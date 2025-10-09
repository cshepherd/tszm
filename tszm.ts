import { ZMachine } from "./ZMachine";
import { ZConsole } from "./ZConsole";

async function main() {
  // Set TERM to a safe value to avoid blessed terminfo parsing errors
  // This prevents the Setulc capability error with xterm-256color
  if (process.env.TERM === 'xterm-256color') {
    process.env.TERM = 'xterm';
  }

  // Parse command line arguments
  const args = process.argv.slice(2);
  const traceEnabled = args.includes("--trace");

  // Find --zmcdn argument
  let zmcdnServer: string | undefined;
  const zmcdnIndex = args.indexOf("--zmcdn");
  if (zmcdnIndex !== -1 && zmcdnIndex + 1 < args.length) {
    zmcdnServer = args[zmcdnIndex + 1];
  }

  const zImagePath = args.find(
    (arg) => !arg.startsWith("--") && arg !== zmcdnServer,
  );

  if (!zImagePath) {
    console.error("Error: Z-image file path is required");
    console.error(
      "Usage: tszm <z-image-file> [--trace] [--zmcdn <server-url>]",
    );
    process.exit(1);
  }

  // Handle Ctrl-C gracefully
  process.on("SIGINT", () => {
    console.log("\n\nInterrupted by user.");
    process.exit(0);
  });

  const consoleDevice = new ZConsole(zmcdnServer, true);
  const zm = new ZMachine(zImagePath, consoleDevice);

  if (traceEnabled) {
    zm.setTrace(true);
  }

  try {
    await zm.load();
    consoleDevice.setZMachine(zm);
    if (traceEnabled) {
      console.log("Header:", zm.getHeader());
      console.log("Starting execution...");
    }

    for (;;) {
      try {
        await zm.executeInstruction();
      } catch (instrErr) {
        // Re-throw QUIT without logging
        if (instrErr instanceof Error && instrErr.message === "QUIT") {
          throw instrErr;
        }
        console.error("Error executing instruction:", instrErr);
        if (instrErr instanceof Error) {
          console.error("Stack trace:", instrErr.stack);
        }
        throw instrErr;
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message === "QUIT") {
      console.log("\nGame quit.");
      consoleDevice.close();
      process.exit(0);
    }
    console.error("Fatal error:", err);
    if (err instanceof Error) {
      console.error("Stack trace:", err.stack);
    }
    consoleDevice.close();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
