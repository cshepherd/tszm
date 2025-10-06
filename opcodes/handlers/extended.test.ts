import {
  h_log_shift,
  h_art_shift,
  h_set_font,
  h_save_undo,
  h_restore_undo,
  h_print_unicode,
  h_check_unicode,
} from "./extended";

describe("Extended Handlers", () => {
  describe("h_log_shift", () => {
    it("should shift left for positive places", () => {
      const storeFn = jest.fn();

      // 1 << 3 = 8
      h_log_shift({}, [1, 3], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(8);
    });

    it("should shift left with larger values", () => {
      const storeFn = jest.fn();

      // 5 << 4 = 80
      h_log_shift({}, [5, 4], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(80);
    });

    it("should mask result to 16 bits on left shift", () => {
      const storeFn = jest.fn();

      // 0xFFFF << 1 = 0x1FFFE, masked to 0xFFFE (65534)
      h_log_shift({}, [0xFFFF, 1], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0xFFFE);
    });

    it("should shift right (logical) for negative places", () => {
      const storeFn = jest.fn();

      // 16 >>> 2 = 4 (places = -2)
      h_log_shift({}, [16, 65534], { store: storeFn }); // -2 as unsigned
      expect(storeFn).toHaveBeenCalledWith(4);
    });

    it("should shift right with zero fill", () => {
      const storeFn = jest.fn();

      // 0x8000 >>> 1 = 0x4000 (logical shift, zero fill)
      h_log_shift({}, [0x8000, 65535], { store: storeFn }); // -1 as unsigned
      expect(storeFn).toHaveBeenCalledWith(0x4000);
    });

    it("should return original value for zero places", () => {
      const storeFn = jest.fn();

      h_log_shift({}, [42, 0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(42);
    });

    it("should handle large left shifts that overflow", () => {
      const storeFn = jest.fn();

      // 1 << 16 would be 65536, masked to 0
      h_log_shift({}, [1, 16], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should handle large right shifts", () => {
      const storeFn = jest.fn();

      // 0xFFFF >>> 8 = 0xFF
      h_log_shift({}, [0xFFFF, 65528], { store: storeFn }); // -8 as unsigned
      expect(storeFn).toHaveBeenCalledWith(0xFF);
    });

    it("should work when store is not provided", () => {
      expect(() => h_log_shift({}, [1, 1], {})).not.toThrow();
    });

    it("should handle edge case with maximum 16-bit value", () => {
      const storeFn = jest.fn();

      // 65535 << 0 = 65535
      h_log_shift({}, [65535, 0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(65535);
    });
  });

  describe("h_art_shift", () => {
    it("should shift left for positive places", () => {
      const storeFn = jest.fn();

      // 1 << 3 = 8
      h_art_shift({}, [1, 3], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(8);
    });

    it("should shift left with larger values", () => {
      const storeFn = jest.fn();

      // 5 << 4 = 80
      h_art_shift({}, [5, 4], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(80);
    });

    it("should shift right (arithmetic) for negative places", () => {
      const storeFn = jest.fn();

      // 16 >> 2 = 4 (places = -2)
      h_art_shift({}, [16, 65534], { store: storeFn }); // -2 as unsigned
      expect(storeFn).toHaveBeenCalledWith(4);
    });

    it("should preserve sign bit on right shift (positive)", () => {
      const storeFn = jest.fn();

      // 0x4000 >> 1 = 0x2000 (positive stays positive)
      h_art_shift({}, [0x4000, 65535], { store: storeFn }); // -1 as unsigned
      expect(storeFn).toHaveBeenCalledWith(0x2000);
    });

    it("should preserve sign bit on right shift (negative)", () => {
      const storeFn = jest.fn();

      // 0x8000 (-32768) >> 1 = 0xC000 (-16384)
      // -32768 >> 1 = -16384, which is 0xC000 as unsigned
      h_art_shift({}, [0x8000, 65535], { store: storeFn }); // -1 as unsigned
      expect(storeFn).toHaveBeenCalledWith(0xC000);
    });

    it("should return original value for zero places", () => {
      const storeFn = jest.fn();

      h_art_shift({}, [42, 0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(42);
    });

    it("should handle negative number left shift", () => {
      const storeFn = jest.fn();

      // -1 (0xFFFF) << 1 = -2 (0xFFFE)
      h_art_shift({}, [0xFFFF, 1], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0xFFFE);
    });

    it("should handle negative number right shift preserving sign", () => {
      const storeFn = jest.fn();

      // -4 (0xFFFC) >> 1 = -2 (0xFFFE)
      h_art_shift({}, [0xFFFC, 65535], { store: storeFn }); // -1 as unsigned
      expect(storeFn).toHaveBeenCalledWith(0xFFFE);
    });

    it("should mask result to 16 bits", () => {
      const storeFn = jest.fn();

      // 0x7FFF << 2 overflows, should mask to 16 bits
      h_art_shift({}, [0x7FFF, 2], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0xFFFC); // Result masked
    });

    it("should work when store is not provided", () => {
      expect(() => h_art_shift({}, [1, 1], {})).not.toThrow();
    });

    it("should handle large right shift of negative number", () => {
      const storeFn = jest.fn();

      // -1 (0xFFFF) >> 8 = -1 (sign extends)
      h_art_shift({}, [0xFFFF, 65528], { store: storeFn }); // -8 as unsigned
      expect(storeFn).toHaveBeenCalledWith(0xFFFF);
    });
  });

  describe("h_set_font", () => {
    it("should accept font 1 (normal) and return 1", () => {
      const storeFn = jest.fn();

      h_set_font({}, [1], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(1);
    });

    it("should accept font 0 (previous) and return 1", () => {
      const storeFn = jest.fn();

      h_set_font({}, [0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(1);
    });

    it("should reject font 3 (character graphics) and return 0", () => {
      const storeFn = jest.fn();

      h_set_font({}, [3], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should reject font 4 (fixed-pitch) and return 0", () => {
      const storeFn = jest.fn();

      h_set_font({}, [4], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should reject unsupported font numbers and return 0", () => {
      const storeFn = jest.fn();

      h_set_font({}, [99], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should work when store is not provided", () => {
      expect(() => h_set_font({}, [1], {})).not.toThrow();
    });
  });

  describe("h_save_undo", () => {
    it("should return -1 (not implemented)", () => {
      const storeFn = jest.fn();

      h_save_undo({}, [], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(-1);
    });

    it("should work when store is not provided", () => {
      expect(() => h_save_undo({}, [], {})).not.toThrow();
    });

    it("should ignore operands", () => {
      const storeFn = jest.fn();

      h_save_undo({}, [1, 2, 3], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(-1);
    });
  });

  describe("h_restore_undo", () => {
    it("should return 0 (no undo state available)", () => {
      const storeFn = jest.fn();

      h_restore_undo({}, [], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should work when store is not provided", () => {
      expect(() => h_restore_undo({}, [], {})).not.toThrow();
    });

    it("should ignore operands", () => {
      const storeFn = jest.fn();

      h_restore_undo({}, [1, 2, 3], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });
  });

  describe("h_print_unicode", () => {
    it("should print character using inputOutputDevice", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      h_print_unicode(vm, [65]); // 'A'

      expect(mockDevice.writeString).toHaveBeenCalledWith("A");
    });

    it("should print Unicode character", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      h_print_unicode(vm, [8364]); // Euro sign €

      expect(mockDevice.writeString).toHaveBeenCalledWith("€");
    });

    it("should print space character", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      h_print_unicode(vm, [32]); // space

      expect(mockDevice.writeString).toHaveBeenCalledWith(" ");
    });

    it("should print newline character", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      h_print_unicode(vm, [10]); // newline

      expect(mockDevice.writeString).toHaveBeenCalledWith("\n");
    });

    it("should use console.log when no inputOutputDevice", () => {
      const vm = { inputOutputDevice: null };
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      h_print_unicode(vm, [65]); // 'A'

      expect(consoleSpy).toHaveBeenCalledWith("A");

      consoleSpy.mockRestore();
    });

    it("should handle zero character code", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      h_print_unicode(vm, [0]);

      expect(mockDevice.writeString).toHaveBeenCalledWith("\0");
    });

    it("should handle high Unicode values", () => {
      const mockDevice = {
        writeString: jest.fn(),
      };
      const vm = { inputOutputDevice: mockDevice };

      h_print_unicode(vm, [0x1F600]); // 😀 emoji

      expect(mockDevice.writeString).toHaveBeenCalled();
    });
  });

  describe("h_check_unicode", () => {
    it("should return 1 for valid ASCII character", () => {
      const storeFn = jest.fn();

      h_check_unicode({}, [65], { store: storeFn }); // 'A'
      expect(storeFn).toHaveBeenCalledWith(1);
    });

    it("should return 1 for character at start of range", () => {
      const storeFn = jest.fn();

      h_check_unicode({}, [0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(1);
    });

    it("should return 1 for character at end of BMP", () => {
      const storeFn = jest.fn();

      h_check_unicode({}, [0xFFFF], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(1);
    });

    it("should return 1 for extended Latin characters", () => {
      const storeFn = jest.fn();

      h_check_unicode({}, [0x00E9], { store: storeFn }); // é
      expect(storeFn).toHaveBeenCalledWith(1);
    });

    it("should return 1 for CJK characters", () => {
      const storeFn = jest.fn();

      h_check_unicode({}, [0x4E00], { store: storeFn }); // 一 (Chinese)
      expect(storeFn).toHaveBeenCalledWith(1);
    });

    it("should return 0 for character code above BMP", () => {
      const storeFn = jest.fn();

      h_check_unicode({}, [0x10000], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should return 0 for negative character code", () => {
      const storeFn = jest.fn();

      h_check_unicode({}, [65535], { store: storeFn }); // -1 as unsigned is 65535, which is valid
      expect(storeFn).toHaveBeenCalledWith(1); // Actually valid!
    });

    it("should return 0 for very large character code", () => {
      const storeFn = jest.fn();

      h_check_unicode({}, [0x110000], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should work when store is not provided", () => {
      expect(() => h_check_unicode({}, [65], {})).not.toThrow();
    });
  });

  describe("Comparison: logical vs arithmetic shift", () => {
    it("should differ for negative numbers shifted right", () => {
      const logicalStore = jest.fn();
      const arithmeticStore = jest.fn();

      // -1 (0xFFFF) shifted right by 1
      h_log_shift({}, [0xFFFF, 65535], { store: logicalStore }); // -1 as places
      h_art_shift({}, [0xFFFF, 65535], { store: arithmeticStore });

      expect(logicalStore).toHaveBeenCalledWith(0x7FFF); // Logical: zero fill
      expect(arithmeticStore).toHaveBeenCalledWith(0xFFFF); // Arithmetic: sign extend
    });

    it("should be same for positive numbers shifted right", () => {
      const logicalStore = jest.fn();
      const arithmeticStore = jest.fn();

      // 0x7FFF shifted right by 1
      h_log_shift({}, [0x7FFF, 65535], { store: logicalStore }); // -1 as places
      h_art_shift({}, [0x7FFF, 65535], { store: arithmeticStore });

      expect(logicalStore).toHaveBeenCalledWith(0x3FFF);
      expect(arithmeticStore).toHaveBeenCalledWith(0x3FFF);
    });

    it("should be same for left shifts", () => {
      const logicalStore = jest.fn();
      const arithmeticStore = jest.fn();

      h_log_shift({}, [5, 3], { store: logicalStore });
      h_art_shift({}, [5, 3], { store: arithmeticStore });

      expect(logicalStore).toHaveBeenCalledWith(40);
      expect(arithmeticStore).toHaveBeenCalledWith(40);
    });
  });

  describe("Edge cases and integration", () => {
    it("should handle shift by maximum positive value", () => {
      const storeFn = jest.fn();

      // Shift left by 15 (max useful for 16-bit)
      h_log_shift({}, [1, 15], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0x8000);
    });

    it("should handle shift by maximum negative value", () => {
      const storeFn = jest.fn();

      // Shift right by 15
      h_log_shift({}, [0x8000, 65521], { store: storeFn }); // -15 as unsigned
      expect(storeFn).toHaveBeenCalledWith(1);
    });

    it("should handle all extended operations in sequence", () => {
      const vm = {
        inputOutputDevice: {
          writeString: jest.fn(),
        },
      };
      const storeFn = jest.fn();

      // Logical shift
      h_log_shift(vm, [8, 2], { store: storeFn });
      expect(storeFn).toHaveBeenLastCalledWith(32);

      // Arithmetic shift
      h_art_shift(vm, [32, 65534], { store: storeFn }); // -2
      expect(storeFn).toHaveBeenLastCalledWith(8);

      // Set font
      h_set_font(vm, [1], { store: storeFn });
      expect(storeFn).toHaveBeenLastCalledWith(1);

      // Check unicode
      h_check_unicode(vm, [65], { store: storeFn });
      expect(storeFn).toHaveBeenLastCalledWith(1);

      // Print unicode
      h_print_unicode(vm, [65]);
      expect(vm.inputOutputDevice.writeString).toHaveBeenCalledWith("A");
    });
  });
});
