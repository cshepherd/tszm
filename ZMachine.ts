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

  constructor(
    private filePath: string,
    private inputOutputDevice: ZMInputOutputDevice | null,
  ) {}

  async load() {
    this.memory = await readFile(this.filePath);
    this.parseHeader(this.memory);

    // init pc to first instruction in high memory + offset from header
    this.pc = this.header?.initialProgramCounter || 0;

    //    this.parseObjectTable(this.memory, this.header?.objectTableAddress || 0);
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

  private parseObjectTable(
    buffer: Buffer,
    objectTableAddress: number,
  ): zMachineObject[] {
    let propertyDefaultSize: number = 31 * 2; // Property Default Table is 31 words
    let objectEntrySize: number = 9; // Each object entry is 9 bytes for version 1-3
    let maxObjects: number = 255; // Max objects for version 1-3
    if (this.header && this.header.version > 3) {
      propertyDefaultSize = 63 * 2; // Property Default Table is 63 words for version 4 and above
      objectEntrySize = 14; // Each object entry is 14 bytes for version 4 and above
      maxObjects = 65535; // Max objects for version 4 and above
    }
    const objects: zMachineObject[] = [];
    console.log("Object table address:", objectTableAddress);
    console.log(
      "Global variables address:",
      this.header?.globalVariablesAddress || 0,
    );
    console.log("Property default size:", propertyDefaultSize);
    console.log("Object entry size:", objectEntrySize);
    let objectCount = 0;
    if (this.header) {
      objectCount =
        (this.header.globalVariablesAddress -
          objectTableAddress -
          propertyDefaultSize) /
        objectEntrySize;
    }
    console.log("Object count:", objectCount);
    if (objectCount > maxObjects) {
      // sanity check
      console.log("Object count exceeds maximum, truncated to", maxObjects);
      objectCount = maxObjects;
    }

    for (let i = 0; i < objectCount; i++) {
      const offset =
        objectTableAddress + propertyDefaultSize + i * objectEntrySize;
      console.log(`Object ${i + 1} offset:`, offset);
      const objBuffer = buffer.slice(offset, offset + objectEntrySize);
      if (this.header && this.header.version < 4) {
        // Version 1-3 object format
        const obj: zMachineObject = {
          id: i + 1,
          attributes: objBuffer.slice(0, 4), // 32 attributes (4 bytes)
          parent: objBuffer.readUInt8(4),
          sibling: objBuffer.readUInt8(5),
          child: objBuffer.readUInt8(6),
          propertyTableAddress: objBuffer.readUInt16BE(7),
        };
        objects.push(obj);
      } else {
        // Version 4+ object format
        const obj: zMachineObject = {
          id: i + 1,
          attributes: objBuffer.slice(0, 6), // 32 attributes (6 bytes)
          parent: objBuffer.readUInt16BE(6),
          sibling: objBuffer.readUInt16BE(8),
          child: objBuffer.readUInt16BE(10),
          propertyTableAddress: objBuffer.readUInt16BE(12),
        };
        objects.push(obj);
      }
    }
    return objects;
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
    return this.memory?.writeUInt16BE(memoryAddress, value);
  }

  getLocalVariableValue(variableNumber: number): any {
    const memLocation = this.currentContext + (variableNumber - 1) * 2;

    return this.memory?.readUInt16BE(memLocation);
  }

  setLocalVariableValue(variableNumber: number, value: number): any {
    const memLocation = this.currentContext + (variableNumber - 1) * 2;

    return this.memory?.writeUInt16BE(memLocation, value);
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
    } = this.decodeInstruction();
    this.advancePC(bytesRead);

    this.executeOpcode(
      category,
      opcodeNumber,
      operands,
      operandTypes,
      storeVariable,
    );
  }

  private executeOpcode(
    category: string,
    opcode: number,
    operands: number[],
    operandTypes: string[],
    storeVariable?: number,
  ) {
    const key = `${category}:${opcode}`;

    // 2OP opcodes
    if (category === "2OP") {
      switch (opcode) {
        case 0:
          console.log("NOP executed");
          return;
        case 13: // store
          this.setVariableValue(operands[0], operands[1]);
          return;
        case 15: // loadw
          console.log("@loadw");
          return;
      }
    }

    // 1OP opcodes
    if (category === "1OP") {
      switch (opcode) {
        case 13: // print_paddr
          const stringAddr = this.getGlobalVariableValue(operands[0]) * 2;
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
          console.log(`storeVariable -> ${storeVariable?.toString(16)}`);
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
          console.log(
            `@call Calling routine at ${calledRoutine} with args ${args}`,
          );

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
        case 1: // call_vs
          calledRoutine = operands[0].toString(16);
          args = operands.slice(1).map((a) => a.toString(16));
          console.log(
            `@call Calling routine at ${calledRoutine} with args ${args}`,
          );
          this.stack.push(this.pc);
          this.pc = operands[0];
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
  } {
    if (!this.memory) {
      throw new Error("Memory not loaded");
    }

    const firstByte = this.memory.readUInt8(this.pc);
    let offset = 1;
    let opcodeNumber: number;
    let operandTypes: string[] = [];
    let category: string;

    // Extended form (0xBE)
    if (firstByte === 0xbe) {
      opcodeNumber = this.memory.readUInt8(this.pc + 1);
      operandTypes = this.parseOperandTypes(this.memory.readUInt8(this.pc + 2));
      offset = 3;
      category = "EXT";
    }
    // Variable form (top 2 bits = 11)
    else if ((firstByte & 0b11000000) === 0b11000000) {
      opcodeNumber = firstByte & 0b00011111;
      category = "VAR";
      // VAR form always reads operand types from the next byte
      operandTypes = this.parseOperandTypes(this.memory.readUInt8(this.pc + 1));
      offset = 2;
    }
    // Short form (top 2 bits = 10)
    else if ((firstByte & 0b11000000) === 0b10000000) {
      opcodeNumber = firstByte & 0b00001111;
      const operandTypeBits = (firstByte & 0b00110000) >> 4;
      if (operandTypeBits !== 0b11) {
        operandTypes = [
          ["LARGE_CONST", "SMALL_CONST", "VARIABLE"][operandTypeBits],
        ];
        category = "1OP";
      } else {
        category = "0OP";
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
    }

    // Fetch operands
    const operands: number[] = [];
    for (const type of operandTypes) {
      if (type === "LARGE_CONST") {
        operands.push(this.memory.readUInt16BE(this.pc + offset));
        offset += 2;
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

    return {
      opcodeNumber,
      operandTypes,
      operands,
      bytesRead: offset,
      category,
      storeVariable,
    };
  }

  private isStoreInstruction(category: string, opcode: number): boolean {
    // List of store instructions by category
    if (category === "VAR") {
      return [0, 1, 7].includes(opcode); // call, call_vs, call_vn2
    }
    if (category === "2OP") {
      return [8, 9, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25].includes(
        opcode,
      ); // or, and, loadw, loadb, etc.
    }
    if (category === "1OP") {
      return [1, 2, 3, 4, 5, 6, 7, 8, 14, 15].includes(opcode); // get_sibling, get_child, get_parent, etc.
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
