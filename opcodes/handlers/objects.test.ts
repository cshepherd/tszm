import {
  h_get_sibling,
  h_get_child,
  h_get_parent,
  h_remove_obj,
  h_print_obj,
  h_test_attr,
  h_set_attr,
  h_clear_attr,
  h_jin,
  h_insert_obj,
} from "./objects";

function createMockVMv3(objectTableAddr: number = 0x100) {
  const memory = Buffer.alloc(2048);
  return {
    memory,
    header: { version: 3 },
    getObjectAddress: jest.fn((id: number) => objectTableAddr + (id - 1) * 9),
  };
}

function createMockVMv5(objectTableAddr: number = 0x200) {
  const memory = Buffer.alloc(2048);
  return {
    memory,
    header: { version: 5 },
    getObjectAddress: jest.fn((id: number) => objectTableAddr + (id - 1) * 14),
  };
}

describe("Object Handlers", () => {
  describe("h_get_sibling", () => {
    it("should get sibling in version 3 (byte)", () => {
      const vm = createMockVMv3();
      const objAddr = vm.getObjectAddress(1);
      vm.memory.writeUInt8(5, objAddr + 5); // Sibling = 5

      const storeFn = jest.fn();
      const branchFn = jest.fn();

      h_get_sibling(vm, [1], { store: storeFn, branch: branchFn });
      expect(storeFn).toHaveBeenCalledWith(5);
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should get sibling in version 5 (word)", () => {
      const vm = createMockVMv5();
      const objAddr = vm.getObjectAddress(1);
      vm.memory.writeUInt16BE(10, objAddr + 9); // Sibling = 10

      const storeFn = jest.fn();
      const branchFn = jest.fn();

      h_get_sibling(vm, [1], { store: storeFn, branch: branchFn });
      expect(storeFn).toHaveBeenCalledWith(10);
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should branch false when sibling is 0", () => {
      const vm = createMockVMv3();
      const branchFn = jest.fn();

      h_get_sibling(vm, [1], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should log error when memory not loaded", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = { header: { version: 3 } };

      h_get_sibling(vm, [1], {});
      expect(consoleSpy).toHaveBeenCalledWith("Memory or header not loaded");

      consoleSpy.mockRestore();
    });
  });

  describe("h_get_child", () => {
    it("should get child in version 3 (byte)", () => {
      const vm = createMockVMv3();
      const objAddr = vm.getObjectAddress(1);
      vm.memory.writeUInt8(3, objAddr + 6); // Child = 3

      const storeFn = jest.fn();
      const branchFn = jest.fn();

      h_get_child(vm, [1], { store: storeFn, branch: branchFn });
      expect(storeFn).toHaveBeenCalledWith(3);
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should get child in version 5 (word)", () => {
      const vm = createMockVMv5();
      const objAddr = vm.getObjectAddress(1);
      vm.memory.writeUInt16BE(8, objAddr + 10); // Child = 8

      const storeFn = jest.fn();
      const branchFn = jest.fn();

      h_get_child(vm, [1], { store: storeFn, branch: branchFn });
      expect(storeFn).toHaveBeenCalledWith(8);
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should branch false when child is 0", () => {
      const vm = createMockVMv3();
      const branchFn = jest.fn();

      h_get_child(vm, [1], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should log error when header not loaded", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = { memory: Buffer.alloc(1024) };

      h_get_child(vm, [1], {});
      expect(consoleSpy).toHaveBeenCalledWith("Memory or header not loaded");

      consoleSpy.mockRestore();
    });
  });

  describe("h_get_parent", () => {
    it("should get parent in version 3 (byte)", () => {
      const vm = createMockVMv3();
      const objAddr = vm.getObjectAddress(2);
      vm.memory.writeUInt8(1, objAddr + 4); // Parent = 1

      const storeFn = jest.fn();

      h_get_parent(vm, [2], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(1);
    });

    it("should get parent in version 5 (word)", () => {
      const vm = createMockVMv5();
      const objAddr = vm.getObjectAddress(3);
      vm.memory.writeUInt16BE(2, objAddr + 6); // Parent = 2

      const storeFn = jest.fn();

      h_get_parent(vm, [3], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(2);
    });

    it("should return 0 when object has no parent", () => {
      const vm = createMockVMv3();
      const storeFn = jest.fn();

      h_get_parent(vm, [1], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });
  });

  describe("h_remove_obj", () => {
    it("should do nothing when object ID is 0", () => {
      const vm = createMockVMv3();
      expect(() => h_remove_obj(vm, [0])).not.toThrow();
    });

    it("should do nothing when object has no parent", () => {
      const vm = createMockVMv3();
      expect(() => h_remove_obj(vm, [1])).not.toThrow();
    });

    it("should remove object as first child in v3", () => {
      const vm = createMockVMv3();
      const parent1Addr = vm.getObjectAddress(1);
      const obj2Addr = vm.getObjectAddress(2);
      const obj3Addr = vm.getObjectAddress(3);

      // Setup: parent(1) -> child(2) -> sibling(3)
      vm.memory.writeUInt8(2, parent1Addr + 6); // Parent's child = 2
      vm.memory.writeUInt8(1, obj2Addr + 4); // Obj2's parent = 1
      vm.memory.writeUInt8(3, obj2Addr + 5); // Obj2's sibling = 3

      h_remove_obj(vm, [2]);

      // After removal, parent should point to obj3
      expect(vm.memory.readUInt8(parent1Addr + 6)).toBe(3);
      expect(vm.memory.readUInt8(obj2Addr + 4)).toBe(0); // Obj2's parent cleared
      expect(vm.memory.readUInt8(obj2Addr + 5)).toBe(0); // Obj2's sibling cleared
    });

    it("should remove object from middle of sibling chain in v3", () => {
      const vm = createMockVMv3();
      const parent1Addr = vm.getObjectAddress(1);
      const obj2Addr = vm.getObjectAddress(2);
      const obj3Addr = vm.getObjectAddress(3);
      const obj4Addr = vm.getObjectAddress(4);

      // Setup: parent(1) -> child(2) -> sibling(3) -> sibling(4)
      vm.memory.writeUInt8(2, parent1Addr + 6);
      vm.memory.writeUInt8(1, obj2Addr + 4);
      vm.memory.writeUInt8(3, obj2Addr + 5);
      vm.memory.writeUInt8(1, obj3Addr + 4);
      vm.memory.writeUInt8(4, obj3Addr + 5);
      vm.memory.writeUInt8(1, obj4Addr + 4);

      h_remove_obj(vm, [3]);

      // After removal, obj2's sibling should be obj4
      expect(vm.memory.readUInt8(obj2Addr + 5)).toBe(4);
      expect(vm.memory.readUInt8(obj3Addr + 4)).toBe(0);
      expect(vm.memory.readUInt8(obj3Addr + 5)).toBe(0);
    });

    it("should remove object as first child in v5", () => {
      const vm = createMockVMv5();
      const parent1Addr = vm.getObjectAddress(1);
      const obj2Addr = vm.getObjectAddress(2);
      const obj3Addr = vm.getObjectAddress(3);

      // Setup: parent(1) -> child(2) -> sibling(3)
      vm.memory.writeUInt16BE(2, parent1Addr + 10);
      vm.memory.writeUInt16BE(1, obj2Addr + 6);
      vm.memory.writeUInt16BE(3, obj2Addr + 9);

      h_remove_obj(vm, [2]);

      expect(vm.memory.readUInt16BE(parent1Addr + 10)).toBe(3);
      expect(vm.memory.readUInt16BE(obj2Addr + 6)).toBe(0);
      expect(vm.memory.readUInt16BE(obj2Addr + 9)).toBe(0);
    });
  });

  describe("h_print_obj", () => {
    it("should print object name in version 3", () => {
      const vm: any = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7); // Property table pointer
      vm.pc = 0;
      vm.print = jest.fn(() => {
        // Verify PC was set correctly during print
        expect(vm.pc).toBe(propTableAddr + 1);
      });

      h_print_obj(vm, [1]);

      expect(vm.print).toHaveBeenCalled();
      expect(vm.pc).toBe(0); // PC should be restored to original
    });

    it("should print object name in version 5", () => {
      const vm: any = createMockVMv5();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x400;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 12); // Property table pointer
      vm.pc = 100;
      vm.print = jest.fn();

      h_print_obj(vm, [1]);

      expect(vm.print).toHaveBeenCalled();
      expect(vm.pc).toBe(100); // PC should be restored
    });

    it("should log error when memory not loaded", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = {};

      h_print_obj(vm, [1]);
      expect(consoleSpy).toHaveBeenCalledWith("Memory or header not loaded");

      consoleSpy.mockRestore();
    });
  });

  describe("h_test_attr", () => {
    it("should test attribute bit in version 3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      vm.memory.writeUInt8(0b10000000, obj1Addr + 0); // Attr 0 is set

      const branchFn = jest.fn();
      h_test_attr(vm, [1, 0], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should test unset attribute", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      vm.memory.writeUInt8(0b01000000, obj1Addr + 0);

      const branchFn = jest.fn();
      h_test_attr(vm, [1, 0], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should test attribute in second byte", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      vm.memory.writeUInt8(0b00000001, obj1Addr + 1); // Attr 15 is set

      const branchFn = jest.fn();
      h_test_attr(vm, [1, 15], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should handle attributes in version 5 (6 bytes)", () => {
      const vm = createMockVMv5();
      const obj1Addr = vm.getObjectAddress(1);
      vm.memory.writeUInt8(0b10000000, obj1Addr + 5); // Attr 40 is set

      const branchFn = jest.fn();
      h_test_attr(vm, [1, 40], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should log error for invalid attribute in v3", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = createMockVMv3();

      h_test_attr(vm, [1, 32], {}); // v3 only has 32 attrs (4 bytes)
      expect(consoleSpy).toHaveBeenCalledWith("Invalid attribute number 32");

      consoleSpy.mockRestore();
    });
  });

  describe("h_set_attr", () => {
    it("should set attribute bit in version 3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);

      h_set_attr(vm, [1, 0]);
      expect(vm.memory.readUInt8(obj1Addr + 0)).toBe(0b10000000);
    });

    it("should preserve other bits when setting", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      vm.memory.writeUInt8(0b10000000, obj1Addr + 0);

      h_set_attr(vm, [1, 7]);
      expect(vm.memory.readUInt8(obj1Addr + 0)).toBe(0b10000001);
    });

    it("should set attribute in different byte", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);

      h_set_attr(vm, [1, 16]);
      expect(vm.memory.readUInt8(obj1Addr + 2)).toBe(0b10000000);
    });

    it("should handle setting already set attribute", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      vm.memory.writeUInt8(0b10000000, obj1Addr + 0);

      h_set_attr(vm, [1, 0]);
      expect(vm.memory.readUInt8(obj1Addr + 0)).toBe(0b10000000);
    });

    it("should log error for invalid attribute", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = createMockVMv3();

      h_set_attr(vm, [1, 32]);
      expect(consoleSpy).toHaveBeenCalledWith("Invalid attribute number 32");

      consoleSpy.mockRestore();
    });
  });

  describe("h_clear_attr", () => {
    it("should clear attribute bit in version 3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      vm.memory.writeUInt8(0b10000000, obj1Addr + 0);

      h_clear_attr(vm, [1, 0]);
      expect(vm.memory.readUInt8(obj1Addr + 0)).toBe(0);
    });

    it("should preserve other bits when clearing", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      vm.memory.writeUInt8(0b11000000, obj1Addr + 0);

      h_clear_attr(vm, [1, 0]);
      expect(vm.memory.readUInt8(obj1Addr + 0)).toBe(0b01000000);
    });

    it("should handle clearing already clear attribute", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);

      h_clear_attr(vm, [1, 0]);
      expect(vm.memory.readUInt8(obj1Addr + 0)).toBe(0);
    });

    it("should clear attribute in different byte", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      vm.memory.writeUInt8(0b00000001, obj1Addr + 1);

      h_clear_attr(vm, [1, 15]);
      expect(vm.memory.readUInt8(obj1Addr + 1)).toBe(0);
    });

    it("should log error for invalid attribute", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = createMockVMv3();

      h_clear_attr(vm, [1, 50]);
      expect(consoleSpy).toHaveBeenCalledWith("Invalid attribute number 50");

      consoleSpy.mockRestore();
    });
  });

  describe("h_jin", () => {
    it("should branch true when obj1 is child of obj2 in v3", () => {
      const vm = createMockVMv3();
      const obj2Addr = vm.getObjectAddress(2);
      vm.memory.writeUInt8(1, obj2Addr + 4); // Obj2's parent = 1

      const branchFn = jest.fn();
      h_jin(vm, [2, 1], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should branch false when obj1 is not child of obj2", () => {
      const vm = createMockVMv3();
      const obj2Addr = vm.getObjectAddress(2);
      vm.memory.writeUInt8(3, obj2Addr + 4);

      const branchFn = jest.fn();
      h_jin(vm, [2, 1], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(false);
    });

    it("should work in version 5", () => {
      const vm = createMockVMv5();
      const obj3Addr = vm.getObjectAddress(3);
      vm.memory.writeUInt16BE(2, obj3Addr + 6);

      const branchFn = jest.fn();
      h_jin(vm, [3, 2], { branch: branchFn });
      expect(branchFn).toHaveBeenCalledWith(true);
    });

    it("should log error when memory not loaded", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = {};

      h_jin(vm, [1, 2], {});
      expect(consoleSpy).toHaveBeenCalledWith("Memory or header not loaded");

      consoleSpy.mockRestore();
    });
  });

  describe("h_insert_obj", () => {
    it("should insert object as first child in v3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const obj2Addr = vm.getObjectAddress(2);

      h_insert_obj(vm, [2, 1]);

      expect(vm.memory.readUInt8(obj1Addr + 6)).toBe(2); // Parent's child = 2
      expect(vm.memory.readUInt8(obj2Addr + 4)).toBe(1); // Obj2's parent = 1
      expect(vm.memory.readUInt8(obj2Addr + 5)).toBe(0); // Obj2's sibling = 0
    });

    it("should insert object before existing children in v3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const obj2Addr = vm.getObjectAddress(2);
      const obj3Addr = vm.getObjectAddress(3);

      // Setup: obj3 is already child of obj1
      vm.memory.writeUInt8(3, obj1Addr + 6);
      vm.memory.writeUInt8(1, obj3Addr + 4);

      h_insert_obj(vm, [2, 1]);

      expect(vm.memory.readUInt8(obj1Addr + 6)).toBe(2); // Parent's child = 2
      expect(vm.memory.readUInt8(obj2Addr + 4)).toBe(1); // Obj2's parent = 1
      expect(vm.memory.readUInt8(obj2Addr + 5)).toBe(3); // Obj2's sibling = 3
    });

    it("should remove object from old parent when inserting in v3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const obj2Addr = vm.getObjectAddress(2);
      const obj3Addr = vm.getObjectAddress(3);

      // Setup: obj3 is child of obj1
      vm.memory.writeUInt8(3, obj1Addr + 6);
      vm.memory.writeUInt8(1, obj3Addr + 4);

      // Insert obj3 under obj2
      h_insert_obj(vm, [3, 2]);

      expect(vm.memory.readUInt8(obj1Addr + 6)).toBe(0); // Obj1's child cleared
      expect(vm.memory.readUInt8(obj2Addr + 6)).toBe(3); // Obj2's child = 3
      expect(vm.memory.readUInt8(obj3Addr + 4)).toBe(2); // Obj3's parent = 2
    });

    it("should insert object in v5", () => {
      const vm = createMockVMv5();
      const obj1Addr = vm.getObjectAddress(1);
      const obj2Addr = vm.getObjectAddress(2);

      h_insert_obj(vm, [2, 1]);

      expect(vm.memory.readUInt16BE(obj1Addr + 10)).toBe(2);
      expect(vm.memory.readUInt16BE(obj2Addr + 6)).toBe(1);
      expect(vm.memory.readUInt16BE(obj2Addr + 9)).toBe(0);
    });

    it("should handle removal from middle of sibling chain in v3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const obj2Addr = vm.getObjectAddress(2);
      const obj3Addr = vm.getObjectAddress(3);
      const obj4Addr = vm.getObjectAddress(4);

      // Setup: obj1 -> obj2 -> obj3
      vm.memory.writeUInt8(2, obj1Addr + 6);
      vm.memory.writeUInt8(1, obj2Addr + 4);
      vm.memory.writeUInt8(3, obj2Addr + 5);
      vm.memory.writeUInt8(1, obj3Addr + 4);

      // Insert obj3 under obj4
      h_insert_obj(vm, [3, 4]);

      expect(vm.memory.readUInt8(obj2Addr + 5)).toBe(0); // Obj2's sibling cleared
      expect(vm.memory.readUInt8(obj4Addr + 6)).toBe(3); // Obj4's child = 3
      expect(vm.memory.readUInt8(obj3Addr + 4)).toBe(4); // Obj3's parent = 4
    });
  });
});
