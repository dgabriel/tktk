import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AuthorModal } from "../components/AuthorModal";
import { LessonView } from "../components/LessonView";
import { PoemListItem } from "../components/PoemListItem";
import { PollsList } from "../components/PollsList";
import { ReadingsList } from "../components/ReadingsList";
import { getClassTitle, getLessonForClass, getState } from "../lib/storage";
import { useViewAs } from "../lib/viewAs";
import type { Student } from "../types";

type ClassSection = "lesson" | "readings" | "workshop" | "polls";

const SECTIONS: { id: ClassSection; label: string }[] = [
  { id: "lesson", label: "Lesson" },
  { id: "readings", label: "Readings" },
  { id: "workshop", label: "Workshop" },
  { id: "polls", label: "Polls" },
];

function sectionDomId(section: ClassSection): string {
  return `class-section-${section}`;
}

function OutlineToggleIcon() {
  return (
    <>
      <span className="lesson-outline-toggle-bar" />
      <span className="lesson-outline-toggle-bar" />
      <span className="lesson-outline-toggle-bar" />
    </>
  );
}

// The clean, read-first "what does a student see for this class" page —
// separate from the lesson editor (still the authoring tool, reachable
// from here via "Edit lesson") and from the workshop home page (now just
// a picker linking into this). All four sections live on one page as an
// accordion — any combination can be open at once. Navigation is the same
// slide-in/collapsible sidebar pattern as the lesson editor (deliberately
// duplicated here rather than shared, so this page doesn't risk touching
// that already-settled editor) instead of a pill row: clicking a sidebar
// item scrolls to that section and opens it if it was collapsed, but never
// closes one that's already open.
export function ClassView() {
  const { classNumber: classNumberParam } = useParams<{ classNumber: string }>();
  const classNumber = Number(classNumberParam);
  const { workshop, students, poems } = getState();
  const { isStudentView } = useViewAs();
  const [openSections, setOpenSections] = useState<Set<ClassSection>>(() => new Set(["lesson"]));
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 760);
  const [currentSection, setCurrentSection] = useState<ClassSection>("lesson");

  const titlebarRef = useRef<HTMLDivElement | null>(null);
  const [stickyOffsets, setStickyOffsets] = useState({ titlebarTop: 0, sidebarTop: 0 });

  useLayoutEffect(() => {
    function measure() {
      const viewAsBarHeight = document.querySelector(".view-as-bar")?.getBoundingClientRect().height ?? 0;
      const titlebarHeight = titlebarRef.current?.getBoundingClientRect().height ?? 0;
      setStickyOffsets({ titlebarTop: viewAsBarHeight, sidebarTop: viewAsBarHeight + titlebarHeight });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Scrollspy: highlights whichever section the viewport is actually
  // scrolled to, independent of that section's open/closed state (a
  // section can be open without currently being in view, e.g. after
  // opening several and scrolling past the first). The "active zone" is a
  // thin band just below the sticky title bar/sidebar top, not the whole
  // viewport, so the indicator flips as soon as a section's header crosses
  // that line rather than waiting for it to fill the screen.
  useEffect(() => {
    const topMargin = stickyOffsets.sidebarTop + 10;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        const topmost = visible.reduce((best, entry) =>
          entry.boundingClientRect.top < best.boundingClientRect.top ? entry : best,
        );
        const id = topmost.target.id.replace("class-section-", "") as ClassSection;
        setCurrentSection(id);
      },
      { rootMargin: `-${topMargin}px 0px -70% 0px`, threshold: 0 },
    );
    for (const section of SECTIONS) {
      const el = document.getElementById(sectionDomId(section.id));
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [stickyOffsets.sidebarTop]);

  const classTitle = getClassTitle(classNumber);
  const lesson = getLessonForClass(classNumber);
  const studentById = new Map(students.map((student) => [student.id, student]));
  const poemsInClass = poems.filter((poem) => poem.classNumber === classNumber);
  const awaitingPoems = poemsInClass.filter((poem) => poem.status === "awaiting_feedback");
  const givenPoems = poemsInClass.filter((poem) => poem.status === "feedback_given");

  function toggleSection(section: ClassSection) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  function jumpToSection(section: ClassSection) {
    setOpenSections((prev) => (prev.has(section) ? prev : new Set(prev).add(section)));
    // Wait a frame so a just-opened section has its body in the DOM before
    // scrolling to it — React commits the state update before the browser's
    // next paint, which is exactly when this callback fires.
    requestAnimationFrame(() => {
      document.getElementById(sectionDomId(section))?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="lesson-editor">
      <div className="lesson-titlebar" ref={titlebarRef} style={{ top: stickyOffsets.titlebarTop }}>
        <Link to="/" className="back-link">
          &larr; Back to workshop
        </Link>
      </div>

      <div className="lesson-workspace">
        {sidebarOpen && (
          <div
            className="lesson-outline-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <aside
          className={`lesson-outline${sidebarOpen ? "" : " lesson-outline--collapsed"}`}
          style={{ top: stickyOffsets.sidebarTop, height: `calc(100vh - ${stickyOffsets.sidebarTop}px)` }}
        >
          {sidebarOpen ? (
            <div className="lesson-outline-inner">
              <div className="lesson-outline-header">
                <h2 className="lesson-outline-heading">Sections</h2>
                <button
                  type="button"
                  className="lesson-outline-toggle"
                  aria-label="Collapse outline"
                  onClick={() => setSidebarOpen(false)}
                >
                  <OutlineToggleIcon />
                </button>
              </div>
              <div className="lesson-outline-body">
                <ul className="lesson-outline-list">
                  {SECTIONS.map((section) => (
                    <li key={section.id} className="lesson-outline-row">
                      <span
                        className={`class-nav-indicator${
                          currentSection === section.id ? " class-nav-indicator--current" : ""
                        }`}
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        className={`lesson-outline-link class-nav-link${
                          openSections.has(section.id) ? " class-nav-link--open" : ""
                        }`}
                        onClick={() => jumpToSection(section.id)}
                        aria-current={currentSection === section.id ? "true" : undefined}
                      >
                        {section.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="lesson-outline-rail">
              <button
                type="button"
                className="lesson-outline-toggle"
                aria-label="Show outline"
                title="Sections"
                onClick={() => setSidebarOpen(true)}
              >
                <OutlineToggleIcon />
              </button>
            </div>
          )}
        </aside>

        <div className="lesson-content">
          <div className="lesson-header">
            <Link to="/" className="lesson-workshop-link">
              {workshop.name}
            </Link>
            <h1 className="lesson-title-heading">
              Class {classNumber}
              {classTitle ? `, ${classTitle}` : ""}
            </h1>
          </div>

          <div className="lesson-main">
            <div className="class-accordion">
              {SECTIONS.map((section) => {
                const isOpen = openSections.has(section.id);
                return (
                  <div
                    key={section.id}
                    id={sectionDomId(section.id)}
                    className={`class-accordion-item${isOpen ? " class-accordion-item--open" : ""}`}
                  >
                    <button
                      type="button"
                      className="class-accordion-header"
                      onClick={() => toggleSection(section.id)}
                      aria-expanded={isOpen}
                    >
                      <span className="class-accordion-label">{section.label}</span>
                      <span className="class-accordion-chevron" aria-hidden="true">
                        {isOpen ? "▾" : "▸"}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="class-accordion-body">
                        {section.id === "lesson" &&
                          (lesson ? (
                            <>
                              {!isStudentView && (
                                <Link
                                  to={`/lessons/${classNumber}`}
                                  className="lesson-link class-view-edit-link"
                                >
                                  Edit lesson &rarr;
                                </Link>
                              )}
                              <LessonView lesson={lesson} workshopName={workshop.name} />
                            </>
                          ) : (
                            <>
                              <p className="empty-note">No lesson posted yet for this class.</p>
                              {!isStudentView && (
                                <Link to={`/lessons/${classNumber}`} className="lesson-link">
                                  Write lesson &rarr;
                                </Link>
                              )}
                            </>
                          ))}

                        {section.id === "readings" && <ReadingsList classNumber={classNumber} />}

                        {section.id === "workshop" && (
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

                        {section.id === "polls" && <PollsList classNumber={classNumber} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {selectedStudent && (
        <AuthorModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      )}
    </div>
  );
}
