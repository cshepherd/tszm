import { ZMachine } from "./ZMachine";
import { ZMInputOutputDevice } from "./ZMInputOutputDevice";
import * as readline from "readline";
import * as crypto from "crypto";
import * as http from "http";

// A simple console-based implementation of ZMInputOutputDevice
class ZMConsole implements ZMInputOutputDevice {
  private history: string[] = [];
  private historyIndex: number = 0;
  private ZMCDNText: string = "";
  private zm: ZMachine | null = null;
  private zmcdnEnabled: boolean = false;
  private zmcdnServer: string = "";

  constructor(zmcdnServer?: string) {
    readline.emitKeypressEvents(process.stdin);
    if (zmcdnServer) {
      this.zmcdnServer = zmcdnServer;
      this.zmcdnEnabled = true;
    }
  }

  setZMachine(zm: ZMachine): void {
    this.zm = zm;
  }

  async processZMCDNText(): Promise<void> {
    if (this.ZMCDNText && this.zmcdnEnabled) {
      const text = this.ZMCDNText;
      this.ZMCDNText = "";

      // Compute SHA512 hash
      const hash = crypto.createHash("sha512").update(text).digest("hex");

      // Get gameId from header
      if (!this.zm) {
        console.error("ZMachine not initialized");
        return;
      }

      const header = this.zm.getHeader();
      if (!header) {
        console.error("Unable to read game header");
        return;
      }
      const gameId = `${header.release}.${header.serial}`;

      // Make HTTP GET request
      const url = `${this.zmcdnServer}/print/${gameId}/${hash}/sixel`;

      try {
        const data = await this.fetchURL(url);
        console.error(`Received ${data.length} bytes of sixel data`);
        // Dump sixel-formatted graphics to terminal
        process.stdout.write(data);
        process.stdout.write('\n');
      } catch (error) {
        // On failure, POST to generate endpoint
        try {
          await this.postGenerate(gameId, text);
          // If generation succeeds, re-request the image
          const data = await this.fetchURL(url);
          console.error(`Received ${data.length} bytes of sixel data after generation`);
          process.stdout.write(data);
          process.stdout.write('\n');
        } catch (postError) {
          console.error(`Failed to fetch graphics from ${url}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    return Promise.resolve();
  }

  private fetchURL(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      http.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }

        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => resolve(data));
      }).on("error", reject);
    });
  }

  private postGenerate(gameId: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        gameID: gameId,
        text: text
      });

      const url = new URL(`${this.zmcdnServer}/generate`);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData)
        }
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
    return new Promise((resolve) => {
      process.stdin.once("data", (data) => {
        resolve(data.toString().charAt(0));
      });
    });
  }

  async readLine(): Promise<string> {
    await this.processZMCDNText();
    return new Promise((resolve) => {
      let input = "";
      let cursorPos = 0;
      this.historyIndex = this.history.length;

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      const onKeypress = (str: string, key: any) => {
        if (key.ctrl && key.name === "c") {
          process.stdin.removeListener("keypress", onKeypress);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          console.log("\n\nInterrupted by user.");
          process.exit(0);
        } else if (key.name === "return") {
          process.stdin.removeListener("keypress", onKeypress);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          process.stdout.write("\n");

          // Check for ZMCDN commands
          const zmcdnMatch = input.trim().match(/^\/zmcdn\s+(.+)$/);
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

          if (input.trim()) {
            this.history.push(input);
          }
          resolve(input);
        } else if (key.name === "backspace") {
          if (cursorPos > 0) {
            input = input.slice(0, cursorPos - 1) + input.slice(cursorPos);
            cursorPos--;
            // Redraw from cursor position
            process.stdout.write("\b" + input.slice(cursorPos) + " ");
            // Move cursor back
            for (let i = 0; i <= input.length - cursorPos; i++) {
              process.stdout.write("\b");
            }
          }
        } else if (key.name === "left") {
          if (cursorPos > 0) {
            cursorPos--;
            process.stdout.write("\x1b[D");
          }
        } else if (key.name === "right") {
          if (cursorPos < input.length) {
            cursorPos++;
            process.stdout.write("\x1b[C");
          }
        } else if (key.name === "up") {
          if (this.historyIndex > 0) {
            this.historyIndex--;
            // Clear only the input portion (move cursor back, clear forward, redraw)
            while (cursorPos > 0) {
              process.stdout.write("\b");
              cursorPos--;
            }
            process.stdout.write("\x1b[0J"); // Clear from cursor to end of screen
            input = this.history[this.historyIndex];
            cursorPos = input.length;
            process.stdout.write(input);
          }
        } else if (key.name === "down") {
          if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            // Clear only the input portion
            while (cursorPos > 0) {
              process.stdout.write("\b");
              cursorPos--;
            }
            process.stdout.write("\x1b[0J"); // Clear from cursor to end of screen
            input = this.history[this.historyIndex];
            cursorPos = input.length;
            process.stdout.write(input);
          } else if (this.historyIndex === this.history.length - 1) {
            this.historyIndex++;
            // Clear only the input portion
            while (cursorPos > 0) {
              process.stdout.write("\b");
              cursorPos--;
            }
            process.stdout.write("\x1b[0J"); // Clear from cursor to end of screen
            input = "";
            cursorPos = 0;
          }
        } else if (key.ctrl && key.name === "a") {
          // Move to beginning
          while (cursorPos > 0) {
            process.stdout.write("\b");
            cursorPos--;
          }
        } else if (key.ctrl && key.name === "e") {
          // Move to end
          while (cursorPos < input.length) {
            process.stdout.write(input[cursorPos]);
            cursorPos++;
          }
        } else if (key.ctrl && key.name === "u") {
          // Clear line
          while (cursorPos > 0) {
            process.stdout.write("\b \b");
            cursorPos--;
          }
          process.stdout.write(input.slice(cursorPos) + " ".repeat(input.length - cursorPos));
          for (let i = 0; i < input.length - cursorPos; i++) {
            process.stdout.write("\b");
          }
          input = "";
          cursorPos = 0;
        } else if (key.ctrl && key.name === "w") {
          // Delete word before cursor
          if (cursorPos > 0) {
            const beforeCursor = input.slice(0, cursorPos);
            const afterCursor = input.slice(cursorPos);
            // Find the start of the last word (skip trailing spaces first)
            let pos = cursorPos - 1;
            while (pos >= 0 && beforeCursor[pos] === " ") {
              pos--;
            }
            while (pos >= 0 && beforeCursor[pos] !== " ") {
              pos--;
            }
            const deleteCount = cursorPos - pos - 1;
            input = beforeCursor.slice(0, pos + 1) + afterCursor;
            // Move cursor back and redraw
            for (let i = 0; i < deleteCount; i++) {
              process.stdout.write("\b");
            }
            cursorPos = pos + 1;
            // Clear from cursor to end and redraw
            process.stdout.write(afterCursor + " ".repeat(deleteCount));
            for (let i = 0; i < afterCursor.length + deleteCount; i++) {
              process.stdout.write("\b");
            }
          }
        } else if (str && !key.ctrl && !key.meta) {
          // Insert character at cursor position
          input = input.slice(0, cursorPos) + str + input.slice(cursorPos);
          cursorPos++;
          // Redraw from cursor position
          process.stdout.write(input.slice(cursorPos - 1));
          // Move cursor back to correct position
          for (let i = cursorPos; i < input.length; i++) {
            process.stdout.write("\b");
          }
        }
      };

      process.stdin.on("keypress", onKeypress);
    });
  }

  async writeChar(char: string): Promise<void> {
    this.ZMCDNText += char;
    process.stdout.write(char);
  }

  async writeString(str: string): Promise<void> {
    this.ZMCDNText += str;
    process.stdout.write(str);
  }

  close(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const traceEnabled = args.includes("--trace");

  // Find --zmcdn argument
  let zmcdnServer: string | undefined;
  const zmcdnIndex = args.indexOf("--zmcdn");
  if (zmcdnIndex !== -1 && zmcdnIndex + 1 < args.length) {
    zmcdnServer = args[zmcdnIndex + 1];
  }

  const zImagePath = args.find(arg => !arg.startsWith("--") && arg !== zmcdnServer);

  if (!zImagePath) {
    console.error("Error: Z-image file path is required");
    console.error("Usage: tszm <z-image-file> [--trace] [--zmcdn <server-url>]");
    process.exit(1);
  }

  // Handle Ctrl-C gracefully
  process.on("SIGINT", () => {
    console.log("\n\nInterrupted by user.");
    process.exit(0);
  });

  const consoleDevice = new ZMConsole(zmcdnServer);
  const zm = new ZMachine(zImagePath, consoleDevice);

  if (traceEnabled) {
    zm.setTrace(true);
  }

  try {
    await zm.load();
    consoleDevice.setZMachine(zm);
    console.log("Header:", zm.getHeader());
    console.log("Starting execution...");

    for (;;) {
      await zm.executeInstruction();
    }
  } catch (err) {
    if (err instanceof Error && err.message === "QUIT") {
      console.log("\nGame quit.");
      consoleDevice.close();
      process.exit(0);
    }
    console.error("Error:", err);
    consoleDevice.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
