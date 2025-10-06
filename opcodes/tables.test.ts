import {
  TABLE_0OP,
  TABLE_1OP,
  TABLE_2OP,
  TABLE_VAR,
  TABLE_EXT,
} from "./tables";

describe("Opcode Tables", () => {
  describe("TABLE_0OP (0-operand opcodes)", () => {
    it("should have rtrue at 0x00", () => {
      const instr = TABLE_0OP[0x00];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("rtrue");
      expect(instr!.kind).toBe("0OP");
      expect(instr!.opcode).toBe(0x00);
      expect(instr!.operandKinds).toEqual([]);
      expect(instr!.handler).toBeDefined();
    });

    it("should have rfalse at 0x01", () => {
      const instr = TABLE_0OP[0x01];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("rfalse");
      expect(instr!.kind).toBe("0OP");
      expect(instr!.opcode).toBe(0x01);
    });

    it("should have print at 0x02", () => {
      const instr = TABLE_0OP[0x02];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("print");
      expect(instr!.kind).toBe("0OP");
    });

    it("should have print_ret at 0x03", () => {
      const instr = TABLE_0OP[0x03];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("print_ret");
      expect(instr!.kind).toBe("0OP");
    });

    it("should have nop at 0x04", () => {
      const instr = TABLE_0OP[0x04];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("nop");
      expect(instr!.kind).toBe("0OP");
    });

    it("should have ret_popped at 0x08", () => {
      const instr = TABLE_0OP[0x08];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("ret_popped");
      expect(instr!.kind).toBe("0OP");
    });

    it("should have pop at 0x09", () => {
      const instr = TABLE_0OP[0x09];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("pop");
      expect(instr!.kind).toBe("0OP");
    });

    it("should have quit at 0x0A", () => {
      const instr = TABLE_0OP[0x0a];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("quit");
      expect(instr!.kind).toBe("0OP");
    });

    it("should have new_line at 0x0B", () => {
      const instr = TABLE_0OP[0x0b];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("new_line");
      expect(instr!.kind).toBe("0OP");
    });

    it("should have show_status at 0x0C with maxVersion", () => {
      const instr = TABLE_0OP[0x0c];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("show_status");
      expect(instr!.kind).toBe("0OP");
      expect(instr!.maxVersion).toBe(3);
    });

    it("should have verify at 0x0D with branch and minVersion", () => {
      const instr = TABLE_0OP[0x0d];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("verify");
      expect(instr!.kind).toBe("0OP");
      expect(instr!.minVersion).toBe(3);
      expect(instr!.doesBranch).toBe(true);
    });

    it("should have piracy at 0x0F with branch and minVersion", () => {
      const instr = TABLE_0OP[0x0f];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("piracy");
      expect(instr!.kind).toBe("0OP");
      expect(instr!.minVersion).toBe(5);
      expect(instr!.doesBranch).toBe(true);
    });

    it("should have undefined entries for unimplemented opcodes", () => {
      expect(TABLE_0OP[0x05]).toBeUndefined(); // save (v1-3)
      expect(TABLE_0OP[0x06]).toBeUndefined(); // restore (v1-3)
      expect(TABLE_0OP[0x07]).toBeUndefined(); // restart
      expect(TABLE_0OP[0x0e]).toBeUndefined(); // extended prefix
    });
  });

  describe("TABLE_1OP (1-operand opcodes)", () => {
    it("should have jz at 0x00 with branch", () => {
      const instr = TABLE_1OP[0x00];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("jz");
      expect(instr!.kind).toBe("1OP");
      expect(instr!.opcode).toBe(0x00);
      expect(instr!.doesBranch).toBe(true);
      expect(instr!.handler).toBeDefined();
    });

    it("should have get_sibling at 0x01 with store and branch", () => {
      const instr = TABLE_1OP[0x01];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("get_sibling");
      expect(instr!.kind).toBe("1OP");
      expect(instr!.doesStore).toBe(true);
      expect(instr!.doesBranch).toBe(true);
    });

    it("should have get_child at 0x02 with store and branch", () => {
      const instr = TABLE_1OP[0x02];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("get_child");
      expect(instr!.kind).toBe("1OP");
      expect(instr!.doesStore).toBe(true);
      expect(instr!.doesBranch).toBe(true);
    });

    it("should have get_parent at 0x03 with store", () => {
      const instr = TABLE_1OP[0x03];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("get_parent");
      expect(instr!.kind).toBe("1OP");
      expect(instr!.doesStore).toBe(true);
      expect(instr!.doesBranch).toBeUndefined();
    });

    it("should have inc at 0x05 with operandKinds", () => {
      const instr = TABLE_1OP[0x05];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("inc");
      expect(instr!.kind).toBe("1OP");
      expect(instr!.operandKinds).toEqual(["small"]);
    });

    it("should have dec at 0x06 with operandKinds", () => {
      const instr = TABLE_1OP[0x06];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("dec");
      expect(instr!.kind).toBe("1OP");
      expect(instr!.operandKinds).toEqual(["small"]);
    });

    it("should have call_1s at 0x08 with store and minVersion", () => {
      const instr = TABLE_1OP[0x08];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("call_1s");
      expect(instr!.kind).toBe("1OP");
      expect(instr!.minVersion).toBe(4);
      expect(instr!.doesStore).toBe(true);
    });

    it("should have load at 0x0E with store, operandKinds and minVersion", () => {
      const instr = TABLE_1OP[0x0e];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("load");
      expect(instr!.kind).toBe("1OP");
      expect(instr!.operandKinds).toEqual(["small"]);
      expect(instr!.minVersion).toBe(5);
      expect(instr!.doesStore).toBe(true);
    });

    it("should have not at 0x0F with store and maxVersion", () => {
      const instr = TABLE_1OP[0x0f];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("not");
      expect(instr!.kind).toBe("1OP");
      expect(instr!.maxVersion).toBe(4);
      expect(instr!.doesStore).toBe(true);
    });
  });

  describe("TABLE_2OP (2-operand opcodes)", () => {
    it("should have undefined at 0x00 (reserved)", () => {
      expect(TABLE_2OP[0x00]).toBeUndefined();
    });

    it("should have je at 0x01 with branch", () => {
      const instr = TABLE_2OP[0x01];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("je");
      expect(instr!.kind).toBe("2OP");
      expect(instr!.opcode).toBe(0x01);
      expect(instr!.doesBranch).toBe(true);
      expect(instr!.operandKinds).toEqual(["var", "var"]);
    });

    it("should have jl at 0x02 with branch", () => {
      const instr = TABLE_2OP[0x02];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("jl");
      expect(instr!.kind).toBe("2OP");
      expect(instr!.doesBranch).toBe(true);
    });

    it("should have jg at 0x03 with branch", () => {
      const instr = TABLE_2OP[0x03];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("jg");
      expect(instr!.kind).toBe("2OP");
      expect(instr!.doesBranch).toBe(true);
    });

    it("should have dec_chk at 0x04 with branch and correct operandKinds", () => {
      const instr = TABLE_2OP[0x04];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("dec_chk");
      expect(instr!.kind).toBe("2OP");
      expect(instr!.operandKinds).toEqual(["small", "var"]);
      expect(instr!.doesBranch).toBe(true);
    });

    it("should have inc_chk at 0x05 with branch and correct operandKinds", () => {
      const instr = TABLE_2OP[0x05];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("inc_chk");
      expect(instr!.kind).toBe("2OP");
      expect(instr!.operandKinds).toEqual(["small", "var"]);
      expect(instr!.doesBranch).toBe(true);
    });

    it("should have test at 0x07 with branch", () => {
      const instr = TABLE_2OP[0x07];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("test");
      expect(instr!.kind).toBe("2OP");
      expect(instr!.doesBranch).toBe(true);
    });

    it("should have or at 0x08 with store", () => {
      const instr = TABLE_2OP[0x08];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("or");
      expect(instr!.kind).toBe("2OP");
      expect(instr!.doesStore).toBe(true);
    });

    it("should have and at 0x09 with store", () => {
      const instr = TABLE_2OP[0x09];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("and");
      expect(instr!.kind).toBe("2OP");
      expect(instr!.doesStore).toBe(true);
    });

    it("should have store at 0x0D with correct operandKinds", () => {
      const instr = TABLE_2OP[0x0d];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("store");
      expect(instr!.kind).toBe("2OP");
      expect(instr!.operandKinds).toEqual(["small", "var"]);
    });

    it("should have arithmetic opcodes with store", () => {
      const arithmeticOps = [
        { opcode: 0x14, name: "add" },
        { opcode: 0x15, name: "sub" },
        { opcode: 0x16, name: "mul" },
        { opcode: 0x17, name: "div" },
        { opcode: 0x18, name: "mod" },
      ];

      arithmeticOps.forEach(({ opcode, name }) => {
        const instr = TABLE_2OP[opcode];
        expect(instr).toBeDefined();
        expect(instr!.name).toBe(name);
        expect(instr!.kind).toBe("2OP");
        expect(instr!.doesStore).toBe(true);
        expect(instr!.operandKinds).toEqual(["var", "var"]);
      });
    });

    it("should have memory access opcodes with store", () => {
      const memOps = [
        { opcode: 0x0f, name: "loadw" },
        { opcode: 0x10, name: "loadb" },
      ];

      memOps.forEach(({ opcode, name }) => {
        const instr = TABLE_2OP[opcode];
        expect(instr).toBeDefined();
        expect(instr!.name).toBe(name);
        expect(instr!.kind).toBe("2OP");
        expect(instr!.doesStore).toBe(true);
      });
    });

    it("should have call_2s at 0x19 with store and minVersion", () => {
      const instr = TABLE_2OP[0x19];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("call_2s");
      expect(instr!.kind).toBe("2OP");
      expect(instr!.minVersion).toBe(4);
      expect(instr!.doesStore).toBe(true);
    });
  });

  describe("TABLE_VAR (variable-operand opcodes)", () => {
    it("should have call at 0x00 with store", () => {
      const instr = TABLE_VAR[0x00];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("call");
      expect(instr!.kind).toBe("VAR");
      expect(instr!.opcode).toBe(0x00);
      expect(instr!.doesStore).toBe(true);
      expect(instr!.handler).toBeDefined();
    });

    it("should have storew at 0x01", () => {
      const instr = TABLE_VAR[0x01];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("storew");
      expect(instr!.kind).toBe("VAR");
    });

    it("should have storeb at 0x02", () => {
      const instr = TABLE_VAR[0x02];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("storeb");
      expect(instr!.kind).toBe("VAR");
    });

    it("should have put_prop at 0x03", () => {
      const instr = TABLE_VAR[0x03];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("put_prop");
      expect(instr!.kind).toBe("VAR");
    });

    it("should have sread at 0x04", () => {
      const instr = TABLE_VAR[0x04];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("sread");
      expect(instr!.kind).toBe("VAR");
    });

    it("should have print_char at 0x05", () => {
      const instr = TABLE_VAR[0x05];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("print_char");
      expect(instr!.kind).toBe("VAR");
    });

    it("should have print_num at 0x06", () => {
      const instr = TABLE_VAR[0x06];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("print_num");
      expect(instr!.kind).toBe("VAR");
    });

    it("should have random at 0x07 with store", () => {
      const instr = TABLE_VAR[0x07];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("random");
      expect(instr!.kind).toBe("VAR");
      expect(instr!.doesStore).toBe(true);
    });

    it("should have push at 0x08", () => {
      const instr = TABLE_VAR[0x08];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("push");
      expect(instr!.kind).toBe("VAR");
    });

    it("should have pull at 0x09 with minVersion", () => {
      const instr = TABLE_VAR[0x09];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("pull");
      expect(instr!.kind).toBe("VAR");
      expect(instr!.minVersion).toBe(5);
    });

    it("should have screen control opcodes with minVersion", () => {
      const screenOps = [
        { opcode: 0x0a, name: "split_window", minVersion: 3 },
        { opcode: 0x0b, name: "set_window", minVersion: 3 },
        { opcode: 0x0f, name: "erase_window", minVersion: 4 },
        { opcode: 0x10, name: "erase_line", minVersion: 4 },
        { opcode: 0x11, name: "set_cursor", minVersion: 4 },
        { opcode: 0x12, name: "get_cursor", minVersion: 4 },
        { opcode: 0x13, name: "set_text_style", minVersion: 4 },
        { opcode: 0x14, name: "buffer_mode", minVersion: 4 },
      ];

      screenOps.forEach(({ opcode, name, minVersion }) => {
        const instr = TABLE_VAR[opcode];
        expect(instr).toBeDefined();
        expect(instr!.name).toBe(name);
        expect(instr!.kind).toBe("VAR");
        expect(instr!.minVersion).toBe(minVersion);
      });
    });

    it("should have not at 0x0C with store and minVersion", () => {
      const instr = TABLE_VAR[0x0c];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("not");
      expect(instr!.kind).toBe("VAR");
      expect(instr!.minVersion).toBe(5);
      expect(instr!.doesStore).toBe(true);
    });

    it("should have call_vs at 0x0D with store and minVersion", () => {
      const instr = TABLE_VAR[0x0d];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("call_vs");
      expect(instr!.kind).toBe("VAR");
      expect(instr!.minVersion).toBe(4);
      expect(instr!.doesStore).toBe(true);
    });

    it("should have I/O stream opcodes with minVersion", () => {
      const ioOps = [
        { opcode: 0x15, name: "output_stream", minVersion: 3 },
        { opcode: 0x16, name: "input_stream", minVersion: 3 },
        { opcode: 0x17, name: "sound_effect", minVersion: 3 },
      ];

      ioOps.forEach(({ opcode, name, minVersion }) => {
        const instr = TABLE_VAR[opcode];
        expect(instr).toBeDefined();
        expect(instr!.name).toBe(name);
        expect(instr!.kind).toBe("VAR");
        expect(instr!.minVersion).toBe(minVersion);
      });
    });

    it("should have read_char at 0x18 with store and minVersion", () => {
      const instr = TABLE_VAR[0x18];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("read_char");
      expect(instr!.kind).toBe("VAR");
      expect(instr!.minVersion).toBe(4);
      expect(instr!.doesStore).toBe(true);
    });

    it("should have print_table at 0x1E with minVersion", () => {
      const instr = TABLE_VAR[0x1e];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("print_table");
      expect(instr!.kind).toBe("VAR");
      expect(instr!.minVersion).toBe(5);
    });
  });

  describe("TABLE_EXT (extended opcodes)", () => {
    it("should have log_shift at 0x02 with store and minVersion", () => {
      const instr = TABLE_EXT[0x02];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("log_shift");
      expect(instr!.kind).toBe("EXT");
      expect(instr!.opcode).toBe(0x02);
      expect(instr!.minVersion).toBe(5);
      expect(instr!.doesStore).toBe(true);
      expect(instr!.handler).toBeDefined();
    });

    it("should have art_shift at 0x03 with store and minVersion", () => {
      const instr = TABLE_EXT[0x03];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("art_shift");
      expect(instr!.kind).toBe("EXT");
      expect(instr!.opcode).toBe(0x03);
      expect(instr!.minVersion).toBe(5);
      expect(instr!.doesStore).toBe(true);
    });

    it("should have set_font at 0x04 with store and minVersion", () => {
      const instr = TABLE_EXT[0x04];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("set_font");
      expect(instr!.kind).toBe("EXT");
      expect(instr!.opcode).toBe(0x04);
      expect(instr!.minVersion).toBe(5);
      expect(instr!.doesStore).toBe(true);
    });

    it("should have save_undo at 0x09 with store and minVersion", () => {
      const instr = TABLE_EXT[0x09];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("save_undo");
      expect(instr!.kind).toBe("EXT");
      expect(instr!.opcode).toBe(0x09);
      expect(instr!.minVersion).toBe(5);
      expect(instr!.doesStore).toBe(true);
    });

    it("should have restore_undo at 0x0A with store and minVersion", () => {
      const instr = TABLE_EXT[0x0a];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("restore_undo");
      expect(instr!.kind).toBe("EXT");
      expect(instr!.opcode).toBe(0x0a);
      expect(instr!.minVersion).toBe(5);
      expect(instr!.doesStore).toBe(true);
    });

    it("should have print_unicode at 0x0B with minVersion", () => {
      const instr = TABLE_EXT[0x0b];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("print_unicode");
      expect(instr!.kind).toBe("EXT");
      expect(instr!.opcode).toBe(0x0b);
      expect(instr!.minVersion).toBe(5);
      expect(instr!.doesStore).toBeUndefined();
    });

    it("should have check_unicode at 0x0C with store and minVersion", () => {
      const instr = TABLE_EXT[0x0c];
      expect(instr).toBeDefined();
      expect(instr!.name).toBe("check_unicode");
      expect(instr!.kind).toBe("EXT");
      expect(instr!.opcode).toBe(0x0c);
      expect(instr!.minVersion).toBe(5);
      expect(instr!.doesStore).toBe(true);
    });

    it("should have undefined entries for unimplemented EXT opcodes", () => {
      expect(TABLE_EXT[0x00]).toBeUndefined(); // save (v5+)
      expect(TABLE_EXT[0x01]).toBeUndefined(); // restore (v5+)
      expect(TABLE_EXT[0x05]).toBeUndefined(); // draw_picture
      expect(TABLE_EXT[0x0d]).toBeUndefined(); // set_true_colour
      expect(TABLE_EXT[0xff]).toBeUndefined(); // random high index
    });
  });

  describe("Table structure and consistency", () => {
    it("should have all defined 0OP opcodes with correct kind", () => {
      TABLE_0OP.forEach((instr, index) => {
        if (instr !== undefined) {
          expect(instr.kind).toBe("0OP");
          expect(instr.opcode).toBe(index);
        }
      });
    });

    it("should have all defined 1OP opcodes with correct kind", () => {
      TABLE_1OP.forEach((instr, index) => {
        if (instr !== undefined) {
          expect(instr.kind).toBe("1OP");
          expect(instr.opcode).toBe(index);
        }
      });
    });

    it("should have all defined 2OP opcodes with correct kind", () => {
      TABLE_2OP.forEach((instr, index) => {
        if (instr !== undefined) {
          expect(instr.kind).toBe("2OP");
          expect(instr.opcode).toBe(index);
        }
      });
    });

    it("should have all defined VAR opcodes with correct kind", () => {
      TABLE_VAR.forEach((instr, index) => {
        if (instr !== undefined) {
          expect(instr.kind).toBe("VAR");
          expect(instr.opcode).toBe(index);
        }
      });
    });

    it("should have all defined EXT opcodes with correct kind", () => {
      TABLE_EXT.forEach((instr, index) => {
        if (instr !== undefined) {
          expect(instr.kind).toBe("EXT");
          expect(instr.opcode).toBe(index);
        }
      });
    });

    it("should have handlers for all defined opcodes", () => {
      const allTables = [TABLE_0OP, TABLE_1OP, TABLE_2OP, TABLE_VAR, TABLE_EXT];

      allTables.forEach((table) => {
        table.forEach((instr) => {
          if (instr !== undefined) {
            expect(instr.handler).toBeDefined();
            expect(typeof instr.handler).toBe("function");
          }
        });
      });
    });

    it("should have valid version constraints where specified", () => {
      const allTables = [TABLE_0OP, TABLE_1OP, TABLE_2OP, TABLE_VAR, TABLE_EXT];

      allTables.forEach((table) => {
        table.forEach((instr) => {
          if (instr !== undefined) {
            if (instr.minVersion !== undefined) {
              expect(instr.minVersion).toBeGreaterThanOrEqual(1);
              expect(instr.minVersion).toBeLessThanOrEqual(8);
            }
            if (instr.maxVersion !== undefined) {
              expect(instr.maxVersion).toBeGreaterThanOrEqual(1);
              expect(instr.maxVersion).toBeLessThanOrEqual(8);
            }
            if (instr.minVersion && instr.maxVersion) {
              expect(instr.minVersion).toBeLessThanOrEqual(instr.maxVersion);
            }
          }
        });
      });
    });

    it("should have operandKinds only for fixed-arity instructions", () => {
      // 0OP should always have empty operandKinds or undefined
      TABLE_0OP.forEach((instr) => {
        if (instr !== undefined && instr.operandKinds !== undefined) {
          expect(instr.operandKinds).toEqual([]);
        }
      });

      // VAR and EXT typically don't specify operandKinds (variable arity)
      [TABLE_VAR, TABLE_EXT].forEach((table) => {
        table.forEach((instr) => {
          if (instr !== undefined && instr.operandKinds !== undefined) {
            // Some may have operandKinds, but it's less common
            expect(Array.isArray(instr.operandKinds)).toBe(true);
          }
        });
      });
    });

    it("should count total number of implemented opcodes", () => {
      const count0OP = TABLE_0OP.filter((i) => i !== undefined).length;
      const count1OP = TABLE_1OP.filter((i) => i !== undefined).length;
      const count2OP = TABLE_2OP.filter((i) => i !== undefined).length;
      const countVAR = TABLE_VAR.filter((i) => i !== undefined).length;
      const countEXT = TABLE_EXT.filter((i) => i !== undefined).length;

      expect(count0OP).toBeGreaterThan(0);
      expect(count1OP).toBeGreaterThan(0);
      expect(count2OP).toBeGreaterThan(0);
      expect(countVAR).toBeGreaterThan(0);
      expect(countEXT).toBeGreaterThan(0);

      const total = count0OP + count1OP + count2OP + countVAR + countEXT;
      expect(total).toBeGreaterThan(50); // Should have many opcodes implemented
    });
  });

  describe("Specific opcode properties", () => {
    it("should have branch opcodes correctly marked", () => {
      const branchOpcodes = [
        { table: TABLE_0OP, opcode: 0x0d, name: "verify" },
        { table: TABLE_0OP, opcode: 0x0f, name: "piracy" },
        { table: TABLE_1OP, opcode: 0x00, name: "jz" },
        { table: TABLE_1OP, opcode: 0x01, name: "get_sibling" },
        { table: TABLE_1OP, opcode: 0x02, name: "get_child" },
        { table: TABLE_2OP, opcode: 0x01, name: "je" },
        { table: TABLE_2OP, opcode: 0x02, name: "jl" },
        { table: TABLE_2OP, opcode: 0x03, name: "jg" },
        { table: TABLE_2OP, opcode: 0x04, name: "dec_chk" },
        { table: TABLE_2OP, opcode: 0x05, name: "inc_chk" },
      ];

      branchOpcodes.forEach(({ table, opcode, name }) => {
        const instr = table[opcode];
        expect(instr).toBeDefined();
        expect(instr!.name).toBe(name);
        expect(instr!.doesBranch).toBe(true);
      });
    });

    it("should have store opcodes correctly marked", () => {
      const storeOpcodes = [
        { table: TABLE_1OP, opcode: 0x03, name: "get_parent" },
        { table: TABLE_1OP, opcode: 0x04, name: "get_prop_len" },
        { table: TABLE_1OP, opcode: 0x0e, name: "load" },
        { table: TABLE_2OP, opcode: 0x08, name: "or" },
        { table: TABLE_2OP, opcode: 0x09, name: "and" },
        { table: TABLE_2OP, opcode: 0x14, name: "add" },
        { table: TABLE_2OP, opcode: 0x15, name: "sub" },
        { table: TABLE_VAR, opcode: 0x00, name: "call" },
        { table: TABLE_VAR, opcode: 0x07, name: "random" },
        { table: TABLE_EXT, opcode: 0x02, name: "log_shift" },
      ];

      storeOpcodes.forEach(({ table, opcode, name }) => {
        const instr = table[opcode];
        expect(instr).toBeDefined();
        expect(instr!.name).toBe(name);
        expect(instr!.doesStore).toBe(true);
      });
    });

    it("should have object manipulation opcodes in correct tables", () => {
      const objectOps = [
        { table: TABLE_1OP, opcode: 0x09, name: "remove_obj" },
        { table: TABLE_1OP, opcode: 0x0a, name: "print_obj" },
        { table: TABLE_2OP, opcode: 0x06, name: "jin" },
        { table: TABLE_2OP, opcode: 0x0a, name: "test_attr" },
        { table: TABLE_2OP, opcode: 0x0b, name: "set_attr" },
        { table: TABLE_2OP, opcode: 0x0c, name: "clear_attr" },
        { table: TABLE_2OP, opcode: 0x0e, name: "insert_obj" },
      ];

      objectOps.forEach(({ table, opcode, name }) => {
        const instr = table[opcode];
        expect(instr).toBeDefined();
        expect(instr!.name).toBe(name);
      });
    });
  });
});
