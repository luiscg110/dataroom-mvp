/**
 * Mirrors backend `next_collision_name`.
 * If `name` exists in `siblings`, append / bump " (n)" before the extension.
 */
export function nextCollisionName(name: string, siblings: Set<string>): string {
  if (!siblings.has(name)) return name;

  const { base, ext } = splitExt(name);
  const m = base.match(/^(.*)\s\((\d+)\)$/);
  let stem = base;
  let n = 1;

  if (m) {
    stem = m[1];
    n = parseInt(m[2], 10) + 1;
  }

  let candidate = `${stem} (${n})${ext}`;
  while (siblings.has(candidate)) {
    n += 1;
    candidate = `${stem} (${n})${ext}`;
  }
  return candidate;
}

function splitExt(name: string): { base: string; ext: string } {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return { base: name, ext: "" };
  return { base: name.slice(0, idx), ext: name.slice(idx) };
}
