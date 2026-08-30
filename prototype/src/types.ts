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

// A custom, syllabus-facing title for a class session — deliberately
// separate from the "Class N" tab label (which stays generic/numbered by
// design), and separate from Lesson, since you might want to name a class
// on the syllabus before you've written its lesson content. Sparse: only
// classes with a custom title have an entry here.
export interface ClassSession {
  classNumber: number;
  title: string;
}

// One stage of a "prompt" LessonSegment — shown for `durationMinutes`
// during a live class before the next stage auto-reveals. `text` is plain
// text, not rich HTML, since PromptRunner displays it large/read-only
// rather than editing it inline.
export interface PromptStage {
  id: string;
  text: string;
  durationMinutes: number;
}

// A single block of a lesson, in display order. `html` is rich text
// produced by a contentEditable region (bold/italic/underline/lists via
// document.execCommand) — trusted content since only the instructor can
// author it, same trust boundary as everything else in this prototype.
// `kind` defaults to plain content when absent. "assignment" segments use
// startAt/dueAt (rendered as a downloadable .ics event; there's no backend
// to actually send reminder emails, see LessonEditor). "prompt" segments
// use `stages` — a multi-stage in-class writing prompt run live via
// PromptRunner, e.g. stage 1 shown for 5 minutes, then stage 2 reveals.
export interface LessonSegment {
  id: string;
  heading: string;
  html: string;
  kind?: "content" | "assignment" | "prompt";
  startAt?: string;
  dueAt?: string;
  stages?: PromptStage[];
  // Per-segment collapse state in the lesson editor, persisted so a long
  // lesson reopens the way the instructor left it. Absent/false means
  // expanded.
  collapsed?: boolean;
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

// A reading added by pasting a link — there's no backend to fetch the
// linked page's real title (would need a server-side fetch to dodge CORS),
// so `title` is a simple heuristic derived from the URL itself at add time.
export interface Reading {
  id: string;
  classNumber: number;
  url: string;
  title: string;
  addedAt: string;
}

// "Optional" community extras (tktk-seb.3) — polls and office hours are
// deliberately minimal since the stakeholder marked this whole group
// optional, and this app is still instructor-only (no student view), so
// there's no real self-serve student interaction yet for either.
export interface PollOption {
  id: string;
  label: string;
  voterIds: string[];
}

export interface Poll {
  id: string;
  classNumber: number;
  question: string;
  options: PollOption[];
}

// bookedByStudentId is instructor-assigned for now — there's no student
// view yet for a participant to self-serve book a slot.
export interface OfficeHoursSlot {
  id: string;
  startAt: string;
  endAt: string;
  bookedByStudentId?: string;
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
