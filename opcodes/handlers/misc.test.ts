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
    it("should do nothing when inputOutputDevice is missing", () => {
      const vm = {};
      expect(() => h_show_status(vm)).not.toThrow();
    });

    it("should do nothing when memory is missing", () => {
      const vm: any = {
        inputOutputDevice: { writeString: jest.fn() }
      };
      h_show_status(vm);
      expect(vm.inputOutputDevice.writeString).not.toHaveBeenCalled();
    });

    it("should do nothing when header is missing", () => {
      const vm: any = {
        inputOutputDevice: { writeString: jest.fn() },
        memory: {}
      };
      h_show_status(vm);
      expect(vm.inputOutputDevice.writeString).not.toHaveBeenCalled();
    });

    it("should do nothing for v4+ games", () => {
      const vm: any = {
        inputOutputDevice: { writeString: jest.fn() },
        memory: { readUInt8: jest.fn() },
        header: { version: 4 }
      };
      h_show_status(vm);
      expect(vm.inputOutputDevice.writeString).not.toHaveBeenCalled();
    });

    it("should update status line for v3 score game", () => {
      const writeString = jest.fn();
      const vm: any = {
        inputOutputDevice: { writeString },
        memory: {
          readUInt8: jest.fn(() => 0x00), // Flags 1, bit 1 = 0 (score game)
          readUInt16BE: jest.fn(() => 100) // property table address
        },
        header: {
          version: 3,
          objectTableAddress: 0
        },
        getVariableValue: jest.fn((varNum) => {
          if (varNum === 16) return 1; // location object
          if (varNum === 17) return 10; // score
          if (varNum === 18) return 25; // turns
          return 0;
        }),
        decodeZSCII: jest.fn(() => "West of House"),
        pc: 0
      };

      // Status line writes directly to process.stdout, so we just verify it doesn't throw
      expect(() => h_show_status(vm)).not.toThrow();

      // Verify the VM methods were called to read the status line data
      expect(vm.getVariableValue).toHaveBeenCalledWith(16); // location
      expect(vm.getVariableValue).toHaveBeenCalledWith(17); // score
      expect(vm.getVariableValue).toHaveBeenCalledWith(18); // turns
    });

    it("should update status line for v3 time game", () => {
      const writeString = jest.fn();
      const vm: any = {
        inputOutputDevice: { writeString },
        memory: {
          readUInt8: jest.fn(() => 0x02), // Flags 1, bit 1 = 1 (time game)
          readUInt16BE: jest.fn(() => 100)
        },
        header: {
          version: 3,
          objectTableAddress: 0
        },
        getVariableValue: jest.fn((varNum) => {
          if (varNum === 16) return 1; // location object
          if (varNum === 17) return 14; // hours
          if (varNum === 18) return 30; // minutes
          return 0;
        }),
        decodeZSCII: jest.fn(() => "Office"),
        pc: 0
      };

      // Status line writes directly to process.stdout, so we just verify it doesn't throw
      expect(() => h_show_status(vm)).not.toThrow();

      // Verify the VM methods were called to read the status line data
      expect(vm.getVariableValue).toHaveBeenCalledWith(16); // location
      expect(vm.getVariableValue).toHaveBeenCalledWith(17); // hours
      expect(vm.getVariableValue).toHaveBeenCalledWith(18); // minutes
    });

    it("should handle missing location object", () => {
      const writeString = jest.fn();
      const vm: any = {
        inputOutputDevice: { writeString },
        memory: {
          readUInt8: jest.fn(() => 0x00),
          readUInt16BE: jest.fn(() => 100)
        },
        header: {
          version: 3,
          objectTableAddress: 0
        },
        getVariableValue: jest.fn((varNum) => {
          if (varNum === 16) return 0; // no location object
          if (varNum === 17) return 5;
          if (varNum === 18) return 10;
          return 0;
        }),
        decodeZSCII: jest.fn(() => ""),
        pc: 0
      };

      // Should still work even with no location (writes empty string for location name)
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
