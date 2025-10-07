import {
  d0,
  d1,
  d2,
  dv,
  InstrDescriptor,
  OperandType,
  CountKind,
  ExecCtx,
} from "./types";

describe("Opcode Types and Helpers", () => {
  describe("Type definitions", () => {
    it("should define OperandType union type", () => {
      const validOperandTypes: OperandType[] = [
        "large",
        "small",
        "var",
        "omit",
      ];

      validOperandTypes.forEach((type) => {
        const t: OperandType = type;
        expect(t).toBe(type);
      });
    });

    it("should define CountKind union type", () => {
      const validCountKinds: CountKind[] = ["0OP", "1OP", "2OP", "VAR", "EXT"];

      validCountKinds.forEach((kind) => {
        const k: CountKind = kind;
        expect(k).toBe(kind);
      });
    });

    it("should define ExecCtx interface with optional store and branch", () => {
      const ctx1: ExecCtx = {};
      expect(ctx1.store).toBeUndefined();
      expect(ctx1.branch).toBeUndefined();

      const storeFn = (value: number) => value * 2;
      const branchFn = (cond: boolean) => cond;

      const ctx2: ExecCtx = {
        store: storeFn,
        branch: branchFn,
      };

      expect(ctx2.store).toBe(storeFn);
      expect(ctx2.branch).toBe(branchFn);
    });

    it("should define InstrDescriptor interface", () => {
      const mockHandler = (_vm: any, _operands: number[], _ctx: ExecCtx) => {};

      const descriptor: InstrDescriptor = {
        name: "test",
        kind: "0OP",
        opcode: 0x00,
        handler: mockHandler,
      };

      expect(descriptor.name).toBe("test");
      expect(descriptor.kind).toBe("0OP");
      expect(descriptor.opcode).toBe(0x00);
      expect(descriptor.handler).toBe(mockHandler);
    });

    it("should allow optional fields in InstrDescriptor", () => {
      const mockHandler = (_vm: any, _operands: number[], _ctx: ExecCtx) => {};

      const descriptor: InstrDescriptor = {
        name: "test",
        kind: "1OP",
        opcode: 0x05,
        minVersion: 3,
        maxVersion: 5,
        operandKinds: ["small"],
        doesStore: true,
        doesBranch: false,
        handler: mockHandler,
      };

      expect(descriptor.minVersion).toBe(3);
      expect(descriptor.maxVersion).toBe(5);
      expect(descriptor.operandKinds).toEqual(["small"]);
      expect(descriptor.doesStore).toBe(true);
      expect(descriptor.doesBranch).toBe(false);
    });
  });

  describe("d0 helper (0OP opcodes)", () => {
    it("should create valid 0OP descriptor for opcode 0x00", () => {
      const mockHandler = jest.fn();
      const descriptor = d0(0x00, {
        name: "rtrue",
        operandKinds: [],
        handler: mockHandler,
      });

      expect(descriptor.kind).toBe("0OP");
      expect(descriptor.opcode).toBe(0x00);
      expect(descriptor.name).toBe("rtrue");
      expect(descriptor.operandKinds).toEqual([]);
      expect(descriptor.handler).toBe(mockHandler);
    });

    it("should create valid 0OP descriptor for opcode 0x0F (max)", () => {
      const mockHandler = jest.fn();
      const descriptor = d0(0x0f, {
        name: "piracy",
        operandKinds: [],
        doesBranch: true,
        handler: mockHandler,
      });

      expect(descriptor.kind).toBe("0OP");
      expect(descriptor.opcode).toBe(0x0f);
      expect(descriptor.name).toBe("piracy");
      expect(descriptor.doesBranch).toBe(true);
    });

    it("should throw error for opcode below range", () => {
      const mockHandler = jest.fn();
      expect(() => {
        d0(-1, {
          name: "invalid",
          handler: mockHandler,
        });
      }).toThrow("0OP opcode out of range: -1");
    });

    it("should throw error for opcode above range", () => {
      const mockHandler = jest.fn();
      expect(() => {
        d0(0x10, {
          name: "invalid",
          handler: mockHandler,
        });
      }).toThrow("0OP opcode out of range: 16");
    });

    it("should support optional minVersion and maxVersion", () => {
      const mockHandler = jest.fn();
      const descriptor = d0(0x0c, {
        name: "show_status",
        operandKinds: [],
        maxVersion: 3,
        handler: mockHandler,
      });

      expect(descriptor.maxVersion).toBe(3);
      expect(descriptor.minVersion).toBeUndefined();
    });
  });

  describe("d1 helper (1OP opcodes)", () => {
    it("should create valid 1OP descriptor for opcode 0x00", () => {
      const mockHandler = jest.fn();
      const descriptor = d1(0x00, {
        name: "jz",
        doesBranch: true,
        handler: mockHandler,
      });

      expect(descriptor.kind).toBe("1OP");
      expect(descriptor.opcode).toBe(0x00);
      expect(descriptor.name).toBe("jz");
      expect(descriptor.doesBranch).toBe(true);
    });

    it("should create valid 1OP descriptor for opcode 0x0F (max)", () => {
      const mockHandler = jest.fn();
      const descriptor = d1(0x0f, {
        name: "not",
        doesStore: true,
        maxVersion: 4,
        handler: mockHandler,
      });

      expect(descriptor.kind).toBe("1OP");
      expect(descriptor.opcode).toBe(0x0f);
      expect(descriptor.doesStore).toBe(true);
      expect(descriptor.maxVersion).toBe(4);
    });

    it("should throw error for opcode below range", () => {
      const mockHandler = jest.fn();
      expect(() => {
        d1(-1, {
          name: "invalid",
          handler: mockHandler,
        });
      }).toThrow("1OP opcode out of range: -1");
    });

    it("should throw error for opcode above range", () => {
      const mockHandler = jest.fn();
      expect(() => {
        d1(0x10, {
          name: "invalid",
          handler: mockHandler,
        });
      }).toThrow("1OP opcode out of range: 16");
    });

    it("should support operandKinds for fixed-arity opcodes", () => {
      const mockHandler = jest.fn();
      const descriptor = d1(0x05, {
        name: "inc",
        operandKinds: ["small"],
        handler: mockHandler,
      });

      expect(descriptor.operandKinds).toEqual(["small"]);
    });

    it("should support both store and branch flags", () => {
      const mockHandler = jest.fn();
      const descriptor = d1(0x01, {
        name: "get_sibling",
        doesStore: true,
        doesBranch: true,
        handler: mockHandler,
      });

      expect(descriptor.doesStore).toBe(true);
      expect(descriptor.doesBranch).toBe(true);
    });
  });

  describe("d2 helper (2OP opcodes)", () => {
    it("should create valid 2OP descriptor for opcode 0x01", () => {
      const mockHandler = jest.fn();
      const descriptor = d2(0x01, {
        name: "je",
        operandKinds: ["var", "var"],
        doesBranch: true,
        handler: mockHandler,
      });

      expect(descriptor.kind).toBe("2OP");
      expect(descriptor.opcode).toBe(0x01);
      expect(descriptor.name).toBe("je");
      expect(descriptor.operandKinds).toEqual(["var", "var"]);
      expect(descriptor.doesBranch).toBe(true);
    });

    it("should create valid 2OP descriptor for opcode 0x1F (max)", () => {
      const mockHandler = jest.fn();
      const descriptor = d2(0x1f, {
        name: "max_opcode",
        handler: mockHandler,
      });

      expect(descriptor.kind).toBe("2OP");
      expect(descriptor.opcode).toBe(0x1f);
    });

    it("should throw error for opcode below range", () => {
      const mockHandler = jest.fn();
      expect(() => {
        d2(-1, {
          name: "invalid",
          handler: mockHandler,
        });
      }).toThrow("2OP opcode out of range: -1");
    });

    it("should throw error for opcode above range", () => {
      const mockHandler = jest.fn();
      expect(() => {
        d2(0x20, {
          name: "invalid",
          handler: mockHandler,
        });
      }).toThrow("2OP opcode out of range: 32");
    });

    it("should support mixed operandKinds", () => {
      const mockHandler = jest.fn();
      const descriptor = d2(0x04, {
        name: "dec_chk",
        operandKinds: ["small", "var"],
        doesBranch: true,
        handler: mockHandler,
      });

      expect(descriptor.operandKinds).toEqual(["small", "var"]);
    });

    it("should support store flag for arithmetic operations", () => {
      const mockHandler = jest.fn();
      const descriptor = d2(0x14, {
        name: "add",
        operandKinds: ["var", "var"],
        doesStore: true,
        handler: mockHandler,
      });

      expect(descriptor.doesStore).toBe(true);
    });
  });

  describe("dv helper (VAR opcodes)", () => {
    it("should create valid VAR descriptor for opcode 0x00", () => {
      const mockHandler = jest.fn();
      const descriptor = dv(0x00, {
        name: "call",
        doesStore: true,
        handler: mockHandler,
      });

      expect(descriptor.kind).toBe("VAR");
      expect(descriptor.opcode).toBe(0x00);
      expect(descriptor.name).toBe("call");
      expect(descriptor.doesStore).toBe(true);
    });

    it("should create valid VAR descriptor for opcode 0xFF (max)", () => {
      const mockHandler = jest.fn();
      const descriptor = dv(0xff, {
        name: "max_opcode",
        handler: mockHandler,
      });

      expect(descriptor.kind).toBe("VAR");
      expect(descriptor.opcode).toBe(0xff);
    });

    it("should throw error for opcode below range", () => {
      const mockHandler = jest.fn();
      expect(() => {
        dv(-1, {
          name: "invalid",
          handler: mockHandler,
        });
      }).toThrow("VAR opcode out of range: -1");
    });

    it("should throw error for opcode above range", () => {
      const mockHandler = jest.fn();
      expect(() => {
        dv(0x100, {
          name: "invalid",
          handler: mockHandler,
        });
      }).toThrow("VAR opcode out of range: 256");
    });

    it("should support minVersion for version-specific opcodes", () => {
      const mockHandler = jest.fn();
      const descriptor = dv(0x09, {
        name: "pull",
        minVersion: 5,
        handler: mockHandler,
      });

      expect(descriptor.minVersion).toBe(5);
    });

    it("should not require operandKinds for variable-arity opcodes", () => {
      const mockHandler = jest.fn();
      const descriptor = dv(0x01, {
        name: "storew",
        handler: mockHandler,
      });

      expect(descriptor.operandKinds).toBeUndefined();
    });
  });

  describe("Handler function signatures", () => {
    it("should accept handler with vm, operands, and ctx parameters", () => {
      const mockVm = { pc: 0 };
      const mockOperands = [1, 2, 3];
      const mockCtx: ExecCtx = {
        store: jest.fn(),
        branch: jest.fn(),
      };

      const mockHandler = jest.fn(
        (vm: any, operands: number[], ctx: ExecCtx) => {
          expect(vm).toBe(mockVm);
          expect(operands).toBe(mockOperands);
          expect(ctx).toBe(mockCtx);
        },
      );

      const descriptor = d0(0x00, {
        name: "test",
        handler: mockHandler,
      });

      descriptor.handler(mockVm, mockOperands, mockCtx);
      expect(mockHandler).toHaveBeenCalledWith(mockVm, mockOperands, mockCtx);
    });

    it("should allow handlers that use store context", () => {
      const storeFn = jest.fn();
      const mockCtx: ExecCtx = { store: storeFn };

      const mockHandler = (vm: any, operands: number[], ctx: ExecCtx) => {
        if (ctx.store) {
          ctx.store(operands[0] + operands[1]);
        }
      };

      const descriptor = d2(0x14, {
        name: "add",
        doesStore: true,
        handler: mockHandler,
      });

      descriptor.handler({}, [5, 3], mockCtx);
      expect(storeFn).toHaveBeenCalledWith(8);
    });

    it("should allow handlers that use branch context", () => {
      const branchFn = jest.fn();
      const mockCtx: ExecCtx = { branch: branchFn };

      const mockHandler = (vm: any, operands: number[], ctx: ExecCtx) => {
        if (ctx.branch) {
          ctx.branch(operands[0] === 0);
        }
      };

      const descriptor = d1(0x00, {
        name: "jz",
        doesBranch: true,
        handler: mockHandler,
      });

      descriptor.handler({}, [0], mockCtx);
      expect(branchFn).toHaveBeenCalledWith(true);

      descriptor.handler({}, [1], mockCtx);
      expect(branchFn).toHaveBeenCalledWith(false);
    });
  });

  describe("Edge cases and boundary conditions", () => {
    it("should handle opcode 0 for all helpers", () => {
      const mockHandler = jest.fn();

      const desc0 = d0(0, { name: "test", handler: mockHandler });
      expect(desc0.opcode).toBe(0);

      const desc1 = d1(0, { name: "test", handler: mockHandler });
      expect(desc1.opcode).toBe(0);

      const desc2 = d2(0, { name: "test", handler: mockHandler });
      expect(desc2.opcode).toBe(0);

      const descV = dv(0, { name: "test", handler: mockHandler });
      expect(descV.opcode).toBe(0);
    });

    it("should handle maximum valid opcodes for all helpers", () => {
      const mockHandler = jest.fn();

      const desc0 = d0(0x0f, { name: "test", handler: mockHandler });
      expect(desc0.opcode).toBe(0x0f);

      const desc1 = d1(0x0f, { name: "test", handler: mockHandler });
      expect(desc1.opcode).toBe(0x0f);

      const desc2 = d2(0x1f, { name: "test", handler: mockHandler });
      expect(desc2.opcode).toBe(0x1f);

      const descV = dv(0x1f, { name: "test", handler: mockHandler });
      expect(descV.opcode).toBe(0x1f);
    });

    it("should preserve all optional fields when provided", () => {
      const mockHandler = jest.fn();
      const allOperandTypes: OperandType[] = ["large", "small", "var", "omit"];

      const descriptor = d2(0x10, {
        name: "complex_opcode",
        minVersion: 3,
        maxVersion: 5,
        operandKinds: allOperandTypes,
        doesStore: true,
        doesBranch: true,
        handler: mockHandler,
      });

      expect(descriptor.name).toBe("complex_opcode");
      expect(descriptor.minVersion).toBe(3);
      expect(descriptor.maxVersion).toBe(5);
      expect(descriptor.operandKinds).toEqual(allOperandTypes);
      expect(descriptor.doesStore).toBe(true);
      expect(descriptor.doesBranch).toBe(true);
      expect(descriptor.handler).toBe(mockHandler);
    });

    it("should handle empty operandKinds array", () => {
      const mockHandler = jest.fn();
      const descriptor = d0(0x04, {
        name: "nop",
        operandKinds: [],
        handler: mockHandler,
      });

      expect(descriptor.operandKinds).toEqual([]);
    });

    it("should handle handlers that do nothing", () => {
      const noopHandler = (_vm: any, _operands: number[], _ctx: ExecCtx) => {};
      const descriptor = d0(0x04, {
        name: "nop",
        handler: noopHandler,
      });

      expect(() => {
        descriptor.handler({}, [], {});
      }).not.toThrow();
    });
  });

  describe("Helper consistency", () => {
    it("should have d0 max at 0x0F (15)", () => {
      const mockHandler = jest.fn();
      expect(() =>
        d0(0x0f, { name: "test", handler: mockHandler }),
      ).not.toThrow();
      expect(() => d0(0x10, { name: "test", handler: mockHandler })).toThrow();
    });

    it("should have d1 max at 0x0F (15)", () => {
      const mockHandler = jest.fn();
      expect(() =>
        d1(0x0f, { name: "test", handler: mockHandler }),
      ).not.toThrow();
      expect(() => d1(0x10, { name: "test", handler: mockHandler })).toThrow();
    });

    it("should have d2 max at 0x1F (31)", () => {
      const mockHandler = jest.fn();
      expect(() =>
        d2(0x1f, { name: "test", handler: mockHandler }),
      ).not.toThrow();
      expect(() => d2(0x20, { name: "test", handler: mockHandler })).toThrow();
    });

    it("should have dv max at 0xFF (255)", () => {
      const mockHandler = jest.fn();
      expect(() =>
        dv(0xff, { name: "test", handler: mockHandler }),
      ).not.toThrow();
      expect(() => dv(0x100, { name: "test", handler: mockHandler })).toThrow();
    });

    it("should all reject negative opcodes", () => {
      const mockHandler = jest.fn();
      expect(() => d0(-1, { name: "test", handler: mockHandler })).toThrow(
        /out of range/,
      );
      expect(() => d1(-1, { name: "test", handler: mockHandler })).toThrow(
        /out of range/,
      );
      expect(() => d2(-1, { name: "test", handler: mockHandler })).toThrow(
        /out of range/,
      );
      expect(() => dv(-1, { name: "test", handler: mockHandler })).toThrow(
        /out of range/,
      );
    });

    it("should set correct kind for each helper", () => {
      const mockHandler = jest.fn();

      expect(d0(0, { name: "test", handler: mockHandler }).kind).toBe("0OP");
      expect(d1(0, { name: "test", handler: mockHandler }).kind).toBe("1OP");
      expect(d2(0, { name: "test", handler: mockHandler }).kind).toBe("2OP");
      expect(dv(0, { name: "test", handler: mockHandler }).kind).toBe("VAR");
    });
  });
});
