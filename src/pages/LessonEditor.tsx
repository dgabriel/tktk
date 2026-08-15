import { useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { getLessonForClass, getState, saveLesson } from "../lib/storage";
import type { LessonSegment } from "../types";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Bonus "auto-segmented by headings" import: paste plain text where lines
// starting with 1-3 "#" characters mark a new segment heading (markdown
// convention) — everything until the next heading line becomes that
// segment's body, one <p> per blank-line-separated paragraph. Anything
// before the first heading lands in a leading "Untitled" segment rather
// than being silently dropped.
function parseIntoSegments(raw: string): LessonSegment[] {
  const lines = raw.split("\n");
  const blocks: { heading: string; bodyLines: string[] }[] = [];
  for (const line of lines) {
    const headingMatch = /^#{1,3}\s+(.*)/.exec(line);
    if (headingMatch) {
      blocks.push({ heading: headingMatch[1].trim(), bodyLines: [] });
    } else if (blocks.length > 0) {
      blocks[blocks.length - 1].bodyLines.push(line);
    } else if (line.trim()) {
      blocks.push({ heading: "Untitled", bodyLines: [line] });
    }
  }
  return blocks.map((block) => ({
    id: generateId("segment"),
    heading: block.heading,
    html: block.bodyLines
      .join("\n")
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join(""),
  }));
}

function formatIcsDate(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function escapeIcsText(text: string): string {
  return text.replace(/([,;])/g, "\\$1");
}

// No backend here to actually send reminder emails — this is the
// functional stand-in for "optionally puts things on their calendars"
// from the original ask: a real .ics file the instructor can download
// and forward, or students can import once there's a student view.
function downloadAssignmentIcs(segment: LessonSegment, workshopName: string) {
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

  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${segment.heading || "assignment"}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function LessonEditor() {
  const { classNumber: classNumberParam } = useParams<{ classNumber: string }>();
  const classNumber = Number(classNumberParam);
  const { workshop } = getState();

  const [segments, setSegments] = useState<LessonSegment[]>(() => {
    const existing = getLessonForClass(classNumber);
    return existing ? existing.segments : [];
  });
  const [lessonId] = useState(() => getLessonForClass(classNumber)?.id ?? generateId("lesson"));
  const [openAt, setOpenAt] = useState(() => getLessonForClass(classNumber)?.openAt ?? "");
  const [importText, setImportText] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const bodyRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const segmentRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const dragIndexRef = useRef<number | null>(null);

  // contentEditable bodies are deliberately uncontrolled — see bodyRefs.
  // This reads whatever's currently in the DOM back into `segments` before
  // any operation (save, reorder, add, delete) that depends on having an
  // up-to-date `.html`, without fighting React for the cursor on every
  // keystroke in between.
  function syncBodiesFromDom(current: LessonSegment[]): LessonSegment[] {
    return current.map((segment) => {
      const el = bodyRefs.current[segment.id];
      return el ? { ...segment, html: el.innerHTML } : segment;
    });
  }

  function handleHeadingChange(id: string, heading: string) {
    setSegments((prev) => prev.map((segment) => (segment.id === id ? { ...segment, heading } : segment)));
  }

  function handleKindChange(id: string, kind: "content" | "assignment") {
    setSegments((prev) =>
      prev.map((segment) =>
        segment.id === id ? { ...segment, kind: kind === "content" ? undefined : kind } : segment,
      ),
    );
  }

  function handleAssignmentFieldChange(id: string, field: "startAt" | "dueAt", value: string) {
    setSegments((prev) =>
      prev.map((segment) => (segment.id === id ? { ...segment, [field]: value || undefined } : segment)),
    );
  }

  function handleAddSegment() {
    const synced = syncBodiesFromDom(segments);
    setSegments([...synced, { id: generateId("segment"), heading: "", html: "" }]);
  }

  function handleDeleteSegment(id: string) {
    const synced = syncBodiesFromDom(segments);
    setSegments(synced.filter((segment) => segment.id !== id));
    delete bodyRefs.current[id];
    delete segmentRefs.current[id];
  }

  function handleMoveSegment(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= segments.length) return;
    const synced = syncBodiesFromDom(segments);
    const next = [...synced];
    [next[index], next[target]] = [next[target], next[index]];
    setSegments(next);
  }

  // Native HTML5 drag-and-drop — a nice-to-have for desktop/mouse users.
  // iOS/iPadOS Safari doesn't support this API over touch at all, and
  // touch is a first-class target for this app, so the Up/Down buttons
  // above are the reliable, universally-supported way to reorder; this is
  // strictly additive for mouse users, not a replacement for them.
  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDrop(index: number) {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from === null || from === index) return;
    const synced = syncBodiesFromDom(segments);
    const next = [...synced];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    setSegments(next);
  }

  // onMouseDown (not onClick) + preventDefault so the toolbar button never
  // steals focus away from whichever contentEditable the user was just
  // typing in — execCommand acts on the current selection, wherever it is.
  function handleFormat(event: ReactMouseEvent, command: string) {
    event.preventDefault();
    document.execCommand(command);
  }

  function handleImport() {
    const imported = parseIntoSegments(importText);
    if (imported.length === 0) return;
    const synced = syncBodiesFromDom(segments);
    setSegments([...synced, ...imported]);
    setImportText("");
  }

  function handleSave() {
    const synced = syncBodiesFromDom(segments);
    setSegments(synced);
    saveLesson({ id: lessonId, classNumber, segments: synced, openAt: openAt || undefined });
    setSavedAt(new Date());
  }

  function scrollToSegment(id: string) {
    segmentRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const opensInFuture = Boolean(openAt) && new Date(openAt).getTime() > Date.now();

  return (
    <div className="page lesson-page">
      <Link to="/" className="back-link">
        &larr; Back to workshop
      </Link>

      <header className="feedback-header">
        <h1>Class {classNumber} Lesson</h1>
        <p className="instructor">{workshop.name}</p>
      </header>

      <div className="lesson-schedule">
        <label className="lesson-schedule-label">
          Opens at
          <input
            type="datetime-local"
            className="lesson-schedule-input"
            value={openAt}
            onChange={(event) => setOpenAt(event.target.value)}
          />
        </label>
        {openAt && (
          <span className={`lesson-schedule-status${opensInFuture ? " lesson-schedule-status--pending" : ""}`}>
            {opensInFuture
              ? `Not yet visible — opens ${new Date(openAt).toLocaleString()}`
              : `Open since ${new Date(openAt).toLocaleString()}`}
          </span>
        )}
      </div>

      <div className="lesson-layout">
        <aside className="lesson-outline">
          <h2 className="lesson-outline-heading">Outline</h2>
          {segments.length === 0 ? (
            <p className="empty-note">No segments yet.</p>
          ) : (
            <ul className="lesson-outline-list">
              {segments.map((segment, index) => (
                <li key={segment.id}>
                  <button
                    type="button"
                    className="lesson-outline-link"
                    onClick={() => scrollToSegment(segment.id)}
                  >
                    {index + 1}. {segment.heading.trim() || "Untitled"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="lesson-main">
          <details className="lesson-import">
            <summary>Paste &amp; auto-segment</summary>
            <p className="lesson-import-hint">
              Paste lesson text with a line like &ldquo;# Heading&rdquo; before each section — each one
              becomes its own segment below.
            </p>
            <textarea
              className="lesson-import-textarea"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder={"# First heading\nSome text...\n\n# Second heading\nMore text..."}
            />
            <button type="button" onClick={handleImport} disabled={!importText.trim()}>
              Add segments from text
            </button>
          </details>

          <ul className="lesson-segment-list">
            {segments.map((segment, index) => (
              <li
                key={segment.id}
                ref={(el) => {
                  segmentRefs.current[segment.id] = el;
                }}
                className="lesson-segment"
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(index)}
              >
                <div className="lesson-segment-header">
                  <span className="lesson-drag-handle" aria-hidden="true">
                    ⠿
                  </span>
                  <input
                    className="lesson-segment-heading-input"
                    value={segment.heading}
                    onChange={(event) => handleHeadingChange(segment.id, event.target.value)}
                    placeholder="Segment heading"
                  />
                  <select
                    className="lesson-segment-kind"
                    value={segment.kind ?? "content"}
                    onChange={(event) =>
                      handleKindChange(segment.id, event.target.value as "content" | "assignment")
                    }
                  >
                    <option value="content">Content</option>
                    <option value="assignment">Assignment</option>
                  </select>
                  <div className="lesson-segment-controls">
                    <button
                      type="button"
                      onClick={() => handleMoveSegment(index, -1)}
                      disabled={index === 0}
                      aria-label="Move segment up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveSegment(index, 1)}
                      disabled={index === segments.length - 1}
                      aria-label="Move segment down"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      className="lesson-segment-delete"
                      onClick={() => handleDeleteSegment(segment.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {segment.kind === "assignment" && (
                  <div className="lesson-assignment-fields">
                    <label>
                      Start
                      <input
                        type="datetime-local"
                        value={segment.startAt ?? ""}
                        onChange={(event) =>
                          handleAssignmentFieldChange(segment.id, "startAt", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Due
                      <input
                        type="datetime-local"
                        value={segment.dueAt ?? ""}
                        onChange={(event) =>
                          handleAssignmentFieldChange(segment.id, "dueAt", event.target.value)
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => downloadAssignmentIcs(segment, workshop.name)}
                      disabled={!segment.dueAt}
                    >
                      Add due date to calendar (.ics)
                    </button>
                    <p className="lesson-assignment-note">
                      Reminder emails aren&rsquo;t available in this prototype — no backend to send them.
                    </p>
                  </div>
                )}

                <div className="lesson-toolbar">
                  <button type="button" onMouseDown={(event) => handleFormat(event, "bold")}>
                    <strong>B</strong>
                  </button>
                  <button type="button" onMouseDown={(event) => handleFormat(event, "italic")}>
                    <em>I</em>
                  </button>
                  <button type="button" onMouseDown={(event) => handleFormat(event, "underline")}>
                    <u>U</u>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => handleFormat(event, "insertUnorderedList")}
                  >
                    • List
                  </button>
                  <button type="button" onMouseDown={(event) => handleFormat(event, "insertOrderedList")}>
                    1. List
                  </button>
                </div>

                <div
                  className="lesson-editable"
                  contentEditable
                  suppressContentEditableWarning
                  ref={(el) => {
                    bodyRefs.current[segment.id] = el;
                  }}
                  dangerouslySetInnerHTML={{ __html: segment.html }}
                />
              </li>
            ))}
          </ul>

          <button type="button" className="lesson-add-segment" onClick={handleAddSegment}>
            + Add segment
          </button>

          <div className="lesson-save-row">
            <button type="button" className="composer-save" onClick={handleSave}>
              Save lesson
            </button>
            {savedAt && (
              <span className="lesson-saved-note">Saved {savedAt.toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
