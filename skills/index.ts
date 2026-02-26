export interface PlaygroundSkill {
  /** Short identifier used for slash commands, e.g. `/frontend-design` */
  id: string;
  /** Human-friendly name shown in the picker */
  label: string;
  /** One-line description shown in the picker */
  description: string;
  /** Prompt text that will be prepended to iteration prompts when this skill is active */
  systemPrompt: string;
}
