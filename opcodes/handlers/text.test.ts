import {
  h_print,
  h_print_ret,
  h_new_line,
  h_print_num,
  h_print_addr,
  h_print_paddr,
} from "./text";

describe("Text Handlers", () => {
  describe("h_print", () => {
    it("should call vm.print()", () => {
      const printFn = jest.fn();
      const vm = {
        print: printFn,
      };

      h_print(vm);
      expect(printFn).toHaveBeenCalled();
    });

    it("should call print exactly once", () => {
      const printFn = jest.fn();
      const vm = {
        print: printFn,
      };

      h_print(vm);
      expect(printFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("h_print_ret", () => {
    it("should print, write newline, and return 1", () => {
      const printFn = jest.fn();
      const writeStringFn = jest.fn();
      const returnFromRoutineFn = jest.fn();
      const vm = {
        print: printFn,
        inputOutputDevice: {
          writeString: writeStringFn,
        },
        returnFromRoutine: returnFromRoutineFn,
      };

      h_print_ret(vm);
      expect(printFn).toHaveBeenCalled();
      expect(writeStringFn).toHaveBeenCalledWith("\n");
      expect(returnFromRoutineFn).toHaveBeenCalledWith(1);
    });

    it("should use console.log when no inputOutputDevice", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const printFn = jest.fn();
      const returnFromRoutineFn = jest.fn();
      const vm = {
        print: printFn,
        returnFromRoutine: returnFromRoutineFn,
      };

      h_print_ret(vm);
      expect(printFn).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith("\n");
      expect(returnFromRoutineFn).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
    });

    it("should call functions in correct order", () => {
      const callOrder: string[] = [];
      const vm = {
        print: jest.fn(() => callOrder.push("print")),
        inputOutputDevice: {
          writeString: jest.fn(() => callOrder.push("newline")),
        },
        returnFromRoutine: jest.fn(() => callOrder.push("return")),
      };

      h_print_ret(vm);
      expect(callOrder).toEqual(["print", "newline", "return"]);
    });
  });

  describe("h_new_line", () => {
    it("should write newline using inputOutputDevice", () => {
      const writeStringFn = jest.fn();
      const vm = {
        inputOutputDevice: {
          writeString: writeStringFn,
        },
      };

      h_new_line(vm);
      expect(writeStringFn).toHaveBeenCalledWith("\n");
    });

    it("should use console.log when no inputOutputDevice", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const vm = {};

      h_new_line(vm);
      expect(consoleSpy).toHaveBeenCalledWith("\n");

      consoleSpy.mockRestore();
    });

    it("should only write newline once", () => {
      const writeStringFn = jest.fn();
      const vm = {
        inputOutputDevice: {
          writeString: writeStringFn,
        },
      };

      h_new_line(vm);
      expect(writeStringFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("h_print_num", () => {
    it("should print positive number", () => {
      const writeStringFn = jest.fn();
      const vm = {
        inputOutputDevice: {
          writeString: writeStringFn,
        },
      };

      h_print_num(vm, [42]);
      expect(writeStringFn).toHaveBeenCalledWith("42");
    });

    it("should print zero", () => {
      const writeStringFn = jest.fn();
      const vm = {
        inputOutputDevice: {
          writeString: writeStringFn,
        },
      };

      h_print_num(vm, [0]);
      expect(writeStringFn).toHaveBeenCalledWith("0");
    });

    it("should convert to signed and print negative number", () => {
      const writeStringFn = jest.fn();
      const vm = {
        inputOutputDevice: {
          writeString: writeStringFn,
        },
      };

      h_print_num(vm, [65535]); // -1 as unsigned
      expect(writeStringFn).toHaveBeenCalledWith("-1");
    });

    it("should print -100 from unsigned 65436", () => {
      const writeStringFn = jest.fn();
      const vm = {
        inputOutputDevice: {
          writeString: writeStringFn,
        },
      };

      h_print_num(vm, [65436]); // -100 as unsigned
      expect(writeStringFn).toHaveBeenCalledWith("-100");
    });

    it("should print max positive (32767)", () => {
      const writeStringFn = jest.fn();
      const vm = {
        inputOutputDevice: {
          writeString: writeStringFn,
        },
      };

      h_print_num(vm, [32767]);
      expect(writeStringFn).toHaveBeenCalledWith("32767");
    });

    it("should print min negative (-32768)", () => {
      const writeStringFn = jest.fn();
      const vm = {
        inputOutputDevice: {
          writeString: writeStringFn,
        },
      };

      h_print_num(vm, [32768]); // -32768 as unsigned
      expect(writeStringFn).toHaveBeenCalledWith("-32768");
    });

    it("should use process.stdout when no inputOutputDevice", () => {
      const stdoutSpy = jest
        .spyOn(process.stdout, "write")
        .mockImplementation();
      const vm = {};

      h_print_num(vm, [123]);
      expect(stdoutSpy).toHaveBeenCalledWith("123");

      stdoutSpy.mockRestore();
    });
  });

  describe("h_print_addr", () => {
    it("should set PC to address, print, and restore PC", () => {
      const printFn = jest.fn(() => {
        expect(vm.pc).toBe(0x200);
      });
      const vm: any = {
        pc: 0x100,
        print: printFn,
      };

      h_print_addr(vm, [0x200]);
      expect(printFn).toHaveBeenCalled();
      expect(vm.pc).toBe(0x100); // PC restored
    });

    it("should handle PC = 0", () => {
      const printFn = jest.fn(() => {
        expect(vm.pc).toBe(0x300);
      });
      const vm: any = {
        pc: 0,
        print: printFn,
      };

      h_print_addr(vm, [0x300]);
      expect(vm.pc).toBe(0);
    });

    it("should handle address = 0", () => {
      const printFn = jest.fn(() => {
        expect(vm.pc).toBe(0);
      });
      const vm: any = {
        pc: 0x100,
        print: printFn,
      };

      h_print_addr(vm, [0]);
      expect(printFn).toHaveBeenCalled();
      expect(vm.pc).toBe(0x100);
    });

    it("should handle large address", () => {
      const printFn = jest.fn(() => {
        expect(vm.pc).toBe(0xffff);
      });
      const vm: any = {
        pc: 0x500,
        print: printFn,
      };

      h_print_addr(vm, [0xffff]);
      expect(printFn).toHaveBeenCalled();
      expect(vm.pc).toBe(0x500);
    });

    it("should restore PC even if print modifies it", () => {
      const vm: any = {
        pc: 0x100,
        print: jest.fn(() => {
          vm.pc = 0x250; // print modifies PC
        }),
      };

      h_print_addr(vm, [0x200]);
      expect(vm.pc).toBe(0x100); // Still restored to original
    });
  });

  describe("h_print_paddr", () => {
    it("should unpack address (multiply by 2), print, and restore PC", () => {
      const printFn = jest.fn(() => {
        expect(vm.pc).toBe(0x200);
      });
      const vm: any = {
        pc: 0x100,
        print: printFn,
      };

      h_print_paddr(vm, [0x100]); // 0x100 * 2 = 0x200
      expect(printFn).toHaveBeenCalled();
      expect(vm.pc).toBe(0x100);
    });

    it("should handle packed address = 0", () => {
      const printFn = jest.fn(() => {
        expect(vm.pc).toBe(0);
      });
      const vm: any = {
        pc: 0x100,
        print: printFn,
      };

      h_print_paddr(vm, [0]);
      expect(printFn).toHaveBeenCalled();
      expect(vm.pc).toBe(0x100);
    });

    it("should handle packed address = 1", () => {
      const printFn = jest.fn(() => {
        expect(vm.pc).toBe(2);
      });
      const vm: any = {
        pc: 0x50,
        print: printFn,
      };

      h_print_paddr(vm, [1]); // 1 * 2 = 2
      expect(printFn).toHaveBeenCalled();
      expect(vm.pc).toBe(0x50);
    });

    it("should handle large packed address", () => {
      const printFn = jest.fn(() => {
        expect(vm.pc).toBe(0x10000); // 0x8000 * 2
      });
      const vm: any = {
        pc: 0x200,
        print: printFn,
      };

      h_print_paddr(vm, [0x8000]);
      expect(printFn).toHaveBeenCalled();
      expect(vm.pc).toBe(0x200);
    });

    it("should restore PC even if print modifies it", () => {
      const vm: any = {
        pc: 0x100,
        print: jest.fn(() => {
          vm.pc = 0x999;
        }),
      };

      h_print_paddr(vm, [0x200]);
      expect(vm.pc).toBe(0x100);
    });

    it("should handle max packed address (65535)", () => {
      const printFn = jest.fn(() => {
        expect(vm.pc).toBe(131070); // 65535 * 2
      });
      const vm: any = {
        pc: 0x100,
        print: printFn,
      };

      h_print_paddr(vm, [65535]);
      expect(printFn).toHaveBeenCalled();
      expect(vm.pc).toBe(0x100);
    });
  });

  describe("Integration tests", () => {
    it("should handle multiple text operations in sequence", () => {
      const writeStringFn = jest.fn();
      const printFn = jest.fn();
      const vm: any = {
        inputOutputDevice: {
          writeString: writeStringFn,
        },
        print: printFn,
        pc: 0,
      };

      h_print_num(vm, [42]);
      h_new_line(vm);
      h_print_num(vm, [65535]); // -1
      h_new_line(vm);

      expect(writeStringFn).toHaveBeenNthCalledWith(1, "42");
      expect(writeStringFn).toHaveBeenNthCalledWith(2, "\n");
      expect(writeStringFn).toHaveBeenNthCalledWith(3, "-1");
      expect(writeStringFn).toHaveBeenNthCalledWith(4, "\n");
    });

    it("should handle print_addr with different addresses", () => {
      let callCount = 0;
      const vm: any = {
        pc: 0x100,
        print: jest.fn(() => {
          callCount++;
        }),
      };

      h_print_addr(vm, [0x200]);
      h_print_addr(vm, [0x300]);
      h_print_addr(vm, [0x400]);

      expect(vm.print).toHaveBeenCalledTimes(3);
      expect(vm.pc).toBe(0x100); // Always restored
    });
  });
});
