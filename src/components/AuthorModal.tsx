import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { Student } from "../types";
import { AuthorProfileContent } from "./AuthorProfileContent";

interface AuthorModalProps {
  student: Student;
  onClose: () => void;
}

export function AuthorModal({ student, onClose }: AuthorModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
        <AuthorProfileContent student={student} headingId="modal-title" />
        <Link to={`/students/${student.id}`} className="modal-full-profile-link">
          View full profile &rarr;
        </Link>
      </div>
    </div>
  );
}
