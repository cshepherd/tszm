// Variable manipulation handlers

function toSigned16(n: number): number {
  return n > 32767 ? n - 65536 : n;
}

export function h_inc(vm: any, [varNum]: number[]) {
  const value = vm.getVariableValue(varNum);
  vm.setVariableValue(varNum, (value + 1) & 0xffff);
}

export function h_dec(vm: any, [varNum]: number[]) {
  const value = vm.getVariableValue(varNum);
  vm.setVariableValue(varNum, (value - 1) & 0xffff);
}

export function h_load(vm: any, [varNum]: number[], ctx: { store?: (v: number) => void }) {
  const value = vm.getVariableValue(varNum);
  ctx.store?.(value);
}

export function h_store(vm: any, [varNum, value]: number[]) {
  vm.setVariableValue(varNum, value);
}

export function h_inc_chk(vm: any, [varNum, compareValue]: number[], ctx: { branch?: (c: boolean) => void }) {
  const value = vm.getVariableValue(varNum);
  const newValue = (value + 1) & 0xffff;
  vm.setVariableValue(varNum, newValue);

  const signedNew = toSigned16(newValue);
  const signedCompare = toSigned16(compareValue);
  ctx.branch?.(signedNew > signedCompare);
}

export function h_dec_chk(vm: any, [varNum, compareValue]: number[], ctx: { branch?: (c: boolean) => void }) {
  const value = vm.getVariableValue(varNum);
  const newValue = (value - 1) & 0xffff;
  vm.setVariableValue(varNum, newValue);

  const signedNew = toSigned16(newValue);
  const signedCompare = toSigned16(compareValue);
  ctx.branch?.(signedNew < signedCompare);
}
