import { h_call, h_call_1s, h_call_2s } from "./call";

describe("Call Handlers", () => {
  // Helper to create a mock VM with Buffer-based memory
  const createMockVM = (version: number, memorySize: number = 1024) => {
    const memory = Buffer.alloc(memorySize);

    return {
      memory,
      header: { version },
      pc: 0x400,
      callStack: [] as number[],
      localVariables: [] as number[],
      currentContext: 0,
      trace: false,
      _currentStoreTarget: undefined as number | undefined,
    };
  };

  // Helper to set up a routine in memory
  const setupRoutine = (
    vm: any,
    routineAddress: number,
    localVarCount: number,
    initialValues?: number[],
  ) => {
    vm.memory.writeUInt8(localVarCount, routineAddress);

    if (vm.header.version <= 4 && initialValues) {
      let offset = routineAddress + 1;
      for (const value of initialValues) {
        vm.memory.writeUInt16BE(value, offset);
        offset += 2;
      }
    }
  };

  describe("h_call", () => {
    describe("Error handling", () => {
      it("should handle missing memory", () => {
        const vm = { memory: null, header: { version: 5 } };
        const consoleSpy = jest.spyOn(console, "error").mockImplementation();
        const storeFn = jest.fn();

        h_call(vm, [0x100], { store: storeFn });

        expect(consoleSpy).toHaveBeenCalledWith("Memory or header not loaded");
        expect(storeFn).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it("should handle missing header", () => {
        const vm = { memory: Buffer.alloc(1024), header: null };
        const consoleSpy = jest.spyOn(console, "error").mockImplementation();
        const storeFn = jest.fn();

        h_call(vm, [0x100], { store: storeFn });

        expect(consoleSpy).toHaveBeenCalledWith("Memory or header not loaded");
        expect(storeFn).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it("should return FALSE when calling routine address 0", () => {
        const vm = createMockVM(5);
        const storeFn = jest.fn();

        h_call(vm, [0], { store: storeFn });

        expect(storeFn).toHaveBeenCalledWith(0);
        expect(vm.callStack).toHaveLength(0);
      });

      it("should log trace when calling routine address 0 with trace enabled", () => {
        const vm = createMockVM(5);
        vm.trace = true;
        const consoleSpy = jest.spyOn(console, "log").mockImplementation();
        const storeFn = jest.fn();

        h_call(vm, [0], { store: storeFn });

        expect(consoleSpy).toHaveBeenCalledWith(
          "@call routine address 0: returning FALSE",
        );
        expect(storeFn).toHaveBeenCalledWith(0);

        consoleSpy.mockRestore();
      });

      it("should return FALSE when routine address is out of bounds", () => {
        const vm = createMockVM(5, 100);
        const storeFn = jest.fn();

        // Packed address 100 * 4 = 400 (out of bounds for 100-byte memory)
        h_call(vm, [100], { store: storeFn });

        expect(storeFn).toHaveBeenCalledWith(0);
        expect(vm.callStack).toHaveLength(0);
      });

      it("should work when store is not provided", () => {
        const vm = createMockVM(5);

        expect(() => h_call(vm, [0], {})).not.toThrow();
      });
    });

    describe("Packed address unpacking", () => {
      it("should unpack address correctly for version 1-3 (multiply by 2)", () => {
        const vm = createMockVM(3);
        const storeFn = jest.fn();
        const packedAddr = 0x100;
        const routineAddr = packedAddr * 2; // 0x200

        setupRoutine(vm, routineAddr, 2, [10, 20]);

        h_call(vm, [packedAddr], { store: storeFn });

        expect(vm.currentContext).toBe(routineAddr);
        expect(vm.pc).toBe(routineAddr + 1 + 2 * 2); // addr + localVarCount byte + 2 initial values
      });

      it("should unpack address correctly for version 4-5 (multiply by 4)", () => {
        const vm = createMockVM(4, 2048); // Larger memory
        const storeFn = jest.fn();
        const packedAddr = 0x100;
        const routineAddr = packedAddr * 4; // 0x400

        setupRoutine(vm, routineAddr, 1, [5]);

        h_call(vm, [packedAddr], { store: storeFn });

        expect(vm.currentContext).toBe(routineAddr);
        expect(vm.pc).toBe(routineAddr + 1 + 1 * 2);
      });

      it("should unpack address correctly for version 5 (multiply by 4)", () => {
        const vm = createMockVM(5);
        const storeFn = jest.fn();
        const packedAddr = 0x80;
        const routineAddr = packedAddr * 4; // 0x200

        setupRoutine(vm, routineAddr, 3);

        h_call(vm, [packedAddr], { store: storeFn });

        expect(vm.currentContext).toBe(routineAddr);
        expect(vm.pc).toBe(routineAddr + 1); // No initial values in v5+
      });

      it("should unpack address correctly for version 6+ (multiply by 8)", () => {
        const vm = createMockVM(6);
        const storeFn = jest.fn();
        const packedAddr = 0x40;
        const routineAddr = packedAddr * 8; // 0x200

        setupRoutine(vm, routineAddr, 2);

        h_call(vm, [packedAddr], { store: storeFn });

        expect(vm.currentContext).toBe(routineAddr);
        expect(vm.pc).toBe(routineAddr + 1);
      });
    });

    describe("Call stack management", () => {
      it("should save return PC on call stack", () => {
        const vm = createMockVM(5);
        const returnPC = 0x400;
        vm.pc = returnPC;

        setupRoutine(vm, 0x200, 0);

        h_call(vm, [0x80], {}); // 0x80 * 4 = 0x200

        expect(vm.callStack[0]).toBe(returnPC);
      });

      it("should save store target when provided", () => {
        const vm = createMockVM(5);
        vm.pc = 0x400;
        vm._currentStoreTarget = 0x10;

        setupRoutine(vm, 0x200, 0);

        h_call(vm, [0x80], {});

        expect(vm.callStack[0]).toBe(0x400); // PC
        expect(vm.callStack[1]).toBe(0x10); // Store target
      });

      it("should save current local variables", () => {
        const vm = createMockVM(5);
        vm.pc = 0x400;
        vm.localVariables = [10, 20, 30];

        setupRoutine(vm, 0x200, 2);

        h_call(vm, [0x80, 100, 200], {});

        // callStack should contain: PC, local1, local2, local3, localCount, frameMarker
        expect(vm.callStack).toEqual([0x400, 10, 20, 30, 3, 0]);
      });

      it("should save frame marker as 1 when store target exists", () => {
        const vm = createMockVM(5);
        vm.pc = 0x400;
        vm._currentStoreTarget = 0x10;
        vm.localVariables = [5];

        setupRoutine(vm, 0x200, 1);

        h_call(vm, [0x80], {});

        // callStack: PC, storeTarget, local1, localCount, frameMarker
        expect(vm.callStack).toEqual([0x400, 0x10, 5, 1, 1]);
      });

      it("should save frame marker as 0 when no store target", () => {
        const vm = createMockVM(5);
        vm.pc = 0x400;
        vm.localVariables = [];

        setupRoutine(vm, 0x200, 0);

        h_call(vm, [0x80], {});

        // callStack: PC, localCount, frameMarker
        expect(vm.callStack).toEqual([0x400, 0, 0]);
      });
    });

    describe("Local variables initialization (version 1-4)", () => {
      it("should initialize locals with initial values from story file", () => {
        const vm = createMockVM(4);

        setupRoutine(vm, 0x200, 3, [100, 200, 300]);

        h_call(vm, [0x80], {}); // 0x80 * 4 = 0x200, no arguments

        expect(vm.localVariables).toEqual([100, 200, 300]);
      });

      it("should replace initial values with provided arguments", () => {
        const vm = createMockVM(3);

        setupRoutine(vm, 0x100, 3, [100, 200, 300]); // 0x80 * 2 = 0x100

        h_call(vm, [0x80, 10, 20], {}); // Provide 2 arguments

        expect(vm.localVariables).toEqual([10, 20, 300]); // First 2 replaced, last uses initial
      });

      it("should handle all arguments provided", () => {
        const vm = createMockVM(4);

        setupRoutine(vm, 0x200, 3, [100, 200, 300]);

        h_call(vm, [0x80, 5, 6, 7], {}); // All 3 arguments provided

        expect(vm.localVariables).toEqual([5, 6, 7]);
      });

      it("should handle more arguments than locals", () => {
        const vm = createMockVM(4);

        setupRoutine(vm, 0x200, 2, [100, 200]);

        h_call(vm, [0x80, 1, 2, 3, 4], {}); // More args than locals

        // Only first 2 arguments are used
        expect(vm.localVariables).toEqual([1, 2]);
      });
    });

    describe("Local variables initialization (version 5+)", () => {
      it("should initialize locals to 0 when no arguments provided", () => {
        const vm = createMockVM(5);

        setupRoutine(vm, 0x200, 3);

        h_call(vm, [0x80], {}); // No arguments

        expect(vm.localVariables).toEqual([0, 0, 0]);
      });

      it("should initialize locals with provided arguments and fill rest with 0", () => {
        const vm = createMockVM(5);

        setupRoutine(vm, 0x200, 4);

        h_call(vm, [0x80, 10, 20], {}); // 2 arguments

        expect(vm.localVariables).toEqual([10, 20, 0, 0]);
      });

      it("should handle all arguments provided", () => {
        const vm = createMockVM(6);

        setupRoutine(vm, 0x200, 3);

        h_call(vm, [0x40, 5, 6, 7], {}); // 0x40 * 8 = 0x200, 3 arguments

        expect(vm.localVariables).toEqual([5, 6, 7]);
      });

      it("should handle zero local variables", () => {
        const vm = createMockVM(5);

        setupRoutine(vm, 0x200, 0);

        h_call(vm, [0x80, 1, 2, 3], {}); // Arguments ignored

        expect(vm.localVariables).toEqual([]);
      });
    });

    describe("PC and context updates", () => {
      it("should set currentContext to routine address", () => {
        const vm = createMockVM(5);

        setupRoutine(vm, 0x200, 0);

        h_call(vm, [0x80], {});

        expect(vm.currentContext).toBe(0x200);
      });

      it("should set PC to start of routine body (v5+)", () => {
        const vm = createMockVM(5);
        const routineAddr = 0x200;

        setupRoutine(vm, routineAddr, 0);

        h_call(vm, [0x80], {});

        // PC should be at routineAddr + 1 (after localVarCount byte)
        expect(vm.pc).toBe(routineAddr + 1);
      });

      it("should set PC correctly after initial values (v4)", () => {
        const vm = createMockVM(4);
        const routineAddr = 0x200;

        setupRoutine(vm, routineAddr, 3, [100, 200, 300]);

        h_call(vm, [0x80], {}); // 0x80 * 4 = 0x200

        // PC should be at routineAddr + 1 + (3 * 2)
        expect(vm.pc).toBe(routineAddr + 1 + 6);
      });
    });

    describe("Trace logging", () => {
      it("should log call information when trace is enabled", () => {
        const vm = createMockVM(5);
        vm.trace = true;
        const consoleSpy = jest.spyOn(console, "log").mockImplementation();

        setupRoutine(vm, 0x200, 0);

        h_call(vm, [0x80, 10, 20], {}); // 2 arguments

        expect(consoleSpy).toHaveBeenCalledWith(
          "@call Calling routine at 200 with 2 args",
        );

        consoleSpy.mockRestore();
      });

      it("should not log when trace is disabled", () => {
        const vm = createMockVM(5);
        vm.trace = false;
        const consoleSpy = jest.spyOn(console, "log").mockImplementation();

        setupRoutine(vm, 0x200, 0);

        h_call(vm, [0x80], {});

        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });
  });

  describe("h_call_1s", () => {
    describe("Error handling", () => {
      it("should handle missing memory", () => {
        const vm = { memory: null, header: { version: 5 } };
        const consoleSpy = jest.spyOn(console, "error").mockImplementation();
        const storeFn = jest.fn();

        h_call_1s(vm, [0x100], { store: storeFn });

        expect(consoleSpy).toHaveBeenCalledWith("Memory or header not loaded");
        expect(storeFn).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it("should return FALSE when calling routine address 0", () => {
        const vm = createMockVM(5);
        const storeFn = jest.fn();

        h_call_1s(vm, [0], { store: storeFn });

        expect(storeFn).toHaveBeenCalledWith(0);
        expect(vm.callStack).toHaveLength(0);
      });

      it("should return FALSE when routine address is out of bounds", () => {
        const vm = createMockVM(5, 100);
        const storeFn = jest.fn();

        h_call_1s(vm, [100], { store: storeFn });

        expect(storeFn).toHaveBeenCalledWith(0);
      });
    });

    describe("Basic functionality", () => {
      it("should call routine with no arguments", () => {
        const vm = createMockVM(5);

        setupRoutine(vm, 0x200, 2);

        h_call_1s(vm, [0x80], {});

        expect(vm.currentContext).toBe(0x200);
        expect(vm.localVariables).toEqual([0, 0]);
      });

      it("should unpack addresses correctly for different versions", () => {
        // Version 3
        const vm3 = createMockVM(3);
        setupRoutine(vm3, 0x100, 0, []); // 0x80 * 2 = 0x100
        h_call_1s(vm3, [0x80], {});
        expect(vm3.currentContext).toBe(0x100);

        // Version 4
        const vm4 = createMockVM(4, 2048);
        setupRoutine(vm4, 0x200, 0, []); // 0x80 * 4 = 0x200
        h_call_1s(vm4, [0x80], {});
        expect(vm4.currentContext).toBe(0x200);

        // Version 5
        const vm5 = createMockVM(5, 2048);
        setupRoutine(vm5, 0x200, 0);
        h_call_1s(vm5, [0x80], {});
        expect(vm5.currentContext).toBe(0x200);

        // Version 6
        const vm6 = createMockVM(6, 2048);
        setupRoutine(vm6, 0x400, 0); // 0x80 * 8 = 0x400
        h_call_1s(vm6, [0x80], {});
        expect(vm6.currentContext).toBe(0x400);
      });

      it("should save call stack correctly", () => {
        const vm = createMockVM(5);
        vm.pc = 0x400;
        vm._currentStoreTarget = 0x15;
        vm.localVariables = [10, 20];

        setupRoutine(vm, 0x200, 0);

        h_call_1s(vm, [0x80], {});

        // callStack: PC, storeTarget, local1, local2, localCount, frameMarker
        expect(vm.callStack).toEqual([0x400, 0x15, 10, 20, 2, 1]);
      });

      it("should initialize locals correctly for v4", () => {
        const vm = createMockVM(4);

        setupRoutine(vm, 0x200, 3, [100, 200, 300]);

        h_call_1s(vm, [0x80], {});

        expect(vm.localVariables).toEqual([100, 200, 300]);
      });

      it("should initialize locals correctly for v5+", () => {
        const vm = createMockVM(5);

        setupRoutine(vm, 0x200, 3);

        h_call_1s(vm, [0x80], {});

        expect(vm.localVariables).toEqual([0, 0, 0]);
      });
    });

    describe("Trace logging", () => {
      it("should log call information when trace is enabled", () => {
        const vm = createMockVM(5);
        vm.trace = true;
        vm._currentStoreTarget = 0x10;
        vm.localVariables = [];
        const consoleSpy = jest.spyOn(console, "log").mockImplementation();

        setupRoutine(vm, 0x200, 0);

        h_call_1s(vm, [0x80], {});

        expect(consoleSpy).toHaveBeenCalledWith(
          "@call_1s Calling routine at 200",
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("@call_1s Pushed: returnPC=400"),
        );

        consoleSpy.mockRestore();
      });
    });
  });

  describe("h_call_2s", () => {
    it("should delegate to h_call", () => {
      const vm = createMockVM(5);
      const storeFn = jest.fn();

      setupRoutine(vm, 0x200, 2);

      h_call_2s(vm, [0x80, 10, 20], { store: storeFn });

      expect(vm.currentContext).toBe(0x200);
      expect(vm.localVariables).toEqual([10, 20]);
    });

    it("should work with 1 argument", () => {
      const vm = createMockVM(5);

      setupRoutine(vm, 0x200, 2);

      h_call_2s(vm, [0x80, 10], {});

      expect(vm.localVariables).toEqual([10, 0]);
    });

    it("should work with 2 arguments", () => {
      const vm = createMockVM(5);

      setupRoutine(vm, 0x200, 2);

      h_call_2s(vm, [0x80, 10, 20], {});

      expect(vm.localVariables).toEqual([10, 20]);
    });

    it("should return FALSE for address 0", () => {
      const vm = createMockVM(5);
      const storeFn = jest.fn();

      h_call_2s(vm, [0], { store: storeFn });

      expect(storeFn).toHaveBeenCalledWith(0);
    });
  });

  describe("Integration tests", () => {
    it("should handle complex call scenario with multiple locals and arguments", () => {
      const vm = createMockVM(4, 2048);
      vm.pc = 0x500;
      vm._currentStoreTarget = 0x20;
      vm.localVariables = [1, 2, 3, 4, 5];

      setupRoutine(vm, 0x400, 4, [100, 200, 300, 400]);

      h_call(vm, [0x100, 10, 20], {}); // 0x100 * 4 = 0x400, 2 args

      // Check call stack saved everything
      expect(vm.callStack).toEqual([
        0x500, // PC
        0x20, // Store target
        1,
        2,
        3,
        4,
        5, // Previous locals
        5, // Local count
        1, // Frame marker
      ]);

      // Check new locals initialized
      expect(vm.localVariables).toEqual([10, 20, 300, 400]);

      // Check context updated
      expect(vm.currentContext).toBe(0x400);
      expect(vm.pc).toBe(0x400 + 1 + 4 * 2); // After local var count and initial values
    });

    it("should handle nested call scenario", () => {
      const vm = createMockVM(5, 2048);

      // First call
      setupRoutine(vm, 0x200, 2);
      h_call(vm, [0x80, 5, 10], {});

      const firstCallStack = [...vm.callStack];

      // Second call (nested)
      setupRoutine(vm, 0x300, 1);
      h_call(vm, [0xc0, 99], {}); // 0xC0 * 4 = 0x300

      // Call stack should have both frames
      expect(vm.callStack.length).toBeGreaterThan(firstCallStack.length);

      // Current locals should be from second call
      expect(vm.localVariables).toEqual([99]);

      // PC should be in second routine
      expect(vm.currentContext).toBe(0x300);
    });
  });
});
