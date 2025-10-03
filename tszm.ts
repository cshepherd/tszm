import { ZMachine } from "./ZMachine";
import { ZMInputOutputDevice } from "./ZMInputOutputDevice";

// A simple console-based implementation of ZMInputOutputDevice
class ZMConsole implements ZMInputOutputDevice {
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

      // Enable raw mode to receive characters one at a time
      process.stdin.setRawMode(true);

      const onData = (chunk: Buffer) => {
        const str = chunk.toString();

        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          const code = str.charCodeAt(i);

          if (code === 13 || code === 10) {
            // Enter key - finish input
            process.stdin.removeListener("data", onData);
            process.stdin.setRawMode(false);
            process.stdout.write("\n");
            resolve(input);
            return;
          } else if (code === 127 || code === 8) {
            // Backspace
            if (input.length > 0) {
              input = input.slice(0, -1);
              process.stdout.write("\b \b");
            }
          } else if (code >= 32 && code < 127) {
            // Printable character
            input += char;
            process.stdout.write(char);
          }
        }
      };

      process.stdin.on("data", onData);
    });
  }

  async writeChar(char: string): Promise<void> {
    process.stdout.write(char);
  }

  async writeString(str: string): Promise<void> {
    process.stdout.write(str);
  }
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const traceEnabled = args.includes("--trace");

  const consoleDevice = new ZMConsole();
  const path = "images/LeatherGoddesses.z3";
  const zm = new ZMachine(path, consoleDevice);

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
      process.exit(0);
    }
    console.error("Error:", err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
