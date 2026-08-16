import { getState } from "../lib/storage";
import { useViewAs } from "../lib/viewAs";

export function ViewAsToggle() {
  const { students } = getState();
  const { viewingAsStudentId, isStudentView, setViewingAsStudentId } = useViewAs();

  return (
    <div className={`view-as-bar${isStudentView ? " view-as-bar--active" : ""}`}>
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
