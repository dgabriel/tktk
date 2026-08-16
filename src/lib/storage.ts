import {
  comments as seedComments,
  lessons as seedLessons,
  officeHoursSlots as seedOfficeHoursSlots,
  overlayStrokes as seedOverlayStrokes,
  poems as seedPoems,
  polls as seedPolls,
  readings as seedReadings,
  replies as seedReplies,
  students as seedStudents,
  workshop as seedWorkshop,
} from "../data/seedData";
import type {
  Comment,
  Lesson,
  OfficeHoursSlot,
  OverlayStroke,
  Poem,
  Poll,
  Reading,
  Reply,
  Student,
  Workshop,
} from "../types";

const STORAGE_KEY = "tktk:v16";

interface AppState {
  workshop: Workshop;
  students: Student[];
  poems: Poem[];
  comments: Comment[];
  overlayStrokes: OverlayStroke[];
  replies: Reply[];
  lessons: Lesson[];
  readings: Reading[];
  polls: Poll[];
  officeHoursSlots: OfficeHoursSlot[];
  currentUser: { username: string; fullName: string };
}

function loadState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    return JSON.parse(raw) as AppState;
  }
  const initial: AppState = {
    workshop: seedWorkshop,
    students: seedStudents,
    poems: seedPoems,
    comments: seedComments,
    overlayStrokes: seedOverlayStrokes,
    replies: seedReplies,
    lessons: seedLessons,
    readings: seedReadings,
    polls: seedPolls,
    officeHoursSlots: seedOfficeHoursSlots,
    currentUser: { username: "scha", fullName: "Sam Cha" },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getState(): AppState {
  return loadState();
}

export function resetState(): AppState {
  localStorage.removeItem(STORAGE_KEY);
  return loadState();
}

export function getCommentsForPoem(poemId: string): Comment[] {
  return loadState().comments.filter((comment) => comment.poemId === poemId);
}

export function addComment(input: {
  poemId: string;
  authorId: string;
  start: number;
  end: number;
  excerpt: string;
  text: string;
}): Comment {
  const state = loadState();
  const comment: Comment = {
    id: `${input.poemId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  state.comments.push(comment);
  saveState(state);
  return comment;
}

export function editComment(commentId: string, text: string): Comment | undefined {
  const state = loadState();
  const comment = state.comments.find((candidate) => candidate.id === commentId);
  if (!comment) return undefined;
  comment.text = text;
  saveState(state);
  return comment;
}

export function deleteComment(commentId: string): void {
  const state = loadState();
  state.comments = state.comments.filter((comment) => comment.id !== commentId);
  state.replies = state.replies.filter((reply) => reply.parentId !== commentId);
  saveState(state);
}

export function getStrokesForPoem(poemId: string): OverlayStroke[] {
  return loadState().overlayStrokes.filter((stroke) => stroke.poemId === poemId);
}

export function saveStroke(input: {
  poemId: string;
  authorId: string;
  points: OverlayStroke["points"];
}): OverlayStroke {
  const state = loadState();
  const stroke: OverlayStroke = {
    id: `${input.poemId}-stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  state.overlayStrokes.push(stroke);
  saveState(state);
  return stroke;
}

export function replaceStrokesForPoem(poemId: string, strokes: OverlayStroke[]): void {
  const state = loadState();
  state.overlayStrokes = [
    ...state.overlayStrokes.filter((stroke) => stroke.poemId !== poemId),
    ...strokes,
  ];
  saveState(state);
}

// Scoped to a single author — "Clear marks" must only ever remove the
// current viewer's own strokes, never a classmate's, even though all
// authors' strokes for a poem live in the same flat array.
export function clearStrokesForPoem(poemId: string, authorId: string): void {
  const state = loadState();
  const removedIds = new Set(
    state.overlayStrokes
      .filter((stroke) => stroke.poemId === poemId && stroke.authorId === authorId)
      .map((stroke) => stroke.id),
  );
  state.overlayStrokes = state.overlayStrokes.filter((stroke) => !removedIds.has(stroke.id));
  state.replies = state.replies.filter((reply) => !removedIds.has(reply.parentId));
  saveState(state);
}

export function setStrokeComment(strokeId: string, comment: string): OverlayStroke | undefined {
  const state = loadState();
  const stroke = state.overlayStrokes.find((candidate) => candidate.id === strokeId);
  if (!stroke) return undefined;
  stroke.comment = comment;
  saveState(state);
  return stroke;
}

export function clearStrokeComment(strokeId: string): OverlayStroke | undefined {
  const state = loadState();
  const stroke = state.overlayStrokes.find((candidate) => candidate.id === strokeId);
  if (!stroke) return undefined;
  delete stroke.comment;
  state.replies = state.replies.filter((reply) => reply.parentId !== strokeId);
  saveState(state);
  return stroke;
}

export function getRepliesForPoem(poemId: string): Reply[] {
  return loadState().replies.filter((reply) => reply.poemId === poemId);
}

export function addReply(input: { poemId: string; parentId: string; authorId: string; text: string }): Reply {
  const state = loadState();
  const reply: Reply = {
    id: `${input.parentId}-reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  state.replies.push(reply);
  saveState(state);
  return reply;
}

export function deleteReply(replyId: string): void {
  const state = loadState();
  state.replies = state.replies.filter((reply) => reply.id !== replyId);
  saveState(state);
}

export function getLessonForClass(classNumber: number): Lesson | undefined {
  return loadState().lessons.find((lesson) => lesson.classNumber === classNumber);
}

export function saveLesson(lesson: Lesson): Lesson {
  const state = loadState();
  const index = state.lessons.findIndex((candidate) => candidate.id === lesson.id);
  if (index === -1) state.lessons.push(lesson);
  else state.lessons[index] = lesson;
  saveState(state);
  return lesson;
}

export function getReadingsForClass(classNumber: number): Reading[] {
  return loadState().readings.filter((reading) => reading.classNumber === classNumber);
}

export function getReading(readingId: string): Reading | undefined {
  return loadState().readings.find((reading) => reading.id === readingId);
}

export function addReading(input: { classNumber: number; url: string; title: string }): Reading {
  const state = loadState();
  const reading: Reading = {
    id: `reading-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    addedAt: new Date().toISOString(),
    ...input,
  };
  state.readings.push(reading);
  saveState(state);
  return reading;
}

// Cascades to comments/replies the same way deleteComment does for poem
// comments — an orphaned reading shouldn't leave its feedback thread
// dangling in the sidebar of a page that no longer exists.
export function deleteReading(readingId: string): void {
  const state = loadState();
  state.readings = state.readings.filter((reading) => reading.id !== readingId);
  const orphanedCommentIds = new Set(
    state.comments.filter((comment) => comment.poemId === readingId).map((comment) => comment.id),
  );
  state.comments = state.comments.filter((comment) => comment.poemId !== readingId);
  state.replies = state.replies.filter(
    (reply) => reply.poemId !== readingId && !orphanedCommentIds.has(reply.parentId),
  );
  saveState(state);
}

export function getPollsForClass(classNumber: number): Poll[] {
  return loadState().polls.filter((poll) => poll.classNumber === classNumber);
}

export function addPoll(input: { classNumber: number; question: string; optionLabels: string[] }): Poll {
  const state = loadState();
  const poll: Poll = {
    id: `poll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    classNumber: input.classNumber,
    question: input.question,
    options: input.optionLabels.map((label, index) => ({
      id: `poll-${Date.now()}-opt-${index}-${Math.random().toString(36).slice(2, 6)}`,
      label,
      voterIds: [],
    })),
  };
  state.polls.push(poll);
  saveState(state);
  return poll;
}

export function deletePoll(pollId: string): void {
  const state = loadState();
  state.polls = state.polls.filter((poll) => poll.id !== pollId);
  saveState(state);
}

// Single-choice voting: picking a new option in the same poll removes any
// existing vote from the voter's other options first. Voting for the
// option you already picked un-votes it (toggle).
export function toggleVote(pollId: string, optionId: string, voterId: string): Poll | undefined {
  const state = loadState();
  const poll = state.polls.find((candidate) => candidate.id === pollId);
  if (!poll) return undefined;
  const target = poll.options.find((option) => option.id === optionId);
  if (!target) return undefined;
  const alreadyVoted = target.voterIds.includes(voterId);
  for (const option of poll.options) {
    option.voterIds = option.voterIds.filter((id) => id !== voterId);
  }
  if (!alreadyVoted) target.voterIds.push(voterId);
  saveState(state);
  return poll;
}

export function getOfficeHoursSlots(): OfficeHoursSlot[] {
  return loadState().officeHoursSlots;
}

export function addOfficeHoursSlot(input: { startAt: string; endAt: string }): OfficeHoursSlot {
  const state = loadState();
  const slot: OfficeHoursSlot = {
    id: `office-hours-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...input,
  };
  state.officeHoursSlots.push(slot);
  saveState(state);
  return slot;
}

export function deleteOfficeHoursSlot(slotId: string): void {
  const state = loadState();
  state.officeHoursSlots = state.officeHoursSlots.filter((slot) => slot.id !== slotId);
  saveState(state);
}

export function setOfficeHoursBooking(slotId: string, studentId: string | undefined): OfficeHoursSlot | undefined {
  const state = loadState();
  const slot = state.officeHoursSlots.find((candidate) => candidate.id === slotId);
  if (!slot) return undefined;
  slot.bookedByStudentId = studentId;
  saveState(state);
  return slot;
}
