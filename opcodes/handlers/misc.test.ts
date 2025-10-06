import { h_nop, h_show_status, h_verify, h_piracy } from "./misc";

describe("Miscellaneous Handlers", () => {
  describe("h_nop", () => {
    it("should do nothing", () => {
      const vm = {};
      expect(() => h_nop(vm)).not.toThrow();
    });

    it("should not modify vm", () => {
      const vm = { foo: "bar", count: 42 };
      h_nop(vm);
      expect(vm).toEqual({ foo: "bar", count: 42 });
    });

    it("should work with null vm", () => {
      expect(() => h_nop(null)).not.toThrow();
    });

    it("should work with undefined vm", () => {
      expect(() => h_nop(undefined)).not.toThrow();
    });

    it("should complete synchronously", () => {
      const vm = {};
      const result = h_nop(vm);
      expect(result).toBeUndefined();
    });
  });

  describe("h_show_status", () => {
    it("should do nothing (no-op)", () => {
      const vm = {};
      expect(() => h_show_status(vm)).not.toThrow();
    });

    it("should not modify vm", () => {
      const vm = { status: "initial" };
      h_show_status(vm);
      expect(vm).toEqual({ status: "initial" });
    });

    it("should work with version 1 game", () => {
      const vm = { header: { version: 1 } };
      expect(() => h_show_status(vm)).not.toThrow();
    });

    it("should work with version 3 game", () => {
      const vm = { header: { version: 3 } };
      expect(() => h_show_status(vm)).not.toThrow();
    });

    it("should work with version 5 game", () => {
      const vm = { header: { version: 5 } };
      expect(() => h_show_status(vm)).not.toThrow();
    });

    it("should complete synchronously", () => {
      const vm = {};
      const result = h_show_status(vm);
      expect(result).toBeUndefined();
    });
  });

  describe("h_verify", () => {
    it("should branch true (verification succeeds)", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_verify(vm, [], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should always branch true regardless of vm state", () => {
      const branchFn = jest.fn();
      const vm = { memory: null };
      h_verify(vm, [], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should work without branch function", () => {
      const vm = {};
      expect(() => h_verify(vm, [], {})).not.toThrow();
    });

    it("should ignore operands", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_verify(vm, [1, 2, 3], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should work with empty ctx", () => {
      const vm = {};
      expect(() => h_verify(vm, [], {})).not.toThrow();
    });

    it("should not call branch function twice", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_verify(vm, [], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledTimes(1);
    });

    it("should complete synchronously", () => {
      const branchFn = jest.fn();
      const vm = {};
      const result = h_verify(vm, [], { branch: branchFn });
      expect(result).toBeUndefined();
    });
  });

  describe("h_piracy", () => {
    it("should branch true (game is genuine)", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_piracy(vm, [], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should always branch true regardless of vm state", () => {
      const branchFn = jest.fn();
      const vm = { pirated: true }; // Even if flagged as pirated, still passes
      h_piracy(vm, [], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should work without branch function", () => {
      const vm = {};
      expect(() => h_piracy(vm, [], {})).not.toThrow();
    });

    it("should ignore operands", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_piracy(vm, [1, 2, 3], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should work with version 5 game", () => {
      const branchFn = jest.fn();
      const vm = { header: { version: 5 } };
      h_piracy(vm, [], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should work with version 6 game", () => {
      const branchFn = jest.fn();
      const vm = { header: { version: 6 } };
      h_piracy(vm, [], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should not call branch function twice", () => {
      const branchFn = jest.fn();
      const vm = {};
      h_piracy(vm, [], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledTimes(1);
    });

    it("should complete synchronously", () => {
      const branchFn = jest.fn();
      const vm = {};
      const result = h_piracy(vm, [], { branch: branchFn });
      expect(result).toBeUndefined();
    });
  });
});
