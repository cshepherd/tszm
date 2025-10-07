import { h_loadw, h_loadb, h_storew, h_storeb } from "./memory";

describe("Memory Handlers", () => {
  describe("h_loadw", () => {
    it("should load word from memory at index 0", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt16BE(0x1234, 0x100);

      const storeFn = jest.fn();
      const vm = { memory };

      h_loadw(vm, [0x100, 0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0x1234);
    });

    it("should load word from memory at positive index", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt16BE(0xabcd, 0x104); // 0x100 + 2*2

      const storeFn = jest.fn();
      const vm = { memory };

      h_loadw(vm, [0x100, 2], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0xabcd);
    });

    it("should load word using negative index", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt16BE(0x5678, 0xfc); // 0x100 + 2*(-2) = 0x100 - 4 = 0xfc

      const storeFn = jest.fn();
      const vm = { memory };

      h_loadw(vm, [0x100, 65534], { store: storeFn }); // 65534 = -2 as signed 16-bit
      expect(storeFn).toHaveBeenCalledWith(0x5678);
    });

    it("should handle memory address at boundary", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt16BE(0xffff, 1022); // Last valid word position

      const storeFn = jest.fn();
      const vm = { memory };

      h_loadw(vm, [1022, 0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0xffff);
    });

    it("should handle loading zero value", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt16BE(0, 0x100);

      const storeFn = jest.fn();
      const vm = { memory };

      h_loadw(vm, [0x100, 0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should log error when memory not loaded", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const storeFn = jest.fn();
      const vm = {};

      h_loadw(vm, [0x100, 0], { store: storeFn });
      expect(consoleSpy).toHaveBeenCalledWith("Memory not loaded");
      expect(storeFn).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should log error for out of bounds address (too high)", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const memory = Buffer.alloc(1024);
      const storeFn = jest.fn();
      const vm = { memory };

      h_loadw(vm, [0x400, 0], { store: storeFn }); // 0x400 = 1024, out of bounds
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("LOADW: Invalid memory address"),
      );
      expect(storeFn).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should log error for negative address", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const memory = Buffer.alloc(1024);
      const storeFn = jest.fn();
      const vm = { memory };

      // 0x1 + 2*(-1) = 0x1 - 2 = -1 (negative)
      h_loadw(vm, [0x1, 65535], { store: storeFn }); // 65535 = -1 as signed
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("LOADW: Invalid memory address"),
      );
      expect(storeFn).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should work without store function", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt16BE(0x1234, 0x100);
      const vm = { memory };

      expect(() => h_loadw(vm, [0x100, 0], {})).not.toThrow();
    });
  });

  describe("h_loadb", () => {
    it("should load byte from memory at index 0", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt8(0x42, 0x100);

      const storeFn = jest.fn();
      const vm = { memory };

      h_loadb(vm, [0x100, 0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0x42);
    });

    it("should load byte from memory at positive index", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt8(0xab, 0x105); // 0x100 + 5

      const storeFn = jest.fn();
      const vm = { memory };

      h_loadb(vm, [0x100, 5], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0xab);
    });

    it("should load byte using negative index", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt8(0xcd, 0xfe); // 0x100 + (-2) = 0xfe

      const storeFn = jest.fn();
      const vm = { memory };

      h_loadb(vm, [0x100, 65534], { store: storeFn }); // 65534 = -2 as signed 16-bit
      expect(storeFn).toHaveBeenCalledWith(0xcd);
    });

    it("should handle memory address at boundary", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt8(0xff, 1023); // Last valid byte position

      const storeFn = jest.fn();
      const vm = { memory };

      h_loadb(vm, [1023, 0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0xff);
    });

    it("should handle loading zero value", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt8(0, 0x100);

      const storeFn = jest.fn();
      const vm = { memory };

      h_loadb(vm, [0x100, 0], { store: storeFn });
      expect(storeFn).toHaveBeenCalledWith(0);
    });

    it("should log error when memory not loaded", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const storeFn = jest.fn();
      const vm = {};

      h_loadb(vm, [0x100, 0], { store: storeFn });
      expect(consoleSpy).toHaveBeenCalledWith("Memory not loaded");
      expect(storeFn).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should log error for out of bounds address (too high)", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const memory = Buffer.alloc(1024);
      const storeFn = jest.fn();
      const vm = { memory };

      h_loadb(vm, [0x400, 0], { store: storeFn }); // 0x400 = 1024, out of bounds
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("LOADB: Invalid memory address"),
      );
      expect(storeFn).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should log error for negative address", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const memory = Buffer.alloc(1024);
      const storeFn = jest.fn();
      const vm = { memory };

      h_loadb(vm, [0x0, 65535], { store: storeFn }); // 65535 = -1, 0x0 + (-1) = -1 (negative)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("LOADB: Invalid memory address"),
      );
      expect(storeFn).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should work without store function", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt8(0x42, 0x100);
      const vm = { memory };

      expect(() => h_loadb(vm, [0x100, 0], {})).not.toThrow();
    });
  });

  describe("h_storew", () => {
    it("should store word to memory at index 0", () => {
      const memory = Buffer.alloc(1024);
      const vm = { memory };

      h_storew(vm, [0x100, 0, 0x1234]);
      expect(memory.readUInt16BE(0x100)).toBe(0x1234);
    });

    it("should store word to memory at positive index", () => {
      const memory = Buffer.alloc(1024);
      const vm = { memory };

      h_storew(vm, [0x100, 3, 0xabcd]);
      expect(memory.readUInt16BE(0x106)).toBe(0xabcd); // 0x100 + 2*3 = 0x106
    });

    it("should store word using negative index", () => {
      const memory = Buffer.alloc(1024);
      const vm = { memory };

      h_storew(vm, [0x100, 65534, 0x5678]); // 65534 = -2 as signed 16-bit
      expect(memory.readUInt16BE(0xfc)).toBe(0x5678); // 0x100 + 2*(-2) = 0xfc
    });

    it("should handle memory address at boundary", () => {
      const memory = Buffer.alloc(1024);
      const vm = { memory };

      h_storew(vm, [1022, 0, 0xffff]); // Last valid word position
      expect(memory.readUInt16BE(1022)).toBe(0xffff);
    });

    it("should handle storing zero value", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt16BE(0xffff, 0x100); // Pre-fill with non-zero
      const vm = { memory };

      h_storew(vm, [0x100, 0, 0]);
      expect(memory.readUInt16BE(0x100)).toBe(0);
    });

    it("should overwrite existing value", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt16BE(0x1111, 0x100);
      const vm = { memory };

      h_storew(vm, [0x100, 0, 0x2222]);
      expect(memory.readUInt16BE(0x100)).toBe(0x2222);
    });

    it("should log error when memory not loaded", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = {};

      h_storew(vm, [0x100, 0, 0x1234]);
      expect(consoleSpy).toHaveBeenCalledWith("Memory not loaded");

      consoleSpy.mockRestore();
    });

    it("should log error for out of bounds address (too high)", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const memory = Buffer.alloc(1024);
      const vm = { memory };

      h_storew(vm, [0x400, 0, 0x1234]); // 0x400 = 1024, out of bounds
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("STOREW: Invalid memory address"),
      );

      consoleSpy.mockRestore();
    });

    it("should log error for negative address", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const memory = Buffer.alloc(1024);
      const vm = { memory };

      h_storew(vm, [0x1, 65535, 0x1234]); // 65535 = -1, 0x1 + 2*(-1) = -1 (negative)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("STOREW: Invalid memory address"),
      );

      consoleSpy.mockRestore();
    });

    it("should handle storing max value", () => {
      const memory = Buffer.alloc(1024);
      const vm = { memory };

      h_storew(vm, [0x100, 0, 0xffff]);
      expect(memory.readUInt16BE(0x100)).toBe(0xffff);
    });
  });

  describe("h_storeb", () => {
    it("should store byte to memory at index 0", () => {
      const memory = Buffer.alloc(1024);
      const vm = { memory };

      h_storeb(vm, [0x100, 0, 0x42]);
      expect(memory.readUInt8(0x100)).toBe(0x42);
    });

    it("should store byte to memory at positive index", () => {
      const memory = Buffer.alloc(1024);
      const vm = { memory };

      h_storeb(vm, [0x100, 7, 0xab]);
      expect(memory.readUInt8(0x107)).toBe(0xab); // 0x100 + 7
    });

    it("should store byte using negative index", () => {
      const memory = Buffer.alloc(1024);
      const vm = { memory };

      h_storeb(vm, [0x100, 65534, 0xcd]); // 65534 = -2 as signed 16-bit
      expect(memory.readUInt8(0xfe)).toBe(0xcd); // 0x100 + (-2) = 0xfe
    });

    it("should handle memory address at boundary", () => {
      const memory = Buffer.alloc(1024);
      const vm = { memory };

      h_storeb(vm, [1023, 0, 0xff]); // Last valid byte position
      expect(memory.readUInt8(1023)).toBe(0xff);
    });

    it("should handle storing zero value", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt8(0xff, 0x100); // Pre-fill with non-zero
      const vm = { memory };

      h_storeb(vm, [0x100, 0, 0]);
      expect(memory.readUInt8(0x100)).toBe(0);
    });

    it("should overwrite existing value", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt8(0x11, 0x100);
      const vm = { memory };

      h_storeb(vm, [0x100, 0, 0x22]);
      expect(memory.readUInt8(0x100)).toBe(0x22);
    });

    it("should log error when memory not loaded", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const vm = {};

      h_storeb(vm, [0x100, 0, 0x42]);
      expect(consoleSpy).toHaveBeenCalledWith("Memory not loaded");

      consoleSpy.mockRestore();
    });

    it("should log error for out of bounds address (too high)", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const memory = Buffer.alloc(1024);
      const vm = { memory };

      h_storeb(vm, [0x400, 0, 0x42]); // 0x400 = 1024, out of bounds
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("STOREB: Invalid memory address"),
      );

      consoleSpy.mockRestore();
    });

    it("should log error for negative address", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const memory = Buffer.alloc(1024);
      const vm = { memory };

      h_storeb(vm, [0x0, 65535, 0x42]); // 65535 = -1, 0x0 + (-1) = -1 (negative)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("STOREB: Invalid memory address"),
      );

      consoleSpy.mockRestore();
    });

    it("should handle storing max byte value", () => {
      const memory = Buffer.alloc(1024);
      const vm = { memory };

      h_storeb(vm, [0x100, 0, 0xff]);
      expect(memory.readUInt8(0x100)).toBe(0xff);
    });

    it("should only affect single byte", () => {
      const memory = Buffer.alloc(1024);
      memory.writeUInt16BE(0xffff, 0x100);
      const vm = { memory };

      h_storeb(vm, [0x100, 1, 0x00]); // Store 0 at second byte
      expect(memory.readUInt8(0x100)).toBe(0xff); // First byte unchanged
      expect(memory.readUInt8(0x101)).toBe(0x00); // Second byte changed
    });
  });
});
