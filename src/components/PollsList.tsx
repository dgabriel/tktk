import { useState } from "react";
import { addPoll, deletePoll, getPollsForClass, getState, toggleVote } from "../lib/storage";
import type { Poll } from "../types";

export function PollsList({ classNumber }: { classNumber: number }) {
  const { currentUser } = getState();
  const [polls, setPolls] = useState<Poll[]>(() => getPollsForClass(classNumber));
  const [question, setQuestion] = useState("");
  const [optionInputs, setOptionInputs] = useState(["", ""]);

  function handleOptionChange(index: number, value: string) {
    setOptionInputs((prev) => prev.map((option, i) => (i === index ? value : option)));
  }

  function handleAddOptionField() {
    setOptionInputs((prev) => [...prev, ""]);
  }

  function handleCreatePoll() {
    const cleanOptions = optionInputs.map((option) => option.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < 2) return;
    const saved = addPoll({ classNumber, question: question.trim(), optionLabels: cleanOptions });
    setPolls((prev) => [...prev, saved]);
    setQuestion("");
    setOptionInputs(["", ""]);
  }

  function handleVote(pollId: string, optionId: string) {
    const updated = toggleVote(pollId, optionId, currentUser.username);
    if (!updated) return;
    setPolls((prev) => prev.map((poll) => (poll.id === pollId ? updated : poll)));
  }

  function handleDeletePoll(pollId: string) {
    deletePoll(pollId);
    setPolls((prev) => prev.filter((poll) => poll.id !== pollId));
  }

  return (
    <div className="polls-section">
      <h2 className="class-heading">Class {classNumber}: polls</h2>

      <details className="lesson-import">
        <summary>New poll</summary>
        <input
          type="text"
          className="readings-add-input polls-question-input"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Question…"
        />
        {optionInputs.map((option, index) => (
          <input
            key={index}
            type="text"
            className="readings-add-input polls-option-input"
            value={option}
            onChange={(event) => handleOptionChange(index, event.target.value)}
            placeholder={`Option ${index + 1}`}
          />
        ))}
        <div className="composer-actions">
          <button type="button" onClick={handleAddOptionField}>
            + Add option
          </button>
          <button
            type="button"
            className="composer-save"
            onClick={handleCreatePoll}
            disabled={!question.trim() || optionInputs.filter((o) => o.trim()).length < 2}
          >
            Create poll
          </button>
        </div>
      </details>

      {polls.length === 0 ? (
        <p className="empty-note">No polls for this class yet.</p>
      ) : (
        <ul className="polls-list">
          {polls.map((poll) => {
            const totalVotes = poll.options.reduce((sum, option) => sum + option.voterIds.length, 0);
            return (
              <li key={poll.id} className="poll-card">
                <div className="poll-question-row">
                  <p className="poll-question">{poll.question}</p>
                  <button
                    type="button"
                    className="comment-card-action"
                    onClick={() => handleDeletePoll(poll.id)}
                  >
                    Delete
                  </button>
                </div>
                <ul className="poll-options">
                  {poll.options.map((option) => {
                    const pct = totalVotes === 0 ? 0 : Math.round((option.voterIds.length / totalVotes) * 100);
                    const votedByMe = option.voterIds.includes(currentUser.username);
                    return (
                      <li key={option.id}>
                        <button
                          type="button"
                          className={`poll-option-button${votedByMe ? " poll-option-button--voted" : ""}`}
                          onClick={() => handleVote(poll.id, option.id)}
                        >
                          <span className="poll-option-bar" style={{ width: `${pct}%` }} />
                          <span className="poll-option-label">
                            {votedByMe ? "✓ " : ""}
                            {option.label}
                          </span>
                          <span className="poll-option-count">
                            {option.voterIds.length} ({pct}%)
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
