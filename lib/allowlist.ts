export function isEmailAllowed(email: string): boolean {
  const raw = process.env.ALLOWLIST_EMAILS ?? "";
  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
