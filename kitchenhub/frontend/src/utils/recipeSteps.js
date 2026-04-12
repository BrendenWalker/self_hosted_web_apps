/**
 * Split free-form recipe instructions into discrete steps for cooking mode.
 *
 * Rules (in order):
 * 1. Trim; empty → [].
 * 2. Split on one or more blank lines (paragraphs). Non-empty chunks are steps
 *    (multi-line paragraphs stay one step).
 * 3. If that yields exactly one chunk, split that chunk on single newlines;
 *    each non-empty line is a step (typical “one step per line” in the editor).
 * 4. If still one blob with no internal newlines, return one step.
 */
export function parseRecipeSteps(instructions) {
  if (instructions == null) return [];
  const raw = String(instructions).replace(/\r\n/g, '\n').trim();
  if (!raw) return [];

  const byParagraphs = raw
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (byParagraphs.length > 1) {
    return byParagraphs;
  }

  const single = byParagraphs[0] ?? raw;
  const byLines = single
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  if (byLines.length > 1) {
    return byLines;
  }

  return [single];
}
