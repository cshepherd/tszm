import {
  h_rtrue,
  h_rfalse,
  h_ret,
  h_ret_popped,
  h_quit,
  h_jz,
  h_jl,
  h_jg,
  h_je,
  h_jump,
} from "./flow";

describe("Flow Control Handlers", () => {
  describe("h_rtrue", () => {
    it("should call returnFromRoutine with 1", () => {
      const vm = {
        returnFromRoutine: jest.fn(),
      };

      h_rtrue(vm);

      expect(vm.returnFromRoutine).toHaveBeenCalledWith(1);
    });

    it("should call returnFromRoutine exactly once", () => {
      const vm = {
        returnFromRoutine: jest.fn(),
      };

      h_rtrue(vm);

      expect(vm.returnFromRoutine).toHaveBeenCalledTimes(1);
    });
  });

  describe("h_rfalse", () => {
    it("should call returnFromRoutine with 0", () => {
      const vm = {
        returnFromRoutine: jest.fn(),
      };

      h_rfalse(vm);

      expect(vm.returnFromRoutine).toHaveBeenCalledWith(0);
    });

    it("should call returnFromRoutine exactly once", () => {
      const vm = {
        returnFromRoutine: jest.fn(),
      };

      h_rfalse(vm);

      expect(vm.returnFromRoutine).toHaveBeenCalledTimes(1);
    });
  });

  describe("h_ret", () => {
    it("should return the provided value", () => {
      const vm = {
        returnFromRoutine: jest.fn(),
      };

      h_ret(vm, [42]);

      expect(vm.returnFromRoutine).toHaveBeenCalledWith(42);
    });

    it("should return 0", () => {
      const vm = {
        returnFromRoutine: jest.fn(),
      };

      h_ret(vm, [0]);

      expect(vm.returnFromRoutine).toHaveBeenCalledWith(0);
    });

    it("should return maximum 16-bit value", () => {
      const vm = {
        returnFromRoutine: jest.fn(),
      };

      h_ret(vm, [65535]);

      expect(vm.returnFromRoutine).toHaveBeenCalledWith(65535);
    });

    it("should return negative value (as unsigned)", () => {
      const vm = {
        returnFromRoutine: jest.fn(),
      };

      h_ret(vm, [65535]); // -1 as unsigned

      expect(vm.returnFromRoutine).toHaveBeenCalledWith(65535);
    });
  });

  describe("h_ret_popped", () => {
    it("should pop value from stack and return it", () => {
      const vm = {
        stack: [10, 20, 30],
        returnFromRoutine: jest.fn(),
      };

      h_ret_popped(vm);

      expect(vm.returnFromRoutine).toHaveBeenCalledWith(30);
      expect(vm.stack).toEqual([10, 20]);
    });

    it("should return 0 when stack is empty", () => {
      const vm = {
        stack: [],
        returnFromRoutine: jest.fn(),
      };

      h_ret_popped(vm);

      expect(vm.returnFromRoutine).toHaveBeenCalledWith(0);
    });

    it("should handle single value on stack", () => {
      const vm = {
        stack: [99],
        returnFromRoutine: jest.fn(),
      };

      h_ret_popped(vm);

      expect(vm.returnFromRoutine).toHaveBeenCalledWith(99);
      expect(vm.stack).toEqual([]);
    });

    it("should pop and return 0 from stack", () => {
      const vm = {
        stack: [0],
        returnFromRoutine: jest.fn(),
      };

      h_ret_popped(vm);

      expect(vm.returnFromRoutine).toHaveBeenCalledWith(0);
    });
  });

  describe("h_quit", () => {
    it("should throw QUIT error", () => {
      const vm = {};

      expect(() => h_quit(vm)).toThrow("QUIT");
    });

    it("should throw Error type", () => {
      const vm = {};

      expect(() => h_quit(vm)).toThrow(Error);
    });
  });

  describe("h_jz", () => {
    it("should branch when value is 0", () => {
      const branchFn = jest.fn();

      h_jz({}, [0], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should not branch when value is non-zero", () => {
      const branchFn = jest.fn();

      h_jz({}, [1], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should not branch for positive value", () => {
      const branchFn = jest.fn();

      h_jz({}, [42], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should not branch for negative value", () => {
      const branchFn = jest.fn();

      h_jz({}, [65535], { branch: branchFn }); // -1 as unsigned

      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should work when branch is not provided", () => {
      expect(() => h_jz({}, [0], {})).not.toThrow();
    });
  });

  describe("h_jl", () => {
    it("should branch when first is less than second (positive)", () => {
      const branchFn = jest.fn();

      h_jl({}, [5, 10], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should not branch when first equals second", () => {
      const branchFn = jest.fn();

      h_jl({}, [10, 10], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should not branch when first is greater than second", () => {
      const branchFn = jest.fn();

      h_jl({}, [10, 5], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should handle negative numbers (signed comparison)", () => {
      const branchFn = jest.fn();

      // -5 < 5 (true)
      // -5 as unsigned = 65531
      h_jl({}, [65531, 5], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should compare two negative numbers", () => {
      const branchFn = jest.fn();

      // -10 < -5 (true)
      // -10 = 65526, -5 = 65531
      h_jl({}, [65526, 65531], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should handle zero comparison", () => {
      const branchFn = jest.fn();

      // 0 < 5 (true)
      h_jl({}, [0, 5], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should handle negative compared to zero", () => {
      const branchFn = jest.fn();

      // -1 < 0 (true)
      // -1 = 65535
      h_jl({}, [65535, 0], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should work when branch is not provided", () => {
      expect(() => h_jl({}, [1, 2], {})).not.toThrow();
    });
  });

  describe("h_jg", () => {
    it("should branch when first is greater than second", () => {
      const branchFn = jest.fn();

      h_jg({}, [10, 5], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should not branch when first equals second", () => {
      const branchFn = jest.fn();

      h_jg({}, [10, 10], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should not branch when first is less than second", () => {
      const branchFn = jest.fn();

      h_jg({}, [5, 10], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should handle negative numbers (signed comparison)", () => {
      const branchFn = jest.fn();

      // 5 > -5 (true)
      // -5 as unsigned = 65531
      h_jg({}, [5, 65531], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should compare two negative numbers", () => {
      const branchFn = jest.fn();

      // -5 > -10 (true)
      // -5 = 65531, -10 = 65526
      h_jg({}, [65531, 65526], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should handle zero comparison", () => {
      const branchFn = jest.fn();

      // 5 > 0 (true)
      h_jg({}, [5, 0], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should handle zero compared to negative", () => {
      const branchFn = jest.fn();

      // 0 > -1 (true)
      // -1 = 65535
      h_jg({}, [0, 65535], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should work when branch is not provided", () => {
      expect(() => h_jg({}, [10, 5], {})).not.toThrow();
    });
  });

  describe("h_je", () => {
    it("should branch when first equals second (2 operands)", () => {
      const branchFn = jest.fn();

      h_je({}, [5, 5], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should not branch when values are different (2 operands)", () => {
      const branchFn = jest.fn();

      h_je({}, [5, 10], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should branch when first matches second (3 operands)", () => {
      const branchFn = jest.fn();

      h_je({}, [5, 10, 5], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should branch when first matches third (3 operands)", () => {
      const branchFn = jest.fn();

      h_je({}, [5, 10, 15], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should branch when first matches any (4 operands)", () => {
      const branchFn = jest.fn();

      h_je({}, [5, 10, 15, 5], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should not branch when first matches none", () => {
      const branchFn = jest.fn();

      h_je({}, [5, 10, 15, 20], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should handle zero comparison", () => {
      const branchFn = jest.fn();

      h_je({}, [0, 0], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should handle multiple matches", () => {
      const branchFn = jest.fn();

      // First matches both second and third
      h_je({}, [5, 5, 5], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should handle single operand (edge case)", () => {
      const branchFn = jest.fn();

      // With only one operand, there's nothing to compare against
      h_je({}, [5], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should handle negative values", () => {
      const branchFn = jest.fn();

      // -1 = 65535
      h_je({}, [65535, 65535], { branch: branchFn });

      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should work when branch is not provided", () => {
      expect(() => h_je({}, [5, 5], {})).not.toThrow();
    });
  });

  describe("h_jump", () => {
    it("should jump forward with positive offset", () => {
      const vm = { pc: 0x1000 };

      h_jump(vm, [100]);

      // pc + offset - 2 = 0x1000 + 100 - 2 = 0x1062
      expect(vm.pc).toBe(0x1062);
    });

    it("should jump backward with negative offset", () => {
      const vm = { pc: 0x1000 };

      // -100 as unsigned = 65436
      h_jump(vm, [65436]);

      // pc + (-100) - 2 = 0x1000 - 100 - 2 = 0x0F9A (4026)
      expect(vm.pc).toBe(0x0f9a);
    });

    it("should handle offset of 2 (stay in place)", () => {
      const vm = { pc: 0x1000 };

      // offset 2 - 2 = 0 (stays at same position)
      h_jump(vm, [2]);

      expect(vm.pc).toBe(0x1000);
    });

    it("should handle offset of 0", () => {
      const vm = { pc: 0x1000 };

      // offset 0 - 2 = -2 (jump back 2)
      h_jump(vm, [0]);

      expect(vm.pc).toBe(0x0ffe);
    });

    it("should handle large positive offset", () => {
      const vm = { pc: 0x1000 };

      h_jump(vm, [1000]);

      // 0x1000 + 1000 - 2 = 0x13E6
      expect(vm.pc).toBe(0x13e6);
    });

    it("should handle large negative offset", () => {
      const vm = { pc: 0x2000 };

      // -1000 as unsigned = 64536
      h_jump(vm, [64536]);

      // 0x2000 (8192) - 1000 - 2 = 7190 (0x1C16)
      expect(vm.pc).toBe(0x1c16);
    });

    it("should handle signed conversion at boundary", () => {
      const vm = { pc: 0x8000 };

      // 32768 (0x8000) is on the boundary - stays positive
      h_jump(vm, [32768]);

      // Should treat as negative: -32768 - 2 = -32770
      expect(vm.pc).toBe(0x8000 - 32768 - 2);
    });

    it("should modify PC in place", () => {
      const vm = { pc: 100 };
      const originalVm = vm;

      h_jump(vm, [10]);

      expect(vm).toBe(originalVm);
      expect(vm.pc).toBe(108);
    });
  });

  describe("Integration and edge cases", () => {
    it("should handle all return operations", () => {
      const vm1 = { returnFromRoutine: jest.fn() };
      const vm2 = { returnFromRoutine: jest.fn() };
      const vm3 = { returnFromRoutine: jest.fn() };
      const vm4 = { stack: [42], returnFromRoutine: jest.fn() };

      h_rtrue(vm1);
      h_rfalse(vm2);
      h_ret(vm3, [99]);
      h_ret_popped(vm4);

      expect(vm1.returnFromRoutine).toHaveBeenCalledWith(1);
      expect(vm2.returnFromRoutine).toHaveBeenCalledWith(0);
      expect(vm3.returnFromRoutine).toHaveBeenCalledWith(99);
      expect(vm4.returnFromRoutine).toHaveBeenCalledWith(42);
    });

    it("should handle all branch conditions in sequence", () => {
      const branchFn = jest.fn();

      // jz: 0 is zero
      h_jz({}, [0], { branch: branchFn });
      expect(branchFn).toHaveBeenLastCalledWith(true);

      // jl: 5 < 10
      h_jl({}, [5, 10], { branch: branchFn });
      expect(branchFn).toHaveBeenLastCalledWith(true);

      // jg: 10 > 5
      h_jg({}, [10, 5], { branch: branchFn });
      expect(branchFn).toHaveBeenLastCalledWith(true);

      // je: 5 == 5
      h_je({}, [5, 5], { branch: branchFn });
      expect(branchFn).toHaveBeenLastCalledWith(true);
    });

    it("should handle boundary values for comparisons", () => {
      const branchFn = jest.fn();

      // Max positive (32767) < max value (treated as -1)
      h_jl({}, [32767, 65535], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(false); // 32767 > -1

      // Min negative (32768 = -32768) < 0
      h_jl({}, [32768, 0], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should handle je with variable operand counts", () => {
      const branchFn = jest.fn();

      // 2 operands
      h_je({}, [5, 5], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);

      // 3 operands - match
      h_je({}, [5, 10, 5], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);

      // 4 operands - no match
      h_je({}, [5, 10, 15, 20], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should handle jump with PC wrapping", () => {
      const vm = { pc: 10 };

      // Jump back beyond 0 (would wrap in actual implementation)
      h_jump(vm, [65526]); // -10 as unsigned

      // 10 + (-10) - 2 = -2
      expect(vm.pc).toBe(-2);
    });

    it("should demonstrate signed vs unsigned interpretation", () => {
      const branchFn = jest.fn();

      // Value 32768 is positive as unsigned, negative as signed (-32768)
      // Compare with 0
      h_jl({}, [32768, 0], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true); // -32768 < 0

      h_jg({}, [32768, 0], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(false); // -32768 not > 0
    });
  });

  describe("Error conditions and robustness", () => {
    it("should handle ret_popped with undefined stack value", () => {
      const vm = {
        stack: [undefined],
        returnFromRoutine: jest.fn(),
      };

      h_ret_popped(vm);

      expect(vm.returnFromRoutine).toHaveBeenCalledWith(0);
    });

    it("should handle all branch handlers with missing branch callback", () => {
      expect(() => h_jz({}, [0], {})).not.toThrow();
      expect(() => h_jl({}, [1, 2], {})).not.toThrow();
      expect(() => h_jg({}, [2, 1], {})).not.toThrow();
      expect(() => h_je({}, [1, 1], {})).not.toThrow();
    });
  });
});
