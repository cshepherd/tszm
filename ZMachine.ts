// Node-compatible Z-machine file I/O (TypeScript)
import { open } from 'fs/promises';
import { ZMInputOutputDevice } from './ZMInputOutputDevice';
import { buffer } from 'stream/consumers';

type zMachineHeader = {
  version: number;                // target z-machine version
  release: number;                // release number
  serial: string;                 // serial number
  checksum: number;               // checksum
  initialProgramCounter: number;  // initial program counter + high memory base
  dictionaryAddress: number;      // dictionary address
  objectTableAddress: number;     // object table address
  globalVariablesAddress: number; // global variables address
  staticMemoryAddress: number;    // static memory address
  dynamicMemoryAddress: number;   // dynamic memory address
  highMemoryAddress: number;      // high memory address
  abbreviationsAddress: number;   // abbreviations address
  fileLength: number;             // file length
  checksumValid: boolean;         // checksum valid
};

type zMachineObject = {
  id: number;                   // object id
  attributes: Buffer;           // object attributes (32 bytes)
  parent: number;               // parent object id
  sibling: number;              // sibling object id
  child: number;                // child object id
  propertyTableAddress: number; // property table address
};

class ZMachine {
  private pc: number = 0; // current program counter
  private fileHandle: any;
  private header: zMachineHeader | null = null;
  private inputOutputDevice: ZMInputOutputDevice | null = null;
  private globalVariables: Map<number, number> = new Map();

  constructor(private filePath: string) {}

  async load() {
    this.fileHandle = await open(this.filePath, 'r+');
    const buffer = Buffer.alloc(64);
    await this.fileHandle.read(buffer, 0, 64, 0);
    this.parseHeader(buffer);

    // init pc to first instruction in high memory + offset from header
    this.pc = this.header?.initialProgramCounter || 0;
  }

  private parseHeader(buffer: Buffer) {
    this.header = {
      version: buffer.readUInt8(0),
      release: buffer.readUInt16BE(2),
      serial: buffer.toString('ascii', 4, 12).replace(/\0/g, ''),
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

  private parseObjectTable(buffer: Buffer, objectTableAddress: number): zMachineObject[] {
    let propertyDefaultSize: number = 31 * 2; // Property Default Table is 31 words
    let objectEntrySize: number = 9; // Each object entry is 9 bytes for version 1-3
    if (this.header && this.header.version > 3) {
        propertyDefaultSize = 63 * 2; // Property Default Table is 63 words for version 4 and above
        objectEntrySize = 14; // Each object entry is 14 bytes for version 4 and above
    }
    const objects: zMachineObject[] = [];
    const objectCount = (buffer.length - objectTableAddress) / objectEntrySize;

    for (let i = 0; i < objectCount; i++) {
      const offset = objectTableAddress + propertyDefaultSize + (i * objectEntrySize);
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

  fetchNextInstruction(length: number): Promise<Buffer> {
    return this.readMemory(this.pc, length);
  }

  advancePC(offset: number) {
    this.pc += offset;
  }

  executeInstruction() {
    let opcodeNumber: number|null = null;
    let operandTypes: string[] = [];
    let operandCount: number = 0;
    let opcodeForm: string|null = null;
    let operands = [];

    // Fetch the next instruction
    this.fetchNextInstruction(1).then((buffer) => {
      const firstByte = buffer.readUInt8(0);

      if( firstByte == 0xbe) {
        // v5+ extended form
        opcodeForm = 'EXTENDED';
        // fetch / decode opcode number
        this.fetchNextInstruction(1).then((buffer) => {
          opcodeNumber = buffer.readUInt8(0);
        });
        // fetch / decode operand types byte
        this.fetchNextInstruction(1).then((buffer) => {
          let operandTypesByte = buffer.readUInt8(0);
          for(let i=6; i>-1; i-=2) {
            let typeBits = (operandTypesByte & 0b11000000) >> i;
            if(typeBits == 0b11) {
                break; // no more operands
            } else if(typeBits == 0b01) {
                operandTypes.push('SMALL_CONST');
            } else if(typeBits == 0b10) {
                operandTypes.push('VARIABLE');
            } else {
                operandTypes.push('LARGE_CONST');
            }
          }
        });
      } else {
        let formDiscriminator = (firstByte & 0b11000000) >> 6
        if(formDiscriminator == 0b11) {
            opcodeForm = 'VAR';
            opcodeNumber = firstByte & 0b00011111;
            if( (firstByte & 0b00100000) == 0b0 ) {
                operandCount = 2;
            } else {
                // fetch / decode operand types byte
                this.fetchNextInstruction(1).then((buffer) => {
                  let operandTypesByte = buffer.readUInt8(0);
                  for(let i=6; i>-1; i-=2) {
                    let typeBits = (operandTypesByte & 0b11000000) >> i;
                    if(typeBits == 0b11) {
                        break; // no more operands
                    } else if(typeBits == 0b01) {
                        operandTypes.push('SMALL_CONST');
                    } else if(typeBits == 0b10) {
                        operandTypes.push('VARIABLE');
                    } else {
                        operandTypes.push('LARGE_CONST');
                    }
                  }});
                 operandCount = operandTypes.length;
            }
        } else if(formDiscriminator == 0b10) {
            // short form: always 1OP or 0OP
            // operand type LARGE_CONST, SMALL_CONST, VARIABLE, or none
            opcodeForm = 'SHORT';
            opcodeNumber = firstByte & 0b00001111;
            if( (firstByte & 0b00110000) >> 4 == 0b11 ) {
                operandCount = 0;
            } else {
                operandCount = 1;
                if( (firstByte & 0b00110000) >> 4 == 0b00 ) {
                    operandTypes.push('LARGE_CONST');
                } else if( (firstByte & 0b00110000) >> 4 == 0b01 ) {
                    operandTypes.push('SMALL_CONST');
                } else {
                    operandTypes.push('VARIABLE');
                }
            }
        } else {
            // long form: always 2OP
            // operand types SMALL_CONST or VARIABLE
            opcodeForm = 'LONG';
            operandCount = 2;
            opcodeNumber = firstByte & 0b00011111;
            if( (firstByte & 0b00100000) == 0b0 ) {
                operandTypes.push('SMALL_CONST');
            } else {
                operandTypes.push('VARIABLE');
            }
            if( (firstByte & 0b00010000) == 0b0 ) {
                operandTypes.push('SMALL_CONST');
            } else {
                operandTypes.push('VARIABLE');
            }
        }
      }
    }).then(() => {
        // Fetch operands based on operandTypes
        let offset = 1; // already read first byte
        if(opcodeForm == 'EXTENDED') {
            offset += 2; // extended form has 2 extra bytes (opcode + operand types)
        } else if(opcodeForm == 'VAR' && operandCount > 2) {
            offset += 1; // var form with more than 2 operands has an extra operand types byte
        } else if(opcodeForm == 'SHORT' && operandCount == 0) {
            // no extra bytes
        } else if(opcodeForm == 'SHORT' && operandCount == 1) {
            offset += 1; // short form with 1 operand has no extra bytes
        } else if(opcodeForm == 'LONG') {
            offset += 0; // long form has no extra bytes
        }

        let promises = [];
        for(let type of operandTypes) {
            if(type == 'SMALL_CONST') {
                promises.push(this.fetchNextInstruction(1).then(buffer => {
                    offset += 1;
                    return buffer.readUInt8(0);
                }));
            } else if(type == 'VARIABLE') {
                promises.push(this.fetchNextInstruction(1).then(buffer => {
                    offset += 1;
                    let varNum = buffer.readUInt8(0);
                    return this.globalVariables.get(varNum) || 0;
                }));
            } else if(type == 'LARGE_CONST') {
                promises.push(this.fetchNextInstruction(2).then(buffer => {
                    offset += 2;
                    return buffer.readUInt16BE(0);
                }));
            }
        }
        return Promise.all(promises).then(values => {
            operands = values;
            this.advancePC(offset);
            // Here you would execute the opcode with the operands
            console.log(`Executed opcode ${opcodeNumber} with operands ${operands}`);
        });
    });
  }

  decodeZSCII(data: Buffer): string {
    const A0 = 'abcdefghijklmnopqrstuvwxyz';
    const A1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const A2 = '\n0123456789.,!?_#\'"/\\-:()';
    const ZSCII_TABLES = [A0, A1, A2];

    let result = '';
    let currentTable = 0;
    let shiftLock = false;

      this.fetchNextInstruction(2).then((buffer) => {
        const firstByte = buffer.readUInt8(0);
        const secondByte = buffer.readUInt8(1);
        const zchars = [
          (firstByte & 0b11111100) >> 2,
          ((firstByte & 0b00000011) << 4) | ((secondByte & 0b11110000) >> 4),
          secondByte & 0b00001111
        ];

        for (let zchar of zchars) {
          if (zchar >= 6 && zchar <= 31) {
            result += ZSCII_TABLES[currentTable][zchar - 6];
            if (!shiftLock) {
              currentTable = 0; // revert to A0 after single shift
            }
          } else if (zchar == 0) {
            result += ' ';
            if (!shiftLock) {
              currentTable = 0; // revert to A0 after single shift
            }
          } else if (zchar == 1) {
            result += '\n';
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
      });

    return result;
  }
}

export { ZMachine };