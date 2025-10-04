import { ZMachine } from "./ZMachine";
import { ZConsole } from "./ZConsole";

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

  const consoleDevice = new ZConsole();
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
