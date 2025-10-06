// Miscellaneous handlers (nop, show_status, verify, etc.)

export function h_nop(vm: any) {
  // No operation
}

export function h_show_status(vm: any) {
  // Show status line (v1-3 only)
  // Currently no-op
}

export function h_verify(vm: any, _ops: number[], ctx: { branch?: (c: boolean) => void }) {
  // Verify game file checksum
  // For now, always succeed
  ctx.branch?.(true);
}

export function h_piracy(vm: any, _ops: number[], ctx: { branch?: (c: boolean) => void }) {
  // Piracy check (v5+)
  // Always return TRUE (game is genuine)
  ctx.branch?.(true);
}
