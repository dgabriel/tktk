import { useLayoutEffect, useRef, useState } from "react";
import type {
  ChangeEvent,
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import { PromptRunner } from "../components/PromptRunner";
import {
  getClassTitle,
  getLessonForClass,
  getState,
  saveLesson,
  setClassTitle,
} from "../lib/storage";
import { useViewAs } from "../lib/viewAs";
import type { LessonSegment, PromptStage } from "../types";

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
// Strips characters that aren't safe across Windows/macOS/Linux filenames
// (workshop names are free text, e.g. "Line & Form: A Poetry Workshop").
function sanitizeFilenameSegment(text: string): string {
  return text.replace(/[\\/:*?"<>|]/g, "").trim();
}

function downloadTextFile(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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
  downloadTextFile(`${segment.heading || "assignment"}.ics`, ics, "text/calendar");
}

// Lenient parsing for an uploaded lesson JSON file: any missing/malformed
// field falls back to a safe default (generated id, empty text, 5-minute
// stage) rather than throwing, so a hand-edited or partial file still
// imports instead of failing outright. Only a top-level "segments" array is
// actually required — see handleImportJsonFile.
function parseImportedStage(raw: unknown): PromptStage {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    id: typeof obj.id === "string" && obj.id ? obj.id : generateId("stage"),
    text: typeof obj.text === "string" ? obj.text : "",
    durationMinutes:
      typeof obj.durationMinutes === "number" && Number.isFinite(obj.durationMinutes)
        ? Math.max(1, Math.round(obj.durationMinutes))
        : 5,
  };
}

function parseImportedSegment(raw: unknown): LessonSegment {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const kind = obj.kind === "assignment" || obj.kind === "prompt" ? obj.kind : undefined;
  const stagesRaw = Array.isArray(obj.stages) ? obj.stages : [];
  return {
    id: typeof obj.id === "string" && obj.id ? obj.id : generateId("segment"),
    heading: typeof obj.heading === "string" ? obj.heading : "",
    html: typeof obj.html === "string" ? obj.html : "",
    kind,
    startAt: typeof obj.startAt === "string" ? obj.startAt : undefined,
    dueAt: typeof obj.dueAt === "string" ? obj.dueAt : undefined,
    stages: stagesRaw.length > 0 ? stagesRaw.map(parseImportedStage) : undefined,
    collapsed: typeof obj.collapsed === "boolean" ? obj.collapsed : undefined,
  };
}

function kindOf(kind: LessonSegment["kind"]): "content" | "assignment" | "prompt" {
  return kind === "assignment" || kind === "prompt" ? kind : "content";
}

// "Content" is the unmarked default (most segments are this), so the
// outline only spells out the kind for the two that aren't — the colored
// dot alone isn't reliably legible without a legend.
function kindLabel(kind: "content" | "assignment" | "prompt"): string | null {
  if (kind === "assignment") return "Assignment";
  if (kind === "prompt") return "Prompt";
  return null;
}

// Same three labels, but always non-null (used where "Content" itself is
// useful to say out loud, e.g. a tooltip prefix, rather than left implicit).
function kindDisplayLabel(kind: "content" | "assignment" | "prompt"): string {
  return kindLabel(kind) ?? "Content";
}

const SIX_DOTS = [0, 1, 2, 3, 4, 5];
const FALLBACK_CARD_HEIGHT = 88;
const FALLBACK_OUTLINE_ROW_HEIGHT = 44;

function OutlineToggleIcon() {
  return (
    <>
      <span className="lesson-outline-toggle-bar" />
      <span className="lesson-outline-toggle-bar" />
      <span className="lesson-outline-toggle-bar" />
    </>
  );
}

function DragDots() {
  return (
    <span className="lesson-drag-dots">
      {SIX_DOTS.map((dot) => (
        <span key={dot} className="lesson-drag-dot" />
      ))}
    </span>
  );
}

export function LessonEditor() {
  const { classNumber: classNumberParam } = useParams<{ classNumber: string }>();
  const classNumber = Number(classNumberParam);
  const { workshop } = getState();
  const { isStudentView } = useViewAs();

  const [segments, setSegments] = useState<LessonSegment[]>(() => {
    const existing = getLessonForClass(classNumber);
    return existing ? existing.segments : [];
  });
  const [lessonId] = useState(() => getLessonForClass(classNumber)?.id ?? generateId("lesson"));
  const [openAt, setOpenAt] = useState(() => getLessonForClass(classNumber)?.openAt ?? "");
  const [classTitleDraft, setClassTitleDraft] = useState(() => getClassTitle(classNumber) ?? "");
  const [importText, setImportText] = useState("");
  const [importJsonError, setImportJsonError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [openRunnerIds, setOpenRunnerIds] = useState<Set<string>>(new Set());

  // Sidebar defaults open on desktop (per the stakeholder's ask), but
  // starts collapsed to its icon rail on narrow viewports — there's no
  // live resize handling for this, just a sane initial guess.
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 760);
  // A page-local preview toggle for the instructor; a real student always
  // sees the read-only variant (isStudentView), so previewMode folds both
  // together everywhere below rather than tracking them separately.
  const [previewToggle, setPreviewToggle] = useState(false);
  const previewMode = isStudentView || previewToggle;

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragDeltaY, setDragDeltaY] = useState(0);
  const [outlineDragId, setOutlineDragId] = useState<string | null>(null);
  const [outlineDragDeltaY, setOutlineDragDeltaY] = useState(0);

  const bodyRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const outlineRowRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const dragOriginYRef = useRef(0);
  const outlineDragOriginYRef = useRef(0);

  // Both the app-wide "Viewing as" bar and this page's own title bar are
  // sticky, stacked on top of each other — measured (rather than
  // hardcoded) so the sidebar and title bar sit flush under whatever their
  // real rendered heights turn out to be.
  const titlebarRef = useRef<HTMLDivElement | null>(null);
  const [stickyOffsets, setStickyOffsets] = useState({ titlebarTop: 0, sidebarTop: 0 });

  useLayoutEffect(() => {
    function measure() {
      const viewAsBarHeight = document.querySelector(".view-as-bar")?.getBoundingClientRect().height ?? 0;
      const titlebarHeight = titlebarRef.current?.getBoundingClientRect().height ?? 0;
      setStickyOffsets({ titlebarTop: viewAsBarHeight, sidebarTop: viewAsBarHeight + titlebarHeight });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

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
    setDirty(true);
  }

  function handleKindChange(id: string, kind: "content" | "assignment" | "prompt") {
    setSegments((prev) =>
      prev.map((segment) =>
        segment.id === id ? { ...segment, kind: kind === "content" ? undefined : kind } : segment,
      ),
    );
    setDirty(true);
  }

  function handleAssignmentFieldChange(id: string, field: "startAt" | "dueAt", value: string) {
    setSegments((prev) =>
      prev.map((segment) => (segment.id === id ? { ...segment, [field]: value || undefined } : segment)),
    );
    setDirty(true);
  }

  function handleAddStage(segmentId: string) {
    setSegments((prev) =>
      prev.map((segment) =>
        segment.id === segmentId
          ? {
              ...segment,
              stages: [...(segment.stages ?? []), { id: generateId("stage"), text: "", durationMinutes: 5 }],
            }
          : segment,
      ),
    );
    setDirty(true);
  }

  function handleDeleteStage(segmentId: string, stageId: string) {
    setSegments((prev) =>
      prev.map((segment) =>
        segment.id === segmentId
          ? { ...segment, stages: (segment.stages ?? []).filter((stage) => stage.id !== stageId) }
          : segment,
      ),
    );
    setDirty(true);
  }

  function handleStageTextChange(segmentId: string, stageId: string, text: string) {
    setSegments((prev) =>
      prev.map((segment) =>
        segment.id === segmentId
          ? {
              ...segment,
              stages: (segment.stages ?? []).map((stage) => (stage.id === stageId ? { ...stage, text } : stage)),
            }
          : segment,
      ),
    );
    setDirty(true);
  }

  function handleStageDurationDelta(segmentId: string, stageId: string, delta: number) {
    setSegments((prev) =>
      prev.map((segment) =>
        segment.id === segmentId
          ? {
              ...segment,
              stages: (segment.stages ?? []).map((stage) =>
                stage.id === stageId
                  ? { ...stage, durationMinutes: Math.max(1, stage.durationMinutes + delta) }
                  : stage,
              ),
            }
          : segment,
      ),
    );
    setDirty(true);
  }

  // PromptRunner is only mounted while its wrapper is open, and remounts
  // fresh (from stage 1, current durations) every time it opens — it
  // captures its countdown state once on mount, so leaving it mounted
  // while collapsed would let it go stale if stage durations are edited
  // afterward.
  function toggleRunner(segmentId: string) {
    setOpenRunnerIds((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) next.delete(segmentId);
      else next.add(segmentId);
      return next;
    });
  }

  function toggleSegmentCollapsed(id: string) {
    setSegments((prev) =>
      prev.map((segment) => (segment.id === id ? { ...segment, collapsed: !segment.collapsed } : segment)),
    );
    setDirty(true);
  }

  function handleAddSegment() {
    const synced = syncBodiesFromDom(segments);
    setSegments([...synced, { id: generateId("segment"), heading: "", html: "" }]);
    setDirty(true);
  }

  function handleDeleteSegment(id: string) {
    const synced = syncBodiesFromDom(segments);
    setSegments(synced.filter((segment) => segment.id !== id));
    delete bodyRefs.current[id];
    delete cardRefs.current[id];
    delete outlineRowRefs.current[id];
    setDirty(true);
  }

  // Pointer Events unify mouse/touch/pen in one code path — native
  // `<li draggable>` HTML5 drag-and-drop doesn't fire on iOS/iPadOS Safari
  // at all, which is the actual bug this replaces (touch is a first-class
  // target here). Dragging swaps array entries live as the pointer crosses
  // each neighboring card's half-height, so the array is already in its
  // final order by the time the pointer is released — no separate commit
  // step.
  function handleSegmentDragStart(id: string, event: ReactPointerEvent<HTMLDivElement>) {
    if (previewMode) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOriginYRef.current = event.clientY;
    setDragId(id);
    setDragDeltaY(0);
  }

  function handleSegmentDragMove(id: string, event: ReactPointerEvent<HTMLDivElement>) {
    if (dragId !== id) return;
    let deltaY = event.clientY - dragOriginYRef.current;
    const next = [...segments];
    let index = next.findIndex((segment) => segment.id === id);
    let changed = false;
    while (deltaY > 0 && index < next.length - 1) {
      const height = cardRefs.current[next[index + 1].id]?.offsetHeight ?? FALLBACK_CARD_HEIGHT;
      if (deltaY <= height / 2) break;
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      deltaY -= height;
      dragOriginYRef.current += height;
      index += 1;
      changed = true;
    }
    while (deltaY < 0 && index > 0) {
      const height = cardRefs.current[next[index - 1].id]?.offsetHeight ?? FALLBACK_CARD_HEIGHT;
      if (-deltaY <= height / 2) break;
      [next[index], next[index - 1]] = [next[index - 1], next[index]];
      deltaY += height;
      dragOriginYRef.current -= height;
      index -= 1;
      changed = true;
    }
    setDragDeltaY(deltaY);
    if (changed) {
      setSegments(next);
      setDirty(true);
    }
  }

  function handleSegmentDragEnd(id: string, event: ReactPointerEvent<HTMLDivElement>) {
    if (dragId !== id) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // capture may already have been released (e.g. pointercancel)
    }
    setDragId(null);
    setDragDeltaY(0);
  }

  // Same measured-height mechanism as segment-card dragging — outline rows
  // used to be a uniform 44px, but wrapping headings (plus a kind label
  // underneath) make row height variable now, so each row's real height is
  // read from outlineRowRefs instead of assumed.
  function handleOutlineDragStart(id: string, event: ReactPointerEvent<HTMLDivElement>) {
    if (previewMode) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    outlineDragOriginYRef.current = event.clientY;
    setOutlineDragId(id);
    setOutlineDragDeltaY(0);
  }

  function handleOutlineDragMove(id: string, event: ReactPointerEvent<HTMLDivElement>) {
    if (outlineDragId !== id) return;
    let deltaY = event.clientY - outlineDragOriginYRef.current;
    const next = [...segments];
    let index = next.findIndex((segment) => segment.id === id);
    let changed = false;
    while (deltaY > 0 && index < next.length - 1) {
      const height = outlineRowRefs.current[next[index + 1].id]?.offsetHeight ?? FALLBACK_OUTLINE_ROW_HEIGHT;
      if (deltaY <= height / 2) break;
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      deltaY -= height;
      outlineDragOriginYRef.current += height;
      index += 1;
      changed = true;
    }
    while (deltaY < 0 && index > 0) {
      const height = outlineRowRefs.current[next[index - 1].id]?.offsetHeight ?? FALLBACK_OUTLINE_ROW_HEIGHT;
      if (-deltaY <= height / 2) break;
      [next[index], next[index - 1]] = [next[index - 1], next[index]];
      deltaY += height;
      outlineDragOriginYRef.current -= height;
      index -= 1;
      changed = true;
    }
    setOutlineDragDeltaY(deltaY);
    if (changed) {
      setSegments(next);
      setDirty(true);
    }
  }

  function handleOutlineDragEnd(id: string, event: ReactPointerEvent<HTMLDivElement>) {
    if (outlineDragId !== id) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // capture may already have been released (e.g. pointercancel)
    }
    setOutlineDragId(null);
    setOutlineDragDeltaY(0);
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
    setDirty(true);
  }

  function handleSave() {
    const synced = syncBodiesFromDom(segments);
    setSegments(synced);
    saveLesson({ id: lessonId, classNumber, segments: synced, openAt: openAt || undefined });
    setDirty(false);
    setSavedAt(new Date());
  }

  // Exports exactly what's editable on this page for this class — not the
  // full Lesson storage record — so a re-import can round-trip through
  // handleImportJsonFile below without needing lessonId/currentUser context.
  function handleExportJson() {
    const synced = syncBodiesFromDom(segments);
    const payload = {
      classNumber,
      classTitle: classTitleDraft,
      openAt: openAt || undefined,
      segments: synced,
    };
    const filename = `${sanitizeFilenameSegment(workshop.name)}-class-${classNumber}-lesson.json`;
    downloadTextFile(filename, JSON.stringify(payload, null, 2), "application/json");
  }

  function handleImportButtonClick() {
    importFileInputRef.current?.click();
  }

  // Import overwrites the editor's current in-progress state outright
  // (segments, opens-at, syllabus title) rather than merging or appending —
  // same "local until you hit Save lesson" gate as every other mutation on
  // this page, except classTitle, which (like the syllabus title input)
  // persists immediately rather than waiting on Save lesson.
  function handleImportJsonFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => setImportJsonError("Could not read that file.");
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as unknown;
        const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
        if (!obj || !Array.isArray(obj.segments)) {
          throw new Error('Expected a JSON object with a "segments" array.');
        }
        bodyRefs.current = {};
        cardRefs.current = {};
        outlineRowRefs.current = {};
        setSegments(obj.segments.map(parseImportedSegment));
        setOpenAt(typeof obj.openAt === "string" ? obj.openAt : "");
        const importedTitle = typeof obj.classTitle === "string" ? obj.classTitle : "";
        setClassTitleDraft(importedTitle);
        setClassTitle(classNumber, importedTitle);
        setImportJsonError(null);
        setDirty(true);
      } catch (error) {
        setImportJsonError(error instanceof Error ? error.message : "Could not read that file as lesson JSON.");
      }
    };
    reader.readAsText(file);
  }

  const opensInFuture = Boolean(openAt) && new Date(openAt).getTime() > Date.now();
  const scheduleStatusText = openAt
    ? opensInFuture
      ? `Not yet visible — opens ${new Date(openAt).toLocaleString()}`
      : `Open since ${new Date(openAt).toLocaleString()}`
    : "No open date set — visible immediately";
  const saveStatusText = dirty ? "Unsaved changes" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "No changes yet";
  const segmentAnchorStyle: CSSProperties = { scrollMarginTop: stickyOffsets.sidebarTop + 16 };

  return (
    <div className="lesson-editor">
      <div className="lesson-titlebar" ref={titlebarRef} style={{ top: stickyOffsets.titlebarTop }}>
        <Link to="/" className="back-link">
          &larr; Back to workshop
        </Link>
      </div>

      <div className="lesson-workspace">
        {sidebarOpen && (
          <div
            className="lesson-outline-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <aside
          className={`lesson-outline${sidebarOpen ? "" : " lesson-outline--collapsed"}`}
          style={{ top: stickyOffsets.sidebarTop, height: `calc(100vh - ${stickyOffsets.sidebarTop}px)` }}
        >
          {sidebarOpen ? (
            <div className="lesson-outline-inner">
              <div className="lesson-outline-header">
                <h2 className="lesson-outline-heading">Outline</h2>
                <button
                  type="button"
                  className="lesson-outline-toggle"
                  aria-label="Collapse outline"
                  onClick={() => setSidebarOpen(false)}
                >
                  <OutlineToggleIcon />
                </button>
              </div>
              <div className="lesson-outline-body">
                {segments.length === 0 ? (
                  <p className="empty-note">No segments yet.</p>
                ) : (
                  <ul className="lesson-outline-list">
                    {segments.map((segment, index) => {
                      const kind = kindOf(segment.kind);
                      const isDraggingRow = outlineDragId === segment.id;
                      return (
                        <li
                          key={segment.id}
                          ref={(el) => {
                            outlineRowRefs.current[segment.id] = el;
                          }}
                          className={`lesson-outline-row${isDraggingRow ? " lesson-outline-row--dragging" : ""}`}
                          style={isDraggingRow ? { transform: `translateY(${outlineDragDeltaY}px)` } : undefined}
                        >
                          {!previewMode && (
                            <div
                              className="lesson-drag-handle lesson-drag-handle--outline"
                              aria-label="Drag to reorder"
                              onPointerDown={(event) => handleOutlineDragStart(segment.id, event)}
                              onPointerMove={(event) => handleOutlineDragMove(segment.id, event)}
                              onPointerUp={(event) => handleOutlineDragEnd(segment.id, event)}
                              onPointerCancel={(event) => handleOutlineDragEnd(segment.id, event)}
                            >
                              <DragDots />
                            </div>
                          )}
                          <span className={`lesson-kind-dot lesson-kind-dot--${kind}`} aria-hidden="true" />
                          <div className="lesson-outline-row-text">
                            <a href={`#seg-${segment.id}`} className="lesson-outline-link">
                              {index + 1}. {segment.heading.trim() || "Untitled"}
                            </a>
                            {kindLabel(kind) && (
                              <span className={`lesson-outline-kind lesson-outline-kind--${kind}`}>
                                {kindLabel(kind)}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="lesson-outline-rail">
              <button
                type="button"
                className="lesson-outline-toggle"
                aria-label="Show outline"
                title="Outline"
                onClick={() => setSidebarOpen(true)}
              >
                <OutlineToggleIcon />
              </button>
            </div>
          )}
        </aside>

        <div className="lesson-content">
          <div className="lesson-header">
            <Link to="/" className="lesson-workshop-link">
              {workshop.name}
            </Link>
            <h1>Class {classNumber}</h1>

            {previewMode ? (
              classTitleDraft && <p className="lesson-title-readonly">{classTitleDraft}</p>
            ) : (
              <input
                type="text"
                className="lesson-title-input"
                value={classTitleDraft}
                onChange={(event) => setClassTitleDraft(event.target.value)}
                onBlur={() => setClassTitle(classNumber, classTitleDraft)}
                placeholder="Untitled — add a syllabus title"
              />
            )}

            {segments.length > 0 && (
              <div className="lesson-timeline">
                <div className="lesson-timeline-line" />
                <div className="lesson-timeline-row">
                  {segments.map((segment, index) => {
                    const kind = kindOf(segment.kind);
                    const heading = segment.heading.trim() || "Untitled";
                    return (
                      <a
                        key={segment.id}
                        href={`#seg-${segment.id}`}
                        className="lesson-timeline-item"
                        title={`${kindDisplayLabel(kind)}: ${heading}`}
                      >
                        <span className={`lesson-timeline-dot lesson-timeline-dot--${kind}`}>{index + 1}</span>
                        <span className="lesson-timeline-label">{heading}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="lesson-schedule">
              {!previewMode && (
                <label className="lesson-schedule-label">
                  Opens at
                  <input
                    type="datetime-local"
                    className="lesson-datetime-input"
                    value={openAt}
                    onChange={(event) => {
                      setOpenAt(event.target.value);
                      setDirty(true);
                    }}
                  />
                </label>
              )}
              <span className={`lesson-status-pill${opensInFuture ? " lesson-status-pill--pending" : ""}`}>
                <span className="lesson-status-dot" aria-hidden="true" />
                {scheduleStatusText}
              </span>
            </div>

            <div className="lesson-save-row">
              <span
                className={`lesson-status-pill lesson-save-status${dirty ? " lesson-status-pill--pending" : ""}`}
              >
                <span className="lesson-status-dot" aria-hidden="true" />
                {saveStatusText}
              </span>
              <div className="lesson-save-actions">
                {!isStudentView && (
                  <button
                    type="button"
                    className="lesson-pill-button"
                    onClick={() => setPreviewToggle((prev) => !prev)}
                  >
                    {previewToggle ? "Exit preview" : "Preview"}
                  </button>
                )}
                {!previewMode && (
                  <button type="button" className="lesson-pill-button lesson-pill-button--primary" onClick={handleSave}>
                    Save lesson
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="lesson-main">
            {!previewMode && (
              <details className="lesson-import">
                <summary>Paste &amp; auto-segment</summary>
                <p className="lesson-import-hint">
                  Paste lesson text with a line like &ldquo;# Heading&rdquo; before each section — each
                  one becomes its own segment below.
                </p>
                <textarea
                  className="lesson-import-textarea"
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  placeholder={"# First heading\nSome text...\n\n# Second heading\nMore text..."}
                />
                <button
                  type="button"
                  className="lesson-pill-button lesson-pill-button--small"
                  onClick={handleImport}
                  disabled={!importText.trim()}
                >
                  Add segments from text
                </button>
              </details>
            )}

            <ul className="lesson-segment-list">
              {segments.map((segment, index) => {
                const kind = kindOf(segment.kind);
                const expanded = !segment.collapsed;
                const isDragging = dragId === segment.id;
                const cardStyle: CSSProperties = isDragging
                  ? { ...segmentAnchorStyle, transform: `translateY(${dragDeltaY}px)` }
                  : segmentAnchorStyle;

                return (
                  <li
                    key={segment.id}
                    id={`seg-${segment.id}`}
                    ref={(el) => {
                      cardRefs.current[segment.id] = el;
                    }}
                    className={`lesson-segment${isDragging ? " lesson-segment--dragging" : ""}`}
                    style={cardStyle}
                  >
                    <div
                      className={`lesson-segment-header${expanded ? " lesson-segment-header--expanded" : ""}`}
                    >
                      {!previewMode && (
                        <div
                          className="lesson-drag-handle"
                          aria-label="Drag to reorder"
                          onPointerDown={(event) => handleSegmentDragStart(segment.id, event)}
                          onPointerMove={(event) => handleSegmentDragMove(segment.id, event)}
                          onPointerUp={(event) => handleSegmentDragEnd(segment.id, event)}
                          onPointerCancel={(event) => handleSegmentDragEnd(segment.id, event)}
                        >
                          <DragDots />
                        </div>
                      )}

                      <span className="lesson-order-badge">{index + 1}</span>

                      {previewMode ? (
                        <p className="lesson-segment-heading-readonly">{segment.heading || "Untitled"}</p>
                      ) : (
                        <>
                          <input
                            className="lesson-segment-heading-input"
                            value={segment.heading}
                            onChange={(event) => handleHeadingChange(segment.id, event.target.value)}
                            placeholder="Segment heading"
                          />
                          <div className="lesson-kind-switch">
                            <button
                              type="button"
                              className={`lesson-kind-switch-button${kind === "content" ? " lesson-kind-switch-button--active" : ""}`}
                              onClick={() => handleKindChange(segment.id, "content")}
                            >
                              Content
                            </button>
                            <button
                              type="button"
                              className={`lesson-kind-switch-button${kind === "assignment" ? " lesson-kind-switch-button--active" : ""}`}
                              onClick={() => handleKindChange(segment.id, "assignment")}
                            >
                              Assignment
                            </button>
                            <button
                              type="button"
                              className={`lesson-kind-switch-button${kind === "prompt" ? " lesson-kind-switch-button--active" : ""}`}
                              onClick={() => handleKindChange(segment.id, "prompt")}
                            >
                              Prompt
                            </button>
                          </div>
                        </>
                      )}

                      <button
                        type="button"
                        className="lesson-segment-collapse-toggle"
                        aria-label={expanded ? "Collapse segment" : "Expand segment"}
                        onClick={() => toggleSegmentCollapsed(segment.id)}
                      >
                        {expanded ? "▾" : "▸"}
                      </button>

                      {!previewMode && (
                        <button
                          type="button"
                          className="lesson-text-remove-button"
                          onClick={() => handleDeleteSegment(segment.id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {expanded && (
                      <div className="lesson-segment-body">
                        {kind === "assignment" && (
                          <div className="lesson-assignment-panel">
                            {previewMode ? (
                              <>
                                {segment.startAt && (
                                  <span className="lesson-assignment-readonly">
                                    Start: {new Date(segment.startAt).toLocaleString()}
                                  </span>
                                )}
                                {segment.dueAt && (
                                  <span className="lesson-assignment-readonly">
                                    Due: {new Date(segment.dueAt).toLocaleString()}
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <label className="lesson-field-label">
                                  Start
                                  <input
                                    type="datetime-local"
                                    className="lesson-datetime-input"
                                    value={segment.startAt ?? ""}
                                    onChange={(event) =>
                                      handleAssignmentFieldChange(segment.id, "startAt", event.target.value)
                                    }
                                  />
                                </label>
                                <label className="lesson-field-label">
                                  Due
                                  <input
                                    type="datetime-local"
                                    className="lesson-datetime-input"
                                    value={segment.dueAt ?? ""}
                                    onChange={(event) =>
                                      handleAssignmentFieldChange(segment.id, "dueAt", event.target.value)
                                    }
                                  />
                                </label>
                              </>
                            )}
                            <button
                              type="button"
                              className="lesson-pill-button lesson-pill-button--small"
                              onClick={() => downloadAssignmentIcs(segment, workshop.name)}
                              disabled={!segment.dueAt}
                            >
                              Add due date to calendar (.ics)
                            </button>
                            {!previewMode && (
                              <p className="lesson-assignment-note">
                                Reminder emails aren&rsquo;t available in this prototype.
                              </p>
                            )}
                          </div>
                        )}

                        <div className="lesson-richtext">
                          {!previewMode && (
                            <div className="lesson-richtext-toolbar">
                              <button
                                type="button"
                                className="lesson-richtext-toolbar-icon"
                                onMouseDown={(event) => handleFormat(event, "bold")}
                              >
                                <strong>B</strong>
                              </button>
                              <button
                                type="button"
                                className="lesson-richtext-toolbar-icon"
                                onMouseDown={(event) => handleFormat(event, "italic")}
                              >
                                <em>I</em>
                              </button>
                              <button
                                type="button"
                                className="lesson-richtext-toolbar-icon"
                                onMouseDown={(event) => handleFormat(event, "underline")}
                              >
                                <u>U</u>
                              </button>
                              <span className="lesson-richtext-toolbar-divider" aria-hidden="true" />
                              <button
                                type="button"
                                onMouseDown={(event) => handleFormat(event, "insertUnorderedList")}
                              >
                                &bull; List
                              </button>
                              <button
                                type="button"
                                onMouseDown={(event) => handleFormat(event, "insertOrderedList")}
                              >
                                1. List
                              </button>
                            </div>
                          )}
                          <div
                            className="lesson-richtext-editable"
                            contentEditable={!previewMode}
                            suppressContentEditableWarning
                            data-placeholder={previewMode ? undefined : "Start typing…"}
                            onInput={() => setDirty(true)}
                            ref={(el) => {
                              bodyRefs.current[segment.id] = el;
                            }}
                            dangerouslySetInnerHTML={{ __html: segment.html }}
                          />
                        </div>

                        {kind === "prompt" && (
                          <div className="lesson-prompt-panel">
                            {!previewMode && (
                              <details className="lesson-prompt-hint-details">
                                <summary>Add timed stages (optional)</summary>
                                <p className="lesson-import-hint">
                                  Each stage shows for its duration, then the next reveals automatically
                                  when run live.
                                </p>
                                <button
                                  type="button"
                                  className="lesson-pill-button lesson-pill-button--small lesson-pill-button--dashed"
                                  onClick={() => handleAddStage(segment.id)}
                                >
                                  + Add stage
                                </button>
                              </details>
                            )}

                            {previewMode ? (
                              <ul className="lesson-stage-list-readonly">
                                {(segment.stages ?? []).map((stage, stageIndex) => (
                                  <li key={stage.id}>
                                    {stageIndex + 1}. {stage.text || "(empty stage)"} &mdash;{" "}
                                    {stage.durationMinutes} min
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="lesson-stage-list">
                                {(segment.stages ?? []).map((stage, stageIndex) => (
                                  <div key={stage.id} className="lesson-stage-row">
                                    <span className="lesson-order-badge lesson-order-badge--stage">
                                      {stageIndex + 1}
                                    </span>
                                    <textarea
                                      className="lesson-stage-textarea"
                                      value={stage.text}
                                      onChange={(event) =>
                                        handleStageTextChange(segment.id, stage.id, event.target.value)
                                      }
                                      placeholder={`Stage ${stageIndex + 1} prompt text…`}
                                    />
                                    <div className="lesson-stage-duration">
                                      <button
                                        type="button"
                                        className="lesson-stepper-button"
                                        aria-label="Decrease duration"
                                        onClick={() => handleStageDurationDelta(segment.id, stage.id, -1)}
                                      >
                                        &minus;
                                      </button>
                                      <span className="lesson-stepper-value">{stage.durationMinutes} min</span>
                                      <button
                                        type="button"
                                        className="lesson-stepper-button"
                                        aria-label="Increase duration"
                                        onClick={() => handleStageDurationDelta(segment.id, stage.id, 1)}
                                      >
                                        +
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      className="lesson-text-remove-button"
                                      onClick={() => handleDeleteStage(segment.id, stage.id)}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {(segment.stages ?? []).length > 0 && (
                              <div className="prompt-runner-wrapper">
                                <button
                                  type="button"
                                  className={`lesson-pill-button lesson-pill-button--small${
                                    openRunnerIds.has(segment.id) ? " lesson-pill-button--primary" : ""
                                  }`}
                                  onClick={() => toggleRunner(segment.id)}
                                >
                                  {openRunnerIds.has(segment.id) ? "Hide prompt runner" : "▶ Run this prompt"}
                                </button>
                                {openRunnerIds.has(segment.id) && (
                                  <PromptRunner key={segment.id} stages={segment.stages ?? []} />
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {!previewMode && (
              <button type="button" className="lesson-add-segment" onClick={handleAddSegment}>
                + Add segment
              </button>
            )}

            {!previewMode && (
              <div className="lesson-json-tools">
                <button type="button" className="lesson-json-tools-button" onClick={handleExportJson}>
                  Export JSON
                </button>
                <span className="lesson-json-tools-divider" aria-hidden="true">
                  ·
                </span>
                <button type="button" className="lesson-json-tools-button" onClick={handleImportButtonClick}>
                  Import JSON
                </button>
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept="application/json"
                  className="lesson-file-input"
                  onChange={handleImportJsonFile}
                />
                {importJsonError && <p className="lesson-import-json-error">{importJsonError}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
