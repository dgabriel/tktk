import { Link } from "react-router-dom";
import type { Poem, Student } from "../types";

interface PoemListItemProps {
  poem: Poem;
  student: Student;
  onAuthorClick: (student: Student) => void;
}

export function PoemListItem({ poem, student, onAuthorClick }: PoemListItemProps) {
  const given = poem.status === "feedback_given";
  return (
    <li className={`poem-item${given ? " poem-item--given" : ""}`}>
      {given && <span className="poem-given-badge">✓ Feedback given</span>}
      <Link to={`/poems/${poem.id}`} className="poem-title">
        {poem.title}
      </Link>
      <button className="poem-author" onClick={() => onAuthorClick(student)}>
        {student.name}
      </button>
    </li>
  );
}
