import type { Student } from "../types";
import { Avatar } from "./Avatar";

// The actual profile content (avatar, bio, workshop history) — shared by
// AuthorModal (quick popover from a poem list) and the full /students/:id
// page (a permanent, linkable profile), so the two never drift apart.
export function AuthorProfileContent({ student, headingId }: { student: Student; headingId?: string }) {
  return (
    <>
      <Avatar initials={student.initials} size="large" />
      <h2 id={headingId}>{student.name}</h2>
      <p className="modal-bio">{student.bio}</p>
      <h3>Workshops</h3>
      <ul className="modal-workshops">
        {student.workshops.map((workshopName) => (
          <li key={workshopName}>{workshopName}</li>
        ))}
      </ul>
    </>
  );
}
