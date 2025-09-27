// Node-compatible Z-machine file I/O (TypeScript)
import { open } from 'fs/promises';

type zMachineHeader = {
  version: number; // target z-machine version
  release: number; // release number
  serial: string; // serial number
  checksum: number; // checksum
  pc: number; // initial program counter + high memory base
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

class ZMachine {
  private fileHandle: any;
  private header: zMachineHeader | null = null;

  constructor(private filePath: string) {}

  async load() {
    this.fileHandle = await open(this.filePath, 'r+');
    const buffer = Buffer.alloc(64);
    await this.fileHandle.read(buffer, 0, 64, 0);
    this.parseHeader(buffer);
  }

  private parseHeader(buffer: Buffer) {
    this.header = {
      version: buffer.readUInt8(0),
      release: buffer.readUInt16BE(2),
      serial: buffer.toString('ascii', 4, 12).replace(/\0/g, ''),
      checksum: buffer.readUInt16BE(14),
      pc: buffer.readUInt16BE(6),
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
}

export { ZMachine };