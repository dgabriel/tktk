import { useState } from "react";
import { Link } from "react-router-dom";
import { addReading, deleteReading, getReadingsForClass } from "../lib/storage";
import { useViewAs } from "../lib/viewAs";
import type { Reading } from "../types";

// No backend here to fetch the linked page's real <title> (would need a
// server-side request to dodge CORS) — this derives a readable label from
// the URL itself: the last path segment if there is one, else the
// hostname. Good enough for a prototype; the instructor can still see and
// click the real link either way.
function deriveTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean)
      .pop();
    const fromPath = lastSegment?.replace(/[-_]+/g, " ").replace(/\.\w+$/, "").trim();
    const label = fromPath || parsed.hostname.replace(/^www\./, "");
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return url;
  }
}

export function ReadingsList({ classNumber }: { classNumber: number }) {
  const { isStudentView } = useViewAs();
  const [readings, setReadings] = useState<Reading[]>(() => getReadingsForClass(classNumber));
  const [url, setUrl] = useState("");

  function handleAdd() {
    const trimmed = url.trim();
    if (!trimmed) return;
    const saved = addReading({ classNumber, url: trimmed, title: deriveTitleFromUrl(trimmed) });
    setReadings((prev) => [...prev, saved]);
    setUrl("");
  }

  function handleDelete(id: string) {
    deleteReading(id);
    setReadings((prev) => prev.filter((reading) => reading.id !== id));
  }

  return (
    <div className="readings-section">
      <h2 className="class-heading">Class {classNumber}: readings</h2>
      {!isStudentView && (
        <div className="readings-add-row">
          <input
            type="url"
            className="readings-add-input"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Paste a link…"
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAdd();
            }}
          />
          <button type="button" onClick={handleAdd} disabled={!url.trim()}>
            Add reading
          </button>
        </div>
      )}

      {readings.length === 0 ? (
        <p className="empty-note">No readings added for this class yet.</p>
      ) : (
        <ul className="readings-list">
          {readings.map((reading) => (
            <li key={reading.id} className="readings-item">
              <a href={reading.url} target="_blank" rel="noreferrer" className="readings-item-link">
                {reading.title}
              </a>
              <div className="readings-item-actions">
                <Link to={`/readings/${reading.id}`} className="readings-item-feedback-link">
                  Feedback
                </Link>
                {!isStudentView && (
                  <button
                    type="button"
                    className="comment-card-action"
                    onClick={() => handleDelete(reading.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
