// Miscellaneous handlers (nop, show_status, verify, etc.)

export function h_nop(vm: any) {
  // No operation
}

export function h_show_status(vm: any) {
  // Show status line (v1-3 only)
  // Displays location and score/time on line 1
  if (vm.trace) {
    console.log("@show_status");
  }

  if (!vm.inputOutputDevice || !vm.memory || !vm.header) {
    return;
  }

  // Only for v1-3
  if (vm.header.version > 3) {
    return;
  }

  // Get terminal width (default to 80)
  const termWidth = process.stdout.columns || 80;

  // Read global variables for status line
  // Global 0 (variable 16): Location object number
  const locationObj = vm.getVariableValue(16);

  if (vm.trace) {
    console.log(`  Location object: ${locationObj}`);
  }

  // Get location name
  let locationName = "";
  if (locationObj && locationObj > 0) {
    // Use the same method as findPlayerParent to get object name
    const { h_get_prop_addr } = require("./objects");
    const objectAddress = vm.header.objectTableAddress +
                          (vm.header.version <= 3 ? 31 * 2 : 63 * 2) +
                          (locationObj - 1) * (vm.header.version <= 3 ? 9 : 14);
    const objectEntrySize = vm.header.version <= 3 ? 9 : 14;
    const propertyTableAddr = vm.memory.readUInt16BE(objectAddress + objectEntrySize - 2);

    // The short name is at the property table address
    const origPC = vm.pc;
    vm.pc = propertyTableAddr + 1;
    locationName = vm.decodeZSCII(true);
    vm.pc = origPC;
  }

  // Check if this is a time game (bit 1 of Flags 1 at 0x01)
  const flags1 = vm.memory.readUInt8(0x01);
  const isTimeGame = (flags1 & 0x02) !== 0;

  let rightText = "";
  if (isTimeGame) {
    // Time game: Global 1 and 2 are hours and minutes
    const hours = vm.getVariableValue(17) || 0;
    const minutes = vm.getVariableValue(18) || 0;
    if (vm.trace) {
      console.log(`  Time: ${hours}:${minutes}`);
    }
    rightText = `Time: ${hours.toString().padStart(2, ' ')}:${minutes.toString().padStart(2, '0')}`;
  } else {
    // Score game: Global 1 and 2 are score and turns
    const score = vm.getVariableValue(17) || 0;
    const turns = vm.getVariableValue(18) || 0;
    if (vm.trace) {
      console.log(`  Score: ${score}, Moves: ${turns}`);
    }
    rightText = `Score: ${score}  Moves: ${turns}`;
  }

  // Build status line with padding
  // Use termWidth - 1 to avoid wrapping at column 80
  const leftText = " " + locationName;
  const padding = termWidth - leftText.length - rightText.length - 2; // -2 for spaces on both sides
  const statusLine = leftText + " ".repeat(Math.max(0, padding)) + rightText;

  // Truncate if too long, ensure we don't reach the last column to avoid wrap
  const finalStatusLine = statusLine.slice(0, termWidth - 1);

  // Update status line on line 1
  // Save cursor, update status line, then restore cursor to preserve current position

  // Directly write to stdout to avoid prompt tracking in ZConsole
  process.stdout.write("\x1b7");      // Save cursor position
  process.stdout.write("\x1b[1;1H");  // Move to line 1, column 1
  process.stdout.write("\x1b[7m");    // Reverse video
  process.stdout.write(finalStatusLine);
  process.stdout.write("\x1b[0m");    // Reset attributes
  process.stdout.write("\x1b8");      // Restore cursor position
}

export function h_verify(
  vm: any,
  _ops: number[],
  ctx: { branch?: (c: boolean) => void },
) {
  // Verify game file checksum
  // For now, always succeed
  ctx.branch?.(true);
}

export function h_piracy(
  vm: any,
  _ops: number[],
  ctx: { branch?: (c: boolean) => void },
) {
  // Piracy check (v5+)
  // Always return TRUE (game is genuine)
  ctx.branch?.(true);
}
