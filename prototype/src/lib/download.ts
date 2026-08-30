export function downloadTextFile(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Strips characters that aren't safe across Windows/macOS/Linux filenames
// (workshop names are free text, e.g. "Line & Form: A Poetry Workshop").
export function sanitizeFilenameSegment(text: string): string {
  return text.replace(/[\\/:*?"<>|]/g, "").trim();
}
