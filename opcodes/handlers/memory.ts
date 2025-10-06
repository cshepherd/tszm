// Memory access handlers

function toSigned16(n: number): number {
  return n > 32767 ? n - 65536 : n;
}

export function h_loadw(vm: any, [arrayAddr, wordIndex]: number[], ctx: { store?: (v: number) => void }) {
  if (!vm.memory) {
    console.error("Memory not loaded");
    return;
  }

  const signedIndex = toSigned16(wordIndex);
  const addr = arrayAddr + 2 * signedIndex;

  if (addr < 0 || addr >= vm.memory.length - 1) {
    console.error(
      `LOADW: Invalid memory address 0x${addr.toString(16)} ` +
      `(array=0x${arrayAddr.toString(16)}, index=${signedIndex}). ` +
      `Memory size: 0x${vm.memory.length.toString(16)}`
    );
    return;
  }

  const value = vm.memory.readUInt16BE(addr);
  ctx.store?.(value);
}

export function h_loadb(vm: any, [arrayAddr, byteIndex]: number[], ctx: { store?: (v: number) => void }) {
  if (!vm.memory) {
    console.error("Memory not loaded");
    return;
  }

  const signedIndex = toSigned16(byteIndex);
  const addr = arrayAddr + signedIndex;

  if (addr < 0 || addr >= vm.memory.length) {
    console.error(
      `LOADB: Invalid memory address 0x${addr.toString(16)} ` +
      `(array=0x${arrayAddr.toString(16)}, index=${signedIndex}). ` +
      `Memory size: 0x${vm.memory.length.toString(16)}`
    );
    return;
  }

  const value = vm.memory.readUInt8(addr);
  ctx.store?.(value);
}

export function h_storew(vm: any, [arrayAddr, wordIndex, value]: number[]) {
  if (!vm.memory) {
    console.error("Memory not loaded");
    return;
  }

  const signedIndex = toSigned16(wordIndex);
  const addr = arrayAddr + 2 * signedIndex;

  if (addr < 0 || addr >= vm.memory.length - 1) {
    console.error(
      `STOREW: Invalid memory address 0x${addr.toString(16)} ` +
      `(array=0x${arrayAddr.toString(16)}, index=${signedIndex}). ` +
      `Memory size: 0x${vm.memory.length.toString(16)}`
    );
    return;
  }

  vm.memory.writeUInt16BE(value, addr);
}

export function h_storeb(vm: any, [arrayAddr, byteIndex, value]: number[]) {
  if (!vm.memory) {
    console.error("Memory not loaded");
    return;
  }

  const signedIndex = toSigned16(byteIndex);
  const addr = arrayAddr + signedIndex;

  if (addr < 0 || addr >= vm.memory.length) {
    console.error(
      `STOREB: Invalid memory address 0x${addr.toString(16)} ` +
      `(array=0x${arrayAddr.toString(16)}, index=${signedIndex}). ` +
      `Memory size: 0x${vm.memory.length.toString(16)}`
    );
    return;
  }

  vm.memory.writeUInt8(value, addr);
}
