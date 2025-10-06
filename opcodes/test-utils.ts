/**
 * Common test utilities for opcode testing
 */

export class MockVM {
  public memory: number[] = [];
  public pc = 0;
  public fetchByteLog: number[] = [];
  public decodeOperandLog: string[] = [];
  public readOperandTypesLog: number[] = [];

  constructor(memory: number[]) {
    this.memory = memory;
  }

  _fetchByte(): number {
    const byte = this.memory[this.pc++];
    this.fetchByteLog.push(byte);
    return byte;
  }

  _fetchWord(): number {
    const high = this._fetchByte();
    const low = this._fetchByte();
    return (high << 8) | low;
  }

  _decodeOperand(type: string): number {
    this.decodeOperandLog.push(type);
    if (type === "large") {
      return this._fetchWord();
    } else if (type === "small") {
      return this._fetchByte();
    } else if (type === "var") {
      return this._fetchByte();
    }
    return 0;
  }

  _readOperandTypes(): string[] {
    const typeByte = this._fetchByte();
    this.readOperandTypesLog.push(typeByte);
    const types: string[] = [];
    for (let i = 6; i >= 0; i -= 2) {
      const bits = (typeByte >> i) & 0x03;
      if (bits === 0) types.push("large");
      else if (bits === 1) types.push("small");
      else if (bits === 2) types.push("var");
      else types.push("omit");
    }
    return types;
  }

  _readBranchOffset(): { offset: number; branchOnTrue: boolean } {
    const byte1 = this._fetchByte();
    const branchOnTrue = (byte1 & 0x80) !== 0;
    const singleByte = (byte1 & 0x40) !== 0;

    if (singleByte) {
      // Single-byte offset
      const offset = byte1 & 0x3f;
      return { offset, branchOnTrue };
    } else {
      // Two-byte offset
      const byte2 = this._fetchByte();
      const offset = ((byte1 & 0x3f) << 8) | byte2;
      return { offset, branchOnTrue };
    }
  }
}
