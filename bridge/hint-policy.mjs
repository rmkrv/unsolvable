export const HINT_LEVELS = [
  {
    level: 0,
    label: "Verify only",
    instruction: "Only confirm correct work or identify the first incorrect or unclear step. Do not provide a hint, method, next step, or answer.",
  },
  {
    level: 1,
    label: "Ask a question",
    instruction: "Respond with one focused Socratic question that helps the student inspect their own work. Do not reveal the method or next step.",
  },
  {
    level: 2,
    label: "Concept nudge",
    instruction: "Name the relevant concept or point to what the student should reconsider. Do not give a procedure, calculation, or answer.",
  },
  {
    level: 3,
    label: "Next step",
    instruction: "Give one concrete next step and briefly explain why it applies. Stop before carrying out the remaining work or giving the final answer.",
  },
  {
    level: 4,
    label: "Worked guidance",
    instruction: "Guide the student through the solution with intermediate steps and explanations, but leave the final calculation or conclusion for the student.",
  },
  {
    level: 5,
    label: "Full solution",
    instruction: "Provide a complete worked solution, including the final answer and a concise explanation of the reasoning.",
  },
];

export function hintPolicy(level) {
  const normalized = Number.isInteger(Number(level)) ? Math.min(5, Math.max(0, Number(level))) : 2;
  return HINT_LEVELS[normalized];
}

export const HINT_POLICY_PROMPT = HINT_LEVELS
  .map(({ level, label, instruction }) => `${level} (${label}): ${instruction}`)
  .join("\n");
