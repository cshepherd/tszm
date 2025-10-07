import {
  h_print_char,
  h_print_num,
  h_sread,
  h_print_table,
  h_split_window,
  h_set_window,
  h_erase_window,
  h_erase_line,
  h_set_cursor,
  h_get_cursor,
  h_set_text_style,
  h_buffer_mode,
  h_output_stream,
  h_input_stream,
  h_sound_effect,
  h_read_char,
} from "./io";

describe("I/O Handlers", () => {
  describe("h_print_char", () => {
    it("should print character using inputOutputDevice", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      h_print_char(vm, [65]); // 'A'

      expect(mockDevice.writeString).toHaveBeenCalledWith("A");
    });

    it("should print space character", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      h_print_char(vm, [32]); // space

      expect(mockDevice.writeString).toHaveBeenCalledWith(" ");
    });

    it("should print newline character", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      h_print_char(vm, [10]); // newline

      expect(mockDevice.writeString).toHaveBeenCalledWith("\n");
    });

    it("should use console.log when no inputOutputDevice", () => {
      const vm = { inputOutputDevice: null };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_print_char(vm, [66]); // 'B'

      expect(consoleSpy).toHaveBeenCalledWith("B");

      consoleSpy.mockRestore();
    });

    it("should handle zero character code", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      h_print_char(vm, [0]);

      expect(mockDevice.writeString).toHaveBeenCalledWith("\0");
    });
  });

  describe("h_print_num", () => {
    it("should print positive number", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      h_print_num(vm, [42]);

      expect(mockDevice.writeString).toHaveBeenCalledWith("42");
    });

    it("should print zero", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      h_print_num(vm, [0]);

      expect(mockDevice.writeString).toHaveBeenCalledWith("0");
    });

    it("should print negative number (signed conversion)", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      // -1 as unsigned = 65535
      h_print_num(vm, [65535]);

      expect(mockDevice.writeString).toHaveBeenCalledWith("-1");
    });

    it("should print negative number -100", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      // -100 as unsigned = 65436
      h_print_num(vm, [65436]);

      expect(mockDevice.writeString).toHaveBeenCalledWith("-100");
    });

    it("should print maximum positive signed value", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      h_print_num(vm, [32767]);

      expect(mockDevice.writeString).toHaveBeenCalledWith("32767");
    });

    it("should print minimum negative signed value", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      // -32768 as unsigned = 32768
      h_print_num(vm, [32768]);

      expect(mockDevice.writeString).toHaveBeenCalledWith("-32768");
    });

    it("should use console.log when no inputOutputDevice", () => {
      const vm = { inputOutputDevice: null };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_print_num(vm, [123]);

      expect(consoleSpy).toHaveBeenCalledWith("123");

      consoleSpy.mockRestore();
    });
  });

  describe("h_sread", () => {
    it("should read input and store in text buffer (v4)", async () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt8(20, 0x100); // Max length
      memory.writeUInt8(5, 0x200); // Max tokens

      const mockDevice = {
        readLine: jest.fn().mockResolvedValue("hello"),
      };

      const vm = {
        memory,
        header: { version: 4, dictionaryAddress: 0x150 },
        inputOutputDevice: mockDevice,
        trace: false,
        decodeZSCII: jest.fn(),
        setLastRead: jest.fn(),
      };

      // Set up minimal dictionary
      memory.writeUInt8(0, 0x150); // num separators
      memory.writeUInt8(4, 0x151); // entry length
      memory.writeUInt16BE(0, 0x152); // num entries

      await h_sread(vm, [0x100, 0x200]);

      expect(mockDevice.readLine).toHaveBeenCalled();
      // Check text was written (v4 format: null-terminated at byte 1+)
      expect(memory.readUInt8(0x101)).toBe(104); // 'h'
      expect(memory.readUInt8(0x102)).toBe(101); // 'e'
      expect(memory.readUInt8(0x103)).toBe(108); // 'l'
      expect(memory.readUInt8(0x104)).toBe(108); // 'l'
      expect(memory.readUInt8(0x105)).toBe(111); // 'o'
      expect(memory.readUInt8(0x106)).toBe(0); // null terminator
    });

    it("should read input and store in text buffer (v5)", async () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt8(20, 0x100); // Max length
      memory.writeUInt8(5, 0x200); // Max tokens

      const mockDevice = {
        readLine: jest.fn().mockResolvedValue("test"),
      };

      const vm = {
        memory,
        header: { version: 5, dictionaryAddress: 0x150 },
        inputOutputDevice: mockDevice,
        trace: false,
        decodeZSCII: jest.fn(),
        setLastRead: jest.fn(),
      };

      // Set up minimal dictionary
      memory.writeUInt8(0, 0x150); // num separators
      memory.writeUInt8(4, 0x151); // entry length
      memory.writeUInt16BE(0, 0x152); // num entries

      await h_sread(vm, [0x100, 0x200]);

      // Check text was written (v5 format: length at byte 1, text at byte 2+)
      expect(memory.readUInt8(0x101)).toBe(4); // length
      expect(memory.readUInt8(0x102)).toBe(116); // 't'
      expect(memory.readUInt8(0x103)).toBe(101); // 'e'
      expect(memory.readUInt8(0x104)).toBe(115); // 's'
      expect(memory.readUInt8(0x105)).toBe(116); // 't'
    });

    it("should handle missing memory", async () => {
      const vm = {
        memory: null,
        inputOutputDevice: {},
        header: { version: 5 },
      };
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await h_sread(vm, [0x100, 0x200]);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Memory, input/output device, or header not loaded",
      );

      consoleSpy.mockRestore();
    });

    it("should truncate input to max length", async () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt8(3, 0x100); // Max length = 3

      const mockDevice = {
        readLine: jest.fn().mockResolvedValue("toolong"),
      };

      const vm = {
        memory,
        header: { version: 5, dictionaryAddress: 0x150 },
        inputOutputDevice: mockDevice,
        trace: false,
        decodeZSCII: jest.fn(),
        setLastRead: jest.fn(),
      };

      // Set up minimal dictionary
      memory.writeUInt8(0, 0x150);
      memory.writeUInt8(4, 0x151);
      memory.writeUInt16BE(0, 0x152);

      await h_sread(vm, [0x100, 0x200]);

      // Should only store first 3 characters
      expect(memory.readUInt8(0x101)).toBe(3); // length
      expect(memory.readUInt8(0x102)).toBe(116); // 't'
      expect(memory.readUInt8(0x103)).toBe(111); // 'o'
      expect(memory.readUInt8(0x104)).toBe(111); // 'o'
    });

    it("should convert input to lowercase", async () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt8(10, 0x100);

      const mockDevice = {
        readLine: jest.fn().mockResolvedValue("UPPER"),
      };

      const vm = {
        memory,
        header: { version: 5, dictionaryAddress: 0x150 },
        inputOutputDevice: mockDevice,
        trace: false,
        decodeZSCII: jest.fn(),
        setLastRead: jest.fn(),
      };

      // Set up minimal dictionary
      memory.writeUInt8(0, 0x150);
      memory.writeUInt8(4, 0x151);
      memory.writeUInt16BE(0, 0x152);

      await h_sread(vm, [0x100, 0x200]);

      // Should be lowercase
      expect(memory.readUInt8(0x102)).toBe(117); // 'u'
      expect(memory.readUInt8(0x103)).toBe(112); // 'p'
      expect(memory.readUInt8(0x104)).toBe(112); // 'p'
      expect(memory.readUInt8(0x105)).toBe(101); // 'e'
      expect(memory.readUInt8(0x106)).toBe(114); // 'r'
    });
  });

  describe("h_print_table", () => {
    it("should print a single row table", () => {
      const memory = Buffer.alloc(1024);
      // Set up table data: "ABC"
      memory.writeUInt8(65, 0x100); // 'A'
      memory.writeUInt8(66, 0x101); // 'B'
      memory.writeUInt8(67, 0x102); // 'C'

      const mockDevice = {
        writeString: jest.fn(),
      };

      const vm = {
        memory,
        inputOutputDevice: mockDevice,
      };

      h_print_table(vm, [0x100, 3]); // addr, width

      expect(mockDevice.writeString).toHaveBeenCalledWith("A");
      expect(mockDevice.writeString).toHaveBeenCalledWith("B");
      expect(mockDevice.writeString).toHaveBeenCalledWith("C");
      expect(mockDevice.writeString).toHaveBeenCalledTimes(3);
    });

    it("should print multi-row table with newlines", () => {
      const memory = Buffer.alloc(1024);
      // Row 1: "AB"
      memory.writeUInt8(65, 0x100);
      memory.writeUInt8(66, 0x101);
      // Row 2: "CD"
      memory.writeUInt8(67, 0x102);
      memory.writeUInt8(68, 0x103);

      const mockDevice = {
        writeString: jest.fn(),
      };

      const vm = {
        memory,
        inputOutputDevice: mockDevice,
      };

      h_print_table(vm, [0x100, 2, 2]); // addr, width, height

      expect(mockDevice.writeString).toHaveBeenNthCalledWith(1, "A");
      expect(mockDevice.writeString).toHaveBeenNthCalledWith(2, "B");
      expect(mockDevice.writeString).toHaveBeenNthCalledWith(3, "\n");
      expect(mockDevice.writeString).toHaveBeenNthCalledWith(4, "C");
      expect(mockDevice.writeString).toHaveBeenNthCalledWith(5, "D");
    });

    it("should handle table with skip parameter", () => {
      const memory = Buffer.alloc(1024);
      // Row 1: "AB" + 1 skip byte
      memory.writeUInt8(65, 0x100);
      memory.writeUInt8(66, 0x101);
      memory.writeUInt8(88, 0x102); // skip byte
      // Row 2: "CD"
      memory.writeUInt8(67, 0x103);
      memory.writeUInt8(68, 0x104);

      const mockDevice = {
        writeString: jest.fn(),
      };

      const vm = {
        memory,
        inputOutputDevice: mockDevice,
      };

      h_print_table(vm, [0x100, 2, 2, 1]); // addr, width, height, skip

      expect(mockDevice.writeString).toHaveBeenNthCalledWith(1, "A");
      expect(mockDevice.writeString).toHaveBeenNthCalledWith(2, "B");
      expect(mockDevice.writeString).toHaveBeenNthCalledWith(3, "\n");
      expect(mockDevice.writeString).toHaveBeenNthCalledWith(4, "C");
      expect(mockDevice.writeString).toHaveBeenNthCalledWith(5, "D");
    });

    it("should handle missing memory", () => {
      const vm = { memory: null };
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      h_print_table(vm, [0x100, 3]);

      expect(consoleSpy).toHaveBeenCalledWith("Memory not loaded");

      consoleSpy.mockRestore();
    });

    it("should handle invalid address", () => {
      const memory = Buffer.alloc(100);
      const vm = { memory };
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      h_print_table(vm, [0x200, 3]); // Address beyond memory

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid address"),
      );

      consoleSpy.mockRestore();
    });

    it("should handle row extending beyond memory", () => {
      const memory = Buffer.alloc(50);
      const mockDevice = { writeString: jest.fn() };
      const vm = { memory, inputOutputDevice: mockDevice };
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      h_print_table(vm, [0x30, 30, 2]); // Would extend beyond buffer

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("extends beyond memory"),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("h_split_window", () => {
    it("should log when trace is enabled", () => {
      const vm = { trace: true };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_split_window(vm, [10]);

      expect(consoleSpy).toHaveBeenCalledWith("@split_window 10 (no-op)");

      consoleSpy.mockRestore();
    });

    it("should not log when trace is disabled", () => {
      const vm = { trace: false };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_split_window(vm, [10]);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("h_set_window", () => {
    it("should log when trace is enabled", () => {
      const vm = { trace: true };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_set_window(vm, [0]);

      expect(consoleSpy).toHaveBeenCalledWith("@set_window 0 (no-op)");

      consoleSpy.mockRestore();
    });
  });

  describe("h_erase_window", () => {
    it("should log when trace is enabled", () => {
      const vm = { trace: true };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_erase_window(vm, [1]);

      expect(consoleSpy).toHaveBeenCalledWith("@erase_window 1 (no-op)");

      consoleSpy.mockRestore();
    });
  });

  describe("h_erase_line", () => {
    it("should log when trace is enabled", () => {
      const vm = { trace: true };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_erase_line(vm, [1]);

      expect(consoleSpy).toHaveBeenCalledWith("@erase_line 1 (no-op)");

      consoleSpy.mockRestore();
    });
  });

  describe("h_set_cursor", () => {
    it("should log when trace is enabled", () => {
      const vm = { trace: true };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_set_cursor(vm, [5, 10]);

      expect(consoleSpy).toHaveBeenCalledWith("@set_cursor 5,10 (no-op)");

      consoleSpy.mockRestore();
    });
  });

  describe("h_get_cursor", () => {
    it("should write cursor position to memory", () => {
      const memory = Buffer.alloc(1024);
      const vm = { memory, trace: false };

      h_get_cursor(vm, [0x100]);

      expect(memory.readUInt16BE(0x100)).toBe(1); // line
      expect(memory.readUInt16BE(0x102)).toBe(1); // column
    });

    it("should log when trace is enabled", () => {
      const memory = Buffer.alloc(1024);
      const vm = { memory, trace: true };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_get_cursor(vm, [0x100]);

      expect(consoleSpy).toHaveBeenCalledWith(
        "@get_cursor 256 (stub: returning 1,1)",
      );

      consoleSpy.mockRestore();
    });
  });

  describe("h_set_text_style", () => {
    it("should log when trace is enabled", () => {
      const vm = { trace: true };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_set_text_style(vm, [2]);

      expect(consoleSpy).toHaveBeenCalledWith("@set_text_style 2 (no-op)");

      consoleSpy.mockRestore();
    });
  });

  describe("h_buffer_mode", () => {
    it("should log when trace is enabled", () => {
      const vm = { trace: true };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_buffer_mode(vm, [1]);

      expect(consoleSpy).toHaveBeenCalledWith("@buffer_mode 1 (no-op)");

      consoleSpy.mockRestore();
    });
  });

  describe("h_output_stream", () => {
    it("should log with single parameter when trace is enabled", () => {
      const vm = { trace: true };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_output_stream(vm, [1]);

      expect(consoleSpy).toHaveBeenCalledWith("@output_stream 1 (no-op)");

      consoleSpy.mockRestore();
    });

    it("should log with table parameter when trace is enabled", () => {
      const vm = { trace: true };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_output_stream(vm, [3, 0x100]);

      expect(consoleSpy).toHaveBeenCalledWith("@output_stream 3,256 (no-op)");

      consoleSpy.mockRestore();
    });
  });

  describe("h_input_stream", () => {
    it("should log when trace is enabled", () => {
      const vm = { trace: true };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_input_stream(vm, [1]);

      expect(consoleSpy).toHaveBeenCalledWith("@input_stream 1 (no-op)");

      consoleSpy.mockRestore();
    });
  });

  describe("h_sound_effect", () => {
    it("should log single operand when trace is enabled", () => {
      const vm = { trace: true };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_sound_effect(vm, [1]);

      expect(consoleSpy).toHaveBeenCalledWith("@sound_effect 1 (no-op)");

      consoleSpy.mockRestore();
    });

    it("should log multiple operands when trace is enabled", () => {
      const vm = { trace: true };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_sound_effect(vm, [1, 2, 3]);

      expect(consoleSpy).toHaveBeenCalledWith("@sound_effect 1,2,3 (no-op)");

      consoleSpy.mockRestore();
    });
  });

  describe("h_read_char", () => {
    it("should read character and store code", async () => {
      const mockDevice = {
        readChar: jest.fn().mockResolvedValue("A"),
      };

      const storeFn = jest.fn();

      const vm = {
        inputOutputDevice: mockDevice,
        trace: false,
      };

      await h_read_char(vm, [1], { store: storeFn });

      expect(mockDevice.readChar).toHaveBeenCalled();
      expect(storeFn).toHaveBeenCalledWith(65); // 'A'
    });

    it("should handle newline character", async () => {
      const mockDevice = {
        readChar: jest.fn().mockResolvedValue("\n"),
      };

      const storeFn = jest.fn();

      const vm = {
        inputOutputDevice: mockDevice,
        trace: false,
      };

      await h_read_char(vm, [1], { store: storeFn });

      expect(storeFn).toHaveBeenCalledWith(10);
    });

    it("should handle missing input device", async () => {
      const vm = { inputOutputDevice: null, trace: false };
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const storeFn = jest.fn();

      await h_read_char(vm, [1], { store: storeFn });

      expect(consoleSpy).toHaveBeenCalledWith("No input device");
      expect(storeFn).toHaveBeenCalledWith(13); // Return newline

      consoleSpy.mockRestore();
    });

    it("should log when trace is enabled", async () => {
      const mockDevice = {
        readChar: jest.fn().mockResolvedValue("x"),
      };

      const vm = {
        inputOutputDevice: mockDevice,
        trace: true,
      };

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await h_read_char(vm, [1], { store: jest.fn() });

      expect(consoleSpy).toHaveBeenCalledWith(
        "@read_char returned 'x' (code 120)",
      );

      consoleSpy.mockRestore();
    });

    it("should work when store is not provided", async () => {
      const mockDevice = {
        readChar: jest.fn().mockResolvedValue("A"),
      };

      const vm = {
        inputOutputDevice: mockDevice,
        trace: false,
      };

      await expect(h_read_char(vm, [1], {})).resolves.not.toThrow();
    });
  });

  describe("Integration and edge cases", () => {
    it("should handle print_char and print_num together", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      h_print_char(vm, [72]); // 'H'
      h_print_char(vm, [105]); // 'i'
      h_print_char(vm, [32]); // ' '
      h_print_num(vm, [42]);

      expect(mockDevice.writeString).toHaveBeenNthCalledWith(1, "H");
      expect(mockDevice.writeString).toHaveBeenNthCalledWith(2, "i");
      expect(mockDevice.writeString).toHaveBeenNthCalledWith(3, " ");
      expect(mockDevice.writeString).toHaveBeenNthCalledWith(4, "42");
    });

    it("should handle all no-op window operations", () => {
      const vm = { trace: true };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_split_window(vm, [5]);
      h_set_window(vm, [1]);
      h_erase_window(vm, [0]);
      h_erase_line(vm, [1]);
      h_set_cursor(vm, [10, 20]);
      h_set_text_style(vm, [1]);
      h_buffer_mode(vm, [0]);

      expect(consoleSpy).toHaveBeenCalledTimes(7);

      consoleSpy.mockRestore();
    });

    it("should handle special characters in print_char", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      h_print_char(vm, [9]); // tab
      h_print_char(vm, [13]); // carriage return
      h_print_char(vm, [0]); // null

      expect(mockDevice.writeString).toHaveBeenCalledWith("\t");
      expect(mockDevice.writeString).toHaveBeenCalledWith("\r");
      expect(mockDevice.writeString).toHaveBeenCalledWith("\0");
    });

    it("should handle signed number edge cases", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      // Boundary at 32767/32768
      h_print_num(vm, [32767]); // max positive
      h_print_num(vm, [32768]); // min negative (-32768)

      expect(mockDevice.writeString).toHaveBeenCalledWith("32767");
      expect(mockDevice.writeString).toHaveBeenCalledWith("-32768");
    });
  });
});
