import { h_add, h_sub, h_mul, h_div, h_mod } from "./arithmetic";

describe("Arithmetic Handlers", () => {
  // Mock VM with _storeResult method
  const createMockVM = () => {
    const vm = {
      _storeResult: jest.fn(),
    };
    return vm;
  };

  describe("h_add", () => {
    it("should add two positive numbers", () => {
      const vm = createMockVM();
      h_add(vm, [10, 20]);
      expect(vm._storeResult).toHaveBeenCalledWith(30);
    });

    it("should add zero", () => {
      const vm = createMockVM();
      h_add(vm, [42, 0]);
      expect(vm._storeResult).toHaveBeenCalledWith(42);
    });

    it("should handle maximum 16-bit unsigned values", () => {
      const vm = createMockVM();
      h_add(vm, [65535, 0]);
      expect(vm._storeResult).toHaveBeenCalledWith(65535);
    });

    it("should handle overflow and wrap around", () => {
      const vm = createMockVM();
      // 65535 + 1 should wrap to 0
      h_add(vm, [65535, 1]);
      expect(vm._storeResult).toHaveBeenCalledWith(0);
    });

    it("should handle signed negative values (represented as unsigned)", () => {
      const vm = createMockVM();
      // -1 (65535) + -1 (65535) = -2 (65534)
      h_add(vm, [65535, 65535]);
      expect(vm._storeResult).toHaveBeenCalledWith(65534);
    });

    it("should add negative and positive (signed arithmetic)", () => {
      const vm = createMockVM();
      // 10 + (-5) = 5
      // -5 in 16-bit signed is 65531 (0xFFFB)
      h_add(vm, [10, 65531]);
      expect(vm._storeResult).toHaveBeenCalledWith(5);
    });

    it("should handle adding to negative number", () => {
      const vm = createMockVM();
      // -10 + 5 = -5
      // -10 = 65526, -5 = 65531
      h_add(vm, [65526, 5]);
      expect(vm._storeResult).toHaveBeenCalledWith(65531);
    });

    it("should work when _storeResult is undefined", () => {
      const vm = {};
      expect(() => h_add(vm, [1, 2])).not.toThrow();
    });
  });

  describe("h_sub", () => {
    it("should subtract two positive numbers", () => {
      const vm = createMockVM();
      h_sub(vm, [20, 10]);
      expect(vm._storeResult).toHaveBeenCalledWith(10);
    });

    it("should subtract to zero", () => {
      const vm = createMockVM();
      h_sub(vm, [42, 42]);
      expect(vm._storeResult).toHaveBeenCalledWith(0);
    });

    it("should subtract zero", () => {
      const vm = createMockVM();
      h_sub(vm, [42, 0]);
      expect(vm._storeResult).toHaveBeenCalledWith(42);
    });

    it("should handle underflow and wrap around", () => {
      const vm = createMockVM();
      // 0 - 1 = -1 (65535)
      h_sub(vm, [0, 1]);
      expect(vm._storeResult).toHaveBeenCalledWith(65535);
    });

    it("should subtract negative from positive", () => {
      const vm = createMockVM();
      // 10 - (-5) = 15
      // -5 = 65531
      h_sub(vm, [10, 65531]);
      expect(vm._storeResult).toHaveBeenCalledWith(15);
    });

    it("should subtract positive from negative", () => {
      const vm = createMockVM();
      // -10 - 5 = -15
      // -10 = 65526, -15 = 65521
      h_sub(vm, [65526, 5]);
      expect(vm._storeResult).toHaveBeenCalledWith(65521);
    });

    it("should subtract negative from negative", () => {
      const vm = createMockVM();
      // -10 - (-5) = -5
      // -10 = 65526, -5 = 65531
      h_sub(vm, [65526, 65531]);
      expect(vm._storeResult).toHaveBeenCalledWith(65531);
    });

    it("should work when _storeResult is undefined", () => {
      const vm = {};
      expect(() => h_sub(vm, [5, 3])).not.toThrow();
    });
  });

  describe("h_mul", () => {
    it("should multiply two positive numbers", () => {
      const vm = createMockVM();
      h_mul(vm, [5, 6]);
      expect(vm._storeResult).toHaveBeenCalledWith(30);
    });

    it("should multiply by zero", () => {
      const vm = createMockVM();
      h_mul(vm, [42, 0]);
      expect(vm._storeResult).toHaveBeenCalledWith(0);
    });

    it("should multiply by one", () => {
      const vm = createMockVM();
      h_mul(vm, [42, 1]);
      expect(vm._storeResult).toHaveBeenCalledWith(42);
    });

    it("should handle overflow with wrap around", () => {
      const vm = createMockVM();
      // 256 * 256 = 65536, which wraps to 0
      h_mul(vm, [256, 256]);
      expect(vm._storeResult).toHaveBeenCalledWith(0);
    });

    it("should multiply negative by positive", () => {
      const vm = createMockVM();
      // -5 * 3 = -15
      // -5 = 65531, -15 = 65521
      h_mul(vm, [65531, 3]);
      expect(vm._storeResult).toHaveBeenCalledWith(65521);
    });

    it("should multiply negative by negative", () => {
      const vm = createMockVM();
      // -5 * -3 = 15
      // -5 = 65531, -3 = 65533
      h_mul(vm, [65531, 65533]);
      expect(vm._storeResult).toHaveBeenCalledWith(15);
    });

    it("should multiply large numbers with overflow", () => {
      const vm = createMockVM();
      // 100 * 1000 = 100000, which wraps within 16-bit
      h_mul(vm, [100, 1000]);
      expect(vm._storeResult).toHaveBeenCalledWith(34464); // 100000 & 0xFFFF
    });

    it("should work when _storeResult is undefined", () => {
      const vm = {};
      expect(() => h_mul(vm, [2, 3])).not.toThrow();
    });
  });

  describe("h_div", () => {
    it("should divide two positive numbers", () => {
      const vm = createMockVM();
      h_div(vm, [20, 5]);
      expect(vm._storeResult).toHaveBeenCalledWith(4);
    });

    it("should truncate division results", () => {
      const vm = createMockVM();
      h_div(vm, [7, 2]);
      expect(vm._storeResult).toHaveBeenCalledWith(3);
    });

    it("should divide by one", () => {
      const vm = createMockVM();
      h_div(vm, [42, 1]);
      expect(vm._storeResult).toHaveBeenCalledWith(42);
    });

    it("should handle division resulting in zero", () => {
      const vm = createMockVM();
      h_div(vm, [3, 5]);
      expect(vm._storeResult).toHaveBeenCalledWith(0);
    });

    it("should handle division by zero with error", () => {
      const vm = createMockVM();
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      h_div(vm, [10, 0]);

      expect(consoleSpy).toHaveBeenCalledWith("Division by zero");
      expect(vm._storeResult).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should divide negative by positive", () => {
      const vm = createMockVM();
      // -20 / 5 = -4
      // -20 = 65516, -4 = 65532
      h_div(vm, [65516, 5]);
      expect(vm._storeResult).toHaveBeenCalledWith(65532);
    });

    it("should divide positive by negative", () => {
      const vm = createMockVM();
      // 20 / -5 = -4
      // -5 = 65531, -4 = 65532
      h_div(vm, [20, 65531]);
      expect(vm._storeResult).toHaveBeenCalledWith(65532);
    });

    it("should divide negative by negative", () => {
      const vm = createMockVM();
      // -20 / -5 = 4
      // -20 = 65516, -5 = 65531
      h_div(vm, [65516, 65531]);
      expect(vm._storeResult).toHaveBeenCalledWith(4);
    });

    it("should truncate towards zero for negative results", () => {
      const vm = createMockVM();
      // -7 / 2 = -3.5, truncates to -3
      // -7 = 65529, -3 = 65533
      h_div(vm, [65529, 2]);
      expect(vm._storeResult).toHaveBeenCalledWith(65533);
    });

    it("should work when _storeResult is undefined", () => {
      const vm = {};
      expect(() => h_div(vm, [10, 2])).not.toThrow();
    });
  });

  describe("h_mod", () => {
    it("should compute modulo for positive numbers", () => {
      const vm = createMockVM();
      h_mod(vm, [10, 3]);
      expect(vm._storeResult).toHaveBeenCalledWith(1);
    });

    it("should return zero for exact division", () => {
      const vm = createMockVM();
      h_mod(vm, [10, 5]);
      expect(vm._storeResult).toHaveBeenCalledWith(0);
    });

    it("should handle modulo by one", () => {
      const vm = createMockVM();
      h_mod(vm, [42, 1]);
      expect(vm._storeResult).toHaveBeenCalledWith(0);
    });

    it("should handle dividend smaller than divisor", () => {
      const vm = createMockVM();
      h_mod(vm, [3, 5]);
      expect(vm._storeResult).toHaveBeenCalledWith(3);
    });

    it("should handle modulo by zero with error", () => {
      const vm = createMockVM();
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      h_mod(vm, [10, 0]);

      expect(consoleSpy).toHaveBeenCalledWith("Modulo by zero");
      expect(vm._storeResult).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle negative dividend", () => {
      const vm = createMockVM();
      // -10 % 3 = -1
      // -10 = 65526, -1 = 65535
      h_mod(vm, [65526, 3]);
      expect(vm._storeResult).toHaveBeenCalledWith(65535);
    });

    it("should handle positive dividend and negative divisor", () => {
      const vm = createMockVM();
      // 10 % -3 = 1
      // -3 = 65533
      h_mod(vm, [10, 65533]);
      expect(vm._storeResult).toHaveBeenCalledWith(1);
    });

    it("should handle negative dividend and negative divisor", () => {
      const vm = createMockVM();
      // -10 % -3 = -1
      // -10 = 65526, -3 = 65533, -1 = 65535
      h_mod(vm, [65526, 65533]);
      expect(vm._storeResult).toHaveBeenCalledWith(65535);
    });

    it("should work when _storeResult is undefined", () => {
      const vm = {};
      expect(() => h_mod(vm, [10, 3])).not.toThrow();
    });
  });

  describe("Edge cases and integration", () => {
    it("should handle all operations with maximum values", () => {
      const vm = createMockVM();

      // Add max + 0
      h_add(vm, [65535, 0]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(65535);

      // Subtract max - max
      h_sub(vm, [65535, 65535]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(0);

      // Multiply max * 1
      h_mul(vm, [65535, 1]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(65535);

      // Divide max / max
      h_div(vm, [65535, 65535]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(1);

      // Mod max % 2
      // 65535 is -1 in signed, -1 % 2 = -1 (65535)
      h_mod(vm, [65535, 2]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(65535);
    });

    it("should handle chain of operations", () => {
      const vm = createMockVM();

      // (5 + 3) = 8
      h_add(vm, [5, 3]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(8);

      // (8 * 2) = 16
      h_mul(vm, [8, 2]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(16);

      // (16 / 4) = 4
      h_div(vm, [16, 4]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(4);

      // (4 - 1) = 3
      h_sub(vm, [4, 1]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(3);

      // (3 % 2) = 1
      h_mod(vm, [3, 2]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(1);
    });

    it("should handle boundary between positive and negative", () => {
      const vm = createMockVM();

      // 32767 is max positive signed 16-bit
      h_add(vm, [32767, 0]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(32767);

      // 32768 is -32768 in signed 16-bit (min negative)
      h_add(vm, [32768, 0]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(32768);

      // 32767 + 1 = 32768 = -32768
      h_add(vm, [32767, 1]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(32768);
    });

    it("should handle identity operations", () => {
      const vm = createMockVM();
      const value = 12345;

      // x + 0 = x
      h_add(vm, [value, 0]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(value);

      // x - 0 = x
      h_sub(vm, [value, 0]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(value);

      // x * 1 = x
      h_mul(vm, [value, 1]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(value);

      // x / 1 = x
      h_div(vm, [value, 1]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(value);
    });

    it("should handle zero operations", () => {
      const vm = createMockVM();

      // 0 + 0 = 0
      h_add(vm, [0, 0]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(0);

      // 0 - 0 = 0
      h_sub(vm, [0, 0]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(0);

      // 0 * x = 0
      h_mul(vm, [0, 999]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(0);

      // 0 / x = 0
      h_div(vm, [0, 999]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(0);

      // 0 % x = 0
      h_mod(vm, [0, 999]);
      expect(vm._storeResult).toHaveBeenLastCalledWith(0);
    });
  });

  describe("Signed/Unsigned conversion behavior", () => {
    it("should correctly convert signed to unsigned for storage", () => {
      const vm = createMockVM();

      // All results should be stored as unsigned 16-bit values
      // Even when the signed arithmetic produces negative results

      // -1 should be stored as 65535
      h_sub(vm, [0, 1]);
      expect(vm._storeResult).toHaveBeenCalledWith(65535);

      // -32768 should be stored as 32768
      h_sub(vm, [0, 32768]);
      expect(vm._storeResult).toHaveBeenCalledWith(32768);
    });

    it("should treat input values as signed when computing", () => {
      const vm = createMockVM();

      // 65535 should be treated as -1 in signed arithmetic
      // -1 + -1 = -2, stored as 65534
      h_add(vm, [65535, 65535]);
      expect(vm._storeResult).toHaveBeenCalledWith(65534);

      // 65535 - 1 = -1 - 1 = -2, stored as 65534
      h_sub(vm, [65535, 1]);
      expect(vm._storeResult).toHaveBeenCalledWith(65534);
    });
  });
});
