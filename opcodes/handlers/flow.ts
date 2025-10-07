// Flow control handlers (return, branch, quit, etc.)

export function h_rtrue(vm: any) {
  vm.returnFromRoutine(1);
}

export function h_rfalse(vm: any) {
  vm.returnFromRoutine(0);
}

export function h_ret(vm: any, [val]: number[]) {
  vm.returnFromRoutine(val);
}

export function h_ret_popped(vm: any) {
  const value = vm.stack.pop() || 0;
  vm.returnFromRoutine(value);
}

export function h_quit(vm: any) {
  throw new Error("QUIT");
}

export function h_jz(
  vm: any,
  [x]: number[],
  ctx: { branch?: (c: boolean) => void },
) {
  ctx.branch?.(x === 0);
}

export function h_jl(
  vm: any,
  [a, b]: number[],
  ctx: { branch?: (c: boolean) => void },
) {
  const signedA = a > 32767 ? a - 65536 : a;
  const signedB = b > 32767 ? b - 65536 : b;
  ctx.branch?.(signedA < signedB);
}

export function h_jg(
  vm: any,
  [a, b]: number[],
  ctx: { branch?: (c: boolean) => void },
) {
  const signedA = a > 32767 ? a - 65536 : a;
  const signedB = b > 32767 ? b - 65536 : b;
  ctx.branch?.(signedA > signedB);
}

export function h_je(
  vm: any,
  ops: number[],
  ctx: { branch?: (c: boolean) => void },
) {
  const [a, ...rest] = ops;
  ctx.branch?.(rest.some((v) => v === a));
}

export function h_jump(vm: any, [offset]: number[]) {
  // Convert to signed 16-bit
  const signedOffset = offset > 32767 ? offset - 65536 : offset;
  vm.pc = vm.pc + signedOffset - 2;
}
