export interface Student {
  id: string;
  name: string;
  bio: string;
  workshops: string[];
  initials: string;
}

export interface Poem {
  id: string;
  title: string;
  studentId: string;
  status: "awaiting_feedback" | "feedback_given";
  classNumber: number;
  body: string;
}

// A single block of a lesson, in display order. `html` is rich text
// produced by a contentEditable region (bold/italic/underline/lists via
// document.execCommand) — trusted content since only the instructor can
// author it, same trust boundary as everything else in this prototype.
// `kind` defaults to plain content when absent — only "assignment"
// segments use startAt/dueAt (rendered as a downloadable .ics event;
// there's no backend to actually send reminder emails, see LessonEditor).
export interface LessonSegment {
  id: string;
  heading: string;
  html: string;
  kind?: "content" | "assignment";
  startAt?: string;
  dueAt?: string;
}

// One per class session (`classNumber` matches Workshop.totalClasses'
// numbering, same as Poem.classNumber) — not every class necessarily has a
// Lesson yet, so callers look this up by class number and handle "none".
// `openAt`, if set, is an ISO datetime for when the lesson becomes visible
// to students — there's no student view yet (see PoemFeedback's
// currentUser note in CLAUDE.md), so this only drives an instructor-facing
// "opens at / already open" status for now, not real access gating.
export interface Lesson {
  id: string;
  classNumber: number;
  segments: LessonSegment[];
  openAt?: string;
}

export interface Workshop {
  name: string;
  instructor: string;
  totalClasses: number;
  location: string;
  meetingTime: string;
}

// Resolved display info for whoever left a Comment/Reply — computed at
// render time from `authorId` (see `getAuthor` in PoemFeedback.tsx), not
// stored. There's no separate persisted Author entity.
export interface Author {
  name: string;
  initials: string;
}

// `authorId` is a Student.id, or the current user's username ("scha" for the
// instructor) — whichever left the comment.
export interface Comment {
  id: string;
  poemId: string;
  authorId: string;
  start: number;
  end: number;
  excerpt: string;
  text: string;
  createdAt: string;
}

export interface OverlayPoint {
  x: number;
  y: number;
}

// A single freehand pen stroke drawn over a poem. `points` are fractions
// (0..1) of the poem body's content box, not pixels, so a stroke drawn on
// one device renders in the same relative place on any other screen size.
// `comment` is an optional note attached to the mark itself (e.g. "arrow
// pointing at the line break") — separate from the text-selection Comment
// system above, and not yet unified with it. `authorId` follows the same
// convention as Comment.authorId — it's what the Markup "View: [author]"
// selector filters on.
export interface OverlayStroke {
  id: string;
  poemId: string;
  authorId: string;
  points: OverlayPoint[];
  comment?: string;
  createdAt: string;
}

// A flat reply on either kind of comment — `parentId` is a Comment.id or an
// OverlayStroke.id (both are unique strings, so one Reply shape works for
// both). Replies can't themselves be replied to; this is a single-level
// thread, not a nested tree. `authorId` follows the same convention as
// Comment.authorId above.
export interface Reply {
  id: string;
  poemId: string;
  parentId: string;
  authorId: string;
  text: string;
  createdAt: string;
}
