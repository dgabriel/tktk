import { useState } from "react";
import type { Author, Reply } from "../types";

interface ReplyThreadProps {
  replies: Reply[];
  getAuthor: (authorId: string) => Author;
  onAddReply: (text: string) => void;
  onDeleteReply: (replyId: string) => void;
}

// Shared by CommentCard and MarkupCommentCard — a flat (non-nested) list of
// replies plus a toggleable composer to add one. Replies can't themselves
// be replied to.
export function ReplyThread({ replies, getAuthor, onAddReply, onDeleteReply }: ReplyThreadProps) {
  const [draft, setDraft] = useState("");
  const [showComposer, setShowComposer] = useState(false);

  function handleSave() {
    if (!draft.trim()) return;
    onAddReply(draft.trim());
    setDraft("");
    setShowComposer(false);
  }

  return (
    <div className="reply-thread">
      {replies.length > 0 && (
        <ul className="reply-list">
          {replies.map((reply) => {
            const author = getAuthor(reply.authorId);
            return (
              <li key={reply.id} className="reply-item">
                <div className="reply-header">
                  <span className="comment-card-avatar" aria-hidden="true">
                    {author.initials}
                  </span>
                  <span className="reply-author">{author.name}</span>
                </div>
                <p className="reply-text">{reply.text}</p>
                <button className="reply-delete" onClick={() => onDeleteReply(reply.id)}>
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showComposer ? (
        <div className="reply-composer">
          <textarea
            className="reply-textarea"
            placeholder="Write a reply…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
          />
          <div className="composer-actions">
            <button className="composer-save" onClick={handleSave} disabled={!draft.trim()}>
              Reply
            </button>
            <button
              className="composer-cancel"
              onClick={() => {
                setShowComposer(false);
                setDraft("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="reply-toggle" onClick={() => setShowComposer(true)}>
          Reply
        </button>
      )}
    </div>
  );
}
