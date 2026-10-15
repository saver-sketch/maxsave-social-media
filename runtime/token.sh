# Sourced by the workflows: sets IG_ACCESS_TOKEN (masked) from state/token.enc or the seed secret.
# With REFRESH=1 and a token 30+ days old, refreshes it and commits the new encrypted copy.
# Needs env: SEED_TOKEN, TOKEN_KEY.
set -euo pipefail
if [ -f state/token.enc ]; then
  IG_ACCESS_TOKEN=$(openssl enc -d -aes-256-cbc -pbkdf2 -a -A -pass env:TOKEN_KEY -in state/token.enc)
else
  IG_ACCESS_TOKEN="$SEED_TOKEN"
fi
echo "::add-mask::$IG_ACCESS_TOKEN"
ISSUED=$(cat state/token.issued 2>/dev/null || echo 2026-10-14)
AGE=$(( ( $(date -u +%s) - $(date -u -d "$ISSUED" +%s) ) / 86400 ))
echo "token age ${AGE} days"
if [ "${REFRESH:-0}" = "1" ] && [ "$AGE" -ge 30 ]; then
  NEW=$(curl -sf "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${IG_ACCESS_TOKEN}" | jq -r '.access_token // empty' || true)
  if [ -n "$NEW" ]; then
    echo "::add-mask::$NEW"
    IG_ACCESS_TOKEN="$NEW"
    printf '%s' "$IG_ACCESS_TOKEN" | openssl enc -aes-256-cbc -pbkdf2 -a -A -pass env:TOKEN_KEY -out state/token.enc
    date -u +%Y-%m-%d > state/token.issued
    git config user.name "maxsave-social bot"
    git config user.email "actions@users.noreply.github.com"
    git add state/token.enc state/token.issued
    git commit -m "Refresh Instagram token"
    git push
    echo "token refreshed"
  else
    echo "::warning::token refresh failed; continuing with current token"
  fi
fi
export IG_ACCESS_TOKEN
