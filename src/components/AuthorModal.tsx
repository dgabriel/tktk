import { useEffect, useRef } from "react";
import type { Student } from "../types";
import { Avatar } from "./Avatar";

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
        <Avatar initials={student.initials} size="large" />
        <h2 id="modal-title">{student.name}</h2>
        <p className="modal-bio">{student.bio}</p>
        <h3>Workshops</h3>
        <ul className="modal-workshops">
          {student.workshops.map((workshopName) => (
            <li key={workshopName}>{workshopName}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
