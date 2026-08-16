import { getState } from "./storage";
import type { Author } from "../types";

function initialsFromName(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

// authorId (on Comment, Reply, and OverlayStroke) is either a Student.id or
// the current user's username — resolves either into display info at
// render time. Falls back to the current user if an id is somehow
// unrecognized (shouldn't happen with real data, but keeps rendering from
// breaking). Shared by PoemFeedback and ReadingFeedback rather than
// duplicated per page.
export function resolveAuthor(authorId: string): Author {
  const { students, currentUser } = getState();
  if (authorId === currentUser.username) {
    return { name: currentUser.fullName, initials: initialsFromName(currentUser.fullName) };
  }
  const student = students.find((candidate) => candidate.id === authorId);
  if (student) return { name: student.name, initials: student.initials };
  return { name: currentUser.fullName, initials: initialsFromName(currentUser.fullName) };
}
