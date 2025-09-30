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
  private globalVariables: Map<number, number> = new Map();
  private stack: number[] = [];

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
      serial: buffer.toString("ascii", 4, 12).replace(/\0/g, ""),
      checksum: buffer.readUInt16BE(14),
      initialProgramCounter: buffer.readUInt16BE(6),
      dictionaryAddress: buffer.readUInt16BE(8),
      objectTableAddress: buffer.readUInt16BE(10),
      globalVariablesAddress: buffer.readUInt16BE(12),
      staticMemoryAddress: buffer.readUInt16BE(16),
      dynamicMemoryAddress: buffer.readUInt16BE(18),
      highMemoryAddress: buffer.readUInt16BE(20),
      abbreviationsAddress: buffer.readUInt16BE(24),
      fileLength: buffer.readUInt16BE(30) * 2,
      checksumValid: false,
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

  getHeader() {
    return this.header;
  }

  async readMemory(address: number, length: number): Promise<Buffer> {
    if (this.memory) {
      // return slice of in-memory buffer
      return this.memory.slice(address, address + length);
    }
    const buffer = Buffer.alloc(length);
    await this.fileHandle.read(buffer, 0, length, address);
    return buffer;
  }

  async writeMemory(address: number, data: Buffer) {
    await this.fileHandle.write(data, 0, data.length, address);
  }

  async close() {
    if (this.fileHandle) {
      await this.fileHandle.close();
    }
  }

  advancePC(offset: number) {
    this.pc += offset;
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
        /* store (variable) value */
      },
      "2OP:14": () => {
        /* insert_obj object destination */
      },
      "2OP:15": () => {
        /* loadw array word-index -> (result) */
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
        /* call_1n routine */
      },
      "1OP:10": () => {
        /* remove_obj object */
      },
      "1OP:11": () => {
        /* print_obj object */
      },
      "1OP:12": () => {
        /* ret (value) */
      },
      "1OP:13": () => {
        /* jump label */
      },
      "1OP:14": () => {
        /* print_paddr packed-address */
      },
      "1OP:15": () => {
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
        let fullString = "";
        let isLast = false;
        while (!isLast) {
          const { result, isLast: last } = this.decodeZSCII();
          fullString += result;
          isLast = last;
        }
        if (this.inputOutputDevice) {
          this.inputOutputDevice.writeString(fullString);
        } else {
          console.log(fullString);
        }
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
        let calledRoutine = operands[0].toString(16);
        let args = operands.slice(1).map((a) => a.toString(16));
        console.log(`@call Calling routine at ${calledRoutine} with args ${args}`);
        this.stack.push(this.pc);
        this.pc = operands[0];
      },
      "VAR:1": () => {
        /* call_vs */
        let calledRoutine = operands[0].toString(16);
        let args = operands.slice(1).map((a) => a.toString(16));
        console.log(`@call Calling routine at ${calledRoutine} with args ${args}`);
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

    console.log(`Executing instruction at PC: ${this.pc.toString(16)}`);
    let opcodeNumber: number | null = null;
    let operandTypes: string[] = [];
    let operandCount: number = 0;
    let opcodeForm: string | null = null;
    let operands: any[] = [];

    // Fetch the first instruction byte synchronously from memory
    if (!this.memory) {
      console.error("Memory not loaded");
      return;
    }
    const firstByte = this.memory.readUInt8(this.pc);

    if (firstByte == 0xbe) {
      // v5+ extended form
      opcodeForm = "EXTENDED";
      // opcode number at pc+1
      opcodeNumber = this.memory.readUInt8(this.pc + 1);
      // operand types at pc+2
      let operandTypesByte = this.memory.readUInt8(this.pc + 2);
      for (let i = 6; i > -1; i -= 2) {
        let typeBits = (operandTypesByte & 0b11000000) >> i;
        if (typeBits == 0b11) {
          break; // no more operands
        } else if (typeBits == 0b01) {
          operandTypes.push("SMALL_CONST");
        } else if (typeBits == 0b10) {
          operandTypes.push("VARIABLE");
        } else {
          operandTypes.push("LARGE_CONST");
        }
        operandTypesByte <<= 2;
      }
    } else {
      let formDiscriminator = (firstByte & 0b11000000) >> 6;
      if (formDiscriminator == 0b11) {
        opcodeForm = "VAR";
        opcodeNumber = firstByte & 0b00011111;
        if ((firstByte & 0b00100000) == 0b0) {
          operandCount = 2;
        } else {
          // operand types byte at pc+1
          let operandTypesByte = this.memory.readUInt8(this.pc + 1);
          for (let i = 6; i > -1; i -= 2) {
            let typeBits = (operandTypesByte & 0b11000000) >> i;
            if (typeBits == 0b11) {
              break; // no more operands
            } else if (typeBits == 0b01) {
              operandTypes.push("SMALL_CONST");
            } else if (typeBits == 0b10) {
              operandTypes.push("VARIABLE");
            } else {
              operandTypes.push("LARGE_CONST");
            }
          }
          operandCount = operandTypes.length;
        }
      } else if (formDiscriminator == 0b10) {
        // short form: always 1OP or 0OP
        opcodeForm = "SHORT";
        opcodeNumber = firstByte & 0b00001111;
        if ((firstByte & 0b00110000) >> 4 == 0b11) {
          operandCount = 0;
        } else {
          operandCount = 1;
          if ((firstByte & 0b00110000) >> 4 == 0b00) {
            operandTypes.push("LARGE_CONST");
          } else if ((firstByte & 0b00110000) >> 4 == 0b01) {
            operandTypes.push("SMALL_CONST");
          } else {
            operandTypes.push("VARIABLE");
          }
        }
      } else {
        // long form: always 2OP
        opcodeForm = "LONG";
        operandCount = 2;
        opcodeNumber = firstByte & 0b00011111;
        if ((firstByte & 0b00100000) == 0b0) {
          operandTypes.push("SMALL_CONST");
        } else {
          operandTypes.push("VARIABLE");
        }
        if ((firstByte & 0b00010000) == 0b0) {
          operandTypes.push("SMALL_CONST");
        } else {
          operandTypes.push("VARIABLE");
        }
      }
    }

    // Fetch operands based on operandTypes
    let offset = 1; // already read first byte
    if (opcodeForm == "EXTENDED") {
      offset += 2; // extended form has 2 extra bytes (opcode + operand types)
    } else if (opcodeForm == "VAR" && operandCount > 2) {
      offset += 1; // var form with more than 2 operands has an extra operand types byte
    } else if (opcodeForm == "SHORT" && operandCount == 0) {
      // no extra bytes
    } else if (opcodeForm == "SHORT" && operandCount == 1) {
      offset += 1; // short form with 1 operand has no extra bytes
    } else if (opcodeForm == "LONG") {
      offset += 0; // long form has no extra bytes
    }

    for (let type of operandTypes) {
      if (type == "SMALL_CONST") {
        const buf = this.memory.slice(this.pc + offset, this.pc + offset + 1);
        offset += 1;
        operands.push(buf.readUInt8(0));
      } else if (type == "VARIABLE") {
        const buf = this.memory.slice(this.pc + offset, this.pc + offset + 1);
        offset += 1;
        let varNum = buf.readUInt8(0);
        operands.push(this.globalVariables.get(varNum) || 0);
      } else if (type == "LARGE_CONST") {
        const buf = this.memory.slice(this.pc + offset, this.pc + offset + 2);
        offset += 2;
        operands.push(buf.readUInt16BE(0));
      }
    }
    this.advancePC(offset);
    console.log(`Opcode form: ${opcodeForm}, Opcode number: ${opcodeNumber}`);
    console.log(`Executed opcode ${opcodeNumber} with operands ${operands}`);

    // dispatch decoded opcode to handler
    if (opcodeForm && opcodeNumber !== null) {
      let handlerKey = `${opcodeForm}:${opcodeNumber}`;
      if (opcodeForm == "SHORT" && opcodeNumber >= 0 && opcodeNumber <= 15) {
        handlerKey = `1OP:${opcodeNumber}`;
      } else if (
        opcodeForm == "LONG" &&
        opcodeNumber >= 0 &&
        opcodeNumber <= 31
      ) {
        handlerKey = `2OP:${opcodeNumber}`;
      }
      const handler = (handlers as Record<string, () => void>)[handlerKey];
      if (handler) {
        handler();
      } else {
        console.error(`No handler for opcode ${handlerKey}`);
      }
    } else {
      console.error("Failed to decode opcode");
    }
  }

  decodeZSCII(): { result: string; isLast: boolean } {
    const A0 = "abcdefghijklmnopqrstuvwxyz";
    const A1 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const A2 = "\n0123456789.,!?_#'\"/\\-:()";
    const ZSCII_TABLES = [A0, A1, A2];

    let result = "";
    let currentTable = 0;
    let shiftLock = false;
    let isLast = false;

    if (!this.memory) {
      return { result, isLast };
    }
    const firstByte = this.memory.readUInt8(this.pc);
    const secondByte = this.memory.readUInt8(this.pc + 1);
    this.advancePC(2);
    const zchars = [
      (firstByte & 0b01111100) >> 2,
      ((firstByte & 0b00000011) << 4) | ((secondByte & 0b11100000) >> 4),
      secondByte & 0b00011111,
    ];

    if (firstByte & 0b10000000) {
      isLast = true;
    }

    for (let zchar of zchars) {
      if (zchar >= 6 && zchar <= 31) {
        result += ZSCII_TABLES[currentTable][zchar - 6];
        if (!shiftLock) {
          currentTable = 0; // revert to A0 after single shift
        }
      } else if (zchar == 0) {
        result += " ";
        if (!shiftLock) {
          currentTable = 0; // revert to A0 after single shift
        }
      } else if (zchar == 1) {
        result += "\n";
        if (!shiftLock) {
          currentTable = 0; // revert to A0 after single shift
        }
      } else if (zchar == 2) {
        currentTable = 1; // shift to A1
        if (!shiftLock) {
          shiftLock = false; // single shift
        }
      } else if (zchar == 3) {
        currentTable = 2; // shift to A2
        if (!shiftLock) {
          shiftLock = false; // single shift
        }
      } else if (zchar == 4) {
        shiftLock = true; // lock shift for next character
      } else if (zchar == 5) {
        currentTable = (currentTable + 1) % 3; // toggle table
        if (!shiftLock) {
          shiftLock = false; // single shift
        }
      }
    }

    return { result, isLast };
  }
}

export { ZMachine };
