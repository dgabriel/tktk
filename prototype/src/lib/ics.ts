import { downloadTextFile } from "./download";
import type { LessonSegment } from "../types";

function formatIcsDate(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function escapeIcsText(text: string): string {
  return text.replace(/([,;])/g, "\\$1");
}

// No backend here to actually send reminder emails — this is the
// functional stand-in for "optionally puts things on their calendars"
// from the original ask: a real .ics file the instructor can download and
// forward, or students can import once there's a student view. Shared by
// the lesson editor and the read-only class view, since both let you
// download an assignment's due date.
export function downloadAssignmentIcs(segment: LessonSegment, workshopName: string) {
  if (!segment.dueAt) return;
  const dtStamp = formatIcsDate(new Date());
  const dtStart = formatIcsDate(new Date(segment.dueAt));
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//tktk//lesson assignment//EN",
    "BEGIN:VEVENT",
    `UID:${segment.id}@tktk`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `SUMMARY:${escapeIcsText(segment.heading || "Assignment")} — ${escapeIcsText(workshopName)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  downloadTextFile(`${segment.heading || "assignment"}.ics`, ics, "text/calendar");
}
