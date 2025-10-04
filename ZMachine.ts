// Node-compatible Z-machine file I/O (TypeScript)
import { ZMInputOutputDevice } from "./ZMInputOutputDevice";
import { readFile } from "fs/promises";

type zMachineHeader = {
  version: number; // target z-machine version
  release: number; // release number
  serial: string; // serial number
  checksum: number; // checksum
  initialProgramCounter: number; // initial program counter + high memory base
  dictionaryAddress: number; // dictionary address
  objectTableAddress: number; // object table address
  globalVariablesAddress: number; // global variables address
  staticMemoryAddress: number; // static memory address
  dynamicMemoryAddress: number; // dynamic memory address
  highMemoryAddress: number; // high memory address
  abbreviationsAddress: number; // abbreviations address
  fileLength: number; // file length
  checksumValid: boolean; // checksum valid
  alphabetIdentifier: number; // alphabet identifier
};

class ZMachine {
  private pc: number = 0; // current program counter
  private fileHandle: any;
  private header: zMachineHeader | null = null;
  private memory: Buffer | null = null;
  private stack: number[] = []; // User stack (variable 0)
  private callStack: number[] = []; // Call frame stack (return addresses, store vars)
  private currentContext: number = 0;
  private localVariables: number[] = []; // Current routine's local variables
  private trace: boolean = false; // Enable debug logging

  constructor(
    private filePath: string,
    private inputOutputDevice: ZMInputOutputDevice | null,
  ) {}

  async load() {
    this.memory = await readFile(this.filePath);
    this.parseHeader(this.memory);

    // init pc to first instruction in high memory + offset from header
    this.pc = this.header?.initialProgramCounter || 0;
  }

  private parseHeader(buffer: Buffer) {
    this.header = {
      version: buffer.readUInt8(0),
      release: buffer.readUInt16BE(2),
      serial: buffer.toString("ascii", 0x12, 0x18).replace(/\0/g, ""), // 0x12-0x17
      checksum: buffer.readUInt16BE(0x1c),
      initialProgramCounter: buffer.readUInt16BE(6),
      dictionaryAddress: buffer.readUInt16BE(8),
      objectTableAddress: buffer.readUInt16BE(10),
      globalVariablesAddress: buffer.readUInt16BE(12),
      staticMemoryAddress: buffer.readUInt16BE(0x0e),
      dynamicMemoryAddress: buffer.readUInt16BE(0x04), // High memory base
      highMemoryAddress: buffer.readUInt16BE(0x04), // High memory base (same as dynamic)
      abbreviationsAddress: buffer.readUInt16BE(0x18),
      fileLength: buffer.readUInt16BE(0x1a) * 2,
      checksumValid: false,
      alphabetIdentifier: buffer.readUInt16BE(0x34), // 0x34 for v5+, may not exist in v3
    };
  }

  getGlobalVariableValue(variableNumber: number): any {
    if (!this.header) {
      console.error("Header not loaded");
      return;
    }

    const memoryAddress =
      this.header.globalVariablesAddress + (variableNumber - 16) * 2;
    return this.memory?.readUInt16BE(memoryAddress);
  }

  setGlobalVariableValue(variableNumber: number, value: number): any {
    if (!this.header) {
      console.error("Header not loaded");
      return;
    }

    const memoryAddress =
      this.header.globalVariablesAddress + (variableNumber - 16) * 2;
    // Z-Machine values are 16-bit, mask before writing
    return this.memory?.writeUInt16BE(value & 0xffff, memoryAddress);
  }

  getLocalVariableValue(variableNumber: number): any {
    // Local variables are 1-indexed, array is 0-indexed
    return this.localVariables[variableNumber - 1];
  }

  setLocalVariableValue(variableNumber: number, value: number): any {
    // Local variables are 1-indexed, array is 0-indexed
    // Z-Machine values are 16-bit, so mask to prevent overflow
    this.localVariables[variableNumber - 1] = value & 0xffff;
  }

  getVariableValue(variableNumber: number): any {
    // Variable 0: SP
    if (variableNumber == 0) {
      return this.stack.pop();
    }
    if (variableNumber < 16) {
      return this.getLocalVariableValue(variableNumber);
    }
    // Variable 16-255: Globals
    if (variableNumber >= 16) {
      return this.getGlobalVariableValue(variableNumber);
    }
  }

  setVariableValue(variableNumber: number, value: number): any {
    // Variable 0: SP
    if (variableNumber == 0) {
      // Z-Machine values are 16-bit, mask before pushing to stack
      return this.stack.push(value & 0xffff);
    }
    if (variableNumber < 16) {
      return this.setLocalVariableValue(variableNumber, value);
    }
    // Variable 16-255: Globals
    if (variableNumber >= 16) {
      return this.setGlobalVariableValue(variableNumber, value);
    }
  }

  getHeader() {
    return this.header;
  }

  setTrace(enabled: boolean) {
    this.trace = enabled;
  }

  async close() {
    if (this.fileHandle) {
      await this.fileHandle.close();
    }
  }

  advancePC(offset: number) {
    this.pc += offset;
  }

  print(abbreviations: boolean = true) {
    let fullString = this.decodeZSCII(abbreviations);
    if (this.inputOutputDevice) {
      this.inputOutputDevice.writeString(fullString);
    } else {
      console.log(fullString);
    }
  }

  async executeInstruction() {
    if (!this.memory) {
      console.error("Memory not loaded");
      return;
    }

    const startPC = this.pc;
    const {
      opcodeNumber,
      operandTypes,
      operands,
      bytesRead,
      category,
      storeVariable,
      branchOffset,
      branchOnTrue,
    } = this.decodeInstruction();

    // Trace logging: show PC and instruction bytes
    if (this.trace) {
      let traceOutput = `${startPC.toString(16).padStart(4, "0")}:`;
      for (let i = 0; i < bytesRead; i++) {
        traceOutput += ` ${this.memory
          .readUInt8(startPC + i)
          .toString(16)
          .padStart(2, "0")}`;
      }
      console.log(traceOutput);
    }

    this.advancePC(bytesRead);

    await this.executeOpcode(
      category,
      opcodeNumber,
      operands,
      operandTypes,
      storeVariable,
      branchOffset,
      branchOnTrue,
    );
  }

  private async executeOpcode(
    category: string,
    opcode: number,
    operands: number[],
    operandTypes: string[],
    storeVariable?: number,
    branchOffset?: number,
    branchOnTrue?: boolean,
  ) {
    const key = `${category}:${opcode}`;

    // 2OP opcodes
    if (category === "2OP") {
      switch (opcode) {
        case 0:
          console.log("NOP executed");
          return;
        case 1: // je (jump if equal)
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for je");
            return;
          }
          // Branch if operand[0] equals any of operand[1..n]
          // Note: In 2OP form, je only has 2 operands, but in VAR form it can have more
          const jeTestValue = operands[0];
          let jeCondition = false;
          for (let i = 1; i < operands.length; i++) {
            if (jeTestValue === operands[i]) {
              jeCondition = true;
              break;
            }
          }
          const jeShouldBranch = jeCondition === branchOnTrue;

          if (jeShouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              const returnValue = branchOffset;
              if (this.trace) {
                console.log(
                  `@je branch return ${returnValue}, callStack size=${this.callStack.length}`,
                );
              }
              const frameMarker = this.callStack.pop();
              if (this.trace) {
                console.log(`  Popped frameMarker=${frameMarker}`);
              }

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              if (this.trace) {
                console.log(`  Popped savedLocalCount=${savedLocalCount}`);
              }
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
                if (this.trace) {
                  console.log(`  Popped returnStoreVar=${returnStoreVar}`);
                }
              }
              const returnPC = this.callStack.pop();
              if (this.trace) {
                console.log(`  Popped returnPC=${returnPC?.toString(16)}`);
              }
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              const newPC = this.pc + branchOffset - 2;
              this.pc = newPC;
            }
          }
          return;
        case 4: // dec_chk
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for dec_chk");
            return;
          }
          // Decrement variable (operand 0) and branch if now less than value (operand 1)
          const decValue = this.getVariableValue(operands[0]);
          const newDecValue = (decValue - 1) & 0xffff; // Keep as 16-bit
          this.setVariableValue(operands[0], newDecValue);

          // Convert to signed for comparison
          const signedDecNewValue =
            newDecValue > 32767 ? newDecValue - 65536 : newDecValue;
          const signedDecCompareValue =
            operands[1] > 32767 ? operands[1] - 65536 : operands[1];
          const decCondition = signedDecNewValue < signedDecCompareValue;
          const decShouldBranch = decCondition === branchOnTrue;

          if (decShouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              const returnValue = branchOffset;
              if (this.trace) {
                console.log(
                  `@branch return ${returnValue}, callStack: [${this.callStack
                    .slice(-10)
                    .map((v) => v.toString(16))
                    .join(", ")}]`,
                );
              }
              const frameMarker = this.callStack.pop();

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
              }
              const returnPC = this.callStack.pop();
              if (this.trace) {
                console.log(
                  `@branch Popped: frameMarker=${frameMarker}, savedLocals=${savedLocalCount}, storeVar=${returnStoreVar}, returnPC=${returnPC?.toString(16)}`,
                );
              }
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              const newPC = this.pc + branchOffset - 2;
              this.pc = newPC;
            }
          }
          return;
        case 5: // inc_chk
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for inc_chk");
            return;
          }
          // Increment variable (operand 0) and branch if now greater than value (operand 1)
          const incValue = this.getVariableValue(operands[0]);
          const newIncValue = (incValue + 1) & 0xffff; // Keep as 16-bit
          this.setVariableValue(operands[0], newIncValue);

          // Convert to signed for comparison
          const signedNewValue =
            newIncValue > 32767 ? newIncValue - 65536 : newIncValue;
          const signedCompareValue =
            operands[1] > 32767 ? operands[1] - 65536 : operands[1];
          const condition = signedNewValue > signedCompareValue;
          const shouldBranch = condition === branchOnTrue;

          if (shouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              const returnValue = branchOffset;
              if (this.trace) {
                console.log(
                  `@branch return ${returnValue}, callStack: [${this.callStack
                    .slice(-10)
                    .map((v) => v.toString(16))
                    .join(", ")}]`,
                );
              }
              const frameMarker = this.callStack.pop();

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
              }
              const returnPC = this.callStack.pop();
              if (this.trace) {
                console.log(
                  `@branch Popped: frameMarker=${frameMarker}, savedLocals=${savedLocalCount}, storeVar=${returnStoreVar}, returnPC=${returnPC?.toString(16)}`,
                );
              }
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              const newPC = this.pc + branchOffset - 2;
              this.pc = newPC;
            }
          }
          return;
        case 8: // or
          const orResult2OP = operands[0] | operands[1];
          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, orResult2OP);
          }
          return;
        case 9: // and
          const andResult2OP = operands[0] & operands[1];
          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, andResult2OP);
          }
          return;
        case 10: // test_attr
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for test_attr");
            return;
          }
          if (!this.memory || !this.header) {
            console.error("Memory or header not loaded");
            return;
          }
          // Test if object has attribute set
          const objectId = operands[0];
          const attributeNum = operands[1];

          // Calculate object address
          let propertyDefaultSize = this.header.version <= 3 ? 31 * 2 : 63 * 2;
          let objectEntrySize = this.header.version <= 3 ? 9 : 14;
          const objectAddress =
            this.header.objectTableAddress +
            propertyDefaultSize +
            (objectId - 1) * objectEntrySize;

          // Attributes are stored in the first 4 bytes (v1-3) or 6 bytes (v4+)
          const attrByteCount = this.header.version <= 3 ? 4 : 6;
          const attrByteIndex = Math.floor(attributeNum / 8);
          const attrBitIndex = 7 - (attributeNum % 8); // MSB is attribute 0

          if (attrByteIndex >= attrByteCount) {
            console.error(`Invalid attribute number ${attributeNum}`);
            return;
          }

          const attrByte = this.memory.readUInt8(objectAddress + attrByteIndex);
          const attrCondition = ((attrByte >> attrBitIndex) & 1) === 1;
          const attrShouldBranch = attrCondition === branchOnTrue;

          if (attrShouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              const returnValue = branchOffset;
              const frameMarker = this.callStack.pop();

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
              }
              const returnPC = this.callStack.pop();
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              const newPC = this.pc + branchOffset - 2;
              this.pc = newPC;
            }
          }
          return;
        case 2: // jl (jump if less)
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for jl");
            return;
          }
          // Branch if operand[0] < operand[1] (signed comparison)
          const jlValue1 =
            operands[0] > 32767 ? operands[0] - 65536 : operands[0];
          const jlValue2 =
            operands[1] > 32767 ? operands[1] - 65536 : operands[1];
          const jlCondition = jlValue1 < jlValue2;
          const jlShouldBranch = jlCondition === branchOnTrue;

          if (jlShouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              const returnValue = branchOffset;
              const frameMarker = this.callStack.pop();

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
              }
              const returnPC = this.callStack.pop();
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              const newPC = this.pc + branchOffset - 2;
              this.pc = newPC;
            }
          }
          return;
        case 3: // jg (jump if greater)
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for jg");
            return;
          }
          // Branch if operand[0] > operand[1] (signed comparison)
          const jgValue1 =
            operands[0] > 32767 ? operands[0] - 65536 : operands[0];
          const jgValue2 =
            operands[1] > 32767 ? operands[1] - 65536 : operands[1];
          const jgCondition = jgValue1 > jgValue2;
          const jgShouldBranch = jgCondition === branchOnTrue;

          if (jgShouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              const returnValue = branchOffset;
              const frameMarker = this.callStack.pop();

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
              }
              const returnPC = this.callStack.pop();
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              const newPC = this.pc + branchOffset - 2;
              this.pc = newPC;
            }
          }
          return;
        case 7: // test
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for test");
            return;
          }
          // Test if all bits set in operand[1] are also set in operand[0]
          const testBitmap = operands[0];
          const testFlags = operands[1];
          const testCondition = (testBitmap & testFlags) === testFlags;
          const testShouldBranch = testCondition === branchOnTrue;

          if (testShouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              const returnValue = branchOffset;
              const frameMarker = this.callStack.pop();

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
              }
              const returnPC = this.callStack.pop();
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              this.pc = this.pc + branchOffset - 2;
            }
          }
          return;
        case 6: // jin (jump if child)
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for jin");
            return;
          }
          if (!this.memory || !this.header) {
            console.error("Memory or header not loaded");
            return;
          }
          // Test if obj1 is a direct child of obj2
          const jinObj1 = operands[0];
          const jinObj2 = operands[1];

          // Calculate obj1 address
          const jinPropertyDefaultSize =
            this.header.version <= 3 ? 31 * 2 : 63 * 2;
          const jinObjectEntrySize = this.header.version <= 3 ? 9 : 14;
          const jinObj1Address =
            this.header.objectTableAddress +
            jinPropertyDefaultSize +
            (jinObj1 - 1) * jinObjectEntrySize;

          // Read parent of obj1
          let jinParent: number;
          if (this.header.version <= 3) {
            // Version 1-3: parent is at offset 4 (1 byte)
            jinParent = this.memory.readUInt8(jinObj1Address + 4);
          } else {
            // Version 4+: parent is at offset 6 (2 bytes)
            jinParent = this.memory.readUInt16BE(jinObj1Address + 6);
          }

          const jinCondition = jinParent === jinObj2;
          const jinShouldBranch = jinCondition === branchOnTrue;

          if (jinShouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              const returnValue = branchOffset;
              if (this.trace) {
                console.log(
                  `@branch return ${returnValue}, callStack: [${this.callStack
                    .slice(-10)
                    .map((v) => v.toString(16))
                    .join(", ")}]`,
                );
              }
              const frameMarker = this.callStack.pop();

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
              }
              const returnPC = this.callStack.pop();
              if (this.trace) {
                console.log(
                  `@branch Popped: frameMarker=${frameMarker}, savedLocals=${savedLocalCount}, storeVar=${returnStoreVar}, returnPC=${returnPC?.toString(16)}`,
                );
              }
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              // Normal branch: offset is relative to current PC
              this.pc = this.pc + branchOffset - 2;
            }
          }
          return;
        case 11: // set_attr
          if (!this.memory || !this.header) {
            console.error("Memory or header not loaded");
            return;
          }
          // Set an attribute on an object
          const setAttrObjectId = operands[0];
          const setAttrNum = operands[1];

          // Calculate object address
          const setAttrPropertyDefaultSize =
            this.header.version <= 3 ? 31 * 2 : 63 * 2;
          const setAttrObjectEntrySize = this.header.version <= 3 ? 9 : 14;
          const setAttrObjectAddress =
            this.header.objectTableAddress +
            setAttrPropertyDefaultSize +
            (setAttrObjectId - 1) * setAttrObjectEntrySize;

          // Attributes are stored in the first 4 bytes (v1-3) or 6 bytes (v4+)
          const setAttrByteCount = this.header.version <= 3 ? 4 : 6;
          const setAttrByteIndex = Math.floor(setAttrNum / 8);
          const setAttrBitIndex = 7 - (setAttrNum % 8); // MSB is attribute 0

          if (setAttrByteIndex >= setAttrByteCount) {
            console.error(`Invalid attribute number ${setAttrNum}`);
            return;
          }

          // Read, set bit, write back
          const setAttrByte = this.memory.readUInt8(
            setAttrObjectAddress + setAttrByteIndex,
          );
          const setAttrNewByte = setAttrByte | (1 << setAttrBitIndex);
          this.memory.writeUInt8(
            setAttrNewByte,
            setAttrObjectAddress + setAttrByteIndex,
          );
          return;
        case 12: // clear_attr
          if (!this.memory || !this.header) {
            console.error("Memory or header not loaded");
            return;
          }
          // Clear an attribute on an object
          const clearAttrObjectId = operands[0];
          const clearAttrNum = operands[1];

          // Calculate object address
          const clearAttrPropertyDefaultSize =
            this.header.version <= 3 ? 31 * 2 : 63 * 2;
          const clearAttrObjectEntrySize = this.header.version <= 3 ? 9 : 14;
          const clearAttrObjectAddress =
            this.header.objectTableAddress +
            clearAttrPropertyDefaultSize +
            (clearAttrObjectId - 1) * clearAttrObjectEntrySize;

          // Attributes are stored in the first 4 bytes (v1-3) or 6 bytes (v4+)
          const clearAttrByteCount = this.header.version <= 3 ? 4 : 6;
          const clearAttrByteIndex = Math.floor(clearAttrNum / 8);
          const clearAttrBitIndex = 7 - (clearAttrNum % 8); // MSB is attribute 0

          if (clearAttrByteIndex >= clearAttrByteCount) {
            console.error(`Invalid attribute number ${clearAttrNum}`);
            return;
          }

          // Read, clear bit, write back
          const clearAttrByte = this.memory.readUInt8(
            clearAttrObjectAddress + clearAttrByteIndex,
          );
          const clearAttrNewByte = clearAttrByte & ~(1 << clearAttrBitIndex);
          this.memory.writeUInt8(
            clearAttrNewByte,
            clearAttrObjectAddress + clearAttrByteIndex,
          );
          return;
        case 13: // store
          this.setVariableValue(operands[0], operands[1]);
          return;
        case 14: // insert_obj
          if (!this.memory || !this.header) {
            console.error("Memory or header not loaded");
            return;
          }
          // insert_obj object destination
          // Make object a child of destination (removing it from its current parent)
          const insertObjId = operands[0];
          const destObjId = operands[1];

          // Calculate object entry size based on version
          const insertObjPropertyDefaultSize =
            this.header.version <= 3 ? 31 * 2 : 63 * 2;
          const insertObjObjectEntrySize = this.header.version <= 3 ? 9 : 14;

          // Get addresses for both objects
          const insertObjAddress =
            this.header.objectTableAddress +
            insertObjPropertyDefaultSize +
            (insertObjId - 1) * insertObjObjectEntrySize;
          const destObjAddress =
            this.header.objectTableAddress +
            insertObjPropertyDefaultSize +
            (destObjId - 1) * insertObjObjectEntrySize;

          // First, remove object from its current parent
          if (this.header.version <= 3) {
            // Version 1-3: parent at offset 4, sibling at 5, child at 6 (all 1 byte)
            const oldParent = this.memory.readUInt8(insertObjAddress + 4);

            if (oldParent !== 0) {
              // Remove from old parent's child list
              const oldParentAddress =
                this.header.objectTableAddress +
                insertObjPropertyDefaultSize +
                (oldParent - 1) * insertObjObjectEntrySize;
              const oldParentChild = this.memory.readUInt8(
                oldParentAddress + 6,
              );

              if (oldParentChild === insertObjId) {
                // Object was first child, make parent point to object's sibling
                const objSibling = this.memory.readUInt8(insertObjAddress + 5);
                this.memory.writeUInt8(objSibling, oldParentAddress + 6);
              } else {
                // Find object in sibling chain and remove it
                let currentObj = oldParentChild;
                while (currentObj !== 0) {
                  const currentObjAddress =
                    this.header.objectTableAddress +
                    insertObjPropertyDefaultSize +
                    (currentObj - 1) * insertObjObjectEntrySize;
                  const nextSibling = this.memory.readUInt8(
                    currentObjAddress + 5,
                  );
                  if (nextSibling === insertObjId) {
                    // Found it, link around it
                    const objSibling = this.memory.readUInt8(
                      insertObjAddress + 5,
                    );
                    this.memory.writeUInt8(objSibling, currentObjAddress + 5);
                    break;
                  }
                  currentObj = nextSibling;
                }
              }
            }

            // Now insert object as first child of destination
            const destChild = this.memory.readUInt8(destObjAddress + 6);
            this.memory.writeUInt8(destChild, insertObjAddress + 5); // Object's sibling = dest's old first child
            this.memory.writeUInt8(insertObjId, destObjAddress + 6); // Dest's child = object
            this.memory.writeUInt8(destObjId, insertObjAddress + 4); // Object's parent = dest
          } else {
            // Version 4+: parent at offset 6, sibling at 8, child at 10 (all 2 bytes)
            const oldParent = this.memory.readUInt16BE(insertObjAddress + 6);

            if (oldParent !== 0) {
              // Remove from old parent's child list
              const oldParentAddress =
                this.header.objectTableAddress +
                insertObjPropertyDefaultSize +
                (oldParent - 1) * insertObjObjectEntrySize;
              const oldParentChild = this.memory.readUInt16BE(
                oldParentAddress + 10,
              );

              if (oldParentChild === insertObjId) {
                const objSibling = this.memory.readUInt16BE(
                  insertObjAddress + 8,
                );
                this.memory.writeUInt16BE(objSibling, oldParentAddress + 10);
              } else {
                let currentObj = oldParentChild;
                while (currentObj !== 0) {
                  const currentObjAddress =
                    this.header.objectTableAddress +
                    insertObjPropertyDefaultSize +
                    (currentObj - 1) * insertObjObjectEntrySize;
                  const nextSibling = this.memory.readUInt16BE(
                    currentObjAddress + 8,
                  );
                  if (nextSibling === insertObjId) {
                    const objSibling = this.memory.readUInt16BE(
                      insertObjAddress + 8,
                    );
                    this.memory.writeUInt16BE(
                      objSibling,
                      currentObjAddress + 8,
                    );
                    break;
                  }
                  currentObj = nextSibling;
                }
              }
            }

            // Insert as first child of destination
            const destChild = this.memory.readUInt16BE(destObjAddress + 10);
            this.memory.writeUInt16BE(destChild, insertObjAddress + 8);
            this.memory.writeUInt16BE(insertObjId, destObjAddress + 10);
            this.memory.writeUInt16BE(destObjId, insertObjAddress + 6);
          }
          return;
        case 15: // loadw
          if (!this.memory) {
            console.error("Memory not loaded");
            return;
          }
          // loadw array word-index -> (result)
          // Loads word at address (array + 2*word-index)
          const arrayAddress = operands[0];
          // Word index should be treated as signed 16-bit
          let wordIndex = operands[1];
          if (wordIndex > 32767) {
            wordIndex = wordIndex - 65536;
          }
          const wordAddress = arrayAddress + 2 * wordIndex;

          // Check if address is in valid range
          if (wordAddress < 0 || wordAddress >= this.memory.length - 1) {
            console.error(
              `LOADW: Invalid memory address 0x${wordAddress.toString(16)} ` +
              `(array=0x${arrayAddress.toString(16)}, index=${wordIndex}). ` +
              `Memory size: 0x${this.memory.length.toString(16)}`
            );
            return;
          }

          const value = this.memory.readUInt16BE(wordAddress);
          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, value);
          }
          return;
        case 16: // loadb
          if (!this.memory) {
            console.error("Memory not loaded");
            return;
          }
          // loadb array byte-index -> (result)
          // Loads byte at address (array + byte-index)
          const byteArrayAddress = operands[0];
          // Byte index should be treated as signed 16-bit
          let byteIndex = operands[1];
          if (byteIndex > 32767) {
            byteIndex = byteIndex - 65536;
          }
          const byteAddress = byteArrayAddress + byteIndex;

          // Check if address is in valid range
          if (byteAddress < 0 || byteAddress >= this.memory.length) {
            console.error(
              `LOADB: Invalid memory address 0x${byteAddress.toString(16)} ` +
              `(array=0x${byteArrayAddress.toString(16)}, index=${byteIndex}). ` +
              `Memory size: 0x${this.memory.length.toString(16)}`
            );
            return;
          }

          const byteValue = this.memory.readUInt8(byteAddress);
          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, byteValue);
          }
          return;
        case 17: // get_prop
          if (!this.memory || !this.header) {
            console.error("Memory or header not loaded");
            return;
          }
          // Get a property value from an object
          const getPropObjectId = operands[0];
          const getPropNum = operands[1];

          // Calculate object address
          const getPropPropertyDefaultSize =
            this.header.version <= 3 ? 31 * 2 : 63 * 2;
          const getPropObjectEntrySize = this.header.version <= 3 ? 9 : 14;
          const getPropObjectAddress =
            this.header.objectTableAddress +
            getPropPropertyDefaultSize +
            (getPropObjectId - 1) * getPropObjectEntrySize;

          // Get property table address (last 2 bytes of object entry)
          const getPropPropertyTableAddr = this.memory.readUInt16BE(
            getPropObjectAddress + getPropObjectEntrySize - 2,
          );

          // Skip past the short name (first byte is length in words)
          const getPropNameLength = this.memory.readUInt8(
            getPropPropertyTableAddr,
          );
          let getPropAddr =
            getPropPropertyTableAddr + 1 + getPropNameLength * 2;

          // Search through properties
          let getPropValue = 0;
          let getPropFound = false;

          while (true) {
            const getPropSizeByte = this.memory.readUInt8(getPropAddr);
            if (getPropSizeByte === 0) break; // End of properties

            let getPropCurrentNum: number;
            let getPropDataSize: number;

            if (this.header.version <= 3) {
              // Version 1-3: size byte format is SSSPPPP
              getPropDataSize = (getPropSizeByte >> 5) + 1;
              getPropCurrentNum = getPropSizeByte & 0x1f;
            } else {
              // Version 4+: more complex format
              getPropCurrentNum = getPropSizeByte & 0x3f;
              if (getPropSizeByte & 0x80) {
                // Two-byte size field
                const getPropSecondByte = this.memory.readUInt8(
                  getPropAddr + 1,
                );
                getPropDataSize = getPropSecondByte & 0x3f;
                if (getPropDataSize === 0) getPropDataSize = 64;
                getPropAddr += 2;
              } else {
                // Single byte, bit 6 determines size
                getPropDataSize = getPropSizeByte & 0x40 ? 2 : 1;
                getPropAddr += 1;
              }
            }

            if (this.header.version <= 3) {
              getPropAddr += 1;
            }

            if (getPropCurrentNum === getPropNum) {
              // Found the property
              if (getPropDataSize === 1) {
                getPropValue = this.memory.readUInt8(getPropAddr);
              } else if (getPropDataSize === 2) {
                getPropValue = this.memory.readUInt16BE(getPropAddr);
              } else {
                console.error(
                  `Invalid property size ${getPropDataSize} for get_prop`,
                );
                return;
              }
              getPropFound = true;
              break;
            }

            // Move to next property
            getPropAddr += getPropDataSize;
          }

          if (!getPropFound) {
            // Property not found, return default value from property defaults table
            const getPropDefaultAddr =
              this.header.objectTableAddress + (getPropNum - 1) * 2;
            getPropValue = this.memory.readUInt16BE(getPropDefaultAddr);
          }

          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, getPropValue);
          }
          return;
        case 18: // get_prop_addr
          if (!this.memory || !this.header) {
            console.error("Memory or header not loaded");
            return;
          }
          // Get the address of a property data in an object
          const getPropAddrObjectId = operands[0];
          const getPropAddrNum = operands[1];

          // Calculate object address
          const getPropAddrPropertyDefaultSize =
            this.header.version <= 3 ? 31 * 2 : 63 * 2;
          const getPropAddrObjectEntrySize = this.header.version <= 3 ? 9 : 14;
          const getPropAddrObjectAddress =
            this.header.objectTableAddress +
            getPropAddrPropertyDefaultSize +
            (getPropAddrObjectId - 1) * getPropAddrObjectEntrySize;

          // Get property table address (last 2 bytes of object entry)
          const getPropAddrPropertyTableAddr = this.memory.readUInt16BE(
            getPropAddrObjectAddress + getPropAddrObjectEntrySize - 2,
          );

          // Skip past the short name (first byte is length in words)
          const getPropAddrNameLength = this.memory.readUInt8(
            getPropAddrPropertyTableAddr,
          );
          let getPropAddrAddr =
            getPropAddrPropertyTableAddr + 1 + getPropAddrNameLength * 2;

          // Search through properties
          let getPropAddrResult = 0;

          while (true) {
            const getPropAddrSizeByte = this.memory.readUInt8(getPropAddrAddr);
            if (getPropAddrSizeByte === 0) break; // End of properties

            let getPropAddrCurrentNum: number;
            let getPropAddrDataSize: number;
            let getPropAddrDataAddr: number;

            if (this.header.version <= 3) {
              // Version 1-3: size byte format is SSSPPPP
              getPropAddrDataSize = (getPropAddrSizeByte >> 5) + 1;
              getPropAddrCurrentNum = getPropAddrSizeByte & 0x1f;
              getPropAddrDataAddr = getPropAddrAddr + 1;
            } else {
              // Version 4+: more complex format
              getPropAddrCurrentNum = getPropAddrSizeByte & 0x3f;
              if (getPropAddrSizeByte & 0x80) {
                // Two-byte size field
                const getPropAddrSecondByte = this.memory.readUInt8(
                  getPropAddrAddr + 1,
                );
                getPropAddrDataSize = getPropAddrSecondByte & 0x3f;
                if (getPropAddrDataSize === 0) getPropAddrDataSize = 64;
                getPropAddrDataAddr = getPropAddrAddr + 2;
              } else {
                // Single byte, bit 6 determines size
                getPropAddrDataSize = getPropAddrSizeByte & 0x40 ? 2 : 1;
                getPropAddrDataAddr = getPropAddrAddr + 1;
              }
            }

            if (getPropAddrCurrentNum === getPropAddrNum) {
              // Found the property, return the address of the data
              getPropAddrResult = getPropAddrDataAddr;
              break;
            }

            // Move to next property
            getPropAddrAddr = getPropAddrDataAddr + getPropAddrDataSize;
          }

          // If property not found, return 0
          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, getPropAddrResult);
          }
          return;
        case 19: // put_prop
          if (!this.memory || !this.header) {
            console.error("Memory or header not loaded");
            return;
          }
          // Set a property value on an object
          const putPropObjectId = operands[0];
          const putPropNum = operands[1];
          const putPropValue = operands[2];

          // Calculate object address
          const putPropPropertyDefaultSize =
            this.header.version <= 3 ? 31 * 2 : 63 * 2;
          const putPropObjectEntrySize = this.header.version <= 3 ? 9 : 14;
          const putPropObjectAddress =
            this.header.objectTableAddress +
            putPropPropertyDefaultSize +
            (putPropObjectId - 1) * putPropObjectEntrySize;

          // Get property table address (last 2 bytes of object entry)
          const putPropPropertyTableAddr = this.memory.readUInt16BE(
            putPropObjectAddress + putPropObjectEntrySize - 2,
          );

          // Skip past the short name (first byte is length in words)
          const putPropNameLength = this.memory.readUInt8(
            putPropPropertyTableAddr,
          );
          let putPropAddr =
            putPropPropertyTableAddr + 1 + putPropNameLength * 2;

          // Search through properties to find the one to modify
          while (true) {
            const putPropSizeByte = this.memory.readUInt8(putPropAddr);
            if (putPropSizeByte === 0) {
              console.error(
                `Property ${putPropNum} not found on object ${putPropObjectId}`,
              );
              return;
            }

            let putPropCurrentNum: number;
            let putPropDataSize: number;
            let putPropDataAddr: number;

            if (this.header.version <= 3) {
              // Version 1-3: size byte format is SSSPPPP
              putPropDataSize = (putPropSizeByte >> 5) + 1;
              putPropCurrentNum = putPropSizeByte & 0x1f;
              putPropDataAddr = putPropAddr + 1;
            } else {
              // Version 4+: more complex format
              putPropCurrentNum = putPropSizeByte & 0x3f;
              if (putPropSizeByte & 0x80) {
                // Two-byte size field
                const putPropSecondByte = this.memory.readUInt8(
                  putPropAddr + 1,
                );
                putPropDataSize = putPropSecondByte & 0x3f;
                if (putPropDataSize === 0) putPropDataSize = 64;
                putPropDataAddr = putPropAddr + 2;
              } else {
                // Single byte, bit 6 determines size
                putPropDataSize = putPropSizeByte & 0x40 ? 2 : 1;
                putPropDataAddr = putPropAddr + 1;
              }
            }

            if (putPropCurrentNum === putPropNum) {
              // Found the property, write the value
              if (putPropDataSize === 1) {
                this.memory.writeUInt8(putPropValue & 0xff, putPropDataAddr);
              } else if (putPropDataSize === 2) {
                this.memory.writeUInt16BE(putPropValue, putPropDataAddr);
              } else {
                console.error(
                  `Invalid property size ${putPropDataSize} for put_prop`,
                );
                return;
              }
              return;
            }

            // Move to next property
            putPropAddr = putPropDataAddr + putPropDataSize;
          }
        case 20: // add
          // Signed 16-bit addition
          const addOperand1 =
            operands[0] > 32767 ? operands[0] - 65536 : operands[0];
          const addOperand2 =
            operands[1] > 32767 ? operands[1] - 65536 : operands[1];

          let addResult = addOperand1 + addOperand2;

          // Convert back to unsigned 16-bit
          if (addResult < 0) {
            addResult = addResult + 65536;
          }
          addResult = addResult & 0xffff;

          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, addResult);
          }
          return;
        case 21: // sub
          // Signed 16-bit subtraction
          const subOperand1 =
            operands[0] > 32767 ? operands[0] - 65536 : operands[0];
          const subOperand2 =
            operands[1] > 32767 ? operands[1] - 65536 : operands[1];

          let subResult = subOperand1 - subOperand2;

          // Convert back to unsigned 16-bit
          if (subResult < 0) {
            subResult = subResult + 65536;
          }
          subResult = subResult & 0xffff;

          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, subResult);
          }
          return;
        case 22: // mul
          // Signed 16-bit multiplication
          const mulOperand1 =
            operands[0] > 32767 ? operands[0] - 65536 : operands[0];
          const mulOperand2 =
            operands[1] > 32767 ? operands[1] - 65536 : operands[1];

          let mulResult = mulOperand1 * mulOperand2;

          // Convert back to unsigned 16-bit
          if (mulResult < 0) {
            mulResult = mulResult + 65536;
          }
          mulResult = mulResult & 0xffff;

          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, mulResult);
          }
          return;
        case 23: // div
          // Signed 16-bit division
          const divDividend =
            operands[0] > 32767 ? operands[0] - 65536 : operands[0];
          const divDivisor =
            operands[1] > 32767 ? operands[1] - 65536 : operands[1];

          if (divDivisor === 0) {
            console.error("Division by zero");
            return;
          }

          // Perform signed division and truncate towards zero
          let divResult = Math.trunc(divDividend / divDivisor);

          // Convert back to unsigned 16-bit
          if (divResult < 0) {
            divResult = divResult + 65536;
          }
          divResult = divResult & 0xffff;

          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, divResult);
          }
          return;
        case 24: // mod
          // Signed 16-bit modulo (remainder after division)
          const modDividend =
            operands[0] > 32767 ? operands[0] - 65536 : operands[0];
          const modDivisor =
            operands[1] > 32767 ? operands[1] - 65536 : operands[1];

          if (modDivisor === 0) {
            console.error("Modulo by zero");
            return;
          }

          // Perform signed modulo
          let modResult = modDividend % modDivisor;

          // Convert back to unsigned 16-bit
          if (modResult < 0) {
            modResult = modResult + 65536;
          }
          modResult = modResult & 0xffff;

          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, modResult);
          }
          return;
      }
    }

    // 1OP opcodes
    if (category === "1OP") {
      switch (opcode) {
        case 0: // jz (jump if zero)
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for jz");
            return;
          }
          const testValue = operands[0];
          const condition = testValue === 0;
          const shouldBranch = condition === branchOnTrue;

          if (shouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              // Special values: return false or true
              const returnValue = branchOffset;
              const frameMarker = this.callStack.pop();

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
              }
              const returnPC = this.callStack.pop();
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              // Normal branch: offset is relative to current PC
              this.pc = this.pc + branchOffset - 2;
            }
          }
          return;
        case 1: // get_sibling
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for get_sibling");
            return;
          }
          if (!this.memory || !this.header) {
            console.error("Memory or header not loaded");
            return;
          }
          // Get the sibling of an object
          const getSiblingObjectId = operands[0];

          // Calculate object address
          const getSiblingPropertyDefaultSize =
            this.header.version <= 3 ? 31 * 2 : 63 * 2;
          const getSiblingObjectEntrySize = this.header.version <= 3 ? 9 : 14;
          const getSiblingObjectAddress =
            this.header.objectTableAddress +
            getSiblingPropertyDefaultSize +
            (getSiblingObjectId - 1) * getSiblingObjectEntrySize;

          // Read sibling field
          let getSiblingValue: number;
          if (this.header.version <= 3) {
            // Version 1-3: sibling is at offset 5 (1 byte)
            // Object layout: attrs(4) parent(1) sibling(1) child(1) properties(2)
            getSiblingValue = this.memory.readUInt8(
              getSiblingObjectAddress + 5,
            );
          } else {
            // Version 4+: sibling is at offset 9 (2 bytes)
            getSiblingValue = this.memory.readUInt16BE(
              getSiblingObjectAddress + 9,
            );
          }

          // Store the sibling value
          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, getSiblingValue);
          }

          // Branch if sibling exists (non-zero)
          const getSiblingCondition = getSiblingValue !== 0;
          const getSiblingShouldBranch = getSiblingCondition === branchOnTrue;

          if (getSiblingShouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              const returnValue = branchOffset;
              if (this.trace) {
                console.log(
                  `@branch return ${returnValue}, callStack: [${this.callStack
                    .slice(-10)
                    .map((v) => v.toString(16))
                    .join(", ")}]`,
                );
              }
              const frameMarker = this.callStack.pop();

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
              }
              const returnPC = this.callStack.pop();
              if (this.trace) {
                console.log(
                  `@branch Popped: frameMarker=${frameMarker}, savedLocals=${savedLocalCount}, storeVar=${returnStoreVar}, returnPC=${returnPC?.toString(16)}`,
                );
              }
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              this.pc = this.pc + branchOffset - 2;
            }
          }
          return;
        case 2: // get_child
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for get_child");
            return;
          }
          if (!this.memory || !this.header) {
            console.error("Memory or header not loaded");
            return;
          }
          // Get the first child of an object
          const getChildObjectId = operands[0];

          // Calculate object address
          const getChildPropertyDefaultSize =
            this.header.version <= 3 ? 31 * 2 : 63 * 2;
          const getChildObjectEntrySize = this.header.version <= 3 ? 9 : 14;
          const getChildObjectAddress =
            this.header.objectTableAddress +
            getChildPropertyDefaultSize +
            (getChildObjectId - 1) * getChildObjectEntrySize;

          // Read child field
          let getChildValue: number;
          if (this.header.version <= 3) {
            // Version 1-3: child is at offset 6 (1 byte)
            // Object layout: attrs(4) parent(1) sibling(1) child(1) properties(2)
            getChildValue = this.memory.readUInt8(getChildObjectAddress + 6);
          } else {
            // Version 4+: child is at offset 10 (2 bytes)
            getChildValue = this.memory.readUInt16BE(getChildObjectAddress + 10);
          }

          // Store the child value
          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, getChildValue);
          }

          // Branch if child exists (non-zero)
          const getChildCondition = getChildValue !== 0;
          const getChildShouldBranch = getChildCondition === branchOnTrue;

          if (getChildShouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              const returnValue = branchOffset;
              if (this.trace) {
                console.log(
                  `@branch return ${returnValue}, callStack: [${this.callStack
                    .slice(-10)
                    .map((v) => v.toString(16))
                    .join(", ")}]`,
                );
              }
              const frameMarker = this.callStack.pop();

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
              }
              const returnPC = this.callStack.pop();
              if (this.trace) {
                console.log(
                  `@branch Popped: frameMarker=${frameMarker}, savedLocals=${savedLocalCount}, storeVar=${returnStoreVar}, returnPC=${returnPC?.toString(16)}`,
                );
              }
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              this.pc = this.pc + branchOffset - 2;
            }
          }
          return;
        case 3: // get_parent
          if (!this.memory || !this.header) {
            console.error("Memory or header not loaded");
            return;
          }
          // Get the parent of an object
          const getParentObjectId = operands[0];

          // Calculate object address
          const getParentPropertyDefaultSize =
            this.header.version <= 3 ? 31 * 2 : 63 * 2;
          const getParentObjectEntrySize = this.header.version <= 3 ? 9 : 14;
          const getParentObjectAddress =
            this.header.objectTableAddress +
            getParentPropertyDefaultSize +
            (getParentObjectId - 1) * getParentObjectEntrySize;

          // Read parent field
          let getParentValue: number;
          if (this.header.version <= 3) {
            // Version 1-3: parent is at offset 4 (1 byte)
            getParentValue = this.memory.readUInt8(getParentObjectAddress + 4);
          } else {
            // Version 4+: parent is at offset 6 (2 bytes)
            getParentValue = this.memory.readUInt16BE(
              getParentObjectAddress + 6,
            );
          }

          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, getParentValue);
          }
          return;
        case 4: // get_prop_len
          if (!this.memory || !this.header) {
            console.error("Memory or header not loaded");
            return;
          }
          // Get the length of a property
          // Operand is the address of the property data (NOT the property header)
          const propDataAddr = operands[0];

          if (propDataAddr === 0) {
            // Special case: address 0 means property doesn't exist, return 0
            if (storeVariable !== undefined) {
              this.setVariableValue(storeVariable, 0);
            }
            return;
          }

          // The size byte is immediately before the property data
          const sizeByte = this.memory.readUInt8(propDataAddr - 1);

          let propLen: number;
          if (this.header.version <= 3) {
            // Version 1-3: size byte format is SSSPPPP, where SSS+1 = length
            propLen = (sizeByte >> 5) + 1;
          } else {
            // Version 4+: more complex format
            if (sizeByte & 0x80) {
              // Two-byte size field, second byte contains length
              const secondByte = this.memory.readUInt8(propDataAddr - 2);
              propLen = secondByte & 0x3f;
              if (propLen === 0) propLen = 64;
            } else {
              // Single byte, bit 6 determines size
              propLen = sizeByte & 0x40 ? 2 : 1;
            }
          }

          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, propLen);
          }
          return;
        case 5: // inc (increment variable)
          const varValue = this.getVariableValue(operands[0]);
          this.setVariableValue(operands[0], varValue + 1);
          return;
        case 6: // dec (decrement variable)
          const currentValue = this.getVariableValue(operands[0]);
          this.setVariableValue(operands[0], currentValue - 1);
          return;
        case 10: // print_obj
          if (!this.memory || !this.header) {
            console.error("Memory or header not loaded");
            return;
          }
          // Print the short name of an object
          const printObjId = operands[0];

          // Calculate object address
          const printObjPropertyDefaultSize =
            this.header.version <= 3 ? 31 * 2 : 63 * 2;
          const printObjObjectEntrySize = this.header.version <= 3 ? 9 : 14;
          const printObjObjectAddress =
            this.header.objectTableAddress +
            printObjPropertyDefaultSize +
            (printObjId - 1) * printObjObjectEntrySize;

          // Get property table address (last 2 bytes of object entry)
          const printObjPropertyTableAddr = this.memory.readUInt16BE(
            printObjObjectAddress + printObjObjectEntrySize - 2,
          );

          // The short name is stored at the property table address
          // First byte is the length in words, followed by the text
          const printObjOrigPC = this.pc;
          this.pc = printObjPropertyTableAddr + 1; // Skip the length byte
          this.print();
          this.pc = printObjOrigPC;
          return;
        case 12: // jump
          // Unconditional jump with signed 16-bit offset
          // Offset is relative to PC after the instruction, minus 2 per Z-machine spec
          const jumpOffset =
            operands[0] > 32767 ? operands[0] - 65536 : operands[0];
          this.pc = this.pc + jumpOffset - 2;
          return;
        case 11: // ret
          // Return with specified value
          const retValue = operands[0];
          if (this.trace) {
            console.log(
              `@ret returning ${retValue}, callStack size=${this.callStack.length}`,
            );
          }
          const retFrameMarker = this.callStack.pop();
          if (this.trace) {
            console.log(`  Popped frameMarker=${retFrameMarker}`);
          }

          // Restore saved local variables
          const retLocalCount = this.callStack.pop();
          if (this.trace) {
            console.log(`  Popped savedLocalCount=${retLocalCount}`);
          }
          this.localVariables = [];
          for (let i = 0; i < (retLocalCount || 0); i++) {
            this.localVariables.unshift(this.callStack.pop() || 0);
          }

          let retStoreVar: number | undefined;
          if (retFrameMarker === 1) {
            retStoreVar = this.callStack.pop();
            if (this.trace) {
              console.log(`  Popped returnStoreVar=${retStoreVar}`);
            }
          }
          const retReturnPC = this.callStack.pop();
          if (this.trace) {
            console.log(`  Popped returnPC=${retReturnPC?.toString(16)}`);
          }
          if (retReturnPC !== undefined) {
            this.pc = retReturnPC;
            if (retStoreVar !== undefined) {
              this.setVariableValue(retStoreVar, retValue);
            }
          }
          return;
        case 7: // print_addr
          // Print string at byte address (not packed address)
          const printAddrOrigPC = this.pc;
          this.pc = operands[0];
          this.print();
          this.pc = printAddrOrigPC;
          return;
        case 13: // print_paddr
          const stringAddr = operands[0] * 2;
          const origPC = this.pc;
          this.pc = stringAddr;
          this.print();
          this.pc = origPC;
          return;
      }
    }

    // 0OP opcodes
    if (category === "0OP") {
      switch (opcode) {
        case 0: // rtrue
          const returnValue = 1;
          const frameMarker = this.callStack.pop();
          if (this.trace) {
            console.log(
              `@rtrue frameMarker=${frameMarker}, callStack before pops: [${this.callStack
                .slice(-5)
                .map((v) => v.toString(16))
                .join(", ")}]`,
            );
          }

          // Restore saved local variables
          const savedLocalCount = this.callStack.pop();
          this.localVariables = [];
          for (let i = 0; i < (savedLocalCount || 0); i++) {
            this.localVariables.unshift(this.callStack.pop() || 0);
          }

          let returnStoreVar: number | undefined;
          if (frameMarker === 1) {
            returnStoreVar = this.callStack.pop();
          }
          const returnPC = this.callStack.pop();
          if (this.trace) {
            console.log(
              `@rtrue Popped: frameMarker=${frameMarker}, storeVar=${returnStoreVar}, returnPC=${returnPC?.toString(16)}, restoredLocals=${savedLocalCount}`,
            );
          }
          if (returnPC !== undefined) {
            this.pc = returnPC;
            if (returnStoreVar !== undefined) {
              this.setVariableValue(returnStoreVar, returnValue);
            }
          }
          return;
        case 1: // rfalse
          const rfalseReturnValue = 0;
          const rfalseFrameMarker = this.callStack.pop();

          // Restore saved local variables
          const rfalseLocalCount = this.callStack.pop();
          this.localVariables = [];
          for (let i = 0; i < (rfalseLocalCount || 0); i++) {
            this.localVariables.unshift(this.callStack.pop() || 0);
          }

          let rfalseReturnStoreVar: number | undefined;
          if (rfalseFrameMarker === 1) {
            rfalseReturnStoreVar = this.callStack.pop();
          }
          const rfalseReturnPC = this.callStack.pop();
          if (rfalseReturnPC !== undefined) {
            this.pc = rfalseReturnPC;
            if (rfalseReturnStoreVar !== undefined) {
              this.setVariableValue(rfalseReturnStoreVar, rfalseReturnValue);
            }
          }
          return;
        case 2: // print
          this.print();
          return;
        case 3: // print_ret
          // Print a string followed by newline, then return true
          this.print();
          if (this.inputOutputDevice) {
            this.inputOutputDevice.writeString("\n");
          } else {
            console.log("\n");
          }

          // Return true (1)
          const printRetValue = 1;
          const printRetFrameMarker = this.callStack.pop();

          // Restore saved local variables
          const printRetLocalCount = this.callStack.pop();
          this.localVariables = [];
          for (let i = 0; i < (printRetLocalCount || 0); i++) {
            this.localVariables.unshift(this.callStack.pop() || 0);
          }

          let printRetStoreVar: number | undefined;
          if (printRetFrameMarker === 1) {
            printRetStoreVar = this.callStack.pop();
          }
          const printRetPC = this.callStack.pop();
          if (printRetPC !== undefined) {
            this.pc = printRetPC;
            if (printRetStoreVar !== undefined) {
              this.setVariableValue(printRetStoreVar, printRetValue);
            }
          }
          return;
        case 8: // ret_popped
          // Return with value popped from user stack
          const retPoppedValue = this.stack.pop() || 0;
          const retPoppedFrameMarker = this.callStack.pop();

          // Restore saved local variables
          const retPoppedLocalCount = this.callStack.pop();
          this.localVariables = [];
          for (let i = 0; i < (retPoppedLocalCount || 0); i++) {
            this.localVariables.unshift(this.callStack.pop() || 0);
          }

          let retPoppedStoreVar: number | undefined;
          if (retPoppedFrameMarker === 1) {
            retPoppedStoreVar = this.callStack.pop();
          }
          const retPoppedPC = this.callStack.pop();
          if (retPoppedPC !== undefined) {
            this.pc = retPoppedPC;
            if (retPoppedStoreVar !== undefined) {
              this.setVariableValue(retPoppedStoreVar, retPoppedValue);
            }
          }
          return;
        case 9: // pop
          // Pop and discard top value from user stack
          this.stack.pop();
          return;
        case 10: // quit
          // Signal that the game should quit
          throw new Error("QUIT");
        case 11: // new_line
          if (this.inputOutputDevice) {
            this.inputOutputDevice.writeString("\n");
          } else {
            console.log("\n");
          }
          return;
        case 12: // show_status
          console.log("@show_status");
          return;
      }
    }

    // VAR opcodes
    if (category === "VAR") {
      switch (opcode) {
        case 0: // call / call_vn
          if (!this.memory || !this.header) {
            console.error("Memory or header not loaded");
            return;
          }
          // Unpack routine address based on version
          let routineAddress = operands[0];
          if (this.header.version <= 3) {
            routineAddress *= 2;
          } else if (this.header.version <= 5) {
            routineAddress *= 4;
          } else {
            routineAddress *= 8;
          }

          // Calling address 0 means "return FALSE immediately"
          if (routineAddress === 0) {
            if (this.trace) {
              console.log(`@call routine address 0: returning FALSE`);
            }
            if (storeVariable !== undefined) {
              this.setVariableValue(storeVariable, 0);
            }
            return;
          }

          let calledRoutine = routineAddress.toString(16);
          let args = operands.slice(1).map((a) => a.toString(16));
          if (this.trace) {
            console.log(
              `@call Calling routine at ${calledRoutine} with args ${args}`,
            );
          }

          // Save return info on call stack
          // Format: [return PC] [storeVariable (if exists)] [saved locals] [local count] [frame marker]
          // Frame marker bits: bit 0 = has store variable
          this.callStack.push(this.pc);
          if (storeVariable !== undefined) {
            this.callStack.push(storeVariable);
          }

          // Save current local variables
          const savedLocalCount = this.localVariables.length;
          for (let i = 0; i < savedLocalCount; i++) {
            this.callStack.push(this.localVariables[i]);
          }
          this.callStack.push(savedLocalCount);

          const frameMarker = storeVariable !== undefined ? 1 : 0;
          this.callStack.push(frameMarker);

          if (this.trace) {
            console.log(
              `@call Pushed: returnPC=${this.pc.toString(16)}, storeVar=${storeVariable}, savedLocals=${savedLocalCount}, marker=${frameMarker}`,
            );
          }

          // Set up new routine context
          this.currentContext = routineAddress;
          let newPC = this.currentContext;
          const localVarCount = this.memory.readUInt8(newPC);
          newPC++;

          // Initialize local variables array
          this.localVariables = [];

          // In versions 1-4, read initial values for local variables
          // In versions 5+, locals are initialized to 0
          if (this.header.version <= 4) {
            // Version 1-4: initial values are in the story file
            for (let i = 0; i < localVarCount; i++) {
              const initialValue = this.memory.readUInt16BE(newPC);
              newPC += 2;

              if (i < operands.length - 1) {
                // Use argument value (operands[i+1] since operands[0] is routine address)
                this.localVariables[i] = operands[i + 1];
              } else {
                // Use the initial value from the story file
                this.localVariables[i] = initialValue;
              }
            }
          } else {
            // Version 5+: no initial values in story file, initialize based on arguments
            for (let i = 0; i < localVarCount; i++) {
              if (i < operands.length - 1) {
                this.localVariables[i] = operands[i + 1];
              } else {
                this.localVariables[i] = 0;
              }
            }
          }

          this.pc = newPC;
          return;
        case 1: // storew
          if (!this.memory) {
            console.error("Memory not loaded");
            return;
          }
          // storew array word-index value
          // Stores word at address (array + 2*word-index)
          const storewArrayAddress = operands[0];
          // Word index should be treated as signed 16-bit
          let storewWordIndex = operands[1];
          if (storewWordIndex > 32767) {
            storewWordIndex = storewWordIndex - 65536;
          }
          const storewValue = operands[2];
          const storewAddress = storewArrayAddress + 2 * storewWordIndex;

          // Check if address is in valid range
          if (storewAddress < 0 || storewAddress >= this.memory.length - 1) {
            console.error(
              `STOREW: Invalid memory address 0x${storewAddress.toString(16)} ` +
              `(array=0x${storewArrayAddress.toString(16)}, index=${storewWordIndex}). ` +
              `Memory size: 0x${this.memory.length.toString(16)}`
            );
            return;
          }

          this.memory.writeUInt16BE(storewValue, storewAddress);
          return;
        case 2: // storeb
          if (!this.memory) {
            console.error("Memory not loaded");
            return;
          }
          // storeb array byte-index value
          // Stores byte at address (array + byte-index)
          const storebArrayAddress = operands[0];
          // Byte index should be treated as signed 16-bit
          let storebByteIndex = operands[1];
          if (storebByteIndex > 32767) {
            storebByteIndex = storebByteIndex - 65536;
          }
          const storebValue = operands[2];
          const storebAddress = storebArrayAddress + storebByteIndex;

          // Check if address is in valid range
          if (storebAddress < 0 || storebAddress >= this.memory.length) {
            console.error(
              `STOREB: Invalid memory address 0x${storebAddress.toString(16)} ` +
              `(array=0x${storebArrayAddress.toString(16)}, index=${storebByteIndex}). ` +
              `Memory size: 0x${this.memory.length.toString(16)}`
            );
            return;
          }

          this.memory.writeUInt8(storebValue, storebAddress);
          return;
        case 3: // put_prop
          if (!this.memory || !this.header) {
            console.error("Memory or header not loaded");
            return;
          }
          // Set a property value on an object
          const putPropVarObjectId = operands[0];
          const putPropVarNum = operands[1];
          const putPropVarValue = operands[2];

          // Calculate object address
          const putPropVarPropertyDefaultSize =
            this.header.version <= 3 ? 31 * 2 : 63 * 2;
          const putPropVarObjectEntrySize = this.header.version <= 3 ? 9 : 14;
          const putPropVarObjectAddress =
            this.header.objectTableAddress +
            putPropVarPropertyDefaultSize +
            (putPropVarObjectId - 1) * putPropVarObjectEntrySize;

          // Get property table address (last 2 bytes of object entry)
          const putPropVarPropertyTableAddr = this.memory.readUInt16BE(
            putPropVarObjectAddress + putPropVarObjectEntrySize - 2,
          );

          // Skip past the short name (first byte is length in words)
          const putPropVarNameLength = this.memory.readUInt8(
            putPropVarPropertyTableAddr,
          );
          let putPropVarAddr =
            putPropVarPropertyTableAddr + 1 + putPropVarNameLength * 2;

          // Search through properties to find the one to modify
          while (true) {
            const putPropVarSizeByte = this.memory.readUInt8(putPropVarAddr);
            if (putPropVarSizeByte === 0) {
              console.error(
                `Property ${putPropVarNum} not found on object ${putPropVarObjectId}`,
              );
              return;
            }

            let putPropVarCurrentNum: number;
            let putPropVarDataSize: number;
            let putPropVarDataAddr: number;

            if (this.header.version <= 3) {
              // Version 1-3: size byte format is SSSPPPP
              putPropVarDataSize = (putPropVarSizeByte >> 5) + 1;
              putPropVarCurrentNum = putPropVarSizeByte & 0x1f;
              putPropVarDataAddr = putPropVarAddr + 1;
            } else {
              // Version 4+: more complex format
              putPropVarCurrentNum = putPropVarSizeByte & 0x3f;
              if (putPropVarSizeByte & 0x80) {
                // Two-byte size field
                const putPropVarSecondByte = this.memory.readUInt8(
                  putPropVarAddr + 1,
                );
                putPropVarDataSize = putPropVarSecondByte & 0x3f;
                if (putPropVarDataSize === 0) putPropVarDataSize = 64;
                putPropVarDataAddr = putPropVarAddr + 2;
              } else {
                // Single byte, bit 6 determines size
                putPropVarDataSize = putPropVarSizeByte & 0x40 ? 2 : 1;
                putPropVarDataAddr = putPropVarAddr + 1;
              }
            }

            if (putPropVarCurrentNum === putPropVarNum) {
              // Found the property, write the value
              if (putPropVarDataSize === 1) {
                this.memory.writeUInt8(
                  putPropVarValue & 0xff,
                  putPropVarDataAddr,
                );
              } else if (putPropVarDataSize === 2) {
                this.memory.writeUInt16BE(putPropVarValue, putPropVarDataAddr);
              } else {
                console.error(
                  `Invalid property size ${putPropVarDataSize} for put_prop`,
                );
                return;
              }
              return;
            }

            // Move to next property
            putPropVarAddr = putPropVarDataAddr + putPropVarDataSize;
          }
        case 4: // sread (read text from keyboard)
          if (!this.memory || !this.inputOutputDevice || !this.header) {
            console.error("Memory, input/output device, or header not loaded");
            return;
          }

          // operands[0]: text buffer address
          // operands[1]: parse buffer address (for tokenization)
          const textBufferAddr = operands[0];
          const parseBufferAddr = operands[1];

          // Read input from user
          const input = await this.inputOutputDevice.readLine();

          if (this.trace) {
            console.log(
              `@sread: textBufferAddr=0x${textBufferAddr.toString(16)}, parseBufferAddr=0x${parseBufferAddr.toString(16)}, input="${input}" (${input.length} chars)`,
            );
          }

          // In v3, the text buffer format is:
          // byte 0: max length (read-only, set by game)
          // byte 1: number of characters read (set by interpreter)
          // byte 2+: the actual text characters
          const maxLen = this.memory.readUInt8(textBufferAddr);

          if (this.trace) {
            console.log(`@sread: maxLen=${maxLen}`);
          }

          // Truncate input to max length and convert to lowercase
          const text = input.toLowerCase().slice(0, maxLen);

          if (this.trace) {
            console.log(`@sread: writing length=${text.length} at offset 1`);
          }

          // Write length
          this.memory.writeUInt8(text.length, textBufferAddr + 1);

          // Write characters
          for (let i = 0; i < text.length; i++) {
            this.memory.writeUInt8(text.charCodeAt(i), textBufferAddr + 2 + i);
          }

          if (this.trace) {
            console.log(`@sread: wrote ${text.length} chars: "${text}"`);
            // Show what's in the buffer
            const bufferContents = [];
            for (let i = 0; i < text.length + 3; i++) {
              bufferContents.push(
                this.memory
                  .readUInt8(textBufferAddr + i)
                  .toString(16)
                  .padStart(2, "0"),
              );
            }
            console.log(`@sread: buffer contents: ${bufferContents.join(" ")}`);
          }

          // Null-terminate if there's room
          if (text.length < maxLen) {
            this.memory.writeUInt8(0, textBufferAddr + 2 + text.length);
          }

          // Tokenize the input and write to parse buffer
          // Parse buffer format (v3):
          // byte 0: max number of tokens (read-only, set by game)
          // byte 1: number of tokens found (set by interpreter)
          // byte 2+: token entries (4 bytes each: word addr [2 bytes], length [1 byte], position [1 byte])

          this.tokenize(textBufferAddr, parseBufferAddr);

          return;
        case 5: // print_char
          // Print a ZSCII character
          const zsciiChar = operands[0];
          if (this.inputOutputDevice) {
            this.inputOutputDevice.writeString(String.fromCharCode(zsciiChar));
          } else {
            console.log(String.fromCharCode(zsciiChar));
          }
          return;
        case 6: // print_num
          // Print a signed 16-bit number
          const num = operands[0];
          // Convert to signed 16-bit
          const signedNum = num > 32767 ? num - 65536 : num;
          if (this.inputOutputDevice) {
            this.inputOutputDevice.writeString(signedNum.toString());
          } else {
            console.log(signedNum.toString());
          }
          return;
        case 8: // push
          // Push a value onto the user stack
          this.stack.push(operands[0]);
          return;
        case 9: // pull
          // Pop a value from the user stack and store in variable
          // In v1-4: operand specifies which variable to store to
          // In v5+: uses store variable byte instead
          if (this.trace) {
            console.log(
              `@pull: stack length=${this.stack.length}, target var=${operands[0]}`
            );
          }
          if (this.stack.length === 0) {
            console.error("Stack underflow in pull");
            return;
          }
          const pulledValue = this.stack.pop() || 0;
          if (this.trace) {
            console.log(`@pull: pulled value=${pulledValue}, storing to var ${operands[0]}`);
          }
          // Store the popped value to the specified variable
          this.setVariableValue(operands[0], pulledValue);
          return;
      }
    }

    // VAR_2OP opcodes (2OP in VAR form, 0xC0-0xDF)
    if (category === "VAR_2OP") {
      switch (opcode) {
        case 1: // je (jump if equal with multiple operands)
          // je (jump if equal) with multiple operands
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for je");
            return;
          }
          const jeVarTestValue = operands[0];
          let jeVarCondition = false;
          for (let i = 1; i < operands.length; i++) {
            if (jeVarTestValue === operands[i]) {
              jeVarCondition = true;
              break;
            }
          }
          const jeVarShouldBranch = jeVarCondition === branchOnTrue;

          if (jeVarShouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              const returnValue = branchOffset;
              if (this.trace) {
                console.log(
                  `@je(VAR_2OP) branch return ${returnValue}, callStack len=${this.callStack.length}`,
                );
              }
              const frameMarker = this.callStack.pop();

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
              }
              const returnPC = this.callStack.pop();
              if (this.trace) {
                console.log(
                  `@je(VAR_2OP) Popped: frameMarker=${frameMarker}, savedLocals=${savedLocalCount}, storeVar=${returnStoreVar}, returnPC=${returnPC?.toString(16)}`,
                );
              }
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              const newPC = this.pc + branchOffset - 2;
              this.pc = newPC;
            }
          }
          return;
        case 2: // jl (jump if less)
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for jl");
            return;
          }
          // Branch if operand[0] < operand[1] (signed comparison)
          const jlVarValue1 =
            operands[0] > 32767 ? operands[0] - 65536 : operands[0];
          const jlVarValue2 =
            operands[1] > 32767 ? operands[1] - 65536 : operands[1];
          const jlVarCondition = jlVarValue1 < jlVarValue2;
          const jlVarShouldBranch = jlVarCondition === branchOnTrue;

          if (jlVarShouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              const returnValue = branchOffset;
              const frameMarker = this.callStack.pop();

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
              }
              const returnPC = this.callStack.pop();
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              const newPC = this.pc + branchOffset - 2;
              this.pc = newPC;
            }
          }
          return;
        case 3: // jg (jump if greater)
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for jg");
            return;
          }
          // Branch if operand[0] > operand[1] (signed comparison)
          const jgVarValue1 =
            operands[0] > 32767 ? operands[0] - 65536 : operands[0];
          const jgVarValue2 =
            operands[1] > 32767 ? operands[1] - 65536 : operands[1];
          const jgVarCondition = jgVarValue1 > jgVarValue2;
          const jgVarShouldBranch = jgVarCondition === branchOnTrue;

          if (jgVarShouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              const returnValue = branchOffset;
              const frameMarker = this.callStack.pop();

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
              }
              const returnPC = this.callStack.pop();
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              this.pc = this.pc + branchOffset - 2;
            }
          }
          return;
        case 4: // dec_chk
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for dec_chk");
            return;
          }
          // Decrement variable (operand 0) and branch if now less than value (operand 1)
          const decVarValue = this.getVariableValue(operands[0]);
          const newDecVarValue = (decVarValue - 1) & 0xffff; // Keep as 16-bit
          this.setVariableValue(operands[0], newDecVarValue);

          // Convert to signed for comparison
          const signedDecVarNewValue =
            newDecVarValue > 32767 ? newDecVarValue - 65536 : newDecVarValue;
          const signedDecVarCompareValue =
            operands[1] > 32767 ? operands[1] - 65536 : operands[1];
          const decVarCondition = signedDecVarNewValue < signedDecVarCompareValue;
          const decVarShouldBranch = decVarCondition === branchOnTrue;

          if (decVarShouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              const returnValue = branchOffset;
              const frameMarker = this.callStack.pop();

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
              }
              const returnPC = this.callStack.pop();
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              const newPC = this.pc + branchOffset - 2;
              this.pc = newPC;
            }
          }
          return;
        case 5: // inc_chk
          if (branchOffset === undefined || branchOnTrue === undefined) {
            console.error("Branch information missing for inc_chk");
            return;
          }
          // Increment variable (operand 0) and branch if now greater than value (operand 1)
          const incVarValue = this.getVariableValue(operands[0]);
          const newIncVarValue = (incVarValue + 1) & 0xffff; // Keep as 16-bit
          this.setVariableValue(operands[0], newIncVarValue);

          // Convert to signed for comparison
          const signedIncVarNewValue =
            newIncVarValue > 32767 ? newIncVarValue - 65536 : newIncVarValue;
          const signedIncVarCompareValue =
            operands[1] > 32767 ? operands[1] - 65536 : operands[1];
          const incVarCondition = signedIncVarNewValue > signedIncVarCompareValue;
          const incVarShouldBranch = incVarCondition === branchOnTrue;

          if (incVarShouldBranch) {
            if (branchOffset === 0 || branchOffset === 1) {
              const returnValue = branchOffset;
              const frameMarker = this.callStack.pop();

              // Restore saved local variables
              const savedLocalCount = this.callStack.pop();
              this.localVariables = [];
              for (let i = 0; i < (savedLocalCount || 0); i++) {
                this.localVariables.unshift(this.callStack.pop() || 0);
              }

              let returnStoreVar: number | undefined;
              if (frameMarker === 1) {
                returnStoreVar = this.callStack.pop();
              }
              const returnPC = this.callStack.pop();
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              const newPC = this.pc + branchOffset - 2;
              this.pc = newPC;
            }
          }
          return;
        case 8: // or
          const orResult = operands[0] | operands[1];
          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, orResult);
          }
          return;
        case 9: // and
          const andResult = operands[0] & operands[1];
          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, andResult);
          }
          return;
        case 13: // store
          this.setVariableValue(operands[0], operands[1]);
          return;
      }
    }

    // True VAR opcodes (0xE0-0xFF) - these should already be in the VAR section above
    // The sread, print_char, print_num opcodes belong to true VAR form

    console.error(`No handler for opcode ${key}`);
  }

  private decodeInstruction(): {
    opcodeNumber: number;
    operandTypes: string[];
    operands: number[];
    bytesRead: number;
    category: string;
    storeVariable?: number;
    branchOffset?: number;
    branchOnTrue?: boolean;
  } {
    if (!this.memory) {
      throw new Error("Memory not loaded");
    }

    const firstByte = this.memory.readUInt8(this.pc);
    let offset = 1;
    let opcodeNumber: number;
    let operandTypes: string[] = [];
    let category: string;

    if (this.trace) {
      console.log(
        `Decoding byte at PC=${this.pc.toString(16)}: 0x${firstByte.toString(16)} (0b${firstByte.toString(2).padStart(8, "0")})`,
      );
    }

    // Extended form (0xBE)
    if (firstByte === 0xbe) {
      opcodeNumber = this.memory.readUInt8(this.pc + 1);
      operandTypes = this.parseOperandTypes(this.memory.readUInt8(this.pc + 2));
      offset = 3;
      category = "EXT";
      if (this.trace) console.log(`  -> Extended form: EXT:${opcodeNumber}`);
    }
    // Variable form (top 2 bits = 11)
    else if ((firstByte & 0b11000000) === 0b11000000) {
      opcodeNumber = firstByte & 0b00011111;
      // Distinguish between 2OP in VAR form (0xC0-0xDF) and true VAR form (0xE0-0xFF)
      if (firstByte >= 0xe0 && firstByte <= 0xff) {
        category = "VAR";
        if (this.trace) console.log(`  -> Variable form: VAR:${opcodeNumber}`);
      } else {
        category = "VAR_2OP";
        if (this.trace)
          console.log(`  -> Variable 2OP form: VAR_2OP:${opcodeNumber}`);
      }
      // VAR form always reads operand types from the next byte
      operandTypes = this.parseOperandTypes(this.memory.readUInt8(this.pc + 1));
      offset = 2;
    }
    // Short form (top 2 bits = 10)
    else if ((firstByte & 0b11000000) === 0b10000000) {
      opcodeNumber = firstByte & 0b00001111;
      const operandTypeBits = (firstByte & 0b00110000) >> 4;
      if (this.trace) {
        console.log(
          `  -> Short form: opcode=${opcodeNumber}, operandTypeBits=${operandTypeBits}`,
        );
      }
      if (operandTypeBits !== 0b11) {
        operandTypes = [
          ["LARGE_CONST", "SMALL_CONST", "VARIABLE"][operandTypeBits],
        ];
        category = "1OP";
        if (this.trace) console.log(`  -> 1OP:${opcodeNumber}`);
      } else {
        category = "0OP";
        if (this.trace) console.log(`  -> 0OP:${opcodeNumber}`);
      }
    }
    // Long form (top 2 bits = 00 or 01)
    else {
      opcodeNumber = firstByte & 0b00011111;
      operandTypes = [
        firstByte & 0b01000000 ? "VARIABLE" : "SMALL_CONST",
        firstByte & 0b00100000 ? "VARIABLE" : "SMALL_CONST",
      ];
      category = "2OP";
      if (this.trace) console.log(`  -> Long form: 2OP:${opcodeNumber}`);
    }

    // Fetch operands
    const operands: number[] = [];
    for (const type of operandTypes) {
      if (type === "LARGE_CONST") {
        operands.push(this.memory.readUInt16BE(this.pc + offset));
        offset += 2;
      } else if (type === "VARIABLE") {
        const variableNumber = this.memory.readUInt8(this.pc + offset);
        operands.push(this.getVariableValue(variableNumber));
        offset += 1;
      } else {
        operands.push(this.memory.readUInt8(this.pc + offset));
        offset += 1;
      }
    }

    // Check if this is a store instruction and read the store variable
    let storeVariable: number | undefined;
    const isStoreInstruction = this.isStoreInstruction(
      category,
      opcodeNumber,
      firstByte,
    );
    if (isStoreInstruction) {
      storeVariable = this.memory.readUInt8(this.pc + offset);
      offset += 1;
    }

    // Check if this is a branch instruction and read the branch information
    let branchOffset: number | undefined;
    let branchOnTrue: boolean | undefined;
    const isBranchInstruction = this.isBranchInstruction(
      category,
      opcodeNumber,
      firstByte,
    );
    if (isBranchInstruction) {
      const branchByte = this.memory.readUInt8(this.pc + offset);
      offset += 1;

      // Bit 7: branch on true (1) or false (0)
      branchOnTrue = (branchByte & 0b10000000) !== 0;

      // Bit 6: 1 = 1-byte offset, 0 = 2-byte offset
      if (branchByte & 0b01000000) {
        // 1-byte offset: bits 5-0 contain the offset
        branchOffset = branchByte & 0b00111111;
      } else {
        // 2-byte offset: bits 5-0 of first byte + second byte (14-bit signed)
        const secondByte = this.memory.readUInt8(this.pc + offset);
        offset += 1;
        branchOffset = ((branchByte & 0b00111111) << 8) | secondByte;
        // Sign extend from 14 bits to 32-bit signed integer
        if (branchOffset & 0x2000) {
          branchOffset = branchOffset - 0x4000; // Convert to negative value
        }
      }
    }

    return {
      opcodeNumber,
      operandTypes,
      operands,
      bytesRead: offset,
      category,
      storeVariable,
      branchOffset,
      branchOnTrue,
    };
  }

  private isBranchInstruction(
    category: string,
    opcode: number,
    firstByte: number,
  ): boolean {
    // List of branch instructions by category
    if (category === "1OP") {
      return [0, 1, 2].includes(opcode); // jz, get_sibling, get_child
    }
    if (category === "2OP") {
      return [1, 2, 3, 4, 5, 6, 7, 10].includes(opcode); // je, jl, jg, dec_chk, inc_chk, jin, test, test_attr
    }
    if (category === "0OP") {
      return [5, 6, 13, 15].includes(opcode); // save, restore, verify, piracy
    }
    if (category === "VAR_2OP") {
      // 2OP in VAR form (0xC0-0xDF) - je, jl, jg, dec_chk, inc_chk are branch instructions
      return [1, 2, 3, 4, 5].includes(opcode); // je, jl, jg, dec_chk, inc_chk
    }
    if (category === "VAR") {
      // True VAR form (0xE0-0xFF) - check standard VAR branch instructions
      return [17, 19, 20].includes(opcode); // scan_table, check_arg_count, call_vn (v5+)
    }
    return false;
  }

  private isStoreInstruction(
    category: string,
    opcode: number,
    firstByte: number,
  ): boolean {
    // List of store instructions by category
    if (category === "VAR_2OP") {
      // 2OP in VAR form (0xC0-0xDF) - or and and are store instructions
      return [8, 9].includes(opcode); // or, and
    }
    if (category === "VAR") {
      // True VAR form (0xE0-0xFF) - call (opcode 0) is a store instruction
      return [0].includes(opcode); // call
    }
    if (category === "2OP") {
      return [8, 9, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25].includes(
        opcode,
      ); // or, and, loadw, loadb, etc.
    }
    if (category === "1OP") {
      return [1, 2, 3, 4, 7, 8, 14, 15].includes(opcode); // get_sibling, get_child, get_parent, get_prop_len, call_1s, call_1n, not (v5), call_1n (v5)
      // Note: opcodes 5 (inc) and 6 (dec) are NOT store instructions
    }
    if (category === "0OP") {
      return false; // No 0OP store instructions
    }
    if (category === "EXT") {
      return [0, 1, 2, 3, 4, 9, 10, 19, 29].includes(opcode); // Extended store instructions
    }
    return false;
  }

  private parseOperandTypes(typeByte: number): string[] {
    const types: string[] = [];
    for (let shift = 6; shift >= 0; shift -= 2) {
      const typeBits = (typeByte >> shift) & 0b11;
      if (typeBits === 0b11) break;
      types.push(
        typeBits === 0b00
          ? "LARGE_CONST"
          : typeBits === 0b01
            ? "SMALL_CONST"
            : "VARIABLE",
      );
    }
    return types;
  }

  private tokenize(textBufferAddr: number, parseBufferAddr: number) {
    if (!this.memory || !this.header) return;

    // Read the text from the text buffer
    const textLength = this.memory.readUInt8(textBufferAddr + 1);
    const text = [];
    for (let i = 0; i < textLength; i++) {
      text.push(this.memory.readUInt8(textBufferAddr + 2 + i));
    }

    // Get max number of tokens from parse buffer
    const maxTokens = this.memory.readUInt8(parseBufferAddr);

    // Split input into words (separated by spaces)
    const tokens: { word: number[]; start: number; length: number }[] = [];
    let currentWord: number[] = [];
    let wordStart = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === 32) {
        // Space - end of word
        if (currentWord.length > 0) {
          tokens.push({
            word: currentWord,
            start: wordStart,
            length: currentWord.length,
          });
          currentWord = [];
        }
      } else {
        if (currentWord.length === 0) {
          wordStart = i;
        }
        currentWord.push(char);
      }
    }

    // Add last word if any
    if (currentWord.length > 0) {
      tokens.push({
        word: currentWord,
        start: wordStart,
        length: currentWord.length,
      });
    }

    if (this.trace) {
      console.log(`@tokenize: found ${tokens.length} tokens`);
      for (const token of tokens) {
        const wordStr = String.fromCharCode(...token.word);
        console.log(
          `  token: "${wordStr}" at position ${token.start}, length ${token.length}`,
        );
      }
    }

    // Look up each word in the dictionary
    const dictionaryAddr = this.header.dictionaryAddress;
    const numWordSeparators = this.memory.readUInt8(dictionaryAddr);
    const entryLength = this.memory.readUInt8(
      dictionaryAddr + numWordSeparators + 1,
    );
    const numEntries = this.memory.readUInt16BE(
      dictionaryAddr + numWordSeparators + 2,
    );
    const firstEntryAddr = dictionaryAddr + numWordSeparators + 4;

    if (this.trace) {
      console.log(
        `@tokenize: dictionary at 0x${dictionaryAddr.toString(16)}, ${numEntries} entries, ${entryLength} bytes each`,
      );
      // Show first few dictionary entries
      console.log(`  First 10 dictionary entries:`);
      for (let i = 0; i < Math.min(10, numEntries); i++) {
        const entryAddr = firstEntryAddr + i * entryLength;
        const w1 = this.memory.readUInt16BE(entryAddr);
        const w2 = this.memory.readUInt16BE(entryAddr + 2);
        const w3 = this.memory.readUInt16BE(entryAddr + 4);
        console.log(
          `    [${i}] @0x${entryAddr.toString(16)}: ${w1.toString(16).padStart(4, "0")} ${w2.toString(16).padStart(4, "0")} ${w3.toString(16).padStart(4, "0")}`,
        );
      }
      // Search for "look", "quit", "yes", "y", "no", "n" in dictionary
      for (let i = 0; i < numEntries; i++) {
        const entryAddr = firstEntryAddr + i * entryLength;
        const w1 = this.memory.readUInt16BE(entryAddr);
        const w2 = this.memory.readUInt16BE(entryAddr + 2);
        const w3 = this.memory.readUInt16BE(entryAddr + 4);
        // Decode to see what word this is
        const origPC = this.pc;
        this.pc = entryAddr;
        const decoded = this.decodeZSCII(false);
        this.pc = origPC;
        if (["look", "quit", "yes", "y", "no", "n"].includes(decoded)) {
          console.log(
            `  Found "${decoded}" at entry ${i} @0x${entryAddr.toString(16)}: ${w1.toString(16).padStart(4, "0")} ${w2.toString(16).padStart(4, "0")} ${w3.toString(16).padStart(4, "0")}`,
          );
        }
      }
    }

    // Write number of tokens found
    const actualTokens = Math.min(tokens.length, maxTokens);
    this.memory.writeUInt8(actualTokens, parseBufferAddr + 1);

    // Write each token entry
    for (let i = 0; i < actualTokens; i++) {
      const token = tokens[i];

      // Encode the word to ZSCII (up to 6 characters for v3)
      const encodedWord = this.encodeWord(token.word);

      // Look up in dictionary
      // In v3 dictionaries, only compare the encoded words (not the metadata in unused words)
      // The encoded word ends at the word with the high bit set
      let dictAddr = 0;
      for (let j = 0; j < numEntries; j++) {
        const entryAddr = firstEntryAddr + j * entryLength;
        const entry1 = this.memory.readUInt16BE(entryAddr);
        const entry2 = this.memory.readUInt16BE(entryAddr + 2);
        const entry3 = this.memory.readUInt16BE(entryAddr + 4);

        // In v3, always compare 2 words (dictionary entries are fixed at 2 words)
        if (entry1 === encodedWord[0] && entry2 === encodedWord[1]) {
          dictAddr = entryAddr;
          break;
        }
      }

      if (this.trace && dictAddr > 0) {
        console.log(
          `  found "${String.fromCharCode(...token.word)}" in dictionary at 0x${dictAddr.toString(16)}`,
        );
      } else if (this.trace) {
        console.log(
          `  "${String.fromCharCode(...token.word)}" not found in dictionary`,
        );
      }

      // Write token entry (4 bytes: dict addr [2], length [1], position [1])
      const tokenEntryAddr = parseBufferAddr + 2 + i * 4;
      this.memory.writeUInt16BE(dictAddr, tokenEntryAddr);
      this.memory.writeUInt8(token.length, tokenEntryAddr + 2);
      this.memory.writeUInt8(token.start + 1, tokenEntryAddr + 3); // Position is 1-indexed
    }
  }

  private encodeWord(chars: number[]): [number, number, number] {
    // Encode a word (array of ZSCII chars) into Z-machine format (3 words for v3)
    // Each word holds 3 z-characters (5 bits each)
    const A0 = "abcdefghijklmnopqrstuvwxyz";
    const A1 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const A2 = " \n0123456789.,!?_#'\"/\\-:()";

    const zchars: number[] = [];

    // Process characters until we have 9 z-chars or run out of input
    for (let i = 0; i < chars.length && zchars.length < 9; i++) {
      const char = String.fromCharCode(chars[i]);
      let idx = A0.indexOf(char);
      if (idx >= 0) {
        zchars.push(idx + 6);
      } else {
        idx = A1.indexOf(char);
        if (idx >= 0) {
          zchars.push(4); // Shift to A1
          zchars.push(idx + 6);
        } else {
          idx = A2.indexOf(char);
          if (idx >= 0) {
            zchars.push(5); // Shift to A2
            zchars.push(idx + 6);
          } else {
            // Unknown character - use ZSCII escape
            zchars.push(5);
            zchars.push(6);
            zchars.push((chars[i] >> 5) & 0x1f);
            zchars.push(chars[i] & 0x1f);
          }
        }
      }
    }

    // In v3, dictionary entries are typically 6 z-chars (2 words)
    // Pad to 6 z-characters with 5s
    while (zchars.length < 6) {
      zchars.push(5);
    }

    // Truncate to 6 for v3 (some games use 9 for v4+)
    if (zchars.length > 6) {
      zchars.length = 6;
    }

    if (this.trace) {
      const wordStr = String.fromCharCode(...chars);
      console.log(`  encodeWord("${wordStr}"): zchars=[${zchars.join(",")}]`);
    }

    // Pack into 2 words for v3 (6 z-chars)
    const word1 = (zchars[0] << 10) | (zchars[1] << 5) | zchars[2];
    const word2 = (zchars[3] << 10) | (zchars[4] << 5) | zchars[5];

    // Set high bit on the second word to mark end
    const finalWord2 = word2 | 0x8000;

    if (this.trace) {
      console.log(
        `  encoded as: ${word1.toString(16).padStart(4, "0")} ${finalWord2.toString(16).padStart(4, "0")} 0000`,
      );
    }

    return [word1, finalWord2, 0];
  }

  decodeZSCII(abbreviations: boolean = true): string {
    const A0 = "abcdefghijklmnopqrstuvwxyz";
    const A1 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const A2 = " \n0123456789.,!?_#'\"/\\-:()";
    const ZSCII_TABLES = [A0, A1, A2];

    let result = "";
    let currentTable = 0;
    let oneShift: any = false;
    let isLast = false;
    let abbrev1: number = -1;
    let abbrev2: number = -1;

    if (!this.memory) {
      return result;
    }

    do {
      const wordAddr = this.pc;
      const firstByte = this.memory.readUInt8(this.pc);
      const secondByte = this.memory.readUInt8(this.pc + 1);
      this.advancePC(2);
      const zchars = [
        (firstByte & 0b01111100) >> 2,
        ((firstByte & 0b00000011) << 3) | ((secondByte & 0b11100000) >> 5),
        secondByte & 0b00011111,
      ];

      if (firstByte & 0b10000000) {
        isLast = true;
      }

      for (let zchar of zchars) {
        // Handle ZSCII escape sequence states first (abbrev1 = -2 or -3)
        if (abbrev1 === -2) {
          // Reading top 5 bits of ZSCII code
          abbrev2 = zchar;
          abbrev1 = -3;
          continue;
        }

        if (abbrev1 === -3) {
          // Reading bottom 5 bits of ZSCII code
          const zsciiCode = (abbrev2 << 5) | zchar;
          result += String.fromCharCode(zsciiCode);
          abbrev1 = -1;
          abbrev2 = -1;
          // Restore the alphabet if we were in a shift
          if (oneShift !== false) {
            currentTable = oneShift;
            oneShift = false;
          }
          continue;
        }

        // If we're expecting the second part of an abbreviation
        if (abbrev1 > -1) {
          if (this.header) {
            abbrev2 = zchar;

            const abbreviationNumber = 32 * abbrev1 + abbrev2;
            const abbrevTableAddr =
              this.header.abbreviationsAddress + abbreviationNumber * 2;
            const abbrevTableEntry = this.memory.readUInt16BE(abbrevTableAddr);
            const abbrevStringAddr = abbrevTableEntry * 2;

            if (this.trace) {
              console.log(
                `    Abbreviation ${abbrev1}:${abbrev2} (num=${abbreviationNumber}) abbrevAddr=${this.header.abbreviationsAddress} calc: ${this.header.abbreviationsAddress}+${abbreviationNumber}*2=${abbrevTableAddr} (0x${abbrevTableAddr.toString(16)}) entry=${abbrevTableEntry.toString(16)} stringAddr=${abbrevStringAddr.toString(16)}`,
              );
            }

            const origPC = this.pc;
            this.pc = abbrevStringAddr;

            // Debug: show first few bytes at abbreviation string address
            if (this.trace) {
              const b1 = this.memory.readUInt8(abbrevStringAddr);
              const b2 = this.memory.readUInt8(abbrevStringAddr + 1);
              console.log(
                `    Reading abbrev string from 0x${abbrevStringAddr.toString(16)}: bytes ${b1.toString(16).padStart(2, "0")} ${b2.toString(16).padStart(2, "0")}`,
              );
            }

            const abbrevText = this.decodeZSCII(false);
            if (this.trace) {
              console.log(`    Abbreviation expanded to: "${abbrevText}"`);
            }
            result += abbrevText;
            this.pc = origPC;

            abbrev1 = -1;
            abbrev2 = -1;
            continue;
          }
        }

        // Handle special z-characters
        if (zchar == 0) {
          result += " ";
          continue;
        }

        if ([1, 2, 3].includes(zchar)) {
          if (abbreviations) {
            // Start of abbreviation sequence
            abbrev1 = zchar - 1;
            continue;
          } else {
            // Inside an abbreviation, z-chars 1-3 should not appear
            // Skip them to prevent nested abbreviations
            continue;
          }
        }

        if (zchar == 4) {
          // Shift to A1 (uppercase) for one character
          oneShift = currentTable; // Save current alphabet
          currentTable = 1;
          continue;
        }

        if (zchar == 5) {
          // Shift to A2 (punctuation) for one character
          oneShift = currentTable; // Save current alphabet
          currentTable = 2;
          continue;
        }

        if (zchar == 6 && currentTable == 2) {
          // Special case: z-char 6 in A2 means ZSCII escape
          // Next two z-chars form a 10-bit ZSCII character code
          if (this.trace) {
            console.log(`    Z-char 6 in A2: ZSCII escape sequence starting`);
          }
          abbrev1 = -2; // Special marker for ZSCII escape
          // Note: oneShift will be restored after the ZSCII char is output
          continue;
        }

        if (zchar >= 6 && zchar <= 31) {
          // Regular character
          result += ZSCII_TABLES[currentTable][zchar - 6];
          if (oneShift !== false) {
            currentTable = oneShift;
            oneShift = false;
          }
          continue;
        }
      }
    } while (!isLast);

    return result;
  }
}

export { ZMachine };
