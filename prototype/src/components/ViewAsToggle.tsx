import { getState } from "../lib/storage";
import { useViewAs } from "../lib/viewAs";

interface ViewAsToggleProps {
  onAboutClick?: () => void;
}

export function ViewAsToggle({ onAboutClick }: ViewAsToggleProps) {
  const { students } = getState();
  const { viewingAsStudentId, isStudentView, setViewingAsStudentId } = useViewAs();

  return (
    <div className={`view-as-bar${isStudentView ? " view-as-bar--active" : ""}`}>
      {onAboutClick && (
        <button type="button" className="about-demo-button" onClick={onAboutClick}>
          About this demo
        </button>
      )}
      <label className="view-as-label">
        Viewing as
        <select
          className="view-as-select"
          value={viewingAsStudentId ?? ""}
          onChange={(event) => setViewingAsStudentId(event.target.value || null)}
        >
          <option value="">Instructor (Sam Cha)</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
