import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CommentCard } from "../components/CommentCard";
import { resolveAuthor } from "../lib/authors";
import {
  addComment,
  addReply,
  deleteComment,
  deleteReply,
  editComment,
  getCommentsForPoem,
  getReading,
  getRepliesForPoem,
} from "../lib/storage";
import { useViewAs } from "../lib/viewAs";
import type { Comment, Reply } from "../types";

// General, unanchored comments — there's no local text body to highlight
// against for an external reading (see Reading's type comment), so every
// comment here gets the same placeholder excerpt rather than a quoted
// selection. This is the "assignment feedback should work exactly the way
// commenting on readings works" system from tktk-seb.10: it's the *same*
// Comment/Reply storage and the *same* CommentCard component PoemFeedback
// uses, not a parallel implementation — reading.id is just passed in
// wherever Comment.poemId is expected.
const GENERAL_COMMENT_EXCERPT = "General comment";

export function ReadingFeedback() {
  const { readingId } = useParams<{ readingId: string }>();
  const { effectiveUserId } = useViewAs();
  const reading = readingId ? getReading(readingId) : undefined;

  const [comments, setComments] = useState<Comment[]>(() => (reading ? getCommentsForPoem(reading.id) : []));
  const [replies, setReplies] = useState<Reply[]>(() => (reading ? getRepliesForPoem(reading.id) : []));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [draftText, setDraftText] = useState("");

  if (!reading) {
    return (
      <div className="page">
        <Link to="/" className="back-link">
          &larr; Back to workshop
        </Link>
        <p className="tbd-note">Reading not found.</p>
      </div>
    );
  }

  function handleToggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePostComment() {
    if (!draftText.trim()) return;
    const saved = addComment({
      poemId: reading!.id,
      authorId: effectiveUserId,
      start: 0,
      end: 0,
      excerpt: GENERAL_COMMENT_EXCERPT,
      text: draftText.trim(),
    });
    setComments((prev) => [...prev, saved]);
    setExpandedIds((prev) => new Set(prev).add(saved.id));
    setDraftText("");
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
  }

  function handleAddReply(parentId: string, text: string) {
    const saved = addReply({ poemId: reading!.id, parentId, authorId: effectiveUserId, text });
    setReplies((prev) => [...prev, saved]);
  }

  function handleDeleteReply(replyId: string) {
    deleteReply(replyId);
    setReplies((prev) => prev.filter((reply) => reply.id !== replyId));
  }

  const sortedComments = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <div className="page feedback-page">
      <Link to="/" className="back-link">
        &larr; Back to workshop
      </Link>

      <header className="feedback-header">
        <h1>{reading.title}</h1>
        <p className="instructor">
          <a href={reading.url} target="_blank" rel="noreferrer">
            {reading.url}
          </a>
        </p>
      </header>

      <div className="feedback-layout">
        <div className="poem-panel">
          <p className="empty-note">
            This is an external link — open it above to read. Feedback below applies to the reading as
            a whole, since there's no local copy of the text to highlight against.
          </p>
        </div>

        <aside className="comments-panel">
          <h2 className="comments-heading">Comments</h2>

          <div className="composer">
            <textarea
              className="composer-textarea"
              placeholder="Leave a comment on this reading…"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
            />
            <div className="composer-actions">
              <button className="composer-save" onClick={handlePostComment} disabled={!draftText.trim()}>
                Post comment
              </button>
            </div>
          </div>

          {sortedComments.length === 0 && <p className="empty-note">No comments yet.</p>}

          <ul className="comment-list">
            {sortedComments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                expanded={expandedIds.has(comment.id)}
                pulsing={false}
                replies={replies.filter((reply) => reply.parentId === comment.id)}
                author={resolveAuthor(comment.authorId)}
                getAuthor={resolveAuthor}
                onToggle={() => handleToggleExpanded(comment.id)}
                onDelete={() => handleDeleteComment(comment.id)}
                onEdit={(text) => handleEditComment(comment.id, text)}
                onAddReply={(text) => handleAddReply(comment.id, text)}
                onDeleteReply={handleDeleteReply}
                onMouseEnter={() => {}}
                cardRef={() => {}}
              />
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
