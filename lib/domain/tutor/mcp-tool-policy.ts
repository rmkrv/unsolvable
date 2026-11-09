const READ_ONLY_TOOLS = new Set([
  "observe_board",
  "verify_arithmetic_equation",
  "verify_math_step",
]);

const DESTRUCTIVE_TOOLS = new Set([
  "board_delete_strokes",
  "board_manage_page",
  "board_erase",
]);

const IDEMPOTENT_WRITE_TOOLS = new Set([
  "board_set_hint_level",
]);

export function boardToolAnnotations(name: string) {
  const readOnly = READ_ONLY_TOOLS.has(name);
  return {
    readOnlyHint: readOnly,
    destructiveHint: DESTRUCTIVE_TOOLS.has(name),
    idempotentHint: readOnly || IDEMPOTENT_WRITE_TOOLS.has(name),
    openWorldHint: false,
  };
}
