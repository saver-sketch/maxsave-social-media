# maxsave-social-media

Runtime for the @maxsavehub Instagram account. Public so GitHub Actions minutes are free.
Content is designed and rendered in a private repo; this repo only holds the finished slides,
`schedule.json`, and two small dependency-free scripts.

- `.github/workflows/post.yml` publishes the day's carousel at 16:00 UTC (9 AM PDT).
- `.github/workflows/replies.yml` runs every 5 minutes. Anyone who comments CALLS or COMPARE gets one
  private DM and a public "Check your DMs" reply.
- `runtime/token.sh` loads the Instagram token from `state/token.enc` (AES-256, key in secrets) or the
  seed secret, and refreshes it every 30 days from the daily job.

Secrets: `IG_USER_ID`, `IG_ACCESS_TOKEN` (seed), `TOKEN_KEY`.
