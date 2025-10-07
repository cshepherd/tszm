// Strongly-typed, table-driven opcode metadata for the Z-Machine

export type OperandType = "large" | "small" | "var" | "omit";
export type CountKind = "0OP" | "1OP" | "2OP" | "VAR" | "EXT";

export interface ExecCtx {
  // Helpers are bound by the dispatcher for the *current* instruction
  store?: (value: number) => void;
  branch?: (cond: boolean) => void;
}

export interface InstrDescriptor {
  name: string; // display/debug name, e.g., "add", "jz"
  kind: CountKind; // 0OP / 1OP / 2OP / VAR / EXT
  opcode: number; // number within that family (per spec)
  minVersion?: number; // first legal version
  maxVersion?: number; // last legal version
  // For fixed-arity families (0OP/1OP/2OP), this is the decode template.
  // For VAR/EXT, operands are described by following type bytes; leave empty.
  operandKinds?: OperandType[];
  // Whether this instruction stores a result or has a branch operand.
  doesStore?: boolean;
  doesBranch?: boolean;
  // The implementation for the instruction
  handler: (vm: any, operands: number[], ctx: ExecCtx) => void;
}

// Tiny helpers to build descriptors with range checks
function mk(kind: CountKind, max: number) {
  return (
    opcode: number,
    init: Omit<InstrDescriptor, "kind" | "opcode">,
  ): InstrDescriptor => {
    if (opcode < 0 || opcode > max)
      throw new Error(`${kind} opcode out of range: ${opcode}`);
    return { kind, opcode, ...init };
  };
}

export const d0 = mk("0OP", 0x0f);
export const d1 = mk("1OP", 0x0f);
export const d2 = mk("2OP", 0x1f);
export const dv = mk("VAR", 0xff); // VAR opcodes use full byte value 0xE0-0xFF
