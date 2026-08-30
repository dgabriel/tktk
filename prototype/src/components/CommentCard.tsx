import { useState } from "react";
import { ReplyThread } from "./ReplyThread";
import type { Author, Comment, Reply } from "../types";

interface CommentCardProps {
  comment: Comment;
  expanded: boolean;
  pulsing: boolean;
  replies: Reply[];
  author: Author;
  getAuthor: (authorId: string) => Author;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (text: string) => void;
  onMouseEnter: () => void;
  onAddReply: (text: string) => void;
  onDeleteReply: (replyId: string) => void;
  cardRef: (el: HTMLLIElement | null) => void;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

export function CommentCard({
  comment,
  expanded,
  pulsing,
  replies,
  author,
  getAuthor,
  onToggle,
  onDelete,
  onEdit,
  onMouseEnter,
  onAddReply,
  onDeleteReply,
  cardRef,
}: CommentCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(comment.text);

  function handleStartEdit() {
    setDraftText(comment.text);
    setIsEditing(true);
  }

  function handleSaveEdit() {
    const trimmed = draftText.trim();
    if (!trimmed) return;
    onEdit(trimmed);
    setIsEditing(false);
  }

  return (
    <li
      ref={cardRef}
      className={`comment-card${expanded ? " comment-card--expanded" : ""}${pulsing ? " comment-card--pulsing" : ""}`}
      onMouseEnter={onMouseEnter}
    >
      <button className="comment-card-header" onClick={onToggle} aria-expanded={expanded}>
        <span className="comment-card-chevron">{expanded ? "▾" : "▸"}</span>
        <span className="comment-card-avatar" aria-hidden="true">
          {author.initials}
        </span>
        <span className="comment-card-excerpt">&ldquo;{truncate(comment.excerpt, 40)}&rdquo;</span>
        {replies.length > 0 && (
          <span className="comment-card-reply-count">
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </span>
        )}
      </button>
      {expanded && (
        <div className="comment-card-body">
          <p className="comment-card-author">{author.name}</p>
          {isEditing ? (
            <div className="composer">
              <textarea
                className="composer-textarea"
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                autoFocus
              />
              <div className="composer-actions">
                <button className="composer-save" onClick={handleSaveEdit} disabled={!draftText.trim()}>
                  Save
                </button>
                <button className="composer-cancel" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="comment-card-text">{comment.text}</p>
          )}
          <ReplyThread
            replies={replies}
            getAuthor={getAuthor}
            onAddReply={onAddReply}
            onDeleteReply={onDeleteReply}
          />
          {!isEditing && (
            <div className="comment-card-actions">
              <button className="comment-card-action" onClick={handleStartEdit}>
                Edit comment
              </button>
              <button className="comment-card-action" onClick={onDelete}>
                Delete comment
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
