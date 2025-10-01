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
    const handlers = {
      "2OP:0": () => {
        /* nop */
        console.log("NOP executed");
      },
      "2OP:1": () => {
        /* je a b ?(label) */
      },
      "2OP:2": () => {
        /* jl a b ?(label) */
      },
      "2OP:3": () => {
        /* jg a b ?(label) */
      },
      "2OP:4": () => {
        /* dec_chk (variable) value ?(label) */
      },
      "2OP:5": () => {
        /* inc_chk (variable) value ?(label) */
      },
      "2OP:6": () => {
        /* jin obj1 obj2 ?(label) */
      },
      "2OP:7": () => {
        /* test bitmap flags ?(label) */
      },
      "2OP:8": () => {
        /* or a b -> (result) */
      },
      "2OP:9": () => {
        /* and a b -> (result) */
      },
      "2OP:10": () => {
        /* test_attr object attribute ?(label) */
      },
      "2OP:11": () => {
        /* set_attr object attribute */
      },
      "2OP:12": () => {
        /* clear_attr object attribute */
      },
      "2OP:13": () => {
        //        console.log(`@store ${operands[1]} -> ${operands[0]}`);
        this.setVariableValue(operands[0], operands[1]);
      },
      "2OP:14": () => {
        /* insert_obj object destination */
      },
      "2OP:15": () => {
        /* loadw array word-index -> (result) */
        console.log("@loadw");
      },
      "2OP:16": () => {
        /* loadb array byte-index -> (result) */
      },
      "2OP:17": () => {
        /* get_prop object property -> (result) */
      },
      "2OP:18": () => {
        /* get_prop_addr object property -> (result) */
      },
      "2OP:19": () => {
        /* get_next_prop object property -> (result) */
      },
      "2OP:20": () => {
        /* add a b -> (result) */
      },
      "2OP:21": () => {
        /* sub a b -> (result) */
      },
      "2OP:22": () => {
        /* mul a b -> (result) */
      },
      "2OP:23": () => {
        /* div a b -> (result) */
      },
      "2OP:24": () => {
        /* mod a b -> (result) */
      },
      "2OP:25": () => {
        /* call_2s routine arg1 -> (result) */
      },
      "2OP:26": () => {
        /* call_2n routine arg1 */
      },
      "2OP:27": () => {
        /* set_colour foreground background */
      },
      "2OP:28": () => {
        /* throw value stack-frame */
      },

      "1OP:0": () => {
        /* jz value ?(label) */
      },
      "1OP:1": () => {
        /* get_sibling object -> (result) */
      },
      "1OP:2": () => {
        /* get_child object -> (result) */
      },
      "1OP:3": () => {
        /* get_parent object -> (result) */
      },
      "1OP:4": () => {
        /* get_prop_len object property -> (result) */
      },
      "1OP:5": () => {
        /* inc (variable) */
      },
      "1OP:6": () => {
        /* dec (variable) */
      },
      "1OP:7": () => {
        /* print_addr string-address */
      },
      "1OP:8": () => {
        /* call_1s routine -> (result) */
      },
      "1OP:9": () => {
        /* remove_obj object */
      },
      "1OP:10": () => {
        /* print_obj object */
      },
      "1OP:11": () => {
        /* ret (value) */
      },
      "1OP:12": () => {
        /* jump label */
      },
      "1OP:13": () => {
        /* print_paddr packed-address */
        //        console.log(`@print_paddr ${operands[0].toString(16)}`);
        const stringAddr = this.getGlobalVariableValue(operands[0]) * 2;
        const origPC = this.pc;
        this.pc = stringAddr;
        this.print();
        this.pc = origPC;
      },
      "1OP:14": () => {
        /* load (variable) -> (result) */
      },

      "0OP:0": () => {
        /* rtrue */
      },
      "0OP:1": () => {
        /* rfalse */
      },
      "0OP:2": () => {
        /* print */
        this.print();
      },
      "0OP:3": () => {
        /* nop */
      },
      "0OP:4": () => {
        /* save (string) -> (result) */
      },
      "0OP:5": () => {
        /* restore (string) -> (result) */
      },
      "0OP:6": () => {
        /* restart */
      },
      "0OP:7": () => {
        /* quit */
      },
      "0OP:8": () => {
        /* new_line */
      },
      "0OP:9": () => {
        /* show_status */
      },
      "0OP:10": () => {
        /* verify (string) -> (result) */
      },
      "0OP:11": () => {
        /* extended opcode */
      },
      "0OP:12": () => {
        console.log("@show_status");
      },
      "0OP:13": () => {
        /* verify */
      },
      "0OP:15": () => {
        /* piracy */
      },

      "EXTENDED:0": () => {
        /* call_vs2 routine arg1 arg2 -> (result) */
      },
      "EXTENDED:1": () => {
        /* call_vn2 routine arg1 arg2 */
      },
      "EXTENDED:2": () => {
        /* call_vs routine arg1 -> (result) */
      },
      "EXTENDED:3": () => {
        /* call_vn routine arg1 */
      },
      "EXTENDED:4": () => {
        /* tokenise (string) parse-buffer parse-buffer-length -> (result) */
      },
      "EXTENDED:5": () => {
        /* encode_text (string) -> (result) */
      },
      "EXTENDED:6": () => {
        /* copy_table source destination length */
      },
      "EXTENDED:7": () => {
        /* print_unicode (string) */
      },
      "EXTENDED:8": () => {
        /* check_unicode (string) -> (result) */
      },

      "VAR:0": () => {
        /* call / call_vn */
        if (!this.memory) {
          console.error("Memory not loaded");
          return;
        }
        let calledRoutine = operands[0].toString(16);
        let args = operands.slice(1).map((a) => a.toString(16));
        console.log(
          `@call Calling routine at ${calledRoutine} with args ${args}`,
        );
        // push pc already advanced past CALL and arguments
        this.stack.push(this.pc);

        // set current context for variables
        this.currentContext = operands[0];
        let newPC = this.currentContext;
        // write local variables and skip PC past them
        const localVarCount = this.memory.readUInt8(this.currentContext);
        newPC++;
        for (
          let operandIndex = 1;
          operandIndex < operandTypes.length;
          operandIndex++
        ) {
          this.memory.writeUint16BE(
            operands[operandIndex],
            this.currentContext + 1 + 2 * (operandIndex - 1),
          );
          newPC += 2;
        }
      },
      "VAR:1": () => {
        /* call_vs */
        let calledRoutine = operands[0].toString(16);
        let args = operands.slice(1).map((a) => a.toString(16));
        console.log(
          `@call Calling routine at ${calledRoutine} with args ${args}`,
        );
        this.stack.push(this.pc);
        this.pc = operands[0];
      },
      "VAR:2": () => {
        /* storew array word-index value */
      },
      "VAR:3": () => {
        /* storeb array byte-index value */
      },
      "VAR:4": () => {
        /* put_prop object property value */
      },
      "VAR:5": () => {
        /* sread (text-buffer) parse-buffer parse-buffer-length */
        const rl = createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        rl.question("", () => {
          rl.close(); // close the interface when done
        });
      },
      "VAR:6": () => {
        /* print_char char */
      },
      "VAR:7": () => {
        /* print_num number */
      },
      "VAR:8": () => {
        /* random range -> (result) */
      },
      "VAR:9": () => {
        /* push value */
      },
      "VAR:10": () => {
        /* pull (variable) */
      },
      "VAR:11": () => {
        /* call_vn routine ... */
      },
      "VAR:12": () => {
        /* call_vs routine ... -> (result) */
      },
      "VAR:13": () => {
        /* set_font font */
      },
      "VAR:14": () => {
        /* draw_picture picture */
      },
      "VAR:15": () => {
        /* picture_data picture -> (result) */
      },
      "VAR:16": () => {
        /* erase_picture */
      },
      "VAR:17": () => {
        /* set_margins left right */
      },
      "VAR:18": () => {
        /* save_game (string) -> (result) */
      },
      "VAR:19": () => {
        /* restore_game (string) -> (result) */
      },
      "VAR:20": () => {
        /* restart_game */
      },
      "VAR:21": () => {
        /* restore_undo */
      },
      "VAR:22": () => {
        /* print_unicode_char unicode-char */
      },
      "VAR:23": () => {
        /* print_unicode_string unicode-string */
      },
      "VAR:24": () => {
        /* get_wind_prop window property -> (result) */
      },
      "VAR:25": () => {
        /* set_wind_prop window property value */
      },
      "VAR:26": () => {
        /* split_window lines */
      },
      "VAR:27": () => {
        /* set_window window */
      },
      "VAR:28": () => {
        /* erase_window window */
      },
      "VAR:29": () => {
        /* create_window lines attributes -> (result) */
      },
      "VAR:30": () => {
        /* move_window window lines */
      },
      "VAR:31": () => {
        /* window_size window -> (result) */
      },
    };

    if (!this.memory) {
      console.error("Memory not loaded");
      return;
    }

    const { opcodeNumber, operandTypes, operands, bytesRead } =
      this.decodeInstruction();
    this.advancePC(bytesRead);

    const opcodeCategory =
      operandTypes.length === 0
        ? "0OP"
        : operandTypes.length === 1
          ? "1OP"
          : operandTypes.length === 2
            ? "2OP"
            : "VAR";

    const handlerKey = `${opcodeCategory}:${opcodeNumber}`;
    const handler = (handlers as Record<string, () => void>)[handlerKey];
    if (handler) {
      handler();
    } else {
      console.error(`No handler for opcode ${handlerKey}`);
    }
  }

  private decodeInstruction(): {
    opcodeNumber: number;
    operandTypes: string[];
    operands: number[];
    bytesRead: number;
  } {
    if (!this.memory) {
      throw new Error("Memory not loaded");
    }

    const firstByte = this.memory.readUInt8(this.pc);
    let offset = 1;
    let opcodeNumber: number;
    let operandTypes: string[] = [];

    // Extended form (0xBE)
    if (firstByte === 0xbe) {
      opcodeNumber = this.memory.readUInt8(this.pc + 1);
      operandTypes = this.parseOperandTypes(this.memory.readUInt8(this.pc + 2));
      offset = 3;
    }
    // Variable form (top 2 bits = 11)
    else if ((firstByte & 0b11000000) === 0b11000000) {
      opcodeNumber = firstByte & 0b00011111;
      if ((firstByte & 0b00100000) === 0) {
        // VAR with 2OP - operand types encoded in bits 4-5
        operandTypes = [
          (firstByte & 0b01000000) ? "VARIABLE" : "SMALL_CONST",
          (firstByte & 0b00100000) ? "VARIABLE" : "SMALL_CONST",
        ];
      } else {
        // VAR with operand types byte
        operandTypes = this.parseOperandTypes(
          this.memory.readUInt8(this.pc + 1),
        );
        offset = 2;
      }
    }
    // Short form (top 2 bits = 10)
    else if ((firstByte & 0b11000000) === 0b10000000) {
      opcodeNumber = firstByte & 0b00001111;
      const operandTypeBits = (firstByte & 0b00110000) >> 4;
      if (operandTypeBits !== 0b11) {
        operandTypes = [
          ["LARGE_CONST", "SMALL_CONST", "VARIABLE"][operandTypeBits],
        ];
      }
    }
    // Long form (top 2 bits = 00 or 01)
    else {
      opcodeNumber = firstByte & 0b00011111;
      operandTypes = [
        (firstByte & 0b01000000) ? "VARIABLE" : "SMALL_CONST",
        (firstByte & 0b00100000) ? "VARIABLE" : "SMALL_CONST",
      ];
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

    return { opcodeNumber, operandTypes, operands, bytesRead: offset };
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
