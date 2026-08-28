import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AuthorModal } from "../components/AuthorModal";
import { EmailListCleaner } from "../components/EmailListCleaner";
import { OfficeHoursList } from "../components/OfficeHoursList";
import { PoemListItem } from "../components/PoemListItem";
import { PollsList } from "../components/PollsList";
import { ReadingsList } from "../components/ReadingsList";
import { getClassTitle, getLessonForClass, getState } from "../lib/storage";
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
  // Nullable — unlike a tab strip, an accordion can have nothing expanded;
  // clicking the already-open header collapses it back to null instead of
  // forcing exactly one class to always stay open.
  const [selectedClass, setSelectedClass] = useState<number | null>(() => {
    const withPoems = allClassNumbers.filter((classNumber) => classNumbersWithPoems.has(classNumber));
    return withPoems.length > 0 ? withPoems[withPoems.length - 1] : allClassNumbers[0];
  });

  const studentById = new Map(students.map((student) => [student.id, student]));
  const isPending = selectedClass !== null && !classNumbersWithPoems.has(selectedClass);
  const poemsInClass = selectedClass !== null ? poems.filter((poem) => poem.classNumber === selectedClass) : [];
  const awaitingPoems = poemsInClass.filter((poem) => poem.status === "awaiting_feedback");
  const givenPoems = poemsInClass.filter((poem) => poem.status === "feedback_given");
  const lesson = selectedClass !== null ? getLessonForClass(selectedClass) : undefined;
  const lessonOpensInFuture = Boolean(lesson?.openAt) && new Date(lesson!.openAt!).getTime() > Date.now();

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

      <Link to="/syllabus" className="lesson-link">
        View syllabus &rarr;
      </Link>

      <EmailListCleaner />
      <OfficeHoursList />

      <ul className="class-accordion" aria-label="Class">
        {allClassNumbers.map((classNumber) => {
          const pending = !classNumbersWithPoems.has(classNumber);
          const isOpen = classNumber === selectedClass;
          const title = getClassTitle(classNumber);
          return (
            <li
              key={classNumber}
              className={`class-accordion-item${isOpen ? " class-accordion-item--open" : ""}${pending ? " class-accordion-item--pending" : ""}`}
            >
              <button
                type="button"
                className="class-accordion-header"
                onClick={() => setSelectedClass(isOpen ? null : classNumber)}
                aria-expanded={isOpen}
              >
                <span className="class-accordion-label">
                  Class {classNumber}
                  {title ? `: ${title}` : ""}
                </span>
                <span className="class-accordion-chevron" aria-hidden="true">
                  {isOpen ? "▾" : "▸"}
                </span>
              </button>

              {isOpen && (
                <div className="class-accordion-body">
                  <Link to={`/lessons/${selectedClass}`} className="lesson-link">
                    {lesson ? "View/edit lesson" : "Write lesson"} for Class {selectedClass} &rarr;
                  </Link>
                  {lessonOpensInFuture && (
                    <p className="lesson-schedule-status lesson-schedule-status--pending">
                      Not yet visible — opens {new Date(lesson!.openAt!).toLocaleString()}
                    </p>
                  )}

                  {isPending ? (
                    <>
                      <h2 className="class-heading class-heading--pending">Pending</h2>
                      <p className="empty-note">This class hasn't happened yet.</p>
                    </>
                  ) : (
                    <>
                      <h2 className="class-heading">Awaiting feedback</h2>
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
                          <h2 className="class-heading">Feedback given</h2>
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

                  <ReadingsList classNumber={selectedClass} />
                  <PollsList classNumber={selectedClass} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {selectedStudent && (
        <AuthorModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      )}
    </div>
  );
}
