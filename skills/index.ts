export interface PlaygroundSkill {
  /** Short identifier used for slash commands, e.g. `/frontend-design` */
  id: string;
  /** Human-friendly name shown in the picker */
  label: string;
  /** One-line description shown in the picker */
  description: string;
  /** Full SKILL.md body (excluding frontmatter). Present in the API for tooling; prompts use `skillPath` instead of inlining this. */
  systemPrompt: string;
  /** Repo-relative path to SKILL.md (forward slashes), e.g. `src/app/playground/skills/foo/SKILL.md` */
  skillPath: string;
}
