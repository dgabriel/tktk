import { Link, useParams } from "react-router-dom";
import { AuthorProfileContent } from "../components/AuthorProfileContent";
import { getState } from "../lib/storage";

export function StudentProfile() {
  const { studentId } = useParams<{ studentId: string }>();
  const { students } = getState();
  const student = students.find((candidate) => candidate.id === studentId);

  return (
    <div className="page student-profile-page">
      <Link to="/" className="back-link">
        &larr; Back to workshop
      </Link>

      {student ? (
        <AuthorProfileContent student={student} />
      ) : (
        <p className="tbd-note">Participant not found.</p>
      )}
    </div>
  );
}
