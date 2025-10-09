import { CountKind, ExecCtx, InstrDescriptor, OperandType } from "./types";
import {
  TABLE_0OP,
  TABLE_1OP,
  TABLE_2OP,
  TABLE_VAR,
  TABLE_EXT,
} from "./tables";

export interface OperandInfo {
  value: number;
  type: "large" | "small" | "var";
  varNum?: number; // Only set if type === "var"
}

export interface DecodedInstr {
  desc: InstrDescriptor;
  operands: number[];
  operandInfo?: OperandInfo[]; // For trace/disassembly purposes
  // Dispatcher fills these according to desc.doesStore / doesBranch
  storeTarget?: number; // variable number to store into (if any)
  branchInfo?: { offset: number; branchOnTrue: boolean };
}

export function decodeNext(vm: any): DecodedInstr {
  // NOTE: This file is intentionally minimal and uses vm helpers you likely already have.
  // Replace the placeholders (_fetchByte, _fetchWord, _decodeOperand, etc.) with your real ones.
  const first = vm._fetchByte();

  // Determine family and inline opcode number based on top bits (per Z-spec forms)
  let kind: CountKind;
  let opnum = 0;
  let isLongForm2OP = false;

  if (first === 0xbe) {
    // Extended form (0xBE)
    kind = "EXT";
    opnum = vm._fetchByte();
  } else if ((first & 0xc0) === 0xc0) {
    // Variable form (11xxxxxx) - distinguish VAR (0xE0+) from VAR_2OP (0xC0-0xDF)
    if (first >= 0xe0) {
      kind = "VAR";
      // For VAR opcodes 0xE0-0xFF, use the full byte as the opcode number
      opnum = first;
    } else {
      // VAR_2OP (0xC0-0xDF) - these are 2OP opcodes in VAR encoding
      kind = "2OP";
      opnum = first & 0x1f;
    }
  } else if ((first & 0xc0) === 0x80) {
    // Short form (10xxxxxx)
    const operandTypeBits = (first >> 4) & 0x03;
    opnum = first & 0x0f;

    if (operandTypeBits === 0x03) {
      // 1011xxxx - 0OP
      kind = "0OP";
    } else {
      // 1000xxxx, 1001xxxx, 1010xxxx - 1OP
      kind = "1OP";
    }
  } else {
    // Long form (00xxxxxx or 01xxxxxx) - 2OP
    kind = "2OP";
    opnum = first & 0x1f;
    isLongForm2OP = true;
  }

  const table =
    kind === "0OP"
      ? TABLE_0OP
      : kind === "1OP"
        ? TABLE_1OP
        : kind === "2OP"
          ? TABLE_2OP
          : kind === "VAR"
            ? TABLE_VAR
            : TABLE_EXT;

  const desc = table[opnum];
  if (!desc)
    throw new Error(`Illegal/unknown opcode: ${kind} ${opnum.toString(16)}`);

  // --- Operands ---
  const operands: number[] = [];
  const operandInfo: OperandInfo[] = [];

  if (isLongForm2OP) {
    // Long form 2OP: operand types are encoded in the first byte
    // Bit 6: first operand type (0=small, 1=variable)
    // Bit 5: second operand type (0=small, 1=variable)
    const type1 = first & 0x40 ? "var" : "small";
    const type2 = first & 0x20 ? "var" : "small";
    const info1 = vm._decodeOperandWithInfo(type1);
    const info2 = vm._decodeOperandWithInfo(type2);
    operands.push(info1.value, info2.value);
    operandInfo.push(info1, info2);
  } else if (
    kind === "VAR" ||
    kind === "EXT" ||
    (kind === "2OP" && !isLongForm2OP)
  ) {
    // Variable form, EXT, or VAR_2OP (0xC0-0xDF): read operand-type byte(s) and decode until "omit"
    // Pass opnum to check if this is call_vs2 (0xec) or call_vn2 (0xfa) which support double-type-bytes
    const types = vm._readOperandTypes(opnum);
    for (const t of types) {
      if (t === "omit") break;
      const info = vm._decodeOperandWithInfo(t);
      operands.push(info.value);
      operandInfo.push(info);
    }
  } else if (kind === "1OP" && !desc.operandKinds) {
    // Short form 1OP: operand type encoded in bits 4-5 of first byte
    const operandTypeBits = (first >> 4) & 0x03;
    const type =
      operandTypeBits === 0 ? "large" : operandTypeBits === 1 ? "small" : "var";
    const info = vm._decodeOperandWithInfo(type);
    operands.push(info.value);
    operandInfo.push(info);
  } else if (desc.operandKinds && desc.operandKinds.length) {
    // Use descriptor's operand kinds
    for (const kind of desc.operandKinds) {
      const info = vm._decodeOperandWithInfo(kind);
      operands.push(info.value);
      operandInfo.push(info);
    }
  }

  // --- Store/Branch plumbing (the dispatcher will bind helpers to use these) ---
  const out: DecodedInstr = { desc, operands, operandInfo };
  if (desc.doesStore) out.storeTarget = vm._fetchByte(); // variable number (var spec)
  if (desc.doesBranch) out.branchInfo = vm._readBranchOffset();
  return out;
}
