import {
  h_inc,
  h_dec,
  h_load,
  h_store,
  h_inc_chk,
  h_dec_chk,
} from "./variables";

describe("Variable Handlers", () => {
  describe("h_inc", () => {
    it("should increment variable by 1", () => {
      const getVariableValue = jest.fn().mockReturnValue(10);
      const setVariableValue = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_inc(vm, [5]);
      expect(getVariableValue).toHaveBeenCalledWith(5);
      expect(setVariableValue).toHaveBeenCalledWith(5, 11);
    });

    it("should increment from 0 to 1", () => {
      const getVariableValue = jest.fn().mockReturnValue(0);
      const setVariableValue = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_inc(vm, [1]);
      expect(setVariableValue).toHaveBeenCalledWith(1, 1);
    });

    it("should wrap around from 65535 to 0", () => {
      const getVariableValue = jest.fn().mockReturnValue(65535);
      const setVariableValue = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_inc(vm, [2]);
      expect(setVariableValue).toHaveBeenCalledWith(2, 0);
    });

    it("should increment variable 0 (stack)", () => {
      const getVariableValue = jest.fn().mockReturnValue(100);
      const setVariableValue = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_inc(vm, [0]);
      expect(getVariableValue).toHaveBeenCalledWith(0);
      expect(setVariableValue).toHaveBeenCalledWith(0, 101);
    });

    it("should mask result to 16 bits", () => {
      const getVariableValue = jest.fn().mockReturnValue(0xffff);
      const setVariableValue = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_inc(vm, [3]);
      expect(setVariableValue).toHaveBeenCalledWith(3, 0);
    });
  });

  describe("h_dec", () => {
    it("should decrement variable by 1", () => {
      const getVariableValue = jest.fn().mockReturnValue(10);
      const setVariableValue = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_dec(vm, [5]);
      expect(getVariableValue).toHaveBeenCalledWith(5);
      expect(setVariableValue).toHaveBeenCalledWith(5, 9);
    });

    it("should decrement from 1 to 0", () => {
      const getVariableValue = jest.fn().mockReturnValue(1);
      const setVariableValue = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_dec(vm, [1]);
      expect(setVariableValue).toHaveBeenCalledWith(1, 0);
    });

    it("should wrap around from 0 to 65535", () => {
      const getVariableValue = jest.fn().mockReturnValue(0);
      const setVariableValue = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_dec(vm, [2]);
      expect(setVariableValue).toHaveBeenCalledWith(2, 65535);
    });

    it("should decrement variable 0 (stack)", () => {
      const getVariableValue = jest.fn().mockReturnValue(100);
      const setVariableValue = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_dec(vm, [0]);
      expect(getVariableValue).toHaveBeenCalledWith(0);
      expect(setVariableValue).toHaveBeenCalledWith(0, 99);
    });

    it("should mask result to 16 bits", () => {
      const getVariableValue = jest.fn().mockReturnValue(0);
      const setVariableValue = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_dec(vm, [3]);
      expect(setVariableValue).toHaveBeenCalledWith(3, 0xffff);
    });
  });

  describe("h_load", () => {
    it("should load variable value and store it", () => {
      const getVariableValue = jest.fn().mockReturnValue(42);
      const storeFn = jest.fn();
      const vm = {
        getVariableValue,
      };

      h_load(vm, [5], { store: storeFn });
      expect(getVariableValue).toHaveBeenCalledWith(5);
      expect(storeFn).toHaveBeenCalledWith(42);
    });

    it("should load zero value", () => {
      const getVariableValue = jest.fn().mockReturnValue(0);
      const storeFn = jest.fn();
      const vm = {
        getVariableValue,
      };

      h_load(vm, [1], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should load max value (65535)", () => {
      const getVariableValue = jest.fn().mockReturnValue(65535);
      const storeFn = jest.fn();
      const vm = {
        getVariableValue,
      };

      h_load(vm, [10], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(65535);
    });

    it("should work without store function", () => {
      const getVariableValue = jest.fn().mockReturnValue(100);
      const vm = {
        getVariableValue,
      };

      expect(() => h_load(vm, [5], {})).not.toThrow();
      expect(getVariableValue).toHaveBeenCalledWith(5);
    });

    it("should load from variable 0 (stack)", () => {
      const getVariableValue = jest.fn().mockReturnValue(999);
      const storeFn = jest.fn();
      const vm = {
        getVariableValue,
      };

      h_load(vm, [0], { store: storeFn });
      expect(getVariableValue).toHaveBeenCalledWith(0);
      expect(storeFn).toHaveBeenCalledWith(999);
    });
  });

  describe("h_store", () => {
    it("should store value to variable", () => {
      const setVariableValue = jest.fn();
      const vm = {
        setVariableValue,
      };

      h_store(vm, [5, 100]);
      expect(setVariableValue).toHaveBeenCalledWith(5, 100);
    });

    it("should store zero", () => {
      const setVariableValue = jest.fn();
      const vm = {
        setVariableValue,
      };

      h_store(vm, [1, 0]);
      expect(setVariableValue).toHaveBeenCalledWith(1, 0);
    });

    it("should store max value", () => {
      const setVariableValue = jest.fn();
      const vm = {
        setVariableValue,
      };

      h_store(vm, [10, 65535]);
      expect(setVariableValue).toHaveBeenCalledWith(10, 65535);
    });

    it("should store to variable 0 (stack)", () => {
      const setVariableValue = jest.fn();
      const vm = {
        setVariableValue,
      };

      h_store(vm, [0, 42]);
      expect(setVariableValue).toHaveBeenCalledWith(0, 42);
    });

    it("should overwrite existing value", () => {
      const setVariableValue = jest.fn();
      const vm = {
        setVariableValue,
      };

      h_store(vm, [5, 100]);
      h_store(vm, [5, 200]);
      expect(setVariableValue).toHaveBeenNthCalledWith(1, 5, 100);
      expect(setVariableValue).toHaveBeenNthCalledWith(2, 5, 200);
    });
  });

  describe("h_inc_chk", () => {
    it("should increment and branch true if greater", () => {
      const getVariableValue = jest.fn().mockReturnValue(10);
      const setVariableValue = jest.fn();
      const branchFn = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_inc_chk(vm, [5, 10], { branch: branchFn });
      expect(setVariableValue).toHaveBeenCalledWith(5, 11);
      expect(branchFn).toHaveBeenCalledWith(true); // 11 > 10
    });

    it("should increment and branch false if not greater", () => {
      const getVariableValue = jest.fn().mockReturnValue(10);
      const setVariableValue = jest.fn();
      const branchFn = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_inc_chk(vm, [5, 11], { branch: branchFn });
      expect(setVariableValue).toHaveBeenCalledWith(5, 11);
      expect(branchFn).toHaveBeenCalledWith(false); // 11 > 11 is false
    });

    it("should branch false when equal", () => {
      const getVariableValue = jest.fn().mockReturnValue(5);
      const setVariableValue = jest.fn();
      const branchFn = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_inc_chk(vm, [1, 6], { branch: branchFn });
      expect(setVariableValue).toHaveBeenCalledWith(1, 6);
      expect(branchFn).toHaveBeenCalledWith(false); // 6 > 6 is false
    });

    it("should handle wrap around from 65535 to 0", () => {
      const getVariableValue = jest.fn().mockReturnValue(65535);
      const setVariableValue = jest.fn();
      const branchFn = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_inc_chk(vm, [2, 5], { branch: branchFn });
      expect(setVariableValue).toHaveBeenCalledWith(2, 0);
      expect(branchFn).toHaveBeenCalledWith(false); // 0 > 5 is false
    });

    it("should use signed comparison (positive > negative)", () => {
      const getVariableValue = jest.fn().mockReturnValue(0);
      const setVariableValue = jest.fn();
      const branchFn = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_inc_chk(vm, [3, 65535], { branch: branchFn }); // Compare 1 > -1
      expect(setVariableValue).toHaveBeenCalledWith(3, 1);
      expect(branchFn).toHaveBeenCalledWith(true); // 1 > -1
    });

    it("should use signed comparison (negative > negative)", () => {
      const getVariableValue = jest.fn().mockReturnValue(65534); // -2
      const setVariableValue = jest.fn();
      const branchFn = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_inc_chk(vm, [4, 65533], { branch: branchFn }); // Compare -1 > -3
      expect(setVariableValue).toHaveBeenCalledWith(4, 65535); // -1
      expect(branchFn).toHaveBeenCalledWith(true); // -1 > -3
    });

    it("should work without branch function", () => {
      const getVariableValue = jest.fn().mockReturnValue(10);
      const setVariableValue = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      expect(() => h_inc_chk(vm, [5, 10], {})).not.toThrow();
      expect(setVariableValue).toHaveBeenCalledWith(5, 11);
    });
  });

  describe("h_dec_chk", () => {
    it("should decrement and branch true if less", () => {
      const getVariableValue = jest.fn().mockReturnValue(10);
      const setVariableValue = jest.fn();
      const branchFn = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_dec_chk(vm, [5, 10], { branch: branchFn });
      expect(setVariableValue).toHaveBeenCalledWith(5, 9);
      expect(branchFn).toHaveBeenCalledWith(true); // 9 < 10
    });

    it("should decrement and branch false if not less", () => {
      const getVariableValue = jest.fn().mockReturnValue(10);
      const setVariableValue = jest.fn();
      const branchFn = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_dec_chk(vm, [5, 9], { branch: branchFn });
      expect(setVariableValue).toHaveBeenCalledWith(5, 9);
      expect(branchFn).toHaveBeenCalledWith(false); // 9 < 9 is false
    });

    it("should branch false when equal", () => {
      const getVariableValue = jest.fn().mockReturnValue(6);
      const setVariableValue = jest.fn();
      const branchFn = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_dec_chk(vm, [1, 5], { branch: branchFn });
      expect(setVariableValue).toHaveBeenCalledWith(1, 5);
      expect(branchFn).toHaveBeenCalledWith(false); // 5 < 5 is false
    });

    it("should handle wrap around from 0 to 65535", () => {
      const getVariableValue = jest.fn().mockReturnValue(0);
      const setVariableValue = jest.fn();
      const branchFn = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_dec_chk(vm, [2, 5], { branch: branchFn });
      expect(setVariableValue).toHaveBeenCalledWith(2, 65535);
      expect(branchFn).toHaveBeenCalledWith(true); // -1 < 5
    });

    it("should use signed comparison (negative < positive)", () => {
      const getVariableValue = jest.fn().mockReturnValue(65535); // -1
      const setVariableValue = jest.fn();
      const branchFn = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_dec_chk(vm, [3, 0], { branch: branchFn }); // Compare -2 < 0
      expect(setVariableValue).toHaveBeenCalledWith(3, 65534); // -2
      expect(branchFn).toHaveBeenCalledWith(true); // -2 < 0
    });

    it("should use signed comparison (negative < negative)", () => {
      const getVariableValue = jest.fn().mockReturnValue(65534); // -2
      const setVariableValue = jest.fn();
      const branchFn = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_dec_chk(vm, [4, 65535], { branch: branchFn }); // Compare -3 < -1
      expect(setVariableValue).toHaveBeenCalledWith(4, 65533); // -3
      expect(branchFn).toHaveBeenCalledWith(true); // -3 < -1
    });

    it("should work without branch function", () => {
      const getVariableValue = jest.fn().mockReturnValue(10);
      const setVariableValue = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      expect(() => h_dec_chk(vm, [5, 10], {})).not.toThrow();
      expect(setVariableValue).toHaveBeenCalledWith(5, 9);
    });
  });

  describe("Integration: inc, dec, load, store", () => {
    it("should work together in sequence", () => {
      let variable5 = 10;
      const getVariableValue = jest.fn((varNum) => {
        if (varNum === 5) return variable5;
        return 0;
      });
      const setVariableValue = jest.fn((varNum, value) => {
        if (varNum === 5) variable5 = value;
      });
      const storeFn = jest.fn();
      const vm = {
        getVariableValue,
        setVariableValue,
      };

      h_inc(vm, [5]); // 10 -> 11
      expect(variable5).toBe(11);

      h_inc(vm, [5]); // 11 -> 12
      expect(variable5).toBe(12);

      h_dec(vm, [5]); // 12 -> 11
      expect(variable5).toBe(11);

      h_load(vm, [5], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(11);

      h_store(vm, [5, 100]);
      expect(variable5).toBe(100);

      h_load(vm, [5], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(100);
    });
  });
});
