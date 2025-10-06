// Node-compatible Z-machine file I/O (TypeScript)
import { ZMInputOutputDevice } from "./ZMInputOutputDevice";
import { readFile } from "fs/promises";
import { decodeNext } from "./opcodes/decode";
import { ExecCtx } from "./opcodes/types";

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

    // Set screen dimensions in header (required by many games)
    if (this.memory && this.header) {
      if (this.header.version >= 4) {
        // v4+: Set screen height at 0x20 and width at 0x21
        this.memory.writeUInt8(24, 0x20); // height in lines (24 is a common terminal height)
        this.memory.writeUInt8(80, 0x21); // width in characters (80 is standard terminal width)
      }
      if (this.header.version >= 5) {
        // v5+: Set screen width and height in units at 0x22-0x25
        this.memory.writeUInt16BE(80, 0x22); // width in units
        this.memory.writeUInt16BE(24, 0x24); // height in units
      }
    }

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

  private returnFromRoutine(returnValue: number): void {
    const frameMarker = this.callStack.pop();

    if (this.trace) {
      console.log(
        `@return value=${returnValue}, frameMarker=${frameMarker}, callStack size=${this.callStack.length}`,
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

    if (returnPC !== undefined) {
      this.pc = returnPC;
      if (returnStoreVar !== undefined) {
        this.setVariableValue(returnStoreVar, returnValue);
      }
    }
  }

  private getPropertyDefaultSize(): number {
    if (!this.header) throw new Error("Header not loaded");
    return this.header.version <= 3 ? 31 * 2 : 63 * 2;
  }

  private getObjectEntrySize(): number {
    if (!this.header) throw new Error("Header not loaded");
    return this.header.version <= 3 ? 9 : 14;
  }

  private getObjectAddress(objectId: number): number {
    if (!this.header) throw new Error("Header not loaded");
    const propertyDefaultSize = this.getPropertyDefaultSize();
    const objectEntrySize = this.getObjectEntrySize();
    return (
      this.header.objectTableAddress +
      propertyDefaultSize +
      (objectId - 1) * objectEntrySize
    );
  }

  print(abbreviations: boolean = true) {
    let fullString = this.decodeZSCII(abbreviations);
    if (this.inputOutputDevice) {
      this.inputOutputDevice.writeString(fullString);
    } else {
      console.log(fullString);
    }
  }

  // --- Helpers used by the decoder ---
  _fetchByte(): number {
    if (!this.memory) throw new Error("Memory not loaded");
    const byte = this.memory.readUInt8(this.pc);
    this.pc++;
    return byte;
  }

  _fetchWord(): number {
    if (!this.memory) throw new Error("Memory not loaded");
    const word = this.memory.readUInt16BE(this.pc);
    this.pc += 2;
    return word;
  }

  _decodeOperand(kind: "large" | "small" | "var"): number {
    if (kind === "large") {
      return this._fetchWord();
    } else if (kind === "small") {
      return this._fetchByte();
    } else {
      // "var" - read variable
      const varNum = this._fetchByte();
      const value = this.getVariableValue(varNum);
      if (value === undefined || value === null || isNaN(value)) {
        console.error(`WARNING: getVariableValue(${varNum}) returned ${value}`);
        return 0;
      }
      return value;
    }
  }

  _readOperandTypes(): ("large" | "small" | "var" | "omit")[] {
    const typeByte = this._fetchByte();
    const types: ("large" | "small" | "var" | "omit")[] = [];
    for (let i = 0; i < 4; i++) {
      const bits = (typeByte >> (6 - i * 2)) & 0b11;
      if (bits === 0b00) types.push("large");
      else if (bits === 0b01) types.push("small");
      else if (bits === 0b10) types.push("var");
      else types.push("omit");
    }
    return types;
  }

  _readBranchOffset(): { offset: number; branchOnTrue: boolean } {
    if (!this.memory) throw new Error("Memory not loaded");
    const firstByte = this._fetchByte();
    const branchOnTrue = (firstByte & 0x80) !== 0;
    const singleByte = (firstByte & 0x40) !== 0;

    let offset: number;
    if (singleByte) {
      // 6-bit offset (0-63)
      offset = firstByte & 0x3f;
    } else {
      // 14-bit offset (signed)
      const secondByte = this._fetchByte();
      offset = ((firstByte & 0x3f) << 8) | secondByte;
      // Sign extend if negative (bit 13 set)
      if (offset & 0x2000) {
        // Convert to proper signed integer: 14-bit negative -> JavaScript negative
        offset = offset - 0x4000;
      }
    }
    return { offset, branchOnTrue };
  }

  /**
   * Execute a single instruction using the new handler-based architecture.
   * This replaces the old executeInstruction() with its giant switch statements.
   */
  async step(): Promise<void> {
    const startPC = this.pc;
    const di = decodeNext(this);
    const bytesRead = this.pc - startPC;

    // Trace logging: show PC and instruction bytes
    if (this.trace) {
      let traceOutput = `${startPC.toString(16).padStart(4, "0")}:`;
      for (let i = 0; i < bytesRead; i++) {
        traceOutput += ` ${this.memory
          ?.readUInt8(startPC + i)
          .toString(16)
          .padStart(2, "0")}`;
      }
      traceOutput += ` [${di.desc.name}`;
      if (di.operands.length > 0) {
        traceOutput += ` ${di.operands.map((o) => o.toString(16)).join(",")}`;
      }
      if (di.storeTarget !== undefined) {
        traceOutput += ` -> var${di.storeTarget}`;
      }
      if (di.branchInfo !== undefined) {
        traceOutput += ` ?branch(${di.branchInfo.branchOnTrue ? "T" : "F"}:${di.branchInfo.offset})`;
      }
      traceOutput += `]`;
      console.log(traceOutput);
    }

    // Bind per-instruction ExecCtx helpers based on decoded plumbing
    const ctx: ExecCtx = {};
    if (di.storeTarget !== undefined) {
      const target = di.storeTarget;
      ctx.store = (v: number) => this._storeVariable(target, v);
      // Also expose legacy bridge for example handlers
      (this as any)._storeResult = (v: number) => this._storeVariable(target, v);
      (this as any)._currentStoreTarget = target;
    } else {
      (this as any)._storeResult = undefined;
      (this as any)._currentStoreTarget = undefined;
    }
    if (di.branchInfo !== undefined) {
      const { offset, branchOnTrue } = di.branchInfo;
      ctx.branch = (cond: boolean) => this._applyBranch(offset, branchOnTrue, cond);
    }

    // Execute
    await di.desc.handler(this as any, di.operands, ctx);
  }

  /**
   * Public API for executing an instruction. Uses the new step() method.
   */
  async executeInstruction(): Promise<void> {
    return this.step();
  }

  // --- Wire these to existing implementation ---
  _storeVariable(varNum: number, value: number): void {
    this.setVariableValue(varNum, value);
  }

  _applyBranch(offset: number, branchOnTrue: boolean, condition: boolean): void {
    const shouldBranch = condition === branchOnTrue;
    if (shouldBranch) {
      if (offset === 0 || offset === 1) {
        // Special values: return false or true
        this.returnFromRoutine(offset);
      } else {
        // Normal branch: offset is relative to current PC (after all instruction bytes)
        this.pc = this.pc + offset - 2;
      }
    }
  }

  private tokenize(textBufferAddr: number, parseBufferAddr: number) {
    if (!this.memory || !this.header) return;

    // Read the text from the text buffer
    // Format differs by version:
    // v1-4: byte 0: max length, byte 1+: text (null-terminated)
    // v5+:  byte 0: max length, byte 1: length, byte 2+: text
    const text = [];
    if (this.header.version <= 4) {
      // v1-4: Read from byte 1 until null terminator
      let i = 0;
      const maxLen = this.memory.readUInt8(textBufferAddr);
      while (i < maxLen) {
        const char = this.memory.readUInt8(textBufferAddr + 1 + i);
        if (char === 0) break;
        text.push(char);
        i++;
      }
    } else {
      // v5+: Read length from byte 1, text from byte 2+
      const textLength = this.memory.readUInt8(textBufferAddr + 1);
      for (let i = 0; i < textLength; i++) {
        text.push(this.memory.readUInt8(textBufferAddr + 2 + i));
      }
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
