import { h_pop, h_push, h_pull, h_random } from "./stack";

describe("Stack Handlers", () => {
  describe("h_pop", () => {
    it("should pop value from stack", () => {
      const vm = {
        stack: [10, 20, 30],
      };

      h_pop(vm);
      expect(vm.stack).toEqual([10, 20]);
    });

    it("should handle multiple pops", () => {
      const vm = {
        stack: [1, 2, 3, 4, 5],
      };

      h_pop(vm);
      h_pop(vm);
      expect(vm.stack).toEqual([1, 2, 3]);
    });

    it("should handle popping from single element stack", () => {
      const vm = {
        stack: [42],
      };

      h_pop(vm);
      expect(vm.stack).toEqual([]);
    });

    it("should handle popping from empty stack", () => {
      const vm = {
        stack: [],
      };

      h_pop(vm);
      expect(vm.stack).toEqual([]);
    });
  });

  describe("h_push", () => {
    it("should push value to stack", () => {
      const vm = {
        stack: [10, 20],
      };

      h_push(vm, [30]);
      expect(vm.stack).toEqual([10, 20, 30]);
    });

    it("should push to empty stack", () => {
      const vm = {
        stack: [],
      };

      h_push(vm, [42]);
      expect(vm.stack).toEqual([42]);
    });

    it("should push zero", () => {
      const vm = {
        stack: [1],
      };

      h_push(vm, [0]);
      expect(vm.stack).toEqual([1, 0]);
    });

    it("should push max unsigned 16-bit value", () => {
      const vm = {
        stack: [],
      };

      h_push(vm, [0xffff]);
      expect(vm.stack).toEqual([0xffff]);
    });

    it("should handle multiple pushes", () => {
      const vm = {
        stack: [],
      };

      h_push(vm, [1]);
      h_push(vm, [2]);
      h_push(vm, [3]);
      expect(vm.stack).toEqual([1, 2, 3]);
    });
  });

  describe("h_pull", () => {
    it("should pull value from stack and store to variable", () => {
      const setVariableValue = jest.fn();
      const vm = {
        stack: [10, 20, 30],
        setVariableValue,
        trace: false,
      };

      h_pull(vm, [5]);
      expect(vm.stack).toEqual([10, 20]);
      expect(setVariableValue).toHaveBeenCalledWith(5, 30);
    });

    it("should pull to variable 0 (stack)", () => {
      const setVariableValue = jest.fn();
      const vm = {
        stack: [100, 200],
        setVariableValue,
        trace: false,
      };

      h_pull(vm, [0]);
      expect(vm.stack).toEqual([100]);
      expect(setVariableValue).toHaveBeenCalledWith(0, 200);
    });

    it("should pull last element from stack", () => {
      const setVariableValue = jest.fn();
      const vm = {
        stack: [42],
        setVariableValue,
        trace: false,
      };

      h_pull(vm, [1]);
      expect(vm.stack).toEqual([]);
      expect(setVariableValue).toHaveBeenCalledWith(1, 42);
    });

    it("should log error on stack underflow", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const setVariableValue = jest.fn();
      const vm = {
        stack: [],
        setVariableValue,
        trace: false,
      };

      h_pull(vm, [5]);
      expect(consoleSpy).toHaveBeenCalledWith("Stack underflow in pull");
      expect(setVariableValue).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle undefined as 0 when popping from empty-ish state", () => {
      const setVariableValue = jest.fn();
      const vm = {
        stack: [undefined] as any,
        setVariableValue,
        trace: false,
      };

      vm.stack.pop(); // Make it truly empty
      vm.stack.push(10); // Add a value
      h_pull(vm, [2]);
      expect(setVariableValue).toHaveBeenCalledWith(2, 10);
    });

    it("should log trace information when trace enabled", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const setVariableValue = jest.fn();
      const vm = {
        stack: [100, 200],
        setVariableValue,
        trace: true,
      };

      h_pull(vm, [3]);
      expect(consoleSpy).toHaveBeenCalledWith(
        "@pull: stack length=2, target var=3",
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "@pull: pulled value=200, storing to var 3",
      );

      consoleSpy.mockRestore();
    });
  });

  describe("h_random", () => {
    it("should return value between 1 and range for positive range", () => {
      const storeFn = jest.fn();
      const vm = {};

      // Run multiple times to test randomness
      for (let i = 0; i < 100; i++) {
        h_random(vm, [10], { store: storeFn });
        const value = storeFn.mock.calls[i][0];
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    });

    it("should return 1 when range is 1", () => {
      const storeFn = jest.fn();
      const vm = {};

      h_random(vm, [1], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(1);
    });

    it("should return value in range for large positive range", () => {
      const storeFn = jest.fn();
      const vm = {};

      for (let i = 0; i < 50; i++) {
        h_random(vm, [1000], { store: storeFn });
        const value = storeFn.mock.calls[i][0];
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(1000);
      }
    });

    it("should return 0 for negative range (seeding)", () => {
      const storeFn = jest.fn();
      const vm = {};

      h_random(vm, [65535], { store: storeFn }); // -1 as signed
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should return 0 for zero range", () => {
      const storeFn = jest.fn();
      const vm = {};

      h_random(vm, [0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should return 0 for negative range (seed = -100)", () => {
      const storeFn = jest.fn();
      const vm = {};

      h_random(vm, [65536 - 100], { store: storeFn }); // -100 as unsigned
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should work without store function", () => {
      const vm = {};
      expect(() => h_random(vm, [10], {})).not.toThrow();
    });

    it("should handle max positive range (32767)", () => {
      const storeFn = jest.fn();
      const vm = {};

      for (let i = 0; i < 20; i++) {
        h_random(vm, [32767], { store: storeFn });
        const value = storeFn.mock.calls[i][0];
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(32767);
      }
    });

    it("should return integer values only", () => {
      const storeFn = jest.fn();
      const vm = {};

      for (let i = 0; i < 50; i++) {
        h_random(vm, [100], { store: storeFn });
        const value = storeFn.mock.calls[i][0];
        expect(value).toBe(Math.floor(value));
      }
    });

    it("should eventually produce different values", () => {
      const storeFn = jest.fn();
      const vm = {};
      const values = new Set();

      for (let i = 0; i < 50; i++) {
        h_random(vm, [100], { store: storeFn });
        values.add(storeFn.mock.calls[i][0]);
      }

      // Should have at least a few different values
      expect(values.size).toBeGreaterThan(5);
    });
  });

  describe("Integration: push, pop, and pull", () => {
    it("should work together in sequence", () => {
      const setVariableValue = jest.fn();
      const vm = {
        stack: [],
        setVariableValue,
        trace: false,
      };

      h_push(vm, [10]);
      h_push(vm, [20]);
      h_push(vm, [30]);
      expect(vm.stack).toEqual([10, 20, 30]);

      h_pop(vm);
      expect(vm.stack).toEqual([10, 20]);

      h_pull(vm, [1]);
      expect(vm.stack).toEqual([10]);
      expect(setVariableValue).toHaveBeenCalledWith(1, 20);

      h_push(vm, [40]);
      expect(vm.stack).toEqual([10, 40]);
    });

    it("should handle push after pull", () => {
      const setVariableValue = jest.fn();
      const vm = {
        stack: [100],
        setVariableValue,
        trace: false,
      };

      h_pull(vm, [5]);
      expect(vm.stack).toEqual([]);

      h_push(vm, [200]);
      h_push(vm, [300]);
      expect(vm.stack).toEqual([200, 300]);
    });
  });
});
