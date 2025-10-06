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
  const addr = packedAddr * 2;
  const origPC = vm.pc;
  vm.pc = addr;
  vm.print();
  vm.pc = origPC;
}
