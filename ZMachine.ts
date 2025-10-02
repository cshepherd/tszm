// Node-compatible Z-machine file I/O (TypeScript)
import { ZMInputOutputDevice } from "./ZMInputOutputDevice";
import { readFile } from "fs/promises";
import { createInterface } from "readline";

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

type zMachineObject = {
  id: number; // object id
  attributes: Buffer; // object attributes (32 bytes)
  parent: number; // parent object id
  sibling: number; // sibling object id
  child: number; // child object id
  propertyTableAddress: number; // property table address
};

class ZMachine {
  private pc: number = 0; // current program counter
  private fileHandle: any;
  private header: zMachineHeader | null = null;
  private memory: Buffer | null = null;
  private stack: number[] = [];
  private currentContext: number = 0;
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
      serial: buffer.toString("ascii", 18, 24).replace(/\0/g, ""),
      checksum: buffer.readUInt16BE(14),
      initialProgramCounter: buffer.readUInt16BE(6),
      dictionaryAddress: buffer.readUInt16BE(8),
      objectTableAddress: buffer.readUInt16BE(10),
      globalVariablesAddress: buffer.readUInt16BE(12),
      staticMemoryAddress: buffer.readUInt16BE(16),
      dynamicMemoryAddress: buffer.readUInt16BE(18),
      highMemoryAddress: buffer.readUInt16BE(20),
      abbreviationsAddress: buffer.readUInt16BE(24),
      fileLength: buffer.readUInt16BE(26) * 2,
      checksumValid: false,
      alphabetIdentifier: buffer.readUInt16BE(52),
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
    return this.memory?.writeUInt16BE(value, memoryAddress);
  }

  getLocalVariableValue(variableNumber: number): any {
    const memLocation = this.currentContext + 1 + (variableNumber - 1) * 2;

    return this.memory?.readUInt16BE(memLocation);
  }

  setLocalVariableValue(variableNumber: number, value: number): any {
    const memLocation = this.currentContext + 1 + (variableNumber - 1) * 2;

    return this.memory?.writeUInt16BE(value, memLocation);
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
      return this.stack.push(value);
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

  executeInstruction() {
    if (!this.memory) {
      console.error("Memory not loaded");
      return;
    }

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
    this.advancePC(bytesRead);

    this.executeOpcode(
      category,
      opcodeNumber,
      operands,
      operandTypes,
      storeVariable,
      branchOffset,
      branchOnTrue,
    );
  }

  private executeOpcode(
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
              const returnStoreVar = this.stack.pop();
              const returnPC = this.stack.pop();
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
              const returnStoreVar = this.stack.pop();
              const returnPC = this.stack.pop();
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
              const returnStoreVar = this.stack.pop();
              const returnPC = this.stack.pop();
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
        case 13: // store
          this.setVariableValue(operands[0], operands[1]);
          return;
        case 15: // loadw
          if (!this.memory) {
            console.error("Memory not loaded");
            return;
          }
          // loadw array word-index -> (result)
          // Loads word at address (array + 2*word-index)
          const arrayAddress = operands[0];
          const wordIndex = operands[1];
          const wordAddress = arrayAddress + 2 * wordIndex;
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
          const byteIndex = operands[1];
          const byteAddress = byteArrayAddress + byteIndex;
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
              const returnStoreVar = this.stack.pop();
              const returnPC = this.stack.pop();
              if (returnPC !== undefined) {
                this.pc = returnPC;
                if (returnStoreVar !== undefined) {
                  this.setVariableValue(returnStoreVar, returnValue);
                }
              }
            } else {
              // Normal branch: offset is relative to current PC, minus 2
              const newPC = this.pc + branchOffset - 2;
              this.pc = newPC;
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
          // Offset is relative to PC after the instruction (minus 2 per spec)
          const jumpOffset =
            operands[0] > 32767 ? operands[0] - 65536 : operands[0];
          this.pc = this.pc + jumpOffset - 2;
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
          const returnStoreVar = this.stack.pop();
          const returnPC = this.stack.pop();
          if (returnPC !== undefined) {
            this.pc = returnPC;
            if (returnStoreVar !== undefined) {
              this.setVariableValue(returnStoreVar, returnValue);
            }
          }
          return;
        case 1: // rfalse
          const rfalseReturnValue = 0;
          const rfalseReturnStoreVar = this.stack.pop();
          const rfalseReturnPC = this.stack.pop();
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

          let calledRoutine = routineAddress.toString(16);
          let args = operands.slice(1).map((a) => a.toString(16));
          if (this.trace) {
            console.log(
              `@call Calling routine at ${calledRoutine} with args ${args}`,
            );
          }

          // Save return info on stack
          this.stack.push(this.pc);
          if (storeVariable !== undefined) {
            this.stack.push(storeVariable);
          }

          // Set up new routine context
          this.currentContext = routineAddress;
          let newPC = this.currentContext;
          const localVarCount = this.memory.readUInt8(newPC);
          newPC++;

          // In versions 1-4, read initial values for local variables
          // In versions 5+, locals are initialized to 0
          if (this.header.version <= 4) {
            // Skip over the initial values (we'll set them below)
            newPC += localVarCount * 2;
          }

          // Initialize local variables with arguments or default values
          for (let i = 0; i < localVarCount; i++) {
            const localVarAddress = this.currentContext + 1 + i * 2;

            if (i < operands.length - 1) {
              // Use argument value (operands[i+1] since operands[0] is routine address)
              this.memory.writeUInt16BE(operands[i + 1], localVarAddress);
            } else if (this.header.version <= 4) {
              // Keep the initial value already in memory (do nothing)
            } else {
              // Version 5+: initialize to 0
              this.memory.writeUInt16BE(0, localVarAddress);
            }
          }

          this.pc = newPC;
          return;
        case 1: // je (v1-4) / call_vs (v5+)
          if (this.header && this.header.version <= 4) {
            // Version 1-4: je (jump if equal) with multiple operands
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
                const returnStoreVar = this.stack.pop();
                const returnPC = this.stack.pop();
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
          } else {
            // Version 5+: call_vs
            const calledRoutineVs = operands[0].toString(16);
            const argsVs = operands.slice(1).map((a) => a.toString(16));
            console.log(
              `@call Calling routine at ${calledRoutineVs} with args ${argsVs}`,
            );
            this.stack.push(this.pc);
            this.pc = operands[0];
          }
          return;
        case 4: // sread
          const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          rl.question("", () => {
            rl.close();
          });
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
        case 9: // and
          const andResult = operands[0] & operands[1];
          if (storeVariable !== undefined) {
            this.setVariableValue(storeVariable, andResult);
          }
          return;
      }
    }

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
      category = "VAR";
      // VAR form always reads operand types from the next byte
      operandTypes = this.parseOperandTypes(this.memory.readUInt8(this.pc + 1));
      offset = 2;
      if (this.trace) console.log(`  -> Variable form: VAR:${opcodeNumber}`);
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
    const isStoreInstruction = this.isStoreInstruction(category, opcodeNumber);
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

  private isBranchInstruction(category: string, opcode: number): boolean {
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
    if (category === "VAR") {
      // VAR:1 is je (branch) in v1-4, call_vs (store) in v5+
      if (opcode === 1 && this.header && this.header.version <= 4) {
        return true;
      }
      return [17, 19, 20].includes(opcode); // scan_table, check_arg_count, call_vn (v5+)
    }
    return false;
  }

  private isStoreInstruction(category: string, opcode: number): boolean {
    // List of store instructions by category
    if (category === "VAR") {
      // VAR:1 is je (branch) in v1-4, call_vs (store) in v5+
      if (opcode === 1 && this.header && this.header.version <= 4) {
        return false; // je is not a store instruction
      }
      return [0, 1, 7, 8, 9].includes(opcode); // call, call_vs, call_vn2, or, and
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
        if (abbrev1 > -1) {
          if (this.header) {
            abbrev2 = zchar;

            const abbreviationNumber = 32 * abbrev1 + abbrev2;
            const origPC = this.pc;
            this.pc =
              this.memory.readUint16BE(
                this.header?.abbreviationsAddress + abbreviationNumber * 2,
              ) * 2;
            result += this.decodeZSCII(false);
            this.pc = origPC;

            abbrev1 = -1;
            abbrev2 = -1;
            continue;
          }
        }
        if (zchar == 0) {
          result += " ";
        }
        if ([1, 2, 3].includes(zchar)) {
          if (abbreviations) {
            abbrev1 = zchar - 1;
            continue;
          }
        }
        if (zchar >= 6 && zchar <= 31) {
          result += ZSCII_TABLES[currentTable][zchar - 6];
          if (oneShift !== false) {
            currentTable = oneShift;
            oneShift = false;
          }
        } else if (zchar == 4) {
          oneShift = 0;
          currentTable = 1;
        } else if (zchar == 5) {
          oneShift = 0;
          currentTable = 2;
        }
      }
    } while (!isLast);

    return result;
  }
}

export { ZMachine };
