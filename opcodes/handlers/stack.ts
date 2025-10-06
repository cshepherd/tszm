// Stack manipulation handlers

function toSigned16(n: number): number {
  return n > 32767 ? n - 65536 : n;
}

export function h_pop(vm: any) {
  vm.stack.pop();
}

export function h_push(vm: any, [value]: number[]) {
  vm.stack.push(value);
}

export function h_pull(vm: any, [varNum]: number[]) {
  if (vm.trace) {
    console.log(`@pull: stack length=${vm.stack.length}, target var=${varNum}`);
  }
  if (vm.stack.length === 0) {
    console.error("Stack underflow in pull");
    return;
  }
  const value = vm.stack.pop() || 0;
  if (vm.trace) {
    console.log(`@pull: pulled value=${value}, storing to var ${varNum}`);
  }
  vm.setVariableValue(varNum, value);
}

export function h_random(vm: any, [range]: number[], ctx: { store?: (v: number) => void }) {
  const signedRange = toSigned16(range);

  let randomValue: number;
  if (signedRange > 0) {
    randomValue = Math.floor(Math.random() * signedRange) + 1;
  } else {
    // Seeding the RNG - we don't actually implement seeding in JS
    randomValue = 0;
  }

  ctx.store?.(randomValue);
}
