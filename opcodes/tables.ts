import { InstrDescriptor, d0, d1, d2, dv } from "./types";
import { h_add, h_sub, h_mul, h_div, h_mod } from "./handlers/arithmetic";
import { h_and, h_or, h_not, h_test } from "./handlers/logic";
import {
  h_rtrue,
  h_rfalse,
  h_ret,
  h_ret_popped,
  h_quit,
  h_jz,
  h_jl,
  h_jg,
  h_je,
  h_jump,
} from "./handlers/flow";
import {
  h_print,
  h_print_ret,
  h_new_line,
  h_print_num,
  h_print_addr,
  h_print_paddr,
} from "./handlers/text";
import { h_pop, h_push, h_pull, h_random } from "./handlers/stack";
import { h_nop, h_show_status, h_verify, h_piracy } from "./handlers/misc";
import {
  h_get_sibling,
  h_get_child,
  h_get_parent,
  h_remove_obj,
  h_print_obj,
  h_test_attr,
  h_set_attr,
  h_clear_attr,
  h_jin,
  h_insert_obj,
} from "./handlers/objects";
import {
  h_get_prop_len,
  h_get_prop,
  h_get_prop_addr,
  h_get_next_prop,
  h_put_prop,
} from "./handlers/properties";
import {
  h_inc,
  h_dec,
  h_load,
  h_store,
  h_inc_chk,
  h_dec_chk,
} from "./handlers/variables";
import { h_call, h_call_1s, h_call_2s } from "./handlers/call";
import { h_loadw, h_loadb, h_storew, h_storeb } from "./handlers/memory";
import {
  h_print_char,
  h_sread,
  h_print_table,
  h_split_window,
  h_set_window,
  h_erase_window,
  h_erase_line,
  h_set_cursor,
  h_get_cursor,
  h_set_text_style,
  h_buffer_mode,
  h_output_stream,
  h_input_stream,
  h_sound_effect,
  h_read_char,
  h_save,
} from "./handlers/io";
import {
  h_log_shift,
  h_art_shift,
  h_set_font,
  h_save_undo,
  h_restore_undo,
  h_print_unicode,
  h_check_unicode,
} from "./handlers/extended";

// Per-family opcode tables. Undefined entries = illegal or unimplemented.
export const TABLE_0OP: Array<InstrDescriptor | undefined> = [];
export const TABLE_1OP: Array<InstrDescriptor | undefined> = [];
export const TABLE_2OP: Array<InstrDescriptor | undefined> = [];
export const TABLE_VAR: Array<InstrDescriptor | undefined> = [];
export const TABLE_EXT: Array<InstrDescriptor | undefined> = [];

// --- 0OP opcodes ---
TABLE_0OP[0x00] = d0(0x00, {
  name: "rtrue",
  operandKinds: [],
  handler: (vm) => h_rtrue(vm),
});

TABLE_0OP[0x01] = d0(0x01, {
  name: "rfalse",
  operandKinds: [],
  handler: (vm) => h_rfalse(vm),
});

TABLE_0OP[0x02] = d0(0x02, {
  name: "print",
  operandKinds: [],
  handler: (vm) => h_print(vm),
});

TABLE_0OP[0x03] = d0(0x03, {
  name: "print_ret",
  operandKinds: [],
  handler: (vm) => h_print_ret(vm),
});

TABLE_0OP[0x04] = d0(0x04, {
  name: "nop",
  operandKinds: [],
  handler: (vm) => h_nop(vm),
});

TABLE_0OP[0x05] = d0(0x05, {
  name: "save",
  operandKinds: [],
  maxVersion: 3,
  doesBranch: true,
  handler: (vm, ops, ctx) => h_save(vm, ops, ctx),
});

// TABLE_0OP[0x06] = restore (v1-3) - TODO: implement save/restore
// TABLE_0OP[0x07] = restart - TODO: implement restart

TABLE_0OP[0x08] = d0(0x08, {
  name: "ret_popped",
  operandKinds: [],
  handler: (vm) => h_ret_popped(vm),
});

TABLE_0OP[0x09] = d0(0x09, {
  name: "pop",
  operandKinds: [],
  handler: (vm) => h_pop(vm),
});

TABLE_0OP[0x0a] = d0(0x0a, {
  name: "quit",
  operandKinds: [],
  handler: (vm) => h_quit(vm),
});

TABLE_0OP[0x0b] = d0(0x0b, {
  name: "new_line",
  operandKinds: [],
  handler: (vm) => h_new_line(vm),
});

TABLE_0OP[0x0c] = d0(0x0c, {
  name: "show_status",
  operandKinds: [],
  maxVersion: 3,
  handler: (vm) => h_show_status(vm),
});

TABLE_0OP[0x0d] = d0(0x0d, {
  name: "verify",
  operandKinds: [],
  minVersion: 3,
  doesBranch: true,
  handler: (vm, ops, ctx) => h_verify(vm, ops, ctx),
});

// TABLE_0OP[0x0e] = extended (v5+) - handled specially in decode

TABLE_0OP[0x0f] = d0(0x0f, {
  name: "piracy",
  operandKinds: [],
  minVersion: 5,
  doesBranch: true,
  handler: (vm, ops, ctx) => h_piracy(vm, ops, ctx),
});

// --- 1OP opcodes ---
TABLE_1OP[0x00] = d1(0x00, {
  name: "jz",
  doesBranch: true,
  handler: (vm, ops, ctx) => h_jz(vm, ops, ctx),
});

TABLE_1OP[0x01] = d1(0x01, {
  name: "get_sibling",
  doesStore: true,
  doesBranch: true,
  handler: (vm, ops, ctx) => h_get_sibling(vm, ops, ctx),
});

TABLE_1OP[0x02] = d1(0x02, {
  name: "get_child",
  doesStore: true,
  doesBranch: true,
  handler: (vm, ops, ctx) => h_get_child(vm, ops, ctx),
});

TABLE_1OP[0x03] = d1(0x03, {
  name: "get_parent",
  doesStore: true,
  handler: (vm, ops, ctx) => h_get_parent(vm, ops, ctx),
});

TABLE_1OP[0x04] = d1(0x04, {
  name: "get_prop_len",
  doesStore: true,
  handler: (vm, ops, ctx) => h_get_prop_len(vm, ops, ctx),
});

TABLE_1OP[0x05] = d1(0x05, {
  name: "inc",
  operandKinds: ["small"],
  handler: (vm, ops) => h_inc(vm, ops),
});

TABLE_1OP[0x06] = d1(0x06, {
  name: "dec",
  operandKinds: ["small"],
  handler: (vm, ops) => h_dec(vm, ops),
});

TABLE_1OP[0x07] = d1(0x07, {
  name: "print_addr",
  handler: (vm, ops) => h_print_addr(vm, ops),
});

TABLE_1OP[0x08] = d1(0x08, {
  name: "call_1s",
  minVersion: 4,
  doesStore: true,
  handler: (vm, ops, ctx) => h_call_1s(vm, ops, ctx),
});

TABLE_1OP[0x09] = d1(0x09, {
  name: "remove_obj",
  handler: (vm, ops) => h_remove_obj(vm, ops),
});

TABLE_1OP[0x0a] = d1(0x0a, {
  name: "print_obj",
  handler: (vm, ops) => h_print_obj(vm, ops),
});

TABLE_1OP[0x0b] = d1(0x0b, {
  name: "ret",
  handler: (vm, ops) => h_ret(vm, ops),
});

TABLE_1OP[0x0c] = d1(0x0c, {
  name: "jump",
  handler: (vm, ops) => h_jump(vm, ops),
});

TABLE_1OP[0x0d] = d1(0x0d, {
  name: "print_paddr",
  handler: (vm, ops) => h_print_paddr(vm, ops),
});

TABLE_1OP[0x0e] = d1(0x0e, {
  name: "load",
  operandKinds: ["small"],
  minVersion: 5,
  doesStore: true,
  handler: (vm, ops, ctx) => h_load(vm, ops, ctx),
});

TABLE_1OP[0x0f] = d1(0x0f, {
  name: "not",
  maxVersion: 4,
  doesStore: true,
  handler: (vm, ops) => h_not(vm, ops),
});

// --- 2OP opcodes ---
// NOTE: Opcodes 0x01-0x1F can be encoded in either 2OP (long form) or VAR_2OP (variable form 0xC0-0xDF).
// Both encodings should use the same handlers below.
// TABLE_2OP[0x00] = reserved/nop

TABLE_2OP[0x01] = d2(0x01, {
  name: "je",
  operandKinds: ["var", "var"],
  doesBranch: true,
  handler: (vm, ops, ctx) => h_je(vm, ops, ctx),
});

TABLE_2OP[0x02] = d2(0x02, {
  name: "jl",
  operandKinds: ["var", "var"],
  doesBranch: true,
  handler: (vm, ops, ctx) => h_jl(vm, ops, ctx),
});

TABLE_2OP[0x03] = d2(0x03, {
  name: "jg",
  operandKinds: ["var", "var"],
  doesBranch: true,
  handler: (vm, ops, ctx) => h_jg(vm, ops, ctx),
});

TABLE_2OP[0x04] = d2(0x04, {
  name: "dec_chk",
  operandKinds: ["small", "var"],
  doesBranch: true,
  handler: (vm, ops, ctx) => h_dec_chk(vm, ops, ctx),
});

TABLE_2OP[0x05] = d2(0x05, {
  name: "inc_chk",
  operandKinds: ["small", "var"],
  doesBranch: true,
  handler: (vm, ops, ctx) => h_inc_chk(vm, ops, ctx),
});

TABLE_2OP[0x06] = d2(0x06, {
  name: "jin",
  operandKinds: ["var", "var"],
  doesBranch: true,
  handler: (vm, ops, ctx) => h_jin(vm, ops, ctx),
});

TABLE_2OP[0x07] = d2(0x07, {
  name: "test",
  operandKinds: ["var", "var"],
  doesBranch: true,
  handler: (vm, ops, ctx) => h_test(vm, ops, ctx),
});

TABLE_2OP[0x08] = d2(0x08, {
  name: "or",
  operandKinds: ["var", "var"],
  doesStore: true,
  handler: (vm, ops) => h_or(vm, ops),
});

TABLE_2OP[0x09] = d2(0x09, {
  name: "and",
  operandKinds: ["var", "var"],
  doesStore: true,
  handler: (vm, ops) => h_and(vm, ops),
});

TABLE_2OP[0x0a] = d2(0x0a, {
  name: "test_attr",
  operandKinds: ["var", "var"],
  doesBranch: true,
  handler: (vm, ops, ctx) => h_test_attr(vm, ops, ctx),
});

TABLE_2OP[0x0b] = d2(0x0b, {
  name: "set_attr",
  operandKinds: ["var", "var"],
  handler: (vm, ops) => h_set_attr(vm, ops),
});

TABLE_2OP[0x0c] = d2(0x0c, {
  name: "clear_attr",
  operandKinds: ["var", "var"],
  handler: (vm, ops) => h_clear_attr(vm, ops),
});

TABLE_2OP[0x0d] = d2(0x0d, {
  name: "store",
  operandKinds: ["small", "var"],
  handler: (vm, ops) => h_store(vm, ops),
});

TABLE_2OP[0x0e] = d2(0x0e, {
  name: "insert_obj",
  operandKinds: ["var", "var"],
  handler: (vm, ops) => h_insert_obj(vm, ops),
});

TABLE_2OP[0x0f] = d2(0x0f, {
  name: "loadw",
  operandKinds: ["var", "var"],
  doesStore: true,
  handler: (vm, ops, ctx) => h_loadw(vm, ops, ctx),
});

TABLE_2OP[0x10] = d2(0x10, {
  name: "loadb",
  operandKinds: ["var", "var"],
  doesStore: true,
  handler: (vm, ops, ctx) => h_loadb(vm, ops, ctx),
});

TABLE_2OP[0x11] = d2(0x11, {
  name: "get_prop",
  operandKinds: ["var", "var"],
  doesStore: true,
  handler: (vm, ops, ctx) => h_get_prop(vm, ops, ctx),
});

TABLE_2OP[0x12] = d2(0x12, {
  name: "get_prop_addr",
  operandKinds: ["var", "var"],
  doesStore: true,
  handler: (vm, ops, ctx) => h_get_prop_addr(vm, ops, ctx),
});

TABLE_2OP[0x13] = d2(0x13, {
  name: "get_next_prop",
  operandKinds: ["var", "var"],
  doesStore: true,
  handler: (vm, ops, ctx) => h_get_next_prop(vm, ops, ctx),
});

// Note: put_prop has 3 operands, but 2OP form only supports 2
// It's typically called in VAR form

TABLE_2OP[0x14] = d2(0x14, {
  name: "add",
  operandKinds: ["var", "var"],
  doesStore: true,
  handler: (vm, ops) => h_add(vm, ops),
});

TABLE_2OP[0x15] = d2(0x15, {
  name: "sub",
  operandKinds: ["var", "var"],
  doesStore: true,
  handler: (vm, ops) => h_sub(vm, ops),
});

TABLE_2OP[0x16] = d2(0x16, {
  name: "mul",
  operandKinds: ["var", "var"],
  doesStore: true,
  handler: (vm, ops) => h_mul(vm, ops),
});

TABLE_2OP[0x17] = d2(0x17, {
  name: "div",
  operandKinds: ["var", "var"],
  doesStore: true,
  handler: (vm, ops) => h_div(vm, ops),
});

TABLE_2OP[0x18] = d2(0x18, {
  name: "mod",
  operandKinds: ["var", "var"],
  doesStore: true,
  handler: (vm, ops) => h_mod(vm, ops),
});

TABLE_2OP[0x19] = d2(0x19, {
  name: "call_2s",
  minVersion: 4,
  doesStore: true,
  handler: (vm, ops, ctx) => h_call_2s(vm, ops, ctx),
});

// TABLE_2OP[0x1a] = call_2n (v5+) - TODO: implement
// TABLE_2OP[0x1b] = set_colour (v5+) - TODO: implement
// TABLE_2OP[0x1c] = throw (v5+) - TODO: implement

// --- VAR opcodes ---
// NOTE: VAR opcodes have variable-length operand lists (0-4 operands typically)
// The operandKinds field is omitted because operand types are encoded in a separate byte
// VAR opcodes use the full byte value 0xE0-0xFF as the index

TABLE_VAR[0xe0] = dv(0xe0, {
  name: "call",
  doesStore: true,
  handler: (vm, ops, ctx) => h_call(vm, ops, ctx),
});

TABLE_VAR[0xe1] = dv(0xe1, {
  name: "storew",
  handler: (vm, ops) => h_storew(vm, ops),
});

TABLE_VAR[0xe2] = dv(0xe2, {
  name: "storeb",
  handler: (vm, ops) => h_storeb(vm, ops),
});

TABLE_VAR[0xe3] = dv(0xe3, {
  name: "put_prop",
  handler: (vm, ops) => h_put_prop(vm, ops),
});

TABLE_VAR[0xe4] = dv(0xe4, {
  name: "sread",
  handler: (vm, ops) => h_sread(vm, ops),
});

TABLE_VAR[0xe5] = dv(0xe5, {
  name: "print_char",
  handler: (vm, ops) => h_print_char(vm, ops),
});

TABLE_VAR[0xe6] = dv(0xe6, {
  name: "print_num",
  handler: (vm, ops) => h_print_num(vm, ops),
});

TABLE_VAR[0xe7] = dv(0xe7, {
  name: "random",
  doesStore: true,
  handler: (vm, ops, ctx) => h_random(vm, ops, ctx),
});

TABLE_VAR[0xe8] = dv(0xe8, {
  name: "push",
  handler: (vm, ops) => h_push(vm, ops),
});

TABLE_VAR[0xe9] = dv(0xe9, {
  name: "pull",
  minVersion: 5,
  handler: (vm, ops) => h_pull(vm, ops),
});

TABLE_VAR[0xea] = dv(0xea, {
  name: "split_window",
  minVersion: 3,
  handler: (vm, ops) => h_split_window(vm, ops),
});

TABLE_VAR[0xeb] = dv(0xeb, {
  name: "set_window",
  minVersion: 3,
  handler: (vm, ops) => h_set_window(vm, ops),
});

TABLE_VAR[0xec] = dv(0xec, {
  name: "call_vs2",
  minVersion: 4,
  doesStore: true,
  handler: (vm, ops, ctx) => h_call(vm, ops, ctx),
});

TABLE_VAR[0xed] = dv(0xed, {
  name: "erase_window",
  minVersion: 4,
  handler: (vm, ops) => h_erase_window(vm, ops),
});

TABLE_VAR[0xee] = dv(0xee, {
  name: "erase_line",
  minVersion: 4,
  handler: (vm, ops) => h_erase_line(vm, ops),
});

TABLE_VAR[0xef] = dv(0xef, {
  name: "set_cursor",
  minVersion: 4,
  handler: (vm, ops) => h_set_cursor(vm, ops),
});

TABLE_VAR[0xf0] = dv(0xf0, {
  name: "get_cursor",
  minVersion: 4,
  handler: (vm, ops) => h_get_cursor(vm, ops),
});

TABLE_VAR[0xf1] = dv(0xf1, {
  name: "set_text_style",
  minVersion: 4,
  handler: (vm, ops) => h_set_text_style(vm, ops),
});

TABLE_VAR[0xf2] = dv(0xf2, {
  name: "buffer_mode",
  minVersion: 4,
  handler: (vm, ops) => h_buffer_mode(vm, ops),
});

TABLE_VAR[0xf3] = dv(0xf3, {
  name: "output_stream",
  minVersion: 3,
  handler: (vm, ops) => h_output_stream(vm, ops),
});

TABLE_VAR[0xf4] = dv(0xf4, {
  name: "input_stream",
  minVersion: 3,
  handler: (vm, ops) => h_input_stream(vm, ops),
});

TABLE_VAR[0xf5] = dv(0xf5, {
  name: "sound_effect",
  minVersion: 3,
  handler: (vm, ops) => h_sound_effect(vm, ops),
});

TABLE_VAR[0xf6] = dv(0xf6, {
  name: "read_char",
  minVersion: 4,
  doesStore: true,
  handler: async (vm, ops, ctx) => await h_read_char(vm, ops, ctx),
});

// TABLE_VAR[0xf7] = scan_table (v4+) - TODO: implement h_scan_table

TABLE_VAR[0xf8] = dv(0xf8, {
  name: "not",
  minVersion: 5,
  doesStore: true,
  handler: (vm, ops) => h_not(vm, ops),
});
// TABLE_VAR[0xf9] = call_vn (v5+) - TODO
// TABLE_VAR[0xfa] = call_vn2 (v5+) - TODO
// TABLE_VAR[0xfb] = tokenise (v5+) - TODO
// TABLE_VAR[0x1a] = not (v1-4) - handled by 0x0c above
// TABLE_VAR[0x1b] = call_vn (v5+) - TODO
// TABLE_VAR[0x1c] = call_vn2 (v5+) - TODO
// TABLE_VAR[0x1d] = tokenise (v5+) - TODO

TABLE_VAR[0x1e] = dv(0x1e, {
  name: "print_table",
  minVersion: 5,
  handler: (vm, ops) => h_print_table(vm, ops),
});

// TABLE_VAR[0x1f] = check_arg_count (v5+) - TODO

// --- EXT opcodes (Extended opcodes, v5+) ---
// NOTE: EXT opcodes are accessed via the 0xBE prefix byte
// They have variable-length operand lists like VAR opcodes

// TABLE_EXT[0x00] = save (v5+) - store result, TODO: implement file I/O
// TABLE_EXT[0x01] = restore (v5+) - store result, TODO: implement file I/O

TABLE_EXT[0x02] = {
  name: "log_shift",
  kind: "EXT",
  opcode: 0x02,
  minVersion: 5,
  doesStore: true,
  handler: (vm, ops, ctx) => h_log_shift(vm, ops, ctx),
};

TABLE_EXT[0x03] = {
  name: "art_shift",
  kind: "EXT",
  opcode: 0x03,
  minVersion: 5,
  doesStore: true,
  handler: (vm, ops, ctx) => h_art_shift(vm, ops, ctx),
};

TABLE_EXT[0x04] = {
  name: "set_font",
  kind: "EXT",
  opcode: 0x04,
  minVersion: 5,
  doesStore: true,
  handler: (vm, ops, ctx) => h_set_font(vm, ops, ctx),
};

// TABLE_EXT[0x05] = draw_picture (v6) - TODO: implement graphics
// TABLE_EXT[0x06] = picture_data (v6) - branch, TODO: implement graphics
// TABLE_EXT[0x07] = erase_picture (v6) - TODO: implement graphics
// TABLE_EXT[0x08] = set_margins (v6) - TODO: implement

TABLE_EXT[0x09] = {
  name: "save_undo",
  kind: "EXT",
  opcode: 0x09,
  minVersion: 5,
  doesStore: true,
  handler: (vm, ops, ctx) => h_save_undo(vm, ops, ctx),
};

TABLE_EXT[0x0a] = {
  name: "restore_undo",
  kind: "EXT",
  opcode: 0x0a,
  minVersion: 5,
  doesStore: true,
  handler: (vm, ops, ctx) => h_restore_undo(vm, ops, ctx),
};

TABLE_EXT[0x0b] = {
  name: "print_unicode",
  kind: "EXT",
  opcode: 0x0b,
  minVersion: 5,
  handler: (vm, ops) => h_print_unicode(vm, ops),
};

TABLE_EXT[0x0c] = {
  name: "check_unicode",
  kind: "EXT",
  opcode: 0x0c,
  minVersion: 5,
  doesStore: true,
  handler: (vm, ops, ctx) => h_check_unicode(vm, ops, ctx),
};

// TABLE_EXT[0x0d] = set_true_colour (v5+) - TODO: implement
// TABLE_EXT[0x10] = move_window (v6) - TODO: implement
// TABLE_EXT[0x11] = window_size (v6) - TODO: implement
// TABLE_EXT[0x12] = window_style (v6) - TODO: implement
// TABLE_EXT[0x13] = get_wind_prop (v6) - store result, TODO: implement
// TABLE_EXT[0x14] = scroll_window (v6) - TODO: implement
// TABLE_EXT[0x15] = pop_stack (v6) - TODO: implement
// TABLE_EXT[0x16] = read_mouse (v6) - TODO: implement
// TABLE_EXT[0x17] = mouse_window (v6) - TODO: implement
// TABLE_EXT[0x18] = push_stack (v6) - branch, TODO: implement
// TABLE_EXT[0x19] = put_wind_prop (v6) - TODO: implement
// TABLE_EXT[0x1a] = print_form (v6) - TODO: implement
// TABLE_EXT[0x1b] = make_menu (v6) - branch, TODO: implement
// TABLE_EXT[0x1c] = picture_table (v6) - TODO: implement
// TABLE_EXT[0x1d] = buffer_screen (v6) - store result, TODO: implement

// Most EXT opcodes are for advanced features (graphics, sound, menus) in v6
// and are rarely used in practice. Placeholders provided for completeness.
