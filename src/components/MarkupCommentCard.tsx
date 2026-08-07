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
  onAddReply,
  onDeleteReply,
}: MarkupCommentCardProps) {
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
          <p className="comment-card-text">{text}</p>
          <ReplyThread
            replies={replies}
            getAuthor={getAuthor}
            onAddReply={onAddReply}
            onDeleteReply={onDeleteReply}
          />
          <button className="comment-card-delete" onClick={onDelete}>
            Delete comment
          </button>
        </div>
      )}
    </li>
  );
}
