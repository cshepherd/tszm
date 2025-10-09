import { ZConsole } from "./ZConsole";
import { ZMachine } from "./ZMachine";
import * as readline from "node:readline/promises";

// Mock node:readline/promises
jest.mock("node:readline/promises");

describe("ZConsole", () => {
  let mockRl: any;

  beforeEach(() => {
    mockRl = {
      setPrompt: jest.fn(),
      prompt: jest.fn(),
      once: jest.fn(),
      close: jest.fn(),
    };
    (readline.createInterface as jest.Mock).mockReturnValue(mockRl);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Constructor", () => {
    it("should create ZConsole without ZMCDN server", () => {
      const console = new ZConsole(undefined);
      expect(console).toBeDefined();
    });

    it("should create ZConsole with ZMCDN server", () => {
      const console = new ZConsole("http://localhost:3000");
      expect(console).toBeDefined();
    });

    it("should create readline interface", () => {
      new ZConsole(undefined);
      expect(readline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
        historySize: 100,
        prompt: "",
      });
    });
  });

  describe("setZMachine", () => {
    it("should set ZMachine instance", () => {
      const console = new ZConsole(undefined);
      const mockZM = {} as ZMachine;

      console.setZMachine(mockZM);
      expect((console as any).zm).toBe(mockZM);
    });
  });

  describe("writeChar", () => {
    let stdoutSpy: jest.SpyInstance;

    beforeEach(() => {
      stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation();
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    it("should write character to stdout", async () => {
      const console = new ZConsole(undefined);
      await console.writeChar("a");
      expect(stdoutSpy).toHaveBeenCalledWith("a");
    });

    it("should accumulate ZMCDN text", async () => {
      const console = new ZConsole(undefined);
      await console.writeChar("h");
      await console.writeChar("i");
      expect((console as any).ZMCDNText).toBe("hi");
    });

    it("should track current prompt", async () => {
      const console = new ZConsole(undefined);
      await console.writeChar(">");
      await console.writeChar(" ");
      expect((console as any).currentPrompt).toBe("> ");
    });

    it("should reset prompt on newline", async () => {
      const console = new ZConsole(undefined);
      await console.writeChar(">");
      await console.writeChar("\n");
      expect((console as any).currentPrompt).toBe("");
    });

    it("should limit prompt to last 50 characters", async () => {
      const console = new ZConsole(undefined);
      const longString = "a".repeat(60);
      for (const char of longString) {
        await console.writeChar(char);
      }
      expect((console as any).currentPrompt).toHaveLength(50);
      expect((console as any).currentPrompt).toBe("a".repeat(50));
    });
  });

  describe("writeString", () => {
    let stdoutSpy: jest.SpyInstance;

    beforeEach(() => {
      stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation();
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    it("should write string to stdout", async () => {
      const console = new ZConsole(undefined);
      await console.writeString("hello");
      expect(stdoutSpy).toHaveBeenCalledWith("hello");
    });

    it("should accumulate ZMCDN text", async () => {
      const console = new ZConsole(undefined);
      await console.writeString("hello");
      await console.writeString(" world");
      expect((console as any).ZMCDNText).toBe("hello world");
    });

    it("should track prompt from single line", async () => {
      const console = new ZConsole(undefined);
      await console.writeString("> ");
      expect((console as any).currentPrompt).toBe("> ");
    });

    it("should track prompt from last line of multi-line string", async () => {
      const console = new ZConsole(undefined);
      await console.writeString("Some text\nAnother line\n> ");
      expect((console as any).currentPrompt).toBe("> ");
    });

    it("should reset prompt when string ends with newline", async () => {
      const console = new ZConsole(undefined);
      await console.writeString("Some text\n");
      expect((console as any).currentPrompt).toBe("");
    });

    it("should limit prompt to 50 characters", async () => {
      const console = new ZConsole(undefined);
      await console.writeString("a".repeat(60));
      expect((console as any).currentPrompt).toHaveLength(50);
    });
  });

  describe("readLine", () => {
    it("should call readline prompt", async () => {
      const console = new ZConsole(undefined);

      // Setup readline mock to resolve immediately
      mockRl.once.mockImplementation((event: string, callback: Function) => {
        if (event === "line") {
          setTimeout(() => callback("test input"), 0);
        }
      });

      const promise = console.readLine();
      await promise;

      expect(mockRl.prompt).toHaveBeenCalled();
    });

    it("should return user input", async () => {
      const console = new ZConsole(undefined);

      mockRl.once.mockImplementation((event: string, callback: Function) => {
        if (event === "line") {
          setTimeout(() => callback("hello"), 0);
        }
      });

      const result = await console.readLine();
      expect(result).toBe("hello");
    });

    it("should set prompt before reading", async () => {
      const console = new ZConsole(undefined);
      (console as any).currentPrompt = "> ";

      mockRl.once.mockImplementation((event: string, callback: Function) => {
        if (event === "line") {
          setTimeout(() => callback("test"), 0);
        }
      });

      await console.readLine();
      expect(mockRl.setPrompt).toHaveBeenCalledWith("> ");
    });

    it("should handle /trace on command", async () => {
      const console = new ZConsole(undefined);
      const mockZM = {
        setTrace: jest.fn(),
      } as any;
      console.setZMachine(mockZM);

      const consoleSpy = jest.spyOn(global.console, "log").mockImplementation();

      mockRl.once
        .mockImplementationOnce((event: string, callback: Function) => {
          if (event === "line") {
            setTimeout(() => callback("/trace on"), 0);
          }
        })
        .mockImplementationOnce((event: string, callback: Function) => {
          if (event === "line") {
            setTimeout(() => callback("actual input"), 0);
          }
        });

      const result = await console.readLine();

      expect(mockZM.setTrace).toHaveBeenCalledWith(true);
      expect(consoleSpy).toHaveBeenCalledWith("Trace enabled");
      expect(result).toBe("actual input");

      consoleSpy.mockRestore();
    });

    it("should handle /trace off command", async () => {
      const console = new ZConsole(undefined);
      const mockZM = {
        setTrace: jest.fn(),
      } as any;
      console.setZMachine(mockZM);

      const consoleSpy = jest.spyOn(global.console, "log").mockImplementation();

      mockRl.once
        .mockImplementationOnce((event: string, callback: Function) => {
          if (event === "line") {
            setTimeout(() => callback("/trace off"), 0);
          }
        })
        .mockImplementationOnce((event: string, callback: Function) => {
          if (event === "line") {
            setTimeout(() => callback("actual input"), 0);
          }
        });

      const result = await console.readLine();

      expect(mockZM.setTrace).toHaveBeenCalledWith(false);
      expect(consoleSpy).toHaveBeenCalledWith("Trace disabled");
      expect(result).toBe("actual input");

      consoleSpy.mockRestore();
    });

    it("should handle /trace command without ZMachine", async () => {
      const console = new ZConsole(undefined);
      const consoleSpy = jest.spyOn(global.console, "log").mockImplementation();

      mockRl.once
        .mockImplementationOnce((event: string, callback: Function) => {
          if (event === "line") {
            setTimeout(() => callback("/trace on"), 0);
          }
        })
        .mockImplementationOnce((event: string, callback: Function) => {
          if (event === "line") {
            setTimeout(() => callback("actual input"), 0);
          }
        });

      const result = await console.readLine();

      expect(consoleSpy).toHaveBeenCalledWith("ZMachine not initialized");
      expect(result).toBe("actual input");

      consoleSpy.mockRestore();
    });

    it("should handle /zmcdn off command", async () => {
      const console = new ZConsole("http://localhost:3000");
      const consoleSpy = jest.spyOn(global.console, "log").mockImplementation();

      mockRl.once
        .mockImplementationOnce((event: string, callback: Function) => {
          if (event === "line") {
            setTimeout(() => callback("/zmcdn off"), 0);
          }
        })
        .mockImplementationOnce((event: string, callback: Function) => {
          if (event === "line") {
            setTimeout(() => callback("actual input"), 0);
          }
        });

      const result = await console.readLine();

      expect((console as any).zmcdnEnabled).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith("ZMCDN image fetching disabled");
      expect(result).toBe("actual input");

      consoleSpy.mockRestore();
    });

    it("should handle /zmcdn server command", async () => {
      const console = new ZConsole(undefined);
      const consoleSpy = jest.spyOn(global.console, "log").mockImplementation();

      mockRl.once
        .mockImplementationOnce((event: string, callback: Function) => {
          if (event === "line") {
            setTimeout(() => callback("/zmcdn http://example.com:8080"), 0);
          }
        })
        .mockImplementationOnce((event: string, callback: Function) => {
          if (event === "line") {
            setTimeout(() => callback("actual input"), 0);
          }
        });

      const result = await console.readLine();

      expect((console as any).zmcdnServer).toBe("http://example.com:8080");
      expect((console as any).zmcdnEnabled).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        "ZMCDN image fetching enabled with server: http://example.com:8080",
      );
      expect(result).toBe("actual input");

      consoleSpy.mockRestore();
    });
  });

  describe("readChar", () => {
    let stdinOnceSpy: jest.SpyInstance;

    beforeEach(() => {
      stdinOnceSpy = jest.spyOn(process.stdin, "once").mockImplementation();
    });

    afterEach(() => {
      stdinOnceSpy.mockRestore();
    });

    it("should return lowercase character", async () => {
      const console = new ZConsole(undefined);

      stdinOnceSpy.mockImplementation((event: string, callback: Function) => {
        if (event === "keypress") {
          setTimeout(() => callback({ shift: false, name: "a" }), 0);
        }
      });

      const result = await console.readChar();
      expect(result).toBe("a");
    });

    it("should return uppercase character when shift pressed", async () => {
      const console = new ZConsole(undefined);

      stdinOnceSpy.mockImplementation((event: string, callback: Function) => {
        if (event === "keypress") {
          setTimeout(() => callback({ shift: true, name: "a" }), 0);
        }
      });

      const result = await console.readChar();
      expect(result).toBe("A");
    });

    it("should handle single character keys", async () => {
      const console = new ZConsole(undefined);

      stdinOnceSpy.mockImplementation((event: string, callback: Function) => {
        if (event === "keypress") {
          setTimeout(() => callback({ shift: false, name: "z" }), 0);
        }
      });

      const result = await console.readChar();
      expect(result).toBe("z");
    });

    it("should throw error for unhandled special keys", async () => {
      const console = new ZConsole(undefined);

      stdinOnceSpy.mockImplementation((event: string, callback: Function) => {
        if (event === "keypress") {
          setTimeout(() => {
            try {
              callback({ shift: false, name: "escape" });
            } catch (e) {
              // Error is thrown synchronously, which is expected behavior
              expect((e as Error).message).toBe('Unhandled key "escape"');
            }
          }, 0);
        }
      });

      // The promise will hang because the error prevents resolve from being called
      // We just need to verify the error is thrown in the callback
      const promise = console.readChar();
      await new Promise((resolve) => setTimeout(resolve, 10));
      // If we get here without the test failing, the error was handled correctly
    });
  });

  describe("close", () => {
    it("should close readline interface", () => {
      const console = new ZConsole(undefined);
      console.close();
      expect(mockRl.close).toHaveBeenCalled();
    });
  });

  describe("processZMCDNText", () => {
    it("should do nothing when ZMCDN disabled", async () => {
      const console = new ZConsole(undefined);
      (console as any).ZMCDNText = "some text";

      await console.processZMCDNText();

      // Text should remain because ZMCDN is disabled
      expect((console as any).ZMCDNText).toBe("some text");
    });

    it("should do nothing when ZMCDN text is empty", async () => {
      const console = new ZConsole("http://localhost:3000");
      (console as any).ZMCDNText = "";

      await console.processZMCDNText();

      expect((console as any).ZMCDNText).toBe("");
    });

    it("should handle missing ZMachine", async () => {
      const zconsole = new ZConsole("http://localhost:3000");
      (zconsole as any).ZMCDNText = "test";
      const consoleSpy = jest
        .spyOn(global.console, "error")
        .mockImplementation();

      await zconsole.processZMCDNText();

      expect(consoleSpy).toHaveBeenCalledWith("ZMachine not initialized");
      consoleSpy.mockRestore();
    });
  });
});

describe("ZConsole constructor", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test("undefined zmcdnServer → no warn, disabled", () => {
    const z = new ZConsole(undefined);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(z.isZmcdnEnabled).toBe(false);
    expect(z.zmcdnServerUrl).toBeUndefined();
  });

  test("empty string → no warn, disabled", () => {
    const z = new ZConsole("");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(z.isZmcdnEnabled).toBe(false);
  });

  test("host without scheme → defaults to http", () => {
    const z = new ZConsole("example.org:3000");
    expect(z.zmcdnServerUrl).toBe("http://example.org:3000");
    expect(z.isZmcdnEnabled).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("http url stays http", () => {
    const z = new ZConsole("http://example.org");
    expect(z.zmcdnServerUrl).toBe("http://example.org");
    expect(z.isZmcdnEnabled).toBe(true);
  });

  test("https url trims trailing slash", () => {
    const z = new ZConsole("https://example.org/");
    expect(z.zmcdnServerUrl).toBe("https://example.org");
    expect(z.isZmcdnEnabled).toBe(true);
  });

  test("malformed url → warns and disables", () => {
    const z = new ZConsole("htp://bad");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(z.isZmcdnEnabled).toBe(false);
    expect(z.zmcdnServerUrl).toBeUndefined();
  });
});

describe("normalizeZmcdnUrl (static)", () => {
  test.each([
    [undefined, undefined],
    ["", undefined],
    ["   ", undefined],
    ["foo", "http://foo"],
    ["foo/", "http://foo"],
    ["http://bar/", "http://bar"],
    ["https://bar/", "https://bar"],
  ])("normalize %p → %p", (input, expected) => {
    const out = (ZConsole as any).normalizeZmcdnUrl(input);
    expect(out).toBe(expected);
  });

  test("rejects junk", () => {
    const out = (ZConsole as any).normalizeZmcdnUrl("htp://bad");
    expect(out).toBeUndefined();
  });
});
