import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AuthorModal } from "../components/AuthorModal";
import { PoemListItem } from "../components/PoemListItem";
import { getLessonForClass, getState } from "../lib/storage";
import type { Student } from "../types";

export function WorkshopHome() {
  const { workshop, students, poems, currentUser } = getState();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const allClassNumbers = useMemo(
    () => Array.from({ length: workshop.totalClasses }, (_, index) => index + 1),
    [workshop.totalClasses],
  );
  const classNumbersWithPoems = useMemo(
    () => new Set(poems.map((poem) => poem.classNumber)),
    [poems],
  );
  const [selectedClass, setSelectedClass] = useState(() => {
    const withPoems = allClassNumbers.filter((classNumber) => classNumbersWithPoems.has(classNumber));
    return withPoems.length > 0 ? withPoems[withPoems.length - 1] : allClassNumbers[0];
  });

  const studentById = new Map(students.map((student) => [student.id, student]));
  const isPending = !classNumbersWithPoems.has(selectedClass);
  const poemsInClass = poems.filter((poem) => poem.classNumber === selectedClass);
  const awaitingPoems = poemsInClass.filter((poem) => poem.status === "awaiting_feedback");
  const givenPoems = poemsInClass.filter((poem) => poem.status === "feedback_given");
  const hasLesson = Boolean(getLessonForClass(selectedClass));

  return (
    <div className="page">
      <header className="page-header">
        <p className="signed-in-as">
          Signed in as {currentUser.fullName} ({currentUser.username})
        </p>
        <h1>{workshop.name}</h1>
        <p className="instructor">Instructor: {workshop.instructor}</p>
      </header>

      <div className="workshop-info">
        <p className="workshop-info-item">
          <span className="workshop-info-label">Location</span> {workshop.location}
        </p>
        <p className="workshop-info-item">
          <span className="workshop-info-label">Meets</span> {workshop.meetingTime}
        </p>
      </div>

      <nav className="tabs" aria-label="Class">
        {allClassNumbers.map((classNumber) => {
          const pending = !classNumbersWithPoems.has(classNumber);
          return (
            <button
              key={classNumber}
              className={`tab${classNumber === selectedClass ? " tab--active" : ""}${pending ? " tab--pending" : ""}`}
              onClick={() => setSelectedClass(classNumber)}
              aria-current={classNumber === selectedClass}
            >
              Class {classNumber}
            </button>
          );
        })}
      </nav>

      <div className="notebook-page">
        <Link to={`/lessons/${selectedClass}`} className="lesson-link">
          {hasLesson ? "View/edit lesson" : "Write lesson"} for Class {selectedClass} &rarr;
        </Link>

        {isPending ? (
          <>
            <h2 className="class-heading class-heading--pending">Class {selectedClass}: pending</h2>
            <p className="empty-note">This class hasn't happened yet.</p>
          </>
        ) : (
          <>
            <h2 className="class-heading">Class {selectedClass}: awaiting feedback</h2>
            <ul className="poem-list">
              {awaitingPoems.map((poem) => {
                const student = studentById.get(poem.studentId);
                if (!student) return null;
                return (
                  <PoemListItem
                    key={poem.id}
                    poem={poem}
                    student={student}
                    onAuthorClick={setSelectedStudent}
                  />
                );
              })}
              {awaitingPoems.length === 0 && (
                <li className="empty-note">No poems awaiting feedback for this class.</li>
              )}
            </ul>

            {givenPoems.length > 0 && (
              <>
                <h2 className="class-heading">Class {selectedClass}: feedback given</h2>
                <ul className="poem-list">
                  {givenPoems.map((poem) => {
                    const student = studentById.get(poem.studentId);
                    if (!student) return null;
                    return (
                      <PoemListItem
                        key={poem.id}
                        poem={poem}
                        student={student}
                        onAuthorClick={setSelectedStudent}
                      />
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      {selectedStudent && (
        <AuthorModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      )}
    </div>
  );
}
