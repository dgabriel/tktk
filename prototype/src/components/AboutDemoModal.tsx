import { useEffect, useRef } from "react";

interface AboutDemoModalProps {
  onClose: () => void;
}

// Static "what is this / what to try" guide for stakeholder reviewers.
// Reuses the .modal chrome from AuthorModal: Escape to close, focus the
// close button on open, click outside to dismiss.
export function AboutDemoModal({ onClose }: AboutDemoModalProps) {
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
        className="modal modal--about-demo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-demo-title"
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

        <h2 id="about-demo-title">About this demo</h2>
        <p>
          A clickable prototype of a mini-LMS for a poetry workshop — fake
          course, fake students, no real server. It exists to try out
          workflows and gather feedback, not to be production software.
        </p>

        <h3>Things to try</h3>
        <ul className="about-demo-list">
          <li>
            <strong>Switch who you're viewing as.</strong> The menu in the top
            bar flips between the instructor (Sam Cha) and each student. Some
            tools are instructor-only, and students see lessons scheduled for
            the future as not yet open.
          </li>
          <li>
            <strong>Browse the class accordion.</strong> Each class lists poems
            awaiting feedback and feedback given, plus readings and polls.
          </li>
          <li>
            <strong>Leave feedback on a poem</strong> two ways: Highlight mode
            (select text, attach a comment) or Markup mode (draw on the poem
            with a pointer or stylus, attach comments to your strokes). Switch
            whose marks you're viewing to see each reader's layer.
          </li>
          <li>
            <strong>Write or edit a lesson</strong> (instructor view). Lessons
            can schedule when they open for students, attach assignments as
            downloadable calendar events, and run multi-stage timed writing
            prompts for live class use.
          </li>
          <li>
            <strong>Create a poll and vote</strong> in any class.
          </li>
          <li>
            <strong>Manage office hours</strong> — add slots and assign
            bookings (instructor view).
          </li>
          <li>
            <strong>Open a student's profile.</strong> Click a poem's author
            for a quick bio, then through to the full profile page.
          </li>
        </ul>

        <p className="about-demo-note">
          Everything is stored in your browser (localStorage) — edits survive
          a reload but never leave your machine. Clearing this site's data
          resets the demo to its seed content.
        </p>
      </div>
    </div>
  );
}
