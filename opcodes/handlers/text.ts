// Text output handlers

export function h_print(vm: any) {
  vm.print();
}

export function h_print_ret(vm: any) {
  vm.print();
  if (vm.inputOutputDevice) {
    vm.inputOutputDevice.writeString("\n");
  } else {
    console.log("\n");
  }
  vm.returnFromRoutine(1);
}

export function h_new_line(vm: any) {
  if (vm.inputOutputDevice) {
    vm.inputOutputDevice.writeString("\n");
  } else {
    console.log("\n");
  }
}

export function h_print_num(vm: any, [n]: number[]) {
  // Convert to signed 16-bit
  const signedNum = n > 32767 ? n - 65536 : n;
  if (vm.inputOutputDevice) {
    vm.inputOutputDevice.writeString(signedNum.toString());
  } else {
    process.stdout.write(signedNum.toString());
  }
}

export function h_print_addr(vm: any, [addr]: number[]) {
  const origPC = vm.pc;
  vm.pc = addr;
  vm.print();
  vm.pc = origPC;
}

export function h_print_paddr(vm: any, [packedAddr]: number[]) {
  // Packed string address calculation depends on version
  // V1-3: multiply by 2
  // V4-5: multiply by 4
  // V6-7: multiply by 4 (or 8 for some V6/7 games, but typically 4)
  // V8: multiply by 8
  const version = vm.header?.version || 3;
  let multiplier: number;
  if (version <= 3) {
    multiplier = 2;
  } else if (version <= 5) {
    multiplier = 4;
  } else if (version <= 7) {
    multiplier = 4; // Some V6/7 may use 8, but 4 is standard
  } else {
    multiplier = 8;
  }

  const addr = packedAddr * multiplier;
  const origPC = vm.pc;
  vm.pc = addr;
  vm.print();
  vm.pc = origPC;
}
