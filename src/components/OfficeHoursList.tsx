import { useState } from "react";
import {
  addOfficeHoursSlot,
  deleteOfficeHoursSlot,
  getOfficeHoursSlots,
  getState,
  setOfficeHoursBooking,
} from "../lib/storage";
import { useViewAs } from "../lib/viewAs";
import type { OfficeHoursSlot } from "../types";

// Booking is instructor-assigned for now (a "Booked by" dropdown), not
// self-serve — the student-view toggle is a read-only preview of a
// student's screen, not a real per-student booking flow, so a student
// still can't book their own slot here even while viewing as one.
export function OfficeHoursList() {
  const { students } = getState();
  const { isStudentView } = useViewAs();
  const [slots, setSlots] = useState<OfficeHoursSlot[]>(() => getOfficeHoursSlots());
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  function handleAddSlot() {
    if (!startAt || !endAt) return;
    const saved = addOfficeHoursSlot({ startAt, endAt });
    setSlots((prev) => [...prev, saved]);
    setStartAt("");
    setEndAt("");
  }

  function handleDeleteSlot(id: string) {
    deleteOfficeHoursSlot(id);
    setSlots((prev) => prev.filter((slot) => slot.id !== id));
  }

  function handleBookingChange(id: string, studentId: string) {
    const updated = setOfficeHoursBooking(id, studentId || undefined);
    if (!updated) return;
    setSlots((prev) => prev.map((slot) => (slot.id === id ? updated : slot)));
  }

  const sortedSlots = [...slots].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  return (
    <details className="lesson-import office-hours-section">
      <summary>Office hours</summary>
      {!isStudentView && (
        <>
          <p className="lesson-import-hint">
            Self-serve booking isn&rsquo;t available yet — this lets you add slots and record who&rsquo;s
            booked each one.
          </p>
          <div className="office-hours-add-row">
            <label>
              Start
              <input
                type="datetime-local"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
              />
            </label>
            <label>
              End
              <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
            </label>
            <button type="button" onClick={handleAddSlot} disabled={!startAt || !endAt}>
              Add slot
            </button>
          </div>
        </>
      )}

      {sortedSlots.length === 0 ? (
        <p className="empty-note">No office hours slots yet.</p>
      ) : (
        <ul className="office-hours-list">
          {sortedSlots.map((slot) => (
            <li key={slot.id} className="office-hours-item">
              <span className="office-hours-time">
                {new Date(slot.startAt).toLocaleString()} &ndash;{" "}
                {new Date(slot.endAt).toLocaleTimeString()}
              </span>
              {isStudentView ? (
                <span className="office-hours-status">
                  {slot.bookedByStudentId
                    ? `Booked: ${students.find((student) => student.id === slot.bookedByStudentId)?.name ?? "—"}`
                    : "Open"}
                </span>
              ) : (
                <>
                  <select
                    value={slot.bookedByStudentId ?? ""}
                    onChange={(event) => handleBookingChange(slot.id, event.target.value)}
                  >
                    <option value="">Open</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="comment-card-action"
                    onClick={() => handleDeleteSlot(slot.id)}
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
