import type { LessonSegment } from "../types";

export type SegmentKind = "content" | "assignment" | "prompt";

export function kindOf(kind: LessonSegment["kind"]): SegmentKind {
  return kind === "assignment" || kind === "prompt" ? kind : "content";
}

// "Content" is the unmarked default (most segments are this), so callers
// that only want to call out the two that aren't (e.g. the outline list)
// get null back for it — the colored dot alone isn't reliably legible
// without a legend.
export function kindLabel(kind: SegmentKind): string | null {
  if (kind === "assignment") return "Assignment";
  if (kind === "prompt") return "Prompt";
  return null;
}

// Same three labels, but always non-null (used where "Content" itself is
// useful to say out loud, e.g. a tooltip prefix, rather than left implicit).
export function kindDisplayLabel(kind: SegmentKind): string {
  return kindLabel(kind) ?? "Content";
}
