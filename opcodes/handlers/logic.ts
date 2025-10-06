// Bitwise/logical operation handlers

export function h_and(vm: any, [a, b]: number[]) {
  const res = (a & b) & 0xffff;
  vm._storeResult?.(res);
}

export function h_or(vm: any, [a, b]: number[]) {
  const res = (a | b) & 0xffff;
  vm._storeResult?.(res);
}

export function h_not(vm: any, [a]: number[]) {
  const res = (~a) & 0xffff;
  vm._storeResult?.(res);
}

export function h_test(vm: any, [bitmap, flags]: number[], ctx: { branch?: (c: boolean) => void }) {
  ctx.branch?.((bitmap & flags) === flags);
}
