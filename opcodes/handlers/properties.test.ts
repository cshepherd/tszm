import {
  h_get_prop_len,
  h_get_prop,
  h_get_prop_addr,
  h_get_next_prop,
  h_put_prop,
} from "./properties";

function createMockVMv3(
  objectTableAddr: number = 0x100,
  propertyDefaultsAddr: number = 0x50,
) {
  const memory = Buffer.alloc(2048);
  return {
    memory,
    header: {
      version: 3,
      objectTableAddress: propertyDefaultsAddr,
    },
    getObjectAddress: jest.fn((id: number) => objectTableAddr + (id - 1) * 9),
  };
}

function createMockVMv5(
  objectTableAddr: number = 0x200,
  propertyDefaultsAddr: number = 0x50,
) {
  const memory = Buffer.alloc(2048);
  return {
    memory,
    header: {
      version: 5,
      objectTableAddress: propertyDefaultsAddr,
    },
    getObjectAddress: jest.fn((id: number) => objectTableAddr + (id - 1) * 14),
  };
}

describe("Property Handlers", () => {
  describe("h_get_prop_len", () => {
    it("should return 0 for address 0", () => {
      const vm = createMockVMv3();
      const storeFn = jest.fn();

      h_get_prop_len(vm, [0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should get property length in version 3 (size 1)", () => {
      const vm = createMockVMv3();
      const propDataAddr = 0x300;
      vm.memory.writeUInt8(0b00000001, propDataAddr - 1); // Size bits: 000 -> length 1

      const storeFn = jest.fn();
      h_get_prop_len(vm, [propDataAddr], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(1);
    });

    it("should get property length in version 3 (size 2)", () => {
      const vm = createMockVMv3();
      const propDataAddr = 0x300;
      vm.memory.writeUInt8(0b00100001, propDataAddr - 1); // Size bits: 001 -> length 2

      const storeFn = jest.fn();
      h_get_prop_len(vm, [propDataAddr], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(2);
    });

    it("should get property length in version 3 (size 8)", () => {
      const vm = createMockVMv3();
      const propDataAddr = 0x300;
      vm.memory.writeUInt8(0b11100001, propDataAddr - 1); // Size bits: 111 -> length 8

      const storeFn = jest.fn();
      h_get_prop_len(vm, [propDataAddr], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(8);
    });

    it("should get property length in version 5 (1-byte header, size 1)", () => {
      const vm = createMockVMv5();
      const propDataAddr = 0x400;
      vm.memory.writeUInt8(0b00000001, propDataAddr - 1); // Bit 7 clear, bit 6 clear -> size 1

      const storeFn = jest.fn();
      h_get_prop_len(vm, [propDataAddr], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(1);
    });

    it("should get property length in version 5 (1-byte header, size 2)", () => {
      const vm = createMockVMv5();
      const propDataAddr = 0x400;
      vm.memory.writeUInt8(0b01000001, propDataAddr - 1); // Bit 7 clear, bit 6 set -> size 2

      const storeFn = jest.fn();
      h_get_prop_len(vm, [propDataAddr], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(2);
    });

    it("should get property length in version 5 (2-byte header, size 5)", () => {
      const vm = createMockVMv5();
      const propDataAddr = 0x400;
      vm.memory.writeUInt8(0b10000001, propDataAddr - 1); // Bit 7 set -> 2-byte header
      vm.memory.writeUInt8(0b00000101, propDataAddr - 2); // Second byte: size 5

      const storeFn = jest.fn();
      h_get_prop_len(vm, [propDataAddr], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(5);
    });

    it("should get property length in version 5 (2-byte header, size 64)", () => {
      const vm = createMockVMv5();
      const propDataAddr = 0x400;
      vm.memory.writeUInt8(0b10000001, propDataAddr - 1);
      vm.memory.writeUInt8(0b00000000, propDataAddr - 2); // 0 means 64

      const storeFn = jest.fn();
      h_get_prop_len(vm, [propDataAddr], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(64);
    });

    it("should log error when memory not loaded", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = {};

      h_get_prop_len(vm, [0x100], {});
      expect(consoleSpy).toHaveBeenCalledWith("Memory or header not loaded");

      consoleSpy.mockRestore();
    });
  });

  describe("h_get_prop", () => {
    it("should get byte property in version 3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      // Setup object property table pointer
      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      // Name length = 0
      vm.memory.writeUInt8(0, propTableAddr);
      // Property 5, size 1 byte
      vm.memory.writeUInt8(0b00000101, propTableAddr + 1); // Size 000, prop 5
      vm.memory.writeUInt8(42, propTableAddr + 2); // Value

      const storeFn = jest.fn();
      h_get_prop(vm, [1, 5], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(42);
    });

    it("should get word property in version 3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      // Property 10, size 2 bytes
      vm.memory.writeUInt8(0b00101010, propTableAddr + 1); // Size 001, prop 10
      vm.memory.writeUInt16BE(0x1234, propTableAddr + 2);

      const storeFn = jest.fn();
      h_get_prop(vm, [1, 10], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0x1234);
    });

    it("should get default value when property not found in v3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      vm.memory.writeUInt8(0, propTableAddr + 1); // End of properties

      // Set default for property 3
      const defaultAddr = vm.header.objectTableAddress + (3 - 1) * 2;
      vm.memory.writeUInt16BE(999, defaultAddr);

      const storeFn = jest.fn();
      h_get_prop(vm, [1, 3], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(999);
    });

    it("should get property in version 5 (1-byte header)", () => {
      const vm = createMockVMv5();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x400;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 12);
      vm.memory.writeUInt8(0, propTableAddr);
      // Property 8, size 2 bytes (bit 6 set)
      vm.memory.writeUInt8(0b01001000, propTableAddr + 1);
      vm.memory.writeUInt16BE(0xabcd, propTableAddr + 2);

      const storeFn = jest.fn();
      h_get_prop(vm, [1, 8], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0xabcd);
    });

    it("should skip name when getting property", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(2, propTableAddr); // Name length = 2 words
      // Property starts after 1 + 2*2 = 5 bytes
      vm.memory.writeUInt8(0b00000111, propTableAddr + 5);
      vm.memory.writeUInt8(55, propTableAddr + 6);

      const storeFn = jest.fn();
      h_get_prop(vm, [1, 7], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(55);
    });

    it("should log error for invalid property size", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      // Property with size 3 (invalid for get_prop)
      vm.memory.writeUInt8(0b01000101, propTableAddr + 1); // Size 010 = 3

      h_get_prop(vm, [1, 5], {});
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid property size"),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("h_get_prop_addr", () => {
    it("should get property data address in version 3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      vm.memory.writeUInt8(0b00000101, propTableAddr + 1);

      const storeFn = jest.fn();
      h_get_prop_addr(vm, [1, 5], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(propTableAddr + 2); // Data starts after size byte
    });

    it("should return 0 when property not found", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      vm.memory.writeUInt8(0, propTableAddr + 1); // No properties

      const storeFn = jest.fn();
      h_get_prop_addr(vm, [1, 5], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should get correct address for second property", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      // First property: prop 10, size 2
      vm.memory.writeUInt8(0b00101010, propTableAddr + 1);
      vm.memory.writeUInt16BE(0x1234, propTableAddr + 2);
      // Second property: prop 5, size 1
      vm.memory.writeUInt8(0b00000101, propTableAddr + 4);
      vm.memory.writeUInt8(42, propTableAddr + 5);

      const storeFn = jest.fn();
      h_get_prop_addr(vm, [1, 5], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(propTableAddr + 5);
    });

    it("should get address in version 5 with 2-byte header", () => {
      const vm = createMockVMv5();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x400;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 12);
      vm.memory.writeUInt8(0, propTableAddr);
      // Property with 2-byte header
      vm.memory.writeUInt8(0b10001000, propTableAddr + 1); // Bit 7 set
      vm.memory.writeUInt8(0b00000011, propTableAddr + 2); // Size = 3

      const storeFn = jest.fn();
      h_get_prop_addr(vm, [1, 8], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(propTableAddr + 3); // After 2-byte header
    });

    it("should log error when memory not loaded", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = {};

      h_get_prop_addr(vm, [1, 5], {});
      expect(consoleSpy).toHaveBeenCalledWith("Memory or header not loaded");

      consoleSpy.mockRestore();
    });
  });

  describe("h_get_next_prop", () => {
    it("should return first property when propNum is 0 in v3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      // First property: prop 12, size 1
      vm.memory.writeUInt8(0b00001100, propTableAddr + 1);
      vm.memory.writeUInt8(42, propTableAddr + 2);

      const storeFn = jest.fn();
      h_get_next_prop(vm, [1, 0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(12);
    });

    it("should return 0 when propNum is 0 and no properties exist", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      vm.memory.writeUInt8(0, propTableAddr + 1); // No properties

      const storeFn = jest.fn();
      h_get_next_prop(vm, [1, 0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should return next property in v3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      // First property: prop 15, size 2
      vm.memory.writeUInt8(0b00101111, propTableAddr + 1);
      vm.memory.writeUInt16BE(0x1234, propTableAddr + 2);
      // Second property: prop 8, size 1
      vm.memory.writeUInt8(0b00001000, propTableAddr + 4);
      vm.memory.writeUInt8(99, propTableAddr + 5);

      const storeFn = jest.fn();
      h_get_next_prop(vm, [1, 15], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(8);
    });

    it("should return 0 when at last property in v3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      // Only one property
      vm.memory.writeUInt8(0b00001010, propTableAddr + 1);
      vm.memory.writeUInt8(42, propTableAddr + 2);
      vm.memory.writeUInt8(0, propTableAddr + 3); // End

      const storeFn = jest.fn();
      h_get_next_prop(vm, [1, 10], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should return 0 when property not found in v3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      vm.memory.writeUInt8(0b00001010, propTableAddr + 1);
      vm.memory.writeUInt8(42, propTableAddr + 2);
      vm.memory.writeUInt8(0, propTableAddr + 3);

      const storeFn = jest.fn();
      h_get_next_prop(vm, [1, 99], { store: storeFn }); // Request non-existent property
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should work through multiple properties in v3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      // Prop 20, size 1
      vm.memory.writeUInt8(0b00010100, propTableAddr + 1);
      vm.memory.writeUInt8(1, propTableAddr + 2);
      // Prop 15, size 1
      vm.memory.writeUInt8(0b00001111, propTableAddr + 3);
      vm.memory.writeUInt8(2, propTableAddr + 4);
      // Prop 10, size 1
      vm.memory.writeUInt8(0b00001010, propTableAddr + 5);
      vm.memory.writeUInt8(3, propTableAddr + 6);
      vm.memory.writeUInt8(0, propTableAddr + 7);

      const storeFn = jest.fn();

      // Get first
      h_get_next_prop(vm, [1, 0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(20);

      // Get second
      storeFn.mockClear();
      h_get_next_prop(vm, [1, 20], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(15);

      // Get third
      storeFn.mockClear();
      h_get_next_prop(vm, [1, 15], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(10);

      // Get end
      storeFn.mockClear();
      h_get_next_prop(vm, [1, 10], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should return first property when propNum is 0 in v5", () => {
      const vm = createMockVMv5();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x400;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 12);
      vm.memory.writeUInt8(0, propTableAddr);
      // First property: prop 25
      vm.memory.writeUInt8(0b00011001, propTableAddr + 1); // 1-byte header
      vm.memory.writeUInt8(100, propTableAddr + 2);

      const storeFn = jest.fn();
      h_get_next_prop(vm, [1, 0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(25);
    });

    it("should handle 2-byte header in v5", () => {
      const vm = createMockVMv5();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x400;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 12);
      vm.memory.writeUInt8(0, propTableAddr);
      // First property: prop 30, 2-byte header, size 5
      vm.memory.writeUInt8(0b10011110, propTableAddr + 1); // Bit 7 set
      vm.memory.writeUInt8(0b00000101, propTableAddr + 2); // Size 5
      vm.memory.writeUInt8(1, propTableAddr + 3);
      vm.memory.writeUInt8(2, propTableAddr + 4);
      vm.memory.writeUInt8(3, propTableAddr + 5);
      vm.memory.writeUInt8(4, propTableAddr + 6);
      vm.memory.writeUInt8(5, propTableAddr + 7);
      // Second property: prop 12, 1-byte header
      vm.memory.writeUInt8(0b00001100, propTableAddr + 8);
      vm.memory.writeUInt8(99, propTableAddr + 9);

      const storeFn = jest.fn();
      h_get_next_prop(vm, [1, 30], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(12);
    });

    it("should skip object name when getting first property", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(3, propTableAddr); // Name length = 3 words
      // Property starts after 1 + 3*2 = 7 bytes
      vm.memory.writeUInt8(0b00001111, propTableAddr + 7);
      vm.memory.writeUInt8(77, propTableAddr + 8);

      const storeFn = jest.fn();
      h_get_next_prop(vm, [1, 0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(15);
    });

    it("should log error when memory not loaded", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = {};

      h_get_next_prop(vm, [1, 5], {});
      expect(consoleSpy).toHaveBeenCalledWith("Memory or header not loaded");

      consoleSpy.mockRestore();
    });
  });

  describe("h_put_prop", () => {
    it("should put byte property in version 3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      vm.memory.writeUInt8(0b00000101, propTableAddr + 1);
      vm.memory.writeUInt8(0, propTableAddr + 2);

      h_put_prop(vm, [1, 5, 99]);
      expect(vm.memory.readUInt8(propTableAddr + 2)).toBe(99);
    });

    it("should put word property in version 3", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      vm.memory.writeUInt8(0b00101010, propTableAddr + 1);
      vm.memory.writeUInt16BE(0, propTableAddr + 2);

      h_put_prop(vm, [1, 10, 0x5678]);
      expect(vm.memory.readUInt16BE(propTableAddr + 2)).toBe(0x5678);
    });

    it("should truncate value for byte property", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      vm.memory.writeUInt8(0b00000101, propTableAddr + 1);

      h_put_prop(vm, [1, 5, 0x1234]);
      expect(vm.memory.readUInt8(propTableAddr + 2)).toBe(0x34); // Only low byte
    });

    it("should update second property", () => {
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      // First property
      vm.memory.writeUInt8(0b00101010, propTableAddr + 1);
      vm.memory.writeUInt16BE(0x1111, propTableAddr + 2);
      // Second property
      vm.memory.writeUInt8(0b00000101, propTableAddr + 4);
      vm.memory.writeUInt8(22, propTableAddr + 5);

      h_put_prop(vm, [1, 5, 88]);
      expect(vm.memory.readUInt8(propTableAddr + 5)).toBe(88);
      expect(vm.memory.readUInt16BE(propTableAddr + 2)).toBe(0x1111); // First unchanged
    });

    it("should log error when property not found", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      vm.memory.writeUInt8(0, propTableAddr + 1); // No properties

      h_put_prop(vm, [1, 5, 100]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Property 5 not found"),
      );

      consoleSpy.mockRestore();
    });

    it("should log error for invalid property size", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = createMockVMv3();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x300;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 7);
      vm.memory.writeUInt8(0, propTableAddr);
      // Property with size 3
      vm.memory.writeUInt8(0b01000101, propTableAddr + 1);

      h_put_prop(vm, [1, 5, 100]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid property size"),
      );

      consoleSpy.mockRestore();
    });

    it("should work in version 5", () => {
      const vm = createMockVMv5();
      const obj1Addr = vm.getObjectAddress(1);
      const propTableAddr = 0x400;

      vm.memory.writeUInt16BE(propTableAddr, obj1Addr + 12);
      vm.memory.writeUInt8(0, propTableAddr);
      vm.memory.writeUInt8(0b01001000, propTableAddr + 1); // Prop 8, size 2
      vm.memory.writeUInt16BE(0, propTableAddr + 2);

      h_put_prop(vm, [1, 8, 0xdead]);
      expect(vm.memory.readUInt16BE(propTableAddr + 2)).toBe(0xdead);
    });

    it("should log error when memory not loaded", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = {};

      h_put_prop(vm, [1, 5, 100]);
      expect(consoleSpy).toHaveBeenCalledWith("Memory or header not loaded");

      consoleSpy.mockRestore();
    });
  });
});
