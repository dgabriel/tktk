import { useState } from "react";
import { Link } from "react-router-dom";
import { getClassTitle, getState, setClassTitle } from "../lib/storage";
import { useViewAs } from "../lib/viewAs";

export function Syllabus() {
  const { workshop } = getState();
  const { isStudentView } = useViewAs();
  const classNumbers = Array.from({ length: workshop.totalClasses }, (_, index) => index + 1);

  const [titles, setTitles] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    for (const classNumber of classNumbers) {
      initial[classNumber] = getClassTitle(classNumber) ?? "";
    }
    return initial;
  });

  function handleChange(classNumber: number, value: string) {
    setTitles((prev) => ({ ...prev, [classNumber]: value }));
  }

  function handleBlur(classNumber: number) {
    setClassTitle(classNumber, titles[classNumber]);
  }

  return (
    <div className="page syllabus-page">
      <Link to="/" className="back-link">
        &larr; Back to workshop
      </Link>

      <header className="feedback-header">
        <h1>Syllabus</h1>
        <p className="instructor">{workshop.name}</p>
      </header>

      <p className="lesson-import-hint">
        These titles are just for the syllabus — the Class N tabs on the workshop page stay as they
        are.
      </p>

      <ul className="syllabus-list">
        {classNumbers.map((classNumber) => (
          <li key={classNumber} className="syllabus-item">
            <span className="syllabus-class-label">Class {classNumber}</span>
            {isStudentView ? (
              <span className="syllabus-title-readonly">{titles[classNumber] || "Untitled"}</span>
            ) : (
              <input
                type="text"
                className="syllabus-title-input"
                value={titles[classNumber]}
                onChange={(event) => handleChange(classNumber, event.target.value)}
                onBlur={() => handleBlur(classNumber)}
                placeholder="Untitled"
              />
            )}
            <Link to={`/lessons/${classNumber}`} className="syllabus-lesson-link">
              Lesson &rarr;
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
