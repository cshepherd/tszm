import { createInterface, Interface } from "node:readline/promises";
import { ZMInputOutputDevice } from "./ZMInputOutputDevice";
import { ZMCDNInput } from "./ZMCDNInput";
import { ZMachine } from "./ZMachine";
import * as crypto from "crypto";
import * as http from "http";
import * as blessed from "blessed";

interface Key {
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  name: string;
}

export class ZConsole implements ZMInputOutputDevice {
  private ZMCDNText: string = "";
  private zm: ZMachine | null = null;
  private zmcdnEnabled: boolean = false;
  private zmcdnServer: string | undefined = "";
  private currentPrompt: string = "";
  private zmcdnSessionId: string = "";
  private lastzmcdnInput: ZMCDNInput | null = null;

  // Blessed/ncurses components
  private screen: blessed.Widgets.Screen | null = null;
  private statusLine: blessed.Widgets.BoxElement | null = null;
  private upperWindow: blessed.Widgets.BoxElement | null = null;
  private lowerWindow: blessed.Widgets.BoxElement | null = null;
  private currentWindow: number = 0; // 0 = lower, 1 = upper
  private upperWindowHeight: number = 0;
  private currentTextStyle: number = 0;
  private useBlessedMode: boolean = false;

  constructor(zmcdnServer: string | undefined, useBlessedMode: boolean = false) {
    this.zmcdnServer = zmcdnServer;
    if (this.zmcdnServer) {
      this.zmcdnEnabled = true;
    }
    this.useBlessedMode = useBlessedMode;

    if (this.useBlessedMode) {
      this.initBlessedScreen();
    } else {
      this.rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        historySize: 100,
        prompt: "",
      });
    }
  }

  private initBlessedScreen(): void {
    this.screen = blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      forceUnicode: true,
      dockBorders: false,
      ignoreLocked: ['C-c'],
    });

    // Create fixed status line at top (inverse video spaces)
    this.statusLine = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: {
        fg: 'black',
        bg: 'white'
      },
      content: ' '.repeat(200), // Fill with spaces
    });

    // Create lower window (main text area), starting below status line
    this.lowerWindow = blessed.box({
      top: 1,
      left: 0,
      width: '100%',
      height: '100%-1',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'cyan'
        },
        style: {
          inverse: true
        }
      },
      tags: true,
    });

    this.screen.append(this.statusLine);
    this.screen.append(this.lowerWindow);
    this.screen.render();
  }

  setZMachine(zm: ZMachine): void {
    this.zm = zm;
  }

  async processZMCDNText(): Promise<void> {
    if (this.ZMCDNText && this.zmcdnEnabled) {
      if (!this.zmcdnSessionId) {
        this.zmcdnSessionId = crypto.randomUUID();
      }
      const zmcdnInput = new ZMCDNInput();
      zmcdnInput.zmcdnSessionID = this.zmcdnSessionId;
      zmcdnInput.lastZMachineOutput = this.ZMCDNText;
      this.ZMCDNText = '';

      // Get gameId from header
      if (!this.zm) {
        console.error("ZMachine not initialized");
        return;
      }

      zmcdnInput.lastZMachineInput = this.zm.getLastRead();

      const header = this.zm.getHeader();
      if (!header) {
        console.error("Unable to read game header");
        return;
      }

      zmcdnInput.gameIdentifier = `${header.release}.${header.serial}`;

      const playerParent = this.zm.findPlayerParent();
      if(playerParent) {
        zmcdnInput.playerLocation = playerParent.name;
      } else {
        zmcdnInput.playerLocation = '';
      }

      zmcdnInput.illustrationFormat = 'sixel';
      this.lastzmcdnInput = zmcdnInput;

      const url = `${this.zmcdnServer}/illustrateMove`;
      try {
        const data = await this.postJSON(url, zmcdnInput);

        // If blessed mode is active, we need to temporarily show raw output
        if (this.useBlessedMode && this.screen) {
          // Save window contents before destroying
          const savedLowerContent = this.lowerWindow?.getContent() || '';
          const savedUpperContent = this.upperWindow?.getContent() || '';
          const savedUpperWindowHeight = this.upperWindowHeight;

          // Completely destroy blessed to fully clean up terminal state
          this.screen.destroy();
          this.screen = null;
          this.statusLine = null;
          this.upperWindow = null;
          this.lowerWindow = null;

          // Small delay to ensure cleanup completes
          await new Promise(resolve => setTimeout(resolve, 50));

          // Dump sixel-formatted graphics to terminal
          process.stdout.write(data);
          process.stdout.write("\n");
          process.stdout.write(zmcdnInput.lastZMachineOutput);
          process.stdout.write("\n[Press any key to continue...]");

          // Wait for keypress - simple data event
          await new Promise<void>((resolve) => {
            const onData = () => {
              process.stdin.removeListener('data', onData);
              resolve();
            };

            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.once('data', onData);
          });

          // Reset stdin to cooked mode
          process.stdin.setRawMode(false);
          process.stdin.pause();

          // Small delay to ensure stdin settles
          await new Promise(resolve => setTimeout(resolve, 50));

          // Clear screen
          process.stdout.write("\x1b[2J\x1b[H");

          // Recreate blessed screen
          this.initBlessedScreen();

          // Restore window state
          if (savedUpperWindowHeight > 0) {
            this.splitWindow(savedUpperWindowHeight);
          }

          // Restore content
          if (this.lowerWindow && savedLowerContent) {
            (this.lowerWindow as any).setContent(savedLowerContent);
            (this.lowerWindow as any).setScrollPerc(100);
          }
          if (this.upperWindow && savedUpperContent) {
            (this.upperWindow as any).setContent(savedUpperContent);
          }

          if (this.screen) {
            (this.screen as any).render();
          }
        } else {
          // Not in blessed mode, just dump to stdout
          process.stdout.write(data);
          process.stdout.write("\n");
          process.stdout.write(zmcdnInput.lastZMachineOutput);
        }
      } catch (error) {
        console.error(
          `Failed to fetch graphics from ${url}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return Promise.resolve();
  }

  private postJSON(url: string, data: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(data);
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
        path: urlObj.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const req = http.request(options, (res) => {
        let responseData = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseData += chunk;
        });
        res.on("end", () => {
          if (res.statusCode !== 200) {
            console.error(`HTTP ${res.statusCode} error response:`, responseData);
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            return;
          }
          resolve(responseData);
        });
      });

      req.on("error", reject);
      req.write(postData);
      req.end();
    });
  }

  private fetchURL(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      http
        .get(url, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            res.resume();
            return;
          }

          let data = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => resolve(data));
        })
        .on("error", reject);
    });
  }

  private postGenerate(gameId: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        gameID: gameId,
        text: text,
      });

      const url = new URL(`${this.zmcdnServer}/generate`);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const req = http.request(options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        res.resume();
        resolve();
      });

      req.on("error", reject);
      req.write(postData);
      req.end();
    });
  }

  async readChar(): Promise<string> {
    await this.processZMCDNText();

    if (this.useBlessedMode && this.screen) {
      // Use blessed key handling for character reading
      return new Promise<string>((resolve) => {
        if (!this.screen) return;

        const onKey = (_ch: any, key: any) => {
          // Remove the key handler
          if (this.screen) {
            this.screen.unkey('enter', onKey);
            this.screen.unkey('escape', onKey);
            this.screen.unkey('backspace', onKey);
            this.screen.unkey('delete', onKey);
            this.screen.unkey('up', onKey);
            this.screen.unkey('down', onKey);
            this.screen.unkey('left', onKey);
            this.screen.unkey('right', onKey);
          }

          if (!key || !key.name) {
            resolve('\r');
            return;
          }

          if (key.name.length === 1) {
            resolve(key.shift ? key.name.toUpperCase() : key.name.toLowerCase());
            return;
          }

          switch (key.name) {
            case 'enter':
              resolve('\r');
              break;
            case 'escape':
              resolve('\x1b');
              break;
            case 'backspace':
            case 'delete':
              resolve('\b');
              break;
            case 'up':
              resolve('\x81');
              break;
            case 'down':
              resolve('\x82');
              break;
            case 'left':
              resolve('\x83');
              break;
            case 'right':
              resolve('\x84');
              break;
            default:
              resolve('\r');
          }
        };

        // Listen for keys
        this.screen.key('enter', onKey);
        this.screen.key('escape', onKey);
        this.screen.key('backspace', onKey);
        this.screen.key('delete', onKey);
        this.screen.key('up', onKey);
        this.screen.key('down', onKey);
        this.screen.key('left', onKey);
        this.screen.key('right', onKey);
      });
    }

    return new Promise<string>((resolve) => {
      process.stdin.once("keypress", ({ shift, name }: Key) => {
        // Handle undefined name
        if (!name) {
          resolve("\r"); // Return carriage return for undefined keys
          return;
        }

        if (name.length === 1) {
          if (shift) {
            resolve(name.toUpperCase());
            return;
          }
          resolve(name.toLowerCase());
          return;
        }

        // Handle special keys
        switch (name) {
          case "return":
            resolve("\r"); // ZSCII 13 (carriage return)
            return;
          case "escape":
            resolve("\x1b"); // ZSCII 27 (escape)
            return;
          case "delete":
          case "backspace":
            resolve("\b"); // ZSCII 8 (backspace)
            return;
          case "up":
            resolve("\x81"); // ZSCII 129 (cursor up)
            return;
          case "down":
            resolve("\x82"); // ZSCII 130 (cursor down)
            return;
          case "left":
            resolve("\x83"); // ZSCII 131 (cursor left)
            return;
          case "right":
            resolve("\x84"); // ZSCII 132 (cursor right)
            return;
          default: {
            throw new Error(`Unhandled key "${name}"`);
          }
        }
      });
    });
  }

  async readLine(): Promise<string> {
    await this.processZMCDNText();

    if (this.useBlessedMode && this.screen) {
      // Use blessed input for line reading
      return new Promise<string>((resolve, reject) => {
        if (!this.screen) {
          reject(new Error("Blessed screen not initialized"));
          return;
        }

        // Ensure we're scrolled to the bottom before showing input
        const targetWindow = this.currentWindow === 1 ? this.upperWindow : this.lowerWindow;
        if (targetWindow) {
          targetWindow.setScrollPerc(100);
        }

        const input = blessed.textbox({
          parent: this.screen,  // Attach to screen, not window
          bottom: 0,
          left: 0,
          height: 1,
          width: '100%',
          inputOnFocus: true,
          keys: true,
          style: {
            fg: 'white',
            bg: 'black'
          }
        });

        input.on('submit', (value: string) => {
          input.destroy();
          this.screen?.render();
          resolve(value || '');
        });

        input.focus();
        this.screen.render();
      });
    }

    // Set the prompt so readline can preserve it during history navigation
    if (!this.rl) {
      throw new Error("Readline interface not initialized");
    }

    this.rl.setPrompt(this.currentPrompt);

    return new Promise<string>((resolve) => {
      if (!this.rl) return;

      // Readline needs to be prompted to manage the line properly
      this.rl.prompt();

      this.rl.once("line", (line) => {
        // Check for trace commands
        const traceMatch = line.trim().match(/^\/trace\s+(on|off)$/);
        if (traceMatch) {
          const arg = traceMatch[1];
          if (this.zm) {
            if (arg === "on") {
              this.zm.setTrace(true);
              console.log("Trace enabled");
            } else {
              this.zm.setTrace(false);
              console.log("Trace disabled");
            }
          } else {
            console.log("ZMachine not initialized");
          }
          return this.readLine().then(resolve);
        }

        // Check for ZMCDN commands
        const zmcdnMatch = line.trim().match(/^\/zmcdn\s+(.+)$/);
        if (zmcdnMatch) {
          const arg = zmcdnMatch[1];
          if (arg === "off") {
            this.zmcdnEnabled = false;
            console.log("ZMCDN image fetching disabled");
          } else {
            this.zmcdnServer = arg;
            this.zmcdnEnabled = true;
            console.log(`ZMCDN image fetching enabled with server: ${arg}`);
          }
          return this.readLine().then(resolve);
        }

        // Check for redraw command
        if (line.trim() === "/redraw") {
          if (!this.lastzmcdnInput) {
            console.log("No previous ZMCDN input to redraw");
          } else if (!this.zmcdnEnabled) {
            console.log("ZMCDN is disabled");
          } else {
            const redrawInput = { ...this.lastzmcdnInput, invalidate: true };
            const url = `${this.zmcdnServer}/illustrateMove`;
            this.postJSON(url, redrawInput)
              .then((data) => {
                process.stdout.write(data);
                process.stdout.write("\n");
                process.stdout.write(redrawInput.lastZMachineOutput);
              })
              .catch((error) => {
                console.error(
                  `Failed to fetch graphics from ${url}: ${error instanceof Error ? error.message : String(error)}`,
                );
              });
          }
          return this.readLine().then(resolve);
        }
        resolve(line);
      });
    });
  }

  async writeChar(char: string): Promise<void> {
    // Always accumulate text for ZMCDN if enabled
    if(this.zmcdnEnabled) {
      this.ZMCDNText += char;
    }

    // Display the text
    if (this.useBlessedMode) {
      const targetWindow = this.currentWindow === 1 ? this.upperWindow : this.lowerWindow;
      if (targetWindow) {
        const currentContent = targetWindow.getContent();
        targetWindow.setContent(currentContent + char);
        // Only scroll if it's the lower window (scrollable)
        if (this.currentWindow === 0 && this.lowerWindow) {
          this.lowerWindow.setScrollPerc(100);
        }
        this.screen?.render();
      }
    } else if (!this.zmcdnEnabled) {
      // Only write to stdout if not in blessed mode and ZMCDN is not handling it
      process.stdout.write(char);
    }
    // Track potential prompt characters
    if (char === "\n") {
      this.currentPrompt = "";
    } else {
      this.currentPrompt += char;
      // Keep only last 50 chars as potential prompt
      if (this.currentPrompt.length > 50) {
        this.currentPrompt = this.currentPrompt.slice(-50);
      }
    }
  }

  async writeString(str: string): Promise<void> {
    // Always accumulate text for ZMCDN if enabled
    if(this.zmcdnEnabled) {
      this.ZMCDNText += str;
    }

    // Display the text
    if (this.useBlessedMode) {
      const targetWindow = this.currentWindow === 1 ? this.upperWindow : this.lowerWindow;
      if (targetWindow) {
        const currentContent = targetWindow.getContent();
        targetWindow.setContent(currentContent + str);
        // Only scroll if it's the lower window (scrollable)
        if (this.currentWindow === 0 && this.lowerWindow) {
          this.lowerWindow.setScrollPerc(100);
        }
        this.screen?.render();
      }
    } else if (!this.zmcdnEnabled) {
      // Only write to stdout if not in blessed mode and ZMCDN is not handling it
      process.stdout.write(str);
    }
    // Track the last line as potential prompt
    const lines = str.split("\n");
    if (lines.length > 1) {
      this.currentPrompt = lines[lines.length - 1];
    } else {
      this.currentPrompt += str;
      // Keep only last 50 chars as potential prompt
      if (this.currentPrompt.length > 50) {
        this.currentPrompt = this.currentPrompt.slice(-50);
      }
    }
  }

  close(): void {
    if (this.useBlessedMode && this.screen) {
      this.screen.destroy();
    } else if (this.rl) {
      this.rl.close();
    }
  }

  // Window management methods (v3+)
  splitWindow(lines: number): void {
    if (!this.useBlessedMode || !this.screen) return;

    this.upperWindowHeight = lines;

    if (lines === 0) {
      // No upper window
      if (this.upperWindow) {
        this.screen.remove(this.upperWindow);
        this.upperWindow = null;
      }
      if (this.lowerWindow) {
        this.lowerWindow.top = 1; // Account for status line
        this.lowerWindow.height = '100%-1';
      }
    } else {
      // Create or resize upper window (below status line)
      if (!this.upperWindow) {
        this.upperWindow = blessed.box({
          top: 1, // Start below status line
          left: 0,
          width: '100%',
          height: lines,
          tags: true,
        });
        this.screen.append(this.upperWindow);
      } else {
        this.upperWindow.height = lines;
      }

      // Adjust lower window (account for status line + upper window)
      if (this.lowerWindow) {
        this.lowerWindow.top = 1 + lines; // Status line + upper window
        this.lowerWindow.height = `100%-${1 + lines}`;
      }
    }

    this.screen.render();
  }

  setWindow(window: number): void {
    if (!this.useBlessedMode) return;
    this.currentWindow = window;
  }

  eraseWindow(window: number): void {
    if (!this.useBlessedMode) return;

    if (window === -1) {
      // Erase entire screen and unsplit
      this.splitWindow(0);
      this.lowerWindow?.setContent('');
    } else if (window === -2) {
      // Erase entire screen without unsplitting
      this.upperWindow?.setContent('');
      this.lowerWindow?.setContent('');
    } else if (window === 0) {
      // Erase lower window
      this.lowerWindow?.setContent('');
    } else if (window === 1 && this.upperWindow) {
      // Erase upper window
      this.upperWindow.setContent('');
    }

    this.screen?.render();
  }

  eraseLine(_value: number): void {
    if (!this.useBlessedMode) return;

    const targetWindow = this.currentWindow === 1 ? this.upperWindow : this.lowerWindow;
    if (!targetWindow) return;

    // Get current cursor position and erase from cursor to end of line
    // For simplicity, we'll just add spaces (blessed doesn't have direct line erase)
    // This is a simplified implementation
    this.screen?.render();
  }

  setCursor(_line: number, _column: number): void {
    if (!this.useBlessedMode || !this.screen) return;

    const targetWindow = this.currentWindow === 1 ? this.upperWindow : this.lowerWindow;
    if (!targetWindow) return;

    // Move cursor to specified position (1-indexed in Z-machine)
    // Blessed uses 0-indexed positions
    // This would need more sophisticated cursor tracking
    this.screen.render();
  }

  getCursor(): { line: number; column: number } {
    if (!this.useBlessedMode) {
      return { line: 1, column: 1 };
    }

    // Return current cursor position (simplified - always return 1,1 for now)
    // Would need cursor tracking implementation
    return { line: 1, column: 1 };
  }

  setTextStyle(style: number): void {
    if (!this.useBlessedMode) return;
    this.currentTextStyle = style;
    // Style bits:
    // 0 = Roman (normal)
    // 1 = Reverse video
    // 2 = Bold
    // 4 = Italic
    // 8 = Fixed-pitch
  }

  setBufferMode(_flag: number): void {
    // Buffer mode control - currently no-op even in blessed mode
  }

  setOutputStream(_number: number, _table?: number): void {
    // Output stream control - currently no-op
  }

  setInputStream(_number: number): void {
    // Input stream control - currently no-op
  }

  private rl: Interface | null = null;
}
