import { useState } from "react";
import { useViewAs } from "../lib/viewAs";

// Matches the pasted-Gmail-list case the instructor described: "Name
// <email@x.com>, Other Name <other@x.com>" — extracting just the email
// pattern strips the display name and angle brackets in one pass, rather
// than trying to parse/strip those characters explicitly.
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function extractEmails(raw: string): string[] {
  const matches = raw.match(EMAIL_PATTERN) ?? [];
  return Array.from(new Set(matches));
}

export function EmailListCleaner() {
  const { isStudentView } = useViewAs();
  const [raw, setRaw] = useState("");
  const [emails, setEmails] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  if (isStudentView) return null;

  function handleClean() {
    setEmails(extractEmails(raw));
    setCopied(false);
  }

  async function handleCopy() {
    if (!emails || emails.length === 0) return;
    await navigator.clipboard.writeText(emails.join(", "));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <details className="lesson-import">
      <summary>Clean up an email list</summary>
      <p className="lesson-import-hint">
        Paste a contact list copied from Gmail (or anywhere with names and &lt;angle-bracket&gt;
        addresses) — this strips everything down to just the email addresses.
      </p>
      <textarea
        className="lesson-import-textarea"
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
        placeholder={"Emily Dickinson <edickinson@example.com>, Audre Lorde <alorde@example.com>"}
      />
      <button type="button" onClick={handleClean} disabled={!raw.trim()}>
        Clean list
      </button>

      {emails && (
        <div className="email-cleaner-result">
          <p className="lesson-import-hint">
            {emails.length} email{emails.length === 1 ? "" : "s"} found
          </p>
          {emails.length > 0 && (
            <>
              <textarea
                className="lesson-import-textarea email-cleaner-output"
                value={emails.join(", ")}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
              <button type="button" onClick={handleCopy}>
                {copied ? "Copied!" : "Copy to clipboard"}
              </button>
            </>
          )}
        </div>
      )}
    </details>
  );
}
