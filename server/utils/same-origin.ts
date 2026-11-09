// A POST with cookies is only trusted when it comes from our own pages (CSRF protection).
// A missing Origin means a non-browser client, which has no visitor cookie to abuse
export function isAllowedOrigin(origin: string | undefined, host: string): boolean {
  if (origin === undefined) return true;
  if (!URL.canParse(origin)) return false;
  return new URL(origin).host === host;
}
