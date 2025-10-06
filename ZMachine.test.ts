import { ZMachine } from "./ZMachine";
import { readFile } from "fs/promises";

// Mock fs/promises
jest.mock("fs/promises");
const mockedReadFile = readFile as jest.MockedFunction<typeof readFile>;

describe("ZMachine", () => {
  const createMinimalStoryFile = (): Buffer => {
    const buffer = Buffer.alloc(2048);
    // Version
    buffer.writeUInt8(3, 0);
    // Release
    buffer.writeUInt16BE(1, 2);
    // Serial number
    buffer.write("240101", 0x12, "ascii");
    // Checksum
    buffer.writeUInt16BE(0x1234, 0x1c);
    // Initial PC
    buffer.writeUInt16BE(0x100, 6);
    // Dictionary address
    buffer.writeUInt16BE(0x200, 8);
    // Object table address
    buffer.writeUInt16BE(0x300, 10);
    // Global variables address
    buffer.writeUInt16BE(0x400, 12);
    // Static memory address
    buffer.writeUInt16BE(0x80, 0x0e);
    // High memory base
    buffer.writeUInt16BE(0x100, 0x04);
    // Abbreviations address
    buffer.writeUInt16BE(0x500, 0x18);
    // File length
    buffer.writeUInt16BE(256, 0x1a); // 256 * 2 = 512
    return buffer;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Constructor", () => {
    it("should create ZMachine instance", () => {
      const zm = new ZMachine("test.z3", null);
      expect(zm).toBeDefined();
    });
  });

  describe("load", () => {
    it("should load file and parse header", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm = new ZMachine("test.z3", null);
      await zm.load();

      const header = zm.getHeader();
      expect(header).toBeDefined();
      expect(header?.version).toBe(3);
      expect(header?.release).toBe(1);
      expect(header?.initialProgramCounter).toBe(0x100);
    });

    it("should set screen dimensions for version 4+", async () => {
      const buffer = createMinimalStoryFile();
      buffer.writeUInt8(4, 0); // Version 4
      mockedReadFile.mockResolvedValue(buffer);

      const zm = new ZMachine("test.z4", null);
      await zm.load();

      expect(buffer.readUInt8(0x20)).toBe(24); // Height
      expect(buffer.readUInt8(0x21)).toBe(80); // Width
    });

    it("should set extended screen dimensions for version 5+", async () => {
      const buffer = createMinimalStoryFile();
      buffer.writeUInt8(5, 0); // Version 5
      mockedReadFile.mockResolvedValue(buffer);

      const zm = new ZMachine("test.z5", null);
      await zm.load();

      expect(buffer.readUInt8(0x20)).toBe(24);
      expect(buffer.readUInt8(0x21)).toBe(80);
      expect(buffer.readUInt16BE(0x22)).toBe(80);
      expect(buffer.readUInt16BE(0x24)).toBe(24);
    });
  });

  describe("Header parsing", () => {
    it("should parse header correctly", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm = new ZMachine("test.z3", null);
      await zm.load();

      const header = zm.getHeader();
      expect(header?.version).toBe(3);
      expect(header?.release).toBe(1);
      expect(header?.serial).toBe("240101");
      expect(header?.checksum).toBe(0x1234);
      expect(header?.dictionaryAddress).toBe(0x200);
      expect(header?.objectTableAddress).toBe(0x300);
      expect(header?.globalVariablesAddress).toBe(0x400);
      expect(header?.abbreviationsAddress).toBe(0x500);
    });
  });

  describe("Global variables", () => {
    it("should get global variable value", async () => {
      const buffer = createMinimalStoryFile();
      buffer.writeUInt16BE(0x1234, 0x400); // Global var 16 at address 0x400
      mockedReadFile.mockResolvedValue(buffer);

      const zm = new ZMachine("test.z3", null);
      await zm.load();

      const value = zm.getGlobalVariableValue(16);
      expect(value).toBe(0x1234);
    });

    it("should set global variable value", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm = new ZMachine("test.z3", null);
      await zm.load();

      zm.setGlobalVariableValue(16, 0x5678);
      expect(buffer.readUInt16BE(0x400)).toBe(0x5678);
    });

    it("should mask value to 16 bits when setting", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm = new ZMachine("test.z3", null);
      await zm.load();

      zm.setGlobalVariableValue(16, 0x10000);
      expect(buffer.readUInt16BE(0x400)).toBe(0);
    });

    it("should calculate correct address for global variable 17", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm = new ZMachine("test.z3", null);
      await zm.load();

      zm.setGlobalVariableValue(17, 0xabcd);
      expect(buffer.readUInt16BE(0x402)).toBe(0xabcd); // 0x400 + (17-16)*2
    });

    it("should log error when header not loaded", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const zm = new ZMachine("test.z3", null);

      zm.getGlobalVariableValue(16);
      expect(consoleSpy).toHaveBeenCalledWith("Header not loaded");

      consoleSpy.mockRestore();
    });
  });

  describe("Local variables", () => {
    it("should get local variable value", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      zm.localVariables = [10, 20, 30];
      expect(zm.getLocalVariableValue(1)).toBe(10);
      expect(zm.getLocalVariableValue(2)).toBe(20);
      expect(zm.getLocalVariableValue(3)).toBe(30);
    });

    it("should return 0 for undefined local variable", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      zm.localVariables = [];
      expect(zm.getLocalVariableValue(1)).toBe(0);
    });

    it("should set local variable value", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      zm.localVariables = [0, 0, 0];
      zm.setLocalVariableValue(2, 100);
      expect(zm.localVariables[1]).toBe(100);
    });

    it("should mask local variable to 16 bits", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      zm.localVariables = [0];
      zm.setLocalVariableValue(1, 0x10001);
      expect(zm.localVariables[0]).toBe(1);
    });
  });

  describe("Generic variable access", () => {
    it("should get/set stack variable (0)", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      zm.setVariableValue(0, 100);
      zm.setVariableValue(0, 200);
      expect(zm.getVariableValue(0)).toBe(200);
      expect(zm.getVariableValue(0)).toBe(100);
    });

    it("should get/set local variables (1-15)", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      zm.localVariables = [0, 0, 0];
      zm.setVariableValue(2, 42);
      expect(zm.getVariableValue(2)).toBe(42);
    });

    it("should get/set global variables (16+)", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm = new ZMachine("test.z3", null);
      await zm.load();

      zm.setVariableValue(16, 999);
      expect(zm.getVariableValue(16)).toBe(999);
    });
  });

  describe("Stack operations", () => {
    it("should push to stack via variable 0", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      zm.setVariableValue(0, 10);
      zm.setVariableValue(0, 20);
      zm.setVariableValue(0, 30);
      expect(zm.stack).toEqual([10, 20, 30]);
    });

    it("should pop from stack via variable 0", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      zm.stack = [10, 20, 30];
      expect(zm.getVariableValue(0)).toBe(30);
      expect(zm.getVariableValue(0)).toBe(20);
      expect(zm.getVariableValue(0)).toBe(10);
    });
  });

  describe("Trace mode", () => {
    it("should enable trace mode", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm = new ZMachine("test.z3", null);
      await zm.load();

      zm.setTrace(true);
      expect((zm as any).trace).toBe(true);
    });

    it("should disable trace mode", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm = new ZMachine("test.z3", null);
      await zm.load();

      zm.setTrace(true);
      zm.setTrace(false);
      expect((zm as any).trace).toBe(false);
    });
  });

  describe("PC manipulation", () => {
    it("should advance PC", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      const initialPC = zm.pc;
      zm.advancePC(5);
      expect(zm.pc).toBe(initialPC + 5);
    });

    it("should advance PC by negative offset", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      zm.pc = 100;
      zm.advancePC(-10);
      expect(zm.pc).toBe(90);
    });
  });

  describe("Fetch operations", () => {
    it("should fetch byte and advance PC", async () => {
      const buffer = createMinimalStoryFile();
      buffer.writeUInt8(0x42, 0x100);
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      const byte = zm._fetchByte();
      expect(byte).toBe(0x42);
      expect(zm.pc).toBe(0x101);
    });

    it("should fetch word and advance PC", async () => {
      const buffer = createMinimalStoryFile();
      buffer.writeUInt16BE(0x1234, 0x100);
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      const word = zm._fetchWord();
      expect(word).toBe(0x1234);
      expect(zm.pc).toBe(0x102);
    });

    it("should throw error when fetching from unloaded memory", async () => {
      const zm: any = new ZMachine("test.z3", null);

      expect(() => zm._fetchByte()).toThrow("Memory not loaded");
    });
  });

  describe("Operand decoding", () => {
    it("should decode large operand (word)", async () => {
      const buffer = createMinimalStoryFile();
      buffer.writeUInt16BE(0xabcd, 0x100);
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      const value = zm._decodeOperand("large");
      expect(value).toBe(0xabcd);
      expect(zm.pc).toBe(0x102);
    });

    it("should decode small operand (byte)", async () => {
      const buffer = createMinimalStoryFile();
      buffer.writeUInt8(0x42, 0x100);
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      const value = zm._decodeOperand("small");
      expect(value).toBe(0x42);
      expect(zm.pc).toBe(0x101);
    });

    it("should decode var operand (variable reference)", async () => {
      const buffer = createMinimalStoryFile();
      buffer.writeUInt8(16, 0x100); // Global var 16
      buffer.writeUInt16BE(0x5555, 0x400); // Value at global var 16
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      const value = zm._decodeOperand("var");
      expect(value).toBe(0x5555);
    });
  });

  describe("Operand type reading", () => {
    it("should read operand types from type byte", async () => {
      const buffer = createMinimalStoryFile();
      buffer.writeUInt8(0b00011011, 0x100); // large, small, var, omit
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      const types = zm._readOperandTypes();
      expect(types).toEqual(["large", "small", "var", "omit"]);
    });

    it("should read all large operands", async () => {
      const buffer = createMinimalStoryFile();
      buffer.writeUInt8(0b00000000, 0x100);
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      const types = zm._readOperandTypes();
      expect(types).toEqual(["large", "large", "large", "large"]);
    });
  });

  describe("Branch offset reading", () => {
    it("should read single-byte branch offset", async () => {
      const buffer = createMinimalStoryFile();
      buffer.writeUInt8(0b11000101, 0x100); // Branch on true, single byte, offset 5
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      const { offset, branchOnTrue } = zm._readBranchOffset();
      expect(offset).toBe(5);
      expect(branchOnTrue).toBe(true);
    });

    it("should read two-byte branch offset (positive)", async () => {
      const buffer = createMinimalStoryFile();
      buffer.writeUInt8(0b10000001, 0x100); // Branch on true, two bytes
      buffer.writeUInt8(0x00, 0x101); // Offset = 0x0100 = 256
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      const { offset, branchOnTrue } = zm._readBranchOffset();
      expect(offset).toBe(256);
      expect(branchOnTrue).toBe(true);
    });

    it("should read two-byte branch offset (negative)", async () => {
      const buffer = createMinimalStoryFile();
      buffer.writeUInt8(0b10100000, 0x100); // Branch on true, two bytes
      buffer.writeUInt8(0x00, 0x101); // Offset = 0x2000 (negative)
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      const { offset, branchOnTrue } = zm._readBranchOffset();
      expect(offset).toBe(-8192); // Sign-extended
      expect(branchOnTrue).toBe(true);
    });

    it("should read branch on false", async () => {
      const buffer = createMinimalStoryFile();
      buffer.writeUInt8(0b01000010, 0x100); // Branch on false, single byte
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      const { offset, branchOnTrue } = zm._readBranchOffset();
      expect(offset).toBe(2);
      expect(branchOnTrue).toBe(false);
    });
  });

  describe("decodeZSCII", () => {
    it("should decode text without crashing", async () => {
      const buffer = createMinimalStoryFile();
      // Minimal encoded text with end bit set
      buffer.writeUInt16BE(0b1000000000000000, 0x100);
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      const text = zm.decodeZSCII();
      expect(typeof text).toBe("string");
    });

    it("should return empty string when memory not loaded", async () => {
      const zm: any = new ZMachine("test.z3", null);
      const text = zm.decodeZSCII();
      expect(text).toBe("");
    });
  });

  describe("Branch application", () => {
    it("should branch when condition matches", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      zm.pc = 0x200;
      zm._applyBranch(10, true, true);
      expect(zm.pc).toBe(0x200 + 10 - 2);
    });

    it("should not branch when condition does not match", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      zm.pc = 0x200;
      zm._applyBranch(10, true, false);
      expect(zm.pc).toBe(0x200); // No change
    });

    it("should return false when offset is 0", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      const returnFromRoutineSpy = jest.spyOn(zm as any, "returnFromRoutine");
      zm._applyBranch(0, true, true);
      expect(returnFromRoutineSpy).toHaveBeenCalledWith(0);
    });

    it("should return true when offset is 1", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      const returnFromRoutineSpy = jest.spyOn(zm as any, "returnFromRoutine");
      zm._applyBranch(1, true, true);
      expect(returnFromRoutineSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("Store variable", () => {
    it("should store to variable", async () => {
      const buffer = createMinimalStoryFile();
      mockedReadFile.mockResolvedValue(buffer);

      const zm: any = new ZMachine("test.z3", null);
      await zm.load();

      zm._storeVariable(16, 0x4242);
      expect(zm.getVariableValue(16)).toBe(0x4242);
    });
  });
});
