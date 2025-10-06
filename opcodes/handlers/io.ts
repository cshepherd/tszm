// Input/output handlers

function toSigned16(n: number): number {
  return n > 32767 ? n - 65536 : n;
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
      `@sread: textBufferAddr=0x${textBufferAddr.toString(16)}, parseBufferAddr=0x${parseBufferAddr.toString(16)}, input="${input}"`
    );
  }

  const maxLen = vm.memory.readUInt8(textBufferAddr);
  const text = input.toLowerCase().slice(0, maxLen);

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
  vm.tokenize(textBufferAddr, parseBufferAddr);
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
    console.log(`@output_stream ${number}${table !== undefined ? `,${table}` : ''} (no-op)`);
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
    console.log(`@sound_effect ${operands.join(',')} (no-op)`);
  }
}

export async function h_read_char(vm: any, [one, time, routine]: number[], ctx: { store?: (v: number) => void }) {
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
