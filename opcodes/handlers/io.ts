// Input/output handlers

function toSigned16(n: number): number {
  return n > 32767 ? n - 65536 : n;
}

function encodeWord(vm: any, chars: number[]): [number, number, number] {
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

  if (vm.trace) {
    const wordStr = String.fromCharCode(...chars);
    console.log(`  encodeWord("${wordStr}"): zchars=[${zchars.join(",")}]`);
  }

  // Pack into 2 words for v3 (6 z-chars)
  const word1 = (zchars[0] << 10) | (zchars[1] << 5) | zchars[2];
  const word2 = (zchars[3] << 10) | (zchars[4] << 5) | zchars[5];

  // Set high bit on the second word to mark end
  const finalWord2 = word2 | 0x8000;

  if (vm.trace) {
    console.log(
      `  encoded as: ${word1.toString(16).padStart(4, "0")} ${finalWord2.toString(16).padStart(4, "0")} 0000`,
    );
  }

  return [word1, finalWord2, 0];
}

function tokenize(vm: any, textBufferAddr: number, parseBufferAddr: number) {
  if (!vm.memory || !vm.header) return;

  // Read the text from the text buffer
  // Format differs by version:
  // v1-4: byte 0: max length, byte 1+: text (null-terminated)
  // v5+:  byte 0: max length, byte 1: length, byte 2+: text
  const text = [];
  if (vm.header.version <= 4) {
    // v1-4: Read from byte 1 until null terminator
    let i = 0;
    const maxLen = vm.memory.readUInt8(textBufferAddr);
    while (i < maxLen) {
      const char = vm.memory.readUInt8(textBufferAddr + 1 + i);
      if (char === 0) break;
      text.push(char);
      i++;
    }
  } else {
    // v5+: Read length from byte 1, text from byte 2+
    const textLength = vm.memory.readUInt8(textBufferAddr + 1);
    for (let i = 0; i < textLength; i++) {
      text.push(vm.memory.readUInt8(textBufferAddr + 2 + i));
    }
  }

  // Get max number of tokens from parse buffer
  const maxTokens = vm.memory.readUInt8(parseBufferAddr);

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

  if (vm.trace) {
    console.log(`@tokenize: found ${tokens.length} tokens`);
    for (const token of tokens) {
      const wordStr = String.fromCharCode(...token.word);
      console.log(
        `  token: "${wordStr}" at position ${token.start}, length ${token.length}`,
      );
    }
  }

  // Look up each word in the dictionary
  const dictionaryAddr = vm.header.dictionaryAddress;
  const numWordSeparators = vm.memory.readUInt8(dictionaryAddr);
  const entryLength = vm.memory.readUInt8(
    dictionaryAddr + numWordSeparators + 1,
  );
  const numEntries = vm.memory.readUInt16BE(
    dictionaryAddr + numWordSeparators + 2,
  );
  const firstEntryAddr = dictionaryAddr + numWordSeparators + 4;

  if (vm.trace) {
    console.log(
      `@tokenize: dictionary at 0x${dictionaryAddr.toString(16)}, ${numEntries} entries, ${entryLength} bytes each`,
    );
    // Show first few dictionary entries
    console.log(`  First 10 dictionary entries:`);
    for (let i = 0; i < Math.min(10, numEntries); i++) {
      const entryAddr = firstEntryAddr + i * entryLength;
      const w1 = vm.memory.readUInt16BE(entryAddr);
      const w2 = vm.memory.readUInt16BE(entryAddr + 2);
      const w3 = vm.memory.readUInt16BE(entryAddr + 4);
      console.log(
        `    [${i}] @0x${entryAddr.toString(16)}: ${w1.toString(16).padStart(4, "0")} ${w2.toString(16).padStart(4, "0")} ${w3.toString(16).padStart(4, "0")}`,
      );
    }
    // Search for "look", "quit", "yes", "y", "no", "n" in dictionary
    for (let i = 0; i < numEntries; i++) {
      const entryAddr = firstEntryAddr + i * entryLength;
      const w1 = vm.memory.readUInt16BE(entryAddr);
      const w2 = vm.memory.readUInt16BE(entryAddr + 2);
      const w3 = vm.memory.readUInt16BE(entryAddr + 4);
      // Decode to see what word this is
      const origPC = vm.pc;
      vm.pc = entryAddr;
      const decoded = vm.decodeZSCII(false);
      vm.pc = origPC;
      if (["look", "quit", "yes", "y", "no", "n"].includes(decoded)) {
        console.log(
          `  Found "${decoded}" at entry ${i} @0x${entryAddr.toString(16)}: ${w1.toString(16).padStart(4, "0")} ${w2.toString(16).padStart(4, "0")} ${w3.toString(16).padStart(4, "0")}`,
        );
      }
    }
  }

  // Write number of tokens found
  const actualTokens = Math.min(tokens.length, maxTokens);
  vm.memory.writeUInt8(actualTokens, parseBufferAddr + 1);

  // Write each token entry
  for (let i = 0; i < actualTokens; i++) {
    const token = tokens[i];

    // Encode the word to ZSCII (up to 6 characters for v3)
    const encodedWord = encodeWord(vm, token.word);

    // Look up in dictionary
    // In v3 dictionaries, only compare the encoded words (not the metadata in unused words)
    // The encoded word ends at the word with the high bit set
    let dictAddr = 0;
    for (let j = 0; j < numEntries; j++) {
      const entryAddr = firstEntryAddr + j * entryLength;
      const entry1 = vm.memory.readUInt16BE(entryAddr);
      const entry2 = vm.memory.readUInt16BE(entryAddr + 2);

      // In v3, always compare 2 words (dictionary entries are fixed at 2 words)
      if (entry1 === encodedWord[0] && entry2 === encodedWord[1]) {
        dictAddr = entryAddr;
        break;
      }
    }

    if (vm.trace && dictAddr > 0) {
      console.log(
        `  found "${String.fromCharCode(...token.word)}" in dictionary at 0x${dictAddr.toString(16)}`,
      );
    } else if (vm.trace) {
      console.log(
        `  "${String.fromCharCode(...token.word)}" not found in dictionary`,
      );
    }

    // Write token entry (4 bytes: dict addr [2], length [1], position [1])
    const tokenEntryAddr = parseBufferAddr + 2 + i * 4;
    vm.memory.writeUInt16BE(dictAddr, tokenEntryAddr);
    vm.memory.writeUInt8(token.length, tokenEntryAddr + 2);
    vm.memory.writeUInt8(token.start + 1, tokenEntryAddr + 3); // Position is 1-indexed
  }
}

export function h_print_char(vm: any, [zsciiChar]: number[]) {
  if (vm.inputOutputDevice) {
    vm.inputOutputDevice.writeString(String.fromCharCode(zsciiChar));
  } else {
    console.log(String.fromCharCode(zsciiChar));
  }
}

export function h_print_num(vm: any, [num]: number[]) {
  const signedNum = toSigned16(num);
  if (vm.inputOutputDevice) {
    vm.inputOutputDevice.writeString(signedNum.toString());
  } else {
    console.log(signedNum.toString());
  }
}

export async function h_sread(vm: any, operands: number[]) {
  if (!vm.memory || !vm.inputOutputDevice || !vm.header) {
    console.error("Memory, input/output device, or header not loaded");
    return;
  }

  const textBufferAddr = operands[0];
  const parseBufferAddr = operands[1];

  // Read input from user
  const input = await vm.inputOutputDevice.readLine();

  if (vm.trace) {
    console.log(
      `@sread: textBufferAddr=0x${textBufferAddr.toString(16)}, parseBufferAddr=0x${parseBufferAddr.toString(16)}, input="${input}"`,
    );
  }

  const maxLen = vm.memory.readUInt8(textBufferAddr);
  const text = input.toLowerCase().slice(0, maxLen);
  vm.setLastRead(text);

  if (vm.header.version <= 4) {
    // v1-4: Write text starting at byte 1, null-terminate
    for (let i = 0; i < text.length; i++) {
      vm.memory.writeUInt8(text.charCodeAt(i), textBufferAddr + 1 + i);
    }
    if (text.length < maxLen) {
      vm.memory.writeUInt8(0, textBufferAddr + 1 + text.length);
    }
  } else {
    // v5+: Write length at byte 1, text at byte 2+
    vm.memory.writeUInt8(text.length, textBufferAddr + 1);
    for (let i = 0; i < text.length; i++) {
      vm.memory.writeUInt8(text.charCodeAt(i), textBufferAddr + 2 + i);
    }
    if (text.length < maxLen) {
      vm.memory.writeUInt8(0, textBufferAddr + 2 + text.length);
    }
  }

  // Tokenize the input
  tokenize(vm, textBufferAddr, parseBufferAddr);
}

export function h_print_table(vm: any, operands: number[]) {
  if (!vm.memory) {
    console.error("Memory not loaded");
    return;
  }

  const tableAddr = operands[0];
  const tableWidth = operands[1];
  const tableHeight = operands.length > 2 ? operands[2] : 1;
  const tableSkip = operands.length > 3 ? operands[3] : 0;

  if (tableAddr >= vm.memory.length) {
    console.error(`print_table: Invalid address 0x${tableAddr.toString(16)}`);
    return;
  }

  for (let row = 0; row < tableHeight; row++) {
    const rowAddr = tableAddr + row * (tableWidth + tableSkip);

    if (rowAddr + tableWidth > vm.memory.length) {
      console.error(`print_table: Row ${row} extends beyond memory`);
      break;
    }

    for (let col = 0; col < tableWidth; col++) {
      const charCode = vm.memory.readUInt8(rowAddr + col);
      if (vm.inputOutputDevice) {
        vm.inputOutputDevice.writeString(String.fromCharCode(charCode));
      } else {
        process.stdout.write(String.fromCharCode(charCode));
      }
    }

    if (row < tableHeight - 1) {
      if (vm.inputOutputDevice) {
        vm.inputOutputDevice.writeString("\n");
      } else {
        process.stdout.write("\n");
      }
    }
  }
}

export function h_split_window(vm: any, [lines]: number[]) {
  // Split window (v3+)
  // lines = number of lines for upper window
  // Currently no-op
  if (vm.trace) {
    console.log(`@split_window ${lines} (no-op)`);
  }
}

export function h_set_window(vm: any, [window]: number[]) {
  // Set current window (v3+)
  // window = 0 (lower) or 1 (upper)
  // Currently no-op
  if (vm.trace) {
    console.log(`@set_window ${window} (no-op)`);
  }
}

export function h_erase_window(vm: any, [window]: number[]) {
  // Erase window (v4+)
  // Currently no-op
  if (vm.trace) {
    console.log(`@erase_window ${window} (no-op)`);
  }
}

export function h_erase_line(vm: any, [value]: number[]) {
  // Erase line (v4+)
  // Currently no-op
  if (vm.trace) {
    console.log(`@erase_line ${value} (no-op)`);
  }
}

export function h_set_cursor(vm: any, [line, column]: number[]) {
  // Set cursor position (v4+)
  // Currently no-op
  if (vm.trace) {
    console.log(`@set_cursor ${line},${column} (no-op)`);
  }
}

export function h_get_cursor(vm: any, [array]: number[]) {
  // Get cursor position (v4+)
  // Store line and column at array and array+2
  // Currently just write 1,1
  if (vm.memory) {
    vm.memory.writeUInt16BE(1, array);
    vm.memory.writeUInt16BE(1, array + 2);
  }
  if (vm.trace) {
    console.log(`@get_cursor ${array} (stub: returning 1,1)`);
  }
}

export function h_set_text_style(vm: any, [style]: number[]) {
  // Set text style (v4+)
  // Currently no-op
  if (vm.trace) {
    console.log(`@set_text_style ${style} (no-op)`);
  }
}

export function h_buffer_mode(vm: any, [flag]: number[]) {
  // Set buffer mode (v4+)
  // Currently no-op
  if (vm.trace) {
    console.log(`@buffer_mode ${flag} (no-op)`);
  }
}

export function h_output_stream(vm: any, [number, table]: number[]) {
  // Select output stream (v3+)
  // Currently no-op
  if (vm.trace) {
    console.log(
      `@output_stream ${number}${table !== undefined ? `,${table}` : ""} (no-op)`,
    );
  }
}

export function h_input_stream(vm: any, [number]: number[]) {
  // Select input stream (v3+)
  // Currently no-op
  if (vm.trace) {
    console.log(`@input_stream ${number} (no-op)`);
  }
}

export function h_sound_effect(vm: any, operands: number[]) {
  // Sound effect (v3+)
  // Currently no-op
  if (vm.trace) {
    console.log(`@sound_effect ${operands.join(",")} (no-op)`);
  }
}

export async function h_read_char(
  vm: any,
  [one, time, routine]: number[],
  ctx: { store?: (v: number) => void },
) {
  // Read a single character (v4+)
  // one = 1 means show cursor, time = timeout, routine = timeout routine
  if (!vm.inputOutputDevice) {
    console.error("No input device");
    ctx.store?.(13); // Return newline
    return;
  }

  const char = await vm.inputOutputDevice.readChar();
  const charCode = char.charCodeAt(0);

  if (vm.trace) {
    console.log(`@read_char returned '${char}' (code ${charCode})`);
  }

  ctx.store?.(charCode);
}

export async function h_save(
  vm: any,
  _operands: number[],
  ctx: { branch?: (condition: boolean) => void; branchInfo?: { offset: number; branchOnTrue: boolean; branchBytes: number } },
) {
  // For v1-3, SAVE is a branch instruction. The decoder has already read the branch
  // offset bytes and advanced PC past them. We need to save the PC pointing to those
  // branch bytes (before they were read), so when we restore we can read and apply them.
  //
  // The decoder tells us exactly how many bytes it read via ctx.branchInfo.branchBytes.
  let savedPC = vm.pc;

  if (ctx.branchInfo) {
    // Use the actual number of branch bytes read by the decoder
    const branchBytes = ctx.branchInfo.branchBytes;

    // Subtract the branch bytes to point to the start of the branch offset
    savedPC = vm.pc - branchBytes;

    if (vm.trace) {
      console.log(`@save: PC=${vm.pc.toString(16)}, branchBytes=${branchBytes}, savedPC=${savedPC.toString(16)}`);
    }
  }

  try {
    const saveData = await vm.saveData(savedPC);

    if (!saveData) {
      if (vm.trace) {
        console.log(`@save failed: could not generate save data`);
      }
      ctx.branch?.(false);
      return;
    }

    // In Node.js environment, save to disk
    if (vm.runtime === 'node') {
      const { writeFile } = await import('fs/promises');
      const savePath = vm.filePath + '.qzl';
      await writeFile(savePath, saveData);

      if (vm.trace) {
        console.log(`@save: saved to ${savePath}`);
      }
      ctx.branch?.(true);
    } else if (vm.runtime === 'browser') {
      // In browser environment, save to localStorage using game identifier
      const header = vm.getHeader();
      if (!header) {
        if (vm.trace) {
          console.log(`@save failed: could not get game header`);
        }
        ctx.branch?.(false);
        return;
      }

      const gameIdentifier = `${header.release}.${header.serial}`;
      const saveKey = `tszm-save-${gameIdentifier}`;

      // Convert Buffer to base64 string for localStorage
      const base64Data = saveData.toString('base64');
      localStorage.setItem(saveKey, base64Data);

      if (vm.trace) {
        console.log(`@save: saved ${saveData.length} bytes to localStorage key "${saveKey}"`);
      }
      ctx.branch?.(true);
    } else {
      // In other environments, just indicate success
      if (vm.trace) {
        console.log(`@save: generated save data (${saveData.length} bytes) but not persisting (unknown environment)`);
      }
      ctx.branch?.(true);
    }
  } catch (error) {
    if (vm.trace) {
      console.log(`@save failed: ${error}`);
    }
    ctx.branch?.(false);
  }
}

export async function h_restore(
  vm: any,
  _operands: number[],
  ctx: { branch?: (condition: boolean) => void },
) {
  // Restore game state (v1-3: 0OP, v4+: uses extended opcode with store)
  try {
    // In Node.js environment, load from disk
    if (vm.runtime === 'node') {
      const { readFile } = await import('fs/promises');
      const savePath = vm.filePath + '.qzl';

      try {
        const saveData = await readFile(savePath);

        if (vm.trace) {
          console.log(`@restore: loaded save file (${saveData.length} bytes), calling restoreFromSave...`);
        }

        const success = await vm.restoreFromSave(saveData);

        if (success) {
          if (vm.trace) {
            console.log(`@restore: SUCCESS - restoreFromSave() succeeded, PC=${vm.pc.toString(16)}`);
            console.log(`@restore: Returning from handler without calling ctx.branch (PC has been set by restoreFromSave)`);
          }
          // restoreFromSave() already read the branch bytes, applied the branch, and set PC correctly.
          // The PC now points to the instruction after the SAVE's branch.
          // Just continue execution from here (execution will continue at the next step()).
          //
          // IMPORTANT: We do NOT call ctx.branch() here, because restoreFromSave() has already
          // modified the PC to point to the correct post-restore location.
          return;
        } else {
          if (vm.trace) {
            console.log(`@restore: FAILED - restoreFromSave() returned false, calling ctx.branch(false)`);
          }
          ctx.branch?.(false);
        }
      } catch (fileError: any) {
        if (fileError.code === 'ENOENT') {
          if (vm.trace) {
            console.log(`@restore: save file not found at ${savePath}`);
          }
        } else {
          if (vm.trace) {
            console.log(`@restore: error reading save file: ${fileError}`);
          }
        }
        ctx.branch?.(false);
      }
    } else if (vm.runtime === 'browser') {
      // In browser environment, load from localStorage using game identifier
      const header = vm.getHeader();
      if (!header) {
        if (vm.trace) {
          console.log(`@restore failed: could not get game header`);
        }
        ctx.branch?.(false);
        return;
      }

      const gameIdentifier = `${header.release}.${header.serial}`;
      const saveKey = `tszm-save-${gameIdentifier}`;

      try {
        const base64Data = localStorage.getItem(saveKey);

        if (!base64Data) {
          if (vm.trace) {
            console.log(`@restore: no save data found in localStorage for key "${saveKey}"`);
          }
          ctx.branch?.(false);
          return;
        }

        // Convert base64 string back to Buffer
        const saveData = Buffer.from(base64Data, 'base64');

        const success = await vm.restoreFromSave(saveData);

        if (success) {
          if (vm.trace) {
            console.log(`@restore: restored ${saveData.length} bytes from localStorage key "${saveKey}"`);
          }

          // restoreFromSave() already skipped the branch bytes and set PC correctly.
          // Just continue execution from here (as if SAVE returned 0/false).
        } else {
          if (vm.trace) {
            console.log(`@restore: failed to restore game state`);
          }
          ctx.branch?.(false);
        }
      } catch (storageError) {
        if (vm.trace) {
          console.log(`@restore: error reading from localStorage: ${storageError}`);
        }
        ctx.branch?.(false);
      }
    } else {
      // In other environments, not yet implemented
      if (vm.trace) {
        console.log(`@restore: not implemented for unknown environment`);
      }
      ctx.branch?.(false);
    }
  } catch (error) {
    if (vm.trace) {
      console.log(`@restore failed: ${error}`);
    }
    ctx.branch?.(false);
  }
}
