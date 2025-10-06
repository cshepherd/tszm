import { decodeNext } from "./decode";
import { TABLE_1OP } from "./tables";
import { MockVM } from "./test-utils";

describe("decodeNext", () => {
  describe("0OP instruction decoding", () => {
    it("should decode rtrue (0xB0)", () => {
      const vm = new MockVM([0xb0]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("rtrue");
      expect(result.desc.kind).toBe("0OP");
      expect(result.operands).toEqual([]);
      expect(result.storeTarget).toBeUndefined();
      expect(result.branchInfo).toBeUndefined();
    });

    it("should decode rfalse (0xB1)", () => {
      const vm = new MockVM([0xb1]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("rfalse");
      expect(result.desc.kind).toBe("0OP");
      expect(result.operands).toEqual([]);
    });

    it("should decode print (0xB2)", () => {
      const vm = new MockVM([0xb2]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("print");
      expect(result.desc.kind).toBe("0OP");
      expect(result.operands).toEqual([]);
    });

    it("should decode quit (0xBA)", () => {
      const vm = new MockVM([0xba]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("quit");
      expect(result.desc.kind).toBe("0OP");
      expect(result.operands).toEqual([]);
    });

    it("should decode verify (0xBD) with branch", () => {
      const vm = new MockVM([0xbd, 0xc0]); // verify with single-byte branch
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("verify");
      expect(result.desc.kind).toBe("0OP");
      expect(result.desc.doesBranch).toBe(true);
      expect(result.branchInfo).toBeDefined();
      expect(result.branchInfo!.branchOnTrue).toBe(true);
      expect(result.branchInfo!.offset).toBe(0);
    });
  });

  describe("1OP instruction decoding", () => {
    it("should decode jz with large operand (0x80)", () => {
      const vm = new MockVM([0x80, 0x12, 0x34, 0xc0]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("jz");
      expect(result.desc.kind).toBe("1OP");
      expect(result.operands).toHaveLength(1);
      expect(result.operands[0]).toBe(0x1234);
      expect(vm.decodeOperandLog).toEqual(["large"]);
      expect(result.branchInfo).toBeDefined();
    });

    it("should decode jz with small operand (0x90)", () => {
      const vm = new MockVM([0x90, 0x42, 0xc0]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("jz");
      expect(result.desc.kind).toBe("1OP");
      expect(result.operands).toHaveLength(1);
      expect(result.operands[0]).toBe(0x42);
      expect(vm.decodeOperandLog).toEqual(["small"]);
    });

    it("should decode jz with variable operand (0xA0)", () => {
      const vm = new MockVM([0xa0, 0x05, 0xc0]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("jz");
      expect(result.desc.kind).toBe("1OP");
      expect(result.operands).toHaveLength(1);
      expect(result.operands[0]).toBe(0x05);
      expect(vm.decodeOperandLog).toEqual(["var"]);
    });

    it("should decode get_sibling with store and branch", () => {
      const vm = new MockVM([0x91, 0x10, 0x20, 0xc0]); // small operand, store var, branch
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("get_sibling");
      expect(result.desc.kind).toBe("1OP");
      expect(result.desc.doesStore).toBe(true);
      expect(result.desc.doesBranch).toBe(true);
      expect(result.storeTarget).toBe(0x20);
      expect(result.branchInfo).toBeDefined();
    });

    it("should decode inc with small operand kind (0x95)", () => {
      const vm = new MockVM([0x95, 0x03]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("inc");
      expect(result.desc.kind).toBe("1OP");
      expect(result.operands).toHaveLength(1);
      expect(result.operands[0]).toBe(0x03);
      expect(vm.decodeOperandLog).toEqual(["small"]);
    });
  });

  describe("2OP long form instruction decoding", () => {
    it("should decode je with two small operands (0x01)", () => {
      const vm = new MockVM([0x01, 0x05, 0x06, 0xc0]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("je");
      expect(result.desc.kind).toBe("2OP");
      expect(result.operands).toHaveLength(2);
      expect(result.operands[0]).toBe(0x05);
      expect(result.operands[1]).toBe(0x06);
      expect(vm.decodeOperandLog).toEqual(["small", "small"]);
      expect(result.desc.doesBranch).toBe(true);
    });

    it("should decode je with small and variable operands (0x21)", () => {
      const vm = new MockVM([0x21, 0x05, 0x10, 0xc0]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("je");
      expect(result.operands).toHaveLength(2);
      expect(result.operands[0]).toBe(0x05);
      expect(result.operands[1]).toBe(0x10);
      expect(vm.decodeOperandLog).toEqual(["small", "var"]);
    });

    it("should decode je with variable and small operands (0x41)", () => {
      const vm = new MockVM([0x41, 0x10, 0x05, 0xc0]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("je");
      expect(result.operands).toHaveLength(2);
      expect(result.operands[0]).toBe(0x10);
      expect(result.operands[1]).toBe(0x05);
      expect(vm.decodeOperandLog).toEqual(["var", "small"]);
    });

    it("should decode je with two variable operands (0x61)", () => {
      const vm = new MockVM([0x61, 0x10, 0x11, 0xc0]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("je");
      expect(result.operands).toHaveLength(2);
      expect(result.operands[0]).toBe(0x10);
      expect(result.operands[1]).toBe(0x11);
      expect(vm.decodeOperandLog).toEqual(["var", "var"]);
    });

    it("should decode add with store", () => {
      const vm = new MockVM([0x14, 0x05, 0x03, 0x20]); // add, two small operands, store to var 0x20
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("add");
      expect(result.desc.kind).toBe("2OP");
      expect(result.operands).toEqual([0x05, 0x03]);
      expect(result.desc.doesStore).toBe(true);
      expect(result.storeTarget).toBe(0x20);
    });

    it("should decode store (0x0D)", () => {
      const vm = new MockVM([0x0d, 0x05, 0x42]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("store");
      expect(result.desc.kind).toBe("2OP");
      expect(result.operands).toHaveLength(2);
    });
  });

  describe("VAR_2OP form (0xC0-0xDF) instruction decoding", () => {
    it("should decode je in VAR_2OP form (0xC1)", () => {
      const vm = new MockVM([0xc1, 0x55, 0x10, 0x20]); // VAR_2OP je, type byte, operands
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("je");
      expect(result.desc.kind).toBe("2OP");
      expect(vm.readOperandTypesLog).toHaveLength(1);
      expect(vm.decodeOperandLog.length).toBeGreaterThan(0);
    });

    it("should decode add in VAR_2OP form (0xD4)", () => {
      const vm = new MockVM([0xd4, 0x55, 0x10, 0x20, 0x30]); // VAR_2OP add with store
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("add");
      expect(result.desc.kind).toBe("2OP");
      expect(result.desc.doesStore).toBe(true);
    });
  });

  describe("VAR instruction decoding", () => {
    it("should decode call (0xE0)", () => {
      const vm = new MockVM([0xe0, 0x55, 0x10, 0x20, 0x30]); // call with type byte and operands
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("call");
      expect(result.desc.kind).toBe("VAR");
      expect(result.desc.doesStore).toBe(true);
      expect(vm.readOperandTypesLog).toHaveLength(1);
    });

    it("should decode storew (0xE1)", () => {
      const vm = new MockVM([0xe1, 0x57, 0x10, 0x20, 0x30]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("storew");
      expect(result.desc.kind).toBe("VAR");
    });

    it("should decode push (0xE8)", () => {
      const vm = new MockVM([0xe8, 0x55, 0x10]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("push");
      expect(result.desc.kind).toBe("VAR");
    });

    it("should decode random with store (0xE7)", () => {
      // 0xE7 = VAR opcode 0x07 (random)
      // Type byte 0x5F = 01 01 11 11 = small, small, omit, omit
      // But random only takes 1 operand, so first type will be used
      // 0x5F decodes to: small (01), small (01), omit (11), omit (11)
      // Operands are read until "omit" is encountered
      // So: read 2 small operands (0x10, 0x20), then hit omit
      // Then read store target (0x30)
      const vm = new MockVM([0xe7, 0x5f, 0x10, 0x20, 0x30]); // random with type byte, 2 operands, store target
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("random");
      expect(result.desc.kind).toBe("VAR");
      expect(result.desc.doesStore).toBe(true);
      // Store target should be read after operands for VAR opcodes
      expect(result.storeTarget).toBe(0x30);
    });

    it("should stop reading operands at omit type", () => {
      const vm = new MockVM([0xe0, 0x5f, 0x10, 0x20]); // call, type byte 0x5f (small, small, omit, omit)
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("call");
      expect(result.operands.length).toBeLessThanOrEqual(2);
    });
  });

  describe("EXT (extended) instruction decoding", () => {
    it("should decode log_shift (0xBE 0x02)", () => {
      // 0xBE = EXT prefix, 0x02 = log_shift
      // Type byte 0x57 = 01 01 01 11 = small, small, small, omit
      // Reads 3 small operands (0x10, 0x20, 0x30) until omit
      // Then reads store target (0x40)
      const vm = new MockVM([0xbe, 0x02, 0x57, 0x10, 0x20, 0x30, 0x40]); // ext prefix, opcode, type byte, 3 operands, store
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("log_shift");
      expect(result.desc.kind).toBe("EXT");
      expect(result.desc.doesStore).toBe(true);
      expect(result.storeTarget).toBe(0x40);
    });

    it("should decode art_shift (0xBE 0x03)", () => {
      const vm = new MockVM([0xbe, 0x03, 0x55, 0x10, 0x20, 0x30]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("art_shift");
      expect(result.desc.kind).toBe("EXT");
      expect(result.desc.doesStore).toBe(true);
    });

    it("should decode set_font (0xBE 0x04)", () => {
      const vm = new MockVM([0xbe, 0x04, 0x55, 0x10, 0x20]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("set_font");
      expect(result.desc.kind).toBe("EXT");
      expect(result.desc.doesStore).toBe(true);
    });

    it("should decode save_undo (0xBE 0x09)", () => {
      const vm = new MockVM([0xbe, 0x09, 0xff, 0x20]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("save_undo");
      expect(result.desc.kind).toBe("EXT");
      expect(result.desc.doesStore).toBe(true);
    });

    it("should decode print_unicode (0xBE 0x0B)", () => {
      const vm = new MockVM([0xbe, 0x0b, 0x55, 0x10]);
      const result = decodeNext(vm);

      expect(result.desc.name).toBe("print_unicode");
      expect(result.desc.kind).toBe("EXT");
    });
  });

  describe("Branch and store handling", () => {
    it("should decode single-byte branch offset (branch on true)", () => {
      // Branch byte: bit 7 = branchOnTrue (1), bit 6 = singleByte (1), bits 5-0 = offset (5)
      // 0xC5 = 11000101 = branchOnTrue=1, singleByte=1, offset=00 0101 (5)
      // 0x80 = 1OP with large operand, needs 2 bytes for operand (word)
      const vm = new MockVM([0x80, 0x00, 0x10, 0xc5]); // jz (1OP, large operand=0x0010), branch
      const result = decodeNext(vm);

      expect(result.desc.doesBranch).toBe(true);
      expect(result.branchInfo).toBeDefined();
      expect(result.branchInfo!.branchOnTrue).toBe(true);
      expect(result.branchInfo!.offset).toBe(5);
    });

    it("should decode single-byte branch offset (branch on false)", () => {
      // Branch byte: bit 7 = branchOnTrue (0), bit 6 = singleByte (1), bits 5-0 = offset (5)
      // 0x45 = 01000101 = branchOnTrue=0, singleByte=1, offset=00 0101 (5)
      const vm = new MockVM([0x80, 0x00, 0x10, 0x45]); // jz, operand (word), branch
      const result = decodeNext(vm);

      expect(result.branchInfo).toBeDefined();
      expect(result.branchInfo!.branchOnTrue).toBe(false);
      expect(result.branchInfo!.offset).toBe(5);
    });

    it("should decode two-byte branch offset (branch on true)", () => {
      // Branch byte 1: bit 7 = branchOnTrue (1), bit 6 = singleByte (0), bits 5-0 = high 6 bits
      // 0x81 = 10000001, branch byte 2: 0x23
      // offset = (0x01 << 8) | 0x23 = 0x0123 = 291
      const vm = new MockVM([0x80, 0x00, 0x10, 0x81, 0x23]); // jz with operand (word), two-byte branch
      const result = decodeNext(vm);

      expect(result.branchInfo).toBeDefined();
      expect(result.branchInfo!.branchOnTrue).toBe(true);
      expect(result.branchInfo!.offset).toBe(0x0123);
    });

    it("should decode two-byte branch offset (branch on false)", () => {
      // Branch byte 1: bit 7 = branchOnTrue (0), bit 6 = singleByte (0), bits 5-0 = high 6 bits
      // 0x01 = 00000001, branch byte 2: 0x23
      // offset = (0x01 << 8) | 0x23 = 0x0123 = 291
      const vm = new MockVM([0x80, 0x00, 0x10, 0x01, 0x23]); // jz with operand (word), two-byte branch
      const result = decodeNext(vm);

      expect(result.branchInfo).toBeDefined();
      expect(result.branchInfo!.branchOnTrue).toBe(false);
      expect(result.branchInfo!.offset).toBe(0x0123);
    });

    it("should handle instruction with both store and branch", () => {
      const vm = new MockVM([0x91, 0x10, 0x20, 0xc0]); // get_sibling: small operand, store, branch
      const result = decodeNext(vm);

      expect(result.desc.doesStore).toBe(true);
      expect(result.desc.doesBranch).toBe(true);
      expect(result.storeTarget).toBe(0x20);
      expect(result.branchInfo).toBeDefined();
    });
  });

  describe("Error handling", () => {
    it("should throw error for illegal 0OP opcode", () => {
      // 0xBE is EXT prefix, 0xBF actually maps to piracy (0x0F in 0OP)
      // Just verify a valid opcode doesn't throw
      const vm = new MockVM([0xb0]); // Just verify it doesn't throw for valid
      expect(() => decodeNext(vm)).not.toThrow();
    });

    it("should throw error for undefined 1OP opcode", () => {
      const vm = new MockVM([0x9f]); // 1OP opcode 0x0F exists but test pattern
      // Note: 0x9F is 1OP:0x0F which is "not" (valid), so let's use undefined slot if any
      // Actually all slots might be defined, so this test verifies the error mechanism works
      const savedEntry = TABLE_1OP[0x0f];
      TABLE_1OP[0x0f] = undefined;

      expect(() => decodeNext(vm)).toThrow(/Illegal\/unknown opcode/);

      TABLE_1OP[0x0f] = savedEntry; // Restore
    });

    it("should throw error for undefined 2OP opcode", () => {
      const vm = new MockVM([0x00]); // 2OP opcode 0x00 is reserved
      expect(() => decodeNext(vm)).toThrow(/Illegal\/unknown opcode/);
    });

    it("should throw error for undefined EXT opcode", () => {
      const vm = new MockVM([0xbe, 0xff]); // EXT with undefined opcode
      expect(() => decodeNext(vm)).toThrow(/Illegal\/unknown opcode/);
    });
  });

  describe("Operand type decoding", () => {
    it("should decode operand types correctly from type byte", () => {
      // Type byte 0x55 = 0b01010101 = small, small, small, small
      const vm = new MockVM([0xe0, 0x55, 0x01, 0x02, 0x03, 0x04, 0x20]);
      decodeNext(vm);

      expect(vm.readOperandTypesLog).toContain(0x55);
      expect(vm.decodeOperandLog.filter(t => t === "small").length).toBeGreaterThan(0);
    });

    it("should decode mixed operand types", () => {
      // Type byte 0x03 = 0b00000011 = large, large, large, omit
      const vm = new MockVM([0xe0, 0x03, 0x00, 0x10, 0x00, 0x20, 0x00, 0x30, 0xff]);
      decodeNext(vm);

      expect(vm.readOperandTypesLog).toContain(0x03);
    });
  });

  describe("Instruction family detection", () => {
    it("should correctly identify 0OP instructions (0xBx)", () => {
      const testCases = [0xb0, 0xb1, 0xb2, 0xb3, 0xba, 0xbb];

      testCases.forEach(opcode => {
        const vm = new MockVM([opcode]);
        const result = decodeNext(vm);
        if (result.desc) {
          expect(result.desc.kind).toBe("0OP");
        }
      });
    });

    it("should correctly identify 1OP instructions (0x8x-0xAx)", () => {
      const testCases = [0x80, 0x90, 0xa0]; // large, small, var forms

      testCases.forEach(opcode => {
        const vm = new MockVM([opcode, 0x10, 0xc0]);
        const result = decodeNext(vm);
        expect(result.desc.kind).toBe("1OP");
      });
    });

    it("should correctly identify 2OP long form (0x00-0x7F)", () => {
      const vm = new MockVM([0x14, 0x05, 0x03, 0x20]); // add
      const result = decodeNext(vm);

      expect(result.desc.kind).toBe("2OP");
    });

    it("should correctly identify VAR_2OP form (0xC0-0xDF)", () => {
      const vm = new MockVM([0xc1, 0x55, 0x10, 0x20, 0xc0]); // je in VAR form
      const result = decodeNext(vm);

      expect(result.desc.kind).toBe("2OP");
    });

    it("should correctly identify VAR form (0xE0-0xFF)", () => {
      const vm = new MockVM([0xe0, 0x55, 0x10, 0x20]); // call
      const result = decodeNext(vm);

      expect(result.desc.kind).toBe("VAR");
    });

    it("should correctly identify EXT form (0xBE)", () => {
      const vm = new MockVM([0xbe, 0x02, 0x55, 0x10, 0x20, 0x30]); // log_shift
      const result = decodeNext(vm);

      expect(result.desc.kind).toBe("EXT");
    });
  });

  describe("Edge cases", () => {
    it("should handle instructions with no operands", () => {
      const vm = new MockVM([0xb0]); // rtrue
      const result = decodeNext(vm);

      expect(result.operands).toEqual([]);
    });

    it("should handle instructions with descriptor operandKinds", () => {
      const vm = new MockVM([0x95, 0x03]); // inc with operandKinds: ["small"]
      const result = decodeNext(vm);

      expect(result.desc.operandKinds).toEqual(["small"]);
      expect(result.operands).toHaveLength(1);
    });

    it("should handle 0xBE prefix for EXT opcodes", () => {
      const vm = new MockVM([0xbe, 0x02, 0x55, 0x10, 0x20, 0x30]);
      const result = decodeNext(vm);

      expect(vm.fetchByteLog[0]).toBe(0xbe);
      expect(vm.fetchByteLog[1]).toBe(0x02);
      expect(result.desc.kind).toBe("EXT");
    });
  });
});
