import { ZMachine } from "./ZMachine";
import { ZMInputOutputDevice } from "./ZMInputOutputDevice";
import * as readline from "readline";

// A simple console-based implementation of ZMInputOutputDevice
class ZMConsole implements ZMInputOutputDevice {
  private history: string[] = [];
  private historyIndex: number = 0;

  constructor() {
    readline.emitKeypressEvents(process.stdin);
  }

  async readChar(): Promise<string> {
    return new Promise((resolve) => {
      process.stdin.once("data", (data) => {
        resolve(data.toString().charAt(0));
      });
    });
  }

  async readLine(): Promise<string> {
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
    process.stdout.write(char);
  }

  async writeString(str: string): Promise<void> {
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
  const zImagePath = args.find(arg => !arg.startsWith("--"));

  if (!zImagePath) {
    console.error("Error: Z-image file path is required");
    console.error("Usage: tszm <z-image-file> [--trace]");
    process.exit(1);
  }

  // Handle Ctrl-C gracefully
  process.on("SIGINT", () => {
    console.log("\n\nInterrupted by user.");
    process.exit(0);
  });

  const consoleDevice = new ZMConsole();
  const zm = new ZMachine(zImagePath, consoleDevice);

  if (traceEnabled) {
    zm.setTrace(true);
  }

  try {
    await zm.load();
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
