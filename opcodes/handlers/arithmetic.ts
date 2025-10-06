// Arithmetic instruction handlers. Keep pure, side-effects via ctx helpers when needed.

// Helper to convert to signed 16-bit
function toSigned16(n: number): number {
  return n > 32767 ? n - 65536 : n;
}

// Helper to convert to unsigned 16-bit
function toUnsigned16(n: number): number {
  if (n < 0) n = n + 65536;
  return n & 0xffff;
}

export function h_add(vm: any, [a, b]: number[]) {
  const signedA = toSigned16(a);
  const signedB = toSigned16(b);
  const result = toUnsigned16(signedA + signedB);
  vm._storeResult?.(result);
}

export function h_sub(vm: any, [a, b]: number[]) {
  const signedA = toSigned16(a);
  const signedB = toSigned16(b);
  const result = toUnsigned16(signedA - signedB);
  vm._storeResult?.(result);
}

export function h_mul(vm: any, [a, b]: number[]) {
  const signedA = toSigned16(a);
  const signedB = toSigned16(b);
  const result = toUnsigned16(signedA * signedB);
  vm._storeResult?.(result);
}

export function h_div(vm: any, [a, b]: number[]) {
  const signedA = toSigned16(a);
  const signedB = toSigned16(b);

  if (signedB === 0) {
    console.error("Division by zero");
    return;
  }

  const result = toUnsigned16(Math.trunc(signedA / signedB));
  vm._storeResult?.(result);
}

export function h_mod(vm: any, [a, b]: number[]) {
  const signedA = toSigned16(a);
  const signedB = toSigned16(b);

  if (signedB === 0) {
    console.error("Modulo by zero");
    return;
  }

  const result = toUnsigned16(signedA % signedB);
  vm._storeResult?.(result);
}
