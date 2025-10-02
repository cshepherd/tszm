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

  async writeChar(char: string): Promise<void> {
    process.stdout.write(char);
  }

  async writeString(str: string): Promise<void> {
    process.stdout.write(str);
  }
}

async function main() {
  const consoleDevice = new ZMConsole();
  const path = "images/LeatherGoddesses.z3";
  const zm = new ZMachine(path, consoleDevice);
  try {
    await zm.load();
    console.log("Header:", zm.getHeader());
    console.log("Starting execution...");
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();

    await zm.executeInstruction();
    await zm.executeInstruction();
    await zm.executeInstruction();
  } catch (err) {
    console.error("Error:", err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
