import { useEffect, useRef, useState } from "react";
import type { PromptStage } from "../types";

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

// Runs a multi-stage in-class writing prompt live: stage 1 shows for its
// duration, then the timer auto-advances to stage 2, and so on — the
// "built-in timer and ability to hide/reveal text, linked to timer, for
// multi-stage prompts" bonus from the original ask. All state here is
// ephemeral (not persisted) — it's a presentation aid for one live class,
// not something that needs to survive a reload.
export function PromptRunner({ stages }: { stages: PromptStage[] }) {
  const [stageIndex, setStageIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(() => (stages[0]?.durationMinutes ?? 0) * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, [running]);

  // Fires exactly once per stage when the countdown reaches 0 (React bails
  // out of re-running effects when a primitive state value doesn't
  // change, so repeated ticks at 0 don't re-trigger this).
  useEffect(() => {
    if (!running || remainingSeconds !== 0) return;
    if (stageIndex < stages.length - 1) {
      const next = stageIndex + 1;
      setStageIndex(next);
      setRemainingSeconds(stages[next].durationMinutes * 60);
    } else {
      setRunning(false);
    }
  }, [remainingSeconds, running, stageIndex, stages]);

  function handleReset() {
    setRunning(false);
    setStageIndex(0);
    setRemainingSeconds((stages[0]?.durationMinutes ?? 0) * 60);
  }

  function handleRevealNext() {
    if (stageIndex >= stages.length - 1) return;
    const next = stageIndex + 1;
    setStageIndex(next);
    setRemainingSeconds(stages[next].durationMinutes * 60);
  }

  if (stages.length === 0) {
    return <p className="empty-note">Add at least one stage to run this prompt.</p>;
  }

  const currentStage = stages[stageIndex];

  return (
    <div className="prompt-runner">
      <p className="prompt-runner-stage-label">
        Stage {stageIndex + 1} of {stages.length}
      </p>
      <p className="prompt-runner-text">{currentStage.text || "(empty stage)"}</p>
      <p className="prompt-runner-timer">{formatTime(remainingSeconds)}</p>
      <div className="prompt-runner-controls">
        {running ? (
          <button
            type="button"
            className="lesson-pill-button lesson-pill-button--small lesson-pill-button--primary"
            onClick={() => setRunning(false)}
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            className="lesson-pill-button lesson-pill-button--small lesson-pill-button--primary"
            onClick={() => setRunning(true)}
          >
            Start
          </button>
        )}
        <button type="button" className="lesson-pill-button lesson-pill-button--small" onClick={handleReset}>
          Reset
        </button>
        <button
          type="button"
          className="lesson-pill-button lesson-pill-button--small"
          onClick={handleRevealNext}
          disabled={stageIndex >= stages.length - 1}
        >
          Reveal next stage now
        </button>
      </div>
    </div>
  );
}
