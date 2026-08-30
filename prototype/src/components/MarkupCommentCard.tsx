import { useState } from "react";
import { ReplyThread } from "./ReplyThread";
import type { Author, Reply } from "../types";

interface MarkupCommentCardProps {
  text: string;
  expanded: boolean;
  replies: Reply[];
  author: Author;
  getAuthor: (authorId: string) => Author;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (text: string) => void;
  onAddReply: (text: string) => void;
  onDeleteReply: (replyId: string) => void;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

export function MarkupCommentCard({
  text,
  expanded,
  replies,
  author,
  getAuthor,
  onToggle,
  onDelete,
  onEdit,
  onAddReply,
  onDeleteReply,
}: MarkupCommentCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(text);

  function handleStartEdit() {
    setDraftText(text);
    setIsEditing(true);
  }

  function handleSaveEdit() {
    const trimmed = draftText.trim();
    if (!trimmed) return;
    onEdit(trimmed);
    setIsEditing(false);
  }

  return (
    <li className={`comment-card${expanded ? " comment-card--expanded" : ""}`}>
      <button className="comment-card-header" onClick={onToggle} aria-expanded={expanded}>
        <span className="comment-card-chevron">{expanded ? "▾" : "▸"}</span>
        <span className="comment-card-avatar comment-card-avatar--markup" aria-hidden="true">
          {author.initials}
        </span>
        <span className="comment-card-excerpt comment-card-excerpt--markup">{truncate(text, 40)}</span>
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
            <p className="comment-card-text">{text}</p>
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
