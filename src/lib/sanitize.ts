export function sanitizeMessage(text: string): string {
  const urlPattern = /(?:https?:\/\/|www\.)[^\s]+/gi;
  const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return text
    .replace(urlPattern, "[link removed]")
    .replace(phonePattern, "[phone removed]")
    .replace(emailPattern, "[email removed]");
}
