import { h_and, h_or, h_not, h_test } from "./logic";

describe("Logic Handlers", () => {
  describe("h_and", () => {
    it("should perform bitwise AND on two numbers", () => {
      const vm = { _storeResult: jest.fn() };
      h_and(vm, [0b1111, 0b1010]);
      expect(vm._storeResult).toHaveBeenCalledWith(0b1010);
    });

    it("should AND two numbers with result 0", () => {
      const vm = { _storeResult: jest.fn() };
      h_and(vm, [0b1010, 0b0101]);
      expect(vm._storeResult).toHaveBeenCalledWith(0);
    });

    it("should handle all bits set", () => {
      const vm = { _storeResult: jest.fn() };
      h_and(vm, [0xffff, 0xffff]);
      expect(vm._storeResult).toHaveBeenCalledWith(0xffff);
    });

    it("should handle zero operands", () => {
      const vm = { _storeResult: jest.fn() };
      h_and(vm, [0, 0xffff]);
      expect(vm._storeResult).toHaveBeenCalledWith(0);
    });

    it("should mask result to 16 bits", () => {
      const vm = { _storeResult: jest.fn() };
      h_and(vm, [0x1ffff, 0xffff]);
      expect(vm._storeResult).toHaveBeenCalledWith(0xffff);
    });

    it("should handle specific bit patterns", () => {
      const vm = { _storeResult: jest.fn() };
      h_and(vm, [0xf0f0, 0x0f0f]);
      expect(vm._storeResult).toHaveBeenCalledWith(0);
    });

    it("should work without _storeResult", () => {
      const vm = {};
      expect(() => h_and(vm, [5, 3])).not.toThrow();
    });
  });

  describe("h_or", () => {
    it("should perform bitwise OR on two numbers", () => {
      const vm = { _storeResult: jest.fn() };
      h_or(vm, [0b1010, 0b0101]);
      expect(vm._storeResult).toHaveBeenCalledWith(0b1111);
    });

    it("should OR with zero", () => {
      const vm = { _storeResult: jest.fn() };
      h_or(vm, [0b1010, 0]);
      expect(vm._storeResult).toHaveBeenCalledWith(0b1010);
    });

    it("should handle all bits set", () => {
      const vm = { _storeResult: jest.fn() };
      h_or(vm, [0xffff, 0xffff]);
      expect(vm._storeResult).toHaveBeenCalledWith(0xffff);
    });

    it("should handle zero operands", () => {
      const vm = { _storeResult: jest.fn() };
      h_or(vm, [0, 0]);
      expect(vm._storeResult).toHaveBeenCalledWith(0);
    });

    it("should mask result to 16 bits", () => {
      const vm = { _storeResult: jest.fn() };
      h_or(vm, [0x10000, 0x10000]);
      expect(vm._storeResult).toHaveBeenCalledWith(0);
    });

    it("should combine different bit patterns", () => {
      const vm = { _storeResult: jest.fn() };
      h_or(vm, [0xf0f0, 0x0f0f]);
      expect(vm._storeResult).toHaveBeenCalledWith(0xffff);
    });

    it("should work without _storeResult", () => {
      const vm = {};
      expect(() => h_or(vm, [5, 3])).not.toThrow();
    });
  });

  describe("h_not", () => {
    it("should perform bitwise NOT on a number", () => {
      const vm = { _storeResult: jest.fn() };
      h_not(vm, [0]);
      expect(vm._storeResult).toHaveBeenCalledWith(0xffff);
    });

    it("should NOT all bits set", () => {
      const vm = { _storeResult: jest.fn() };
      h_not(vm, [0xffff]);
      expect(vm._storeResult).toHaveBeenCalledWith(0);
    });

    it("should NOT alternating bits", () => {
      const vm = { _storeResult: jest.fn() };
      h_not(vm, [0xaaaa]);
      expect(vm._storeResult).toHaveBeenCalledWith(0x5555);
    });

    it("should NOT specific pattern", () => {
      const vm = { _storeResult: jest.fn() };
      h_not(vm, [0x0f0f]);
      expect(vm._storeResult).toHaveBeenCalledWith(0xf0f0);
    });

    it("should mask result to 16 bits", () => {
      const vm = { _storeResult: jest.fn() };
      h_not(vm, [0x10000]);
      expect(vm._storeResult).toHaveBeenCalledWith(0xffff);
    });

    it("should NOT single bit", () => {
      const vm = { _storeResult: jest.fn() };
      h_not(vm, [1]);
      expect(vm._storeResult).toHaveBeenCalledWith(0xfffe);
    });

    it("should work without _storeResult", () => {
      const vm = {};
      expect(() => h_not(vm, [5])).not.toThrow();
    });
  });

  describe("h_test", () => {
    it("should branch true when all flags are set in bitmap", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_test(vm, [0b1111, 0b1010], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should branch false when not all flags are set", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_test(vm, [0b1010, 0b1111], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should branch true when testing zero flags", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_test(vm, [0b1010, 0], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should branch true when bitmap and flags are identical", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_test(vm, [0xffff, 0xffff], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should branch false when bitmap is zero but flags are not", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_test(vm, [0, 0b0001], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should branch true for single flag set", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_test(vm, [0b0100, 0b0100], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should branch false when only some flags are set", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_test(vm, [0b1100, 0b1110], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should branch true when multiple flags are all set", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_test(vm, [0b1111, 0b0011], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should work without branch function", () => {
      const vm = {};
      expect(() => h_test(vm, [0b1111, 0b1010], {})).not.toThrow();
    });

    it("should test specific bit patterns", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_test(vm, [0xf0f0, 0x00f0], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should fail when extra bits needed", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_test(vm, [0xf0f0, 0xf0ff], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(false);
    });
  });
});
