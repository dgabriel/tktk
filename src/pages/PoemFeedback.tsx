import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CommentCard } from "../components/CommentCard";
import { MarkupCommentCard } from "../components/MarkupCommentCard";
import { useMarkupOverlay } from "../hooks/useMarkupOverlay";
import {
  addComment,
  addReply,
  deleteComment,
  deleteReply,
  editComment,
  getCommentsForPoem,
  getRepliesForPoem,
  getState,
} from "../lib/storage";
import type { Author, Comment, OverlayPoint, Reply } from "../types";

interface PendingSelection {
  start: number;
  end: number;
  text: string;
}

function getOffsetWithin(container: Node, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(node, offset);
  return range.toString().length;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function pointsToPath(points: OverlayPoint[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function initialsFromName(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function PoemFeedback() {
  const { poemId } = useParams<{ poemId: string }>();
  const { poems, students, currentUser } = getState();

  const poem = poems.find((candidate) => candidate.id === poemId);
  const student = poem ? students.find((candidate) => candidate.id === poem.studentId) : undefined;

  // Comment/Reply.authorId is either the current user's username or a
  // Student.id — this resolves either into a display name + initials for
  // rendering. Falls back to the current user if an id is somehow unknown
  // (shouldn't happen with real data, but keeps rendering from breaking).
  const getAuthor = (authorId: string): Author => {
    if (authorId === currentUser.username) {
      return { name: currentUser.fullName, initials: initialsFromName(currentUser.fullName) };
    }
    const authorStudent = students.find((candidate) => candidate.id === authorId);
    if (authorStudent) return { name: authorStudent.name, initials: authorStudent.initials };
    return { name: currentUser.fullName, initials: initialsFromName(currentUser.fullName) };
  };

  const [comments, setComments] = useState<Comment[]>(() => (poem ? getCommentsForPoem(poem.id) : []));
  const [replies, setReplies] = useState<Reply[]>(() => (poem ? getRepliesForPoem(poem.id) : []));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Highlight (mouse, text selection + comments) and Markup (stylus,
  // freehand drawing) are mutually exclusive views of the poem — never both
  // visible/interactive at once. See useMarkupOverlay for how markup mode
  // being active also blocks text-selection commenting "for free," via the
  // overlay SVG covering the poem body when it's the active mode.
  const [feedbackMode, setFeedbackMode] = useState<"highlight" | "markup">("highlight");
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [draftText, setDraftText] = useState("");
  const [pulsingHighlightId, setPulsingHighlightId] = useState<string | null>(null);
  const [pulsingCommentId, setPulsingCommentId] = useState<string | null>(null);
  const [pulsingDotId, setPulsingDotId] = useState<string | null>(null);
  // Which author's marks are currently shown/editable in Markup mode.
  // Defaults to "my own" — you can switch to view a classmate's marks, but
  // Draw/Erase/Comment only ever operate on your own (see `canEditMarkup`).
  const [viewAuthorId, setViewAuthorId] = useState(currentUser.username);
  const canEditMarkup = viewAuthorId === currentUser.username;
  const overlay = useMarkupOverlay(poem?.id ?? "", feedbackMode === "markup" && canEditMarkup, viewAuthorId);

  const poemBodyRef = useRef<HTMLDivElement>(null);
  const highlightRefs = useRef<Record<string, HTMLElement | null>>({});
  const commentCardRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const dotRefs = useRef<Record<string, HTMLElement | null>>({});

  // Selection is captured on mouseup/touchend (once the user finishes
  // dragging) rather than on every `selectionchange` — that fires
  // continuously mid-drag, which would otherwise lock in whatever was
  // selected first instead of the full drag. Because this listener is
  // scoped to the poem-body container, clicking into the comment textarea
  // (outside the container) never triggers it, so the pending selection
  // survives the user moving focus to type their comment.
  useEffect(() => {
    const container = poemBodyRef.current;
    if (!container || !poem) return;

    function captureSelection() {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
      const range = selection.getRangeAt(0);
      if (!container!.contains(range.commonAncestorContainer)) return;
      const a = getOffsetWithin(container!, range.startContainer, range.startOffset);
      const b = getOffsetWithin(container!, range.endContainer, range.endOffset);
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      if (start === end) return;
      setPendingSelection({ start, end, text: poem!.body.slice(start, end) });
    }

    container.addEventListener("mouseup", captureSelection);
    container.addEventListener("touchend", captureSelection);
    return () => {
      container.removeEventListener("mouseup", captureSelection);
      container.removeEventListener("touchend", captureSelection);
    };
  }, [poem]);

  const renderedBody = useMemo(() => {
    if (!poem) return null;
    type HighlightRange = { key: string; start: number; end: number; commentId?: string; pending?: boolean };
    const ranges: HighlightRange[] = comments.map((comment) => ({
      key: comment.id,
      start: comment.start,
      end: comment.end,
      commentId: comment.id,
    }));
    if (pendingSelection) {
      ranges.push({
        key: "pending-selection",
        start: pendingSelection.start,
        end: pendingSelection.end,
        pending: true,
      });
    }
    ranges.sort((a, b) => a.start - b.start);

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    for (const range of ranges) {
      const start = Math.max(range.start, cursor);
      if (start >= range.end) continue;
      if (start > cursor) nodes.push(poem.body.slice(cursor, start));
      const commentId = range.commentId;
      nodes.push(
        <mark
          key={range.key}
          ref={
            commentId
              ? (el) => {
                  highlightRefs.current[commentId] = el;
                }
              : undefined
          }
          className={`highlight${range.pending ? " highlight--pending" : ""}${commentId && commentId === pulsingHighlightId ? " highlight--pulsing" : ""}`}
          onClick={
            commentId
              ? () => {
                  setPulsingCommentId(commentId);
                  commentCardRefs.current[commentId]?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                  window.setTimeout(() => {
                    setPulsingCommentId((current) => (current === commentId ? null : current));
                  }, 1200);
                }
              : undefined
          }
        >
          {poem.body.slice(start, range.end)}
        </mark>,
      );
      cursor = range.end;
    }
    if (cursor < poem.body.length) nodes.push(poem.body.slice(cursor));
    return nodes;
  }, [poem, comments, pendingSelection, pulsingHighlightId]);

  if (!poem || !student) {
    return (
      <div className="page">
        <Link to="/" className="back-link">
          &larr; Back to workshop
        </Link>
        <p className="tbd-note">Poem not found.</p>
      </div>
    );
  }

  function handleSaveComment() {
    if (!poem || !pendingSelection || !draftText.trim()) return;
    const saved = addComment({
      poemId: poem.id,
      authorId: currentUser.username,
      start: pendingSelection.start,
      end: pendingSelection.end,
      excerpt: pendingSelection.text,
      text: draftText.trim(),
    });
    setComments((prev) => [...prev, saved]);
    setExpandedIds((prev) => new Set(prev).add(saved.id));
    setPendingSelection(null);
    setDraftText("");
    window.getSelection()?.removeAllRanges();
  }

  function handleCancelComposer() {
    setPendingSelection(null);
    setDraftText("");
    window.getSelection()?.removeAllRanges();
  }

  function handleToggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleToggleComment(id: string) {
    handleToggleExpanded(id);
    const el = highlightRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("highlight--flash");
      window.setTimeout(() => el.classList.remove("highlight--flash"), 900);
    }
  }

  function handleEditComment(id: string, text: string) {
    const updated = editComment(id, text);
    if (!updated) return;
    setComments((prev) => prev.map((comment) => (comment.id === id ? updated : comment)));
  }

  function handleDeleteComment(id: string) {
    deleteComment(id);
    setComments((prev) => prev.filter((comment) => comment.id !== id));
    setReplies((prev) => prev.filter((reply) => reply.parentId !== id));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleAddReply(parentId: string, text: string) {
    if (!poem) return;
    const saved = addReply({ poemId: poem.id, parentId, authorId: currentUser.username, text });
    setReplies((prev) => [...prev, saved]);
  }

  function handleDeleteReply(replyId: string) {
    deleteReply(replyId);
    setReplies((prev) => prev.filter((reply) => reply.id !== replyId));
  }

  function handleClearAllMarks() {
    // overlay.clearAll() only clears viewAuthorId's own strokes (never a
    // classmate's), so the reply cleanup here must match that same scope.
    const strokeIds = new Set(
      overlay.strokes.filter((stroke) => stroke.authorId === viewAuthorId).map((stroke) => stroke.id),
    );
    overlay.clearAll();
    setReplies((prev) => prev.filter((reply) => !strokeIds.has(reply.parentId)));
  }

  function handleToggleMarkupComment(strokeId: string) {
    handleToggleExpanded(strokeId);
    dotRefs.current[strokeId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    setPulsingDotId(strokeId);
    window.setTimeout(() => {
      setPulsingDotId((current) => (current === strokeId ? null : current));
    }, 1200);
  }

  function handleDeleteMarkupComment(strokeId: string) {
    overlay.removeStrokeComment(strokeId);
    setReplies((prev) => prev.filter((reply) => reply.parentId !== strokeId));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(strokeId);
      return next;
    });
  }

  const sortedComments = [...comments].sort((a, b) => a.start - b.start);
  // The poem itself only ever shows the currently-viewed author's ink —
  // but the sidebar comments list intentionally shows every author's
  // markup notes regardless of who's currently being viewed (matches how
  // text comments already work, and was an explicit product decision, not
  // an oversight — don't scope `markupComments` to `viewAuthorId`).
  const visibleStrokes = overlay.strokes.filter((stroke) => stroke.authorId === viewAuthorId);
  const markupComments = overlay.strokes.filter((stroke) => stroke.comment);
  const commentedStrokeIds = new Set(markupComments.map((stroke) => stroke.id));

  return (
    <div className="page feedback-page">
      <Link to="/" className="back-link">
        &larr; Back to workshop
      </Link>

      <header className="feedback-header">
        <h1>{poem.title}</h1>
        <p className="instructor">by {student.name}</p>
      </header>

      <div className="feedback-layout">
        <div className="poem-panel">
          <div className="poem-toolbar">
            <div className="mode-switch">
              <button
                className={`mode-switch-button${feedbackMode === "highlight" ? " mode-switch-button--active" : ""}`}
                onClick={() => setFeedbackMode("highlight")}
                aria-pressed={feedbackMode === "highlight"}
              >
                Highlight
              </button>
              <button
                className={`mode-switch-button${feedbackMode === "markup" ? " mode-switch-button--active" : ""}`}
                onClick={() => setFeedbackMode("markup")}
                aria-pressed={feedbackMode === "markup"}
              >
                Markup
              </button>
            </div>

            {feedbackMode === "markup" && (
              <div className="overlay-mode-buttons">
                <select
                  className="markup-view-select"
                  value={viewAuthorId}
                  onChange={(event) => setViewAuthorId(event.target.value)}
                >
                  <option value={currentUser.username}>My marks</option>
                  {students.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
                <div className="mode-switch mode-switch--small">
                  <button
                    className={`mode-switch-button${overlay.tool === "draw" ? " mode-switch-button--active" : ""}`}
                    onClick={() => overlay.setTool("draw")}
                    aria-pressed={overlay.tool === "draw"}
                    disabled={!canEditMarkup}
                  >
                    Draw
                  </button>
                  <button
                    className={`mode-switch-button${overlay.tool === "erase" ? " mode-switch-button--active" : ""}`}
                    onClick={() => overlay.setTool("erase")}
                    aria-pressed={overlay.tool === "erase"}
                    disabled={!canEditMarkup}
                  >
                    Erase
                  </button>
                  <button
                    className={`mode-switch-button${overlay.tool === "comment" ? " mode-switch-button--active" : ""}`}
                    onClick={() => overlay.setTool("comment")}
                    aria-pressed={overlay.tool === "comment"}
                    disabled={!canEditMarkup}
                  >
                    Comment
                  </button>
                </div>
                {canEditMarkup && visibleStrokes.length > 0 && (
                  <button className="overlay-clear-button" onClick={handleClearAllMarks}>
                    Clear marks
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="poem-body-wrapper">
            <div
              className={`poem-body${feedbackMode === "highlight" ? "" : " highlights-off"}`}
              ref={poemBodyRef}
            >
              {renderedBody}
            </div>
            <svg
              ref={overlay.svgRef}
              className={`overlay-canvas${overlay.tool === "erase" ? " overlay-canvas--erase" : ""}${overlay.tool === "comment" ? " overlay-canvas--comment" : ""}${feedbackMode !== "markup" ? " overlay-canvas--hidden" : ""}`}
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              onPointerDown={overlay.handlePointerDown}
              onPointerMove={overlay.handlePointerMove}
              onPointerUp={overlay.handlePointerUp}
              onPointerLeave={overlay.handlePointerUp}
            >
              {visibleStrokes.map((stroke) => (
                <path
                  key={stroke.id}
                  d={pointsToPath(stroke.points)}
                  className="overlay-stroke"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {overlay.liveStroke && overlay.liveStroke.length > 1 && (
                <path
                  d={pointsToPath(overlay.liveStroke)}
                  className="overlay-stroke"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            {feedbackMode === "markup" && (
              <div className="overlay-comment-dots">
                {visibleStrokes
                  .filter((stroke) => stroke.comment)
                  .map((stroke) => {
                    const last = stroke.points[stroke.points.length - 1];
                    return (
                      <span
                        key={stroke.id}
                        ref={(el) => {
                          dotRefs.current[stroke.id] = el;
                        }}
                        className={`overlay-comment-dot${stroke.id === pulsingDotId ? " overlay-comment-dot--pulsing" : ""}`}
                        style={{ left: `${last.x * 100}%`, top: `${last.y * 100}%` }}
                      />
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        <aside className="comments-panel">
          <h2 className="comments-heading">Comments</h2>

          {pendingSelection && (
            <div className="composer">
              <p className="composer-excerpt">Selected: &ldquo;{truncate(pendingSelection.text, 80)}&rdquo;</p>
              <textarea
                className="composer-textarea"
                placeholder="Leave a comment…"
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
              />
              <div className="composer-actions">
                <button
                  className="composer-save"
                  onClick={handleSaveComment}
                  disabled={!draftText.trim()}
                >
                  Save comment
                </button>
                <button className="composer-cancel" onClick={handleCancelComposer}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {overlay.activeCommentStrokeId && (
            <div className="composer">
              <p className="composer-excerpt">Note for this mark</p>
              <textarea
                className="composer-textarea"
                placeholder="Leave a note…"
                value={overlay.commentDraft}
                onChange={(event) => overlay.setCommentDraft(event.target.value)}
                autoFocus
              />
              <div className="composer-actions">
                <button
                  className="composer-save"
                  onClick={overlay.saveStrokeComment}
                  disabled={!overlay.commentDraft.trim()}
                >
                  Save note
                </button>
                <button className="composer-cancel" onClick={overlay.cancelStrokeComment}>
                  Cancel
                </button>
                {commentedStrokeIds.has(overlay.activeCommentStrokeId) && (
                  <button className="overlay-clear-button" onClick={overlay.deleteStrokeComment}>
                    Remove note
                  </button>
                )}
              </div>
            </div>
          )}

          {sortedComments.length === 0 &&
            markupComments.length === 0 &&
            !pendingSelection &&
            !overlay.activeCommentStrokeId && (
              <p className="empty-note">Select text or tap a mark to leave a comment.</p>
            )}

          <ul className="comment-list">
            {sortedComments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                expanded={expandedIds.has(comment.id)}
                pulsing={pulsingCommentId === comment.id}
                replies={replies.filter((reply) => reply.parentId === comment.id)}
                author={getAuthor(comment.authorId)}
                getAuthor={getAuthor}
                onToggle={() => handleToggleComment(comment.id)}
                onDelete={() => handleDeleteComment(comment.id)}
                onEdit={(text) => handleEditComment(comment.id, text)}
                onAddReply={(text) => handleAddReply(comment.id, text)}
                onDeleteReply={handleDeleteReply}
                onMouseEnter={() => {
                  const id = comment.id;
                  setPulsingHighlightId(id);
                  window.setTimeout(() => {
                    setPulsingHighlightId((current) => (current === id ? null : current));
                  }, 1200);
                }}
                cardRef={(el) => {
                  commentCardRefs.current[comment.id] = el;
                }}
              />
            ))}
            {markupComments.map((stroke) => (
              <MarkupCommentCard
                key={stroke.id}
                text={stroke.comment ?? ""}
                expanded={expandedIds.has(stroke.id)}
                replies={replies.filter((reply) => reply.parentId === stroke.id)}
                author={getAuthor(stroke.authorId)}
                getAuthor={getAuthor}
                onToggle={() => handleToggleMarkupComment(stroke.id)}
                onDelete={() => handleDeleteMarkupComment(stroke.id)}
                onEdit={(text) => overlay.updateStrokeComment(stroke.id, text)}
                onAddReply={(text) => handleAddReply(stroke.id, text)}
                onDeleteReply={handleDeleteReply}
              />
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
