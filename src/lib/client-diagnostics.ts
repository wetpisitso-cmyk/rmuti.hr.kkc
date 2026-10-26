// Only display this locally in an opt-in troubleshooting view.
// No diagnostics are submitted to a server or stored.
export function safeClientError(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  const raw = error instanceof Error ? error.message : String(error);
  const cleaned = (name + ": " + raw)
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[URL]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
    .replace(/\b\d{13}\b/g, "[ID]")
    .replace(/\b[A-Za-z0-9_-]{42,}\b/g, "[TOKEN]");
  return cleaned.slice(0, 260);
}
