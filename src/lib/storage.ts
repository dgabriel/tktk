import {
  comments as seedComments,
  overlayStrokes as seedOverlayStrokes,
  poems as seedPoems,
  replies as seedReplies,
  students as seedStudents,
  workshop as seedWorkshop,
} from "../data/seedData";
import type { Comment, OverlayStroke, Poem, Reply, Student, Workshop } from "../types";

const STORAGE_KEY = "tktk:v12";

interface AppState {
  workshop: Workshop;
  students: Student[];
  poems: Poem[];
  comments: Comment[];
  overlayStrokes: OverlayStroke[];
  replies: Reply[];
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
