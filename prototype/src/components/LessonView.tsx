import { useState } from "react";
import { PromptRunner } from "./PromptRunner";
import { downloadAssignmentIcs } from "../lib/ics";
import { kindOf } from "../lib/lessonKind";
import type { Lesson } from "../types";

// The read-only counterpart to the lesson editor's preview mode — same
// segment-card markup/CSS, but standalone (no editing controls, no
// outline/timeline chrome) since this is meant to sit inside the class
// view's "Lesson" tab, not the authoring page. Per-segment collapse and
// "run this prompt" are local-only UI state here, not persisted — this
// component never writes to storage.
export function LessonView({ lesson, workshopName }: { lesson: Lesson; workshopName: string }) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    () => new Set(lesson.segments.filter((segment) => segment.collapsed).map((segment) => segment.id)),
  );
  const [openRunnerIds, setOpenRunnerIds] = useState<Set<string>>(new Set());

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRunner(id: string) {
    setOpenRunnerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const opensInFuture = Boolean(lesson.openAt) && new Date(lesson.openAt!).getTime() > Date.now();

  if (lesson.segments.length === 0) {
    return <p className="empty-note">This lesson doesn&rsquo;t have any content yet.</p>;
  }

  return (
    <div className="lesson-view">
      {lesson.openAt && (
        <span className={`lesson-status-pill${opensInFuture ? " lesson-status-pill--pending" : ""}`}>
          <span className="lesson-status-dot" aria-hidden="true" />
          {opensInFuture
            ? `Not yet visible — opens ${new Date(lesson.openAt).toLocaleString()}`
            : `Open since ${new Date(lesson.openAt).toLocaleString()}`}
        </span>
      )}

      <ul className="lesson-segment-list">
        {lesson.segments.map((segment, index) => {
          const kind = kindOf(segment.kind);
          const expanded = !collapsedIds.has(segment.id);
          return (
            <li key={segment.id} className="lesson-segment">
              <div className={`lesson-segment-header${expanded ? " lesson-segment-header--expanded" : ""}`}>
                <span className="lesson-order-badge">{index + 1}</span>
                <p className="lesson-segment-heading-readonly">{segment.heading || "Untitled"}</p>
                <button
                  type="button"
                  className="lesson-segment-collapse-toggle"
                  aria-label={expanded ? "Collapse segment" : "Expand segment"}
                  onClick={() => toggleCollapsed(segment.id)}
                >
                  {expanded ? "▾" : "▸"}
                </button>
              </div>

              {expanded && (
                <div className="lesson-segment-body">
                  {kind === "assignment" && (
                    <div className="lesson-assignment-panel">
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
                      <button
                        type="button"
                        className="lesson-pill-button lesson-pill-button--small"
                        onClick={() => downloadAssignmentIcs(segment, workshopName)}
                        disabled={!segment.dueAt}
                      >
                        Add due date to calendar (.ics)
                      </button>
                    </div>
                  )}

                  <div className="lesson-richtext-editable" dangerouslySetInnerHTML={{ __html: segment.html }} />

                  {kind === "prompt" && (
                    <div className="lesson-prompt-panel">
                      <ul className="lesson-stage-list-readonly">
                        {(segment.stages ?? []).map((stage, stageIndex) => (
                          <li key={stage.id}>
                            {stageIndex + 1}. {stage.text || "(empty stage)"} &mdash; {stage.durationMinutes} min
                          </li>
                        ))}
                      </ul>

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
    </div>
  );
}
