// Answers "CALLS" / "COMPARE" comments: one private DM plus a short public reply.
// Instagram allows one private reply per comment, within 7 days; this looks back 3 days.
// A comment that already carries our public reply is treated as handled.
import { env, graph } from './ig.mjs';

const HANDLE = 'maxsavehub';
const MESSAGES = {
  CALLS:
    "Thanks for commenting! MaXsaveHub sends live inbound final expense calls to licensed agents. Every caller is exclusive to one agent, routing follows the states you're licensed in, and you take calls from a browser tab. Apply in two minutes: https://maxsavehub.com/join (a person reads every application, usually within a day or two).",
  COMPARE:
    'Thanks for reaching out! You can compare final expense coverage by phone with a licensed agent at (888) 561-6302. No cost, and no obligation to buy. Licensed agent. Availability varies by state.',
};
const PUBLIC_REPLY = 'Check your DMs 📩';

function keywordOf(text = '') {
  const t = text.toUpperCase();
  if (/\bCOMPARE\b/.test(t)) return 'COMPARE';
  if (/\bCALLS?\b/.test(t)) return 'CALLS';
  return null;
}

const dry = process.argv.includes('--dry-run');
const cfg = env();
const cutoff = Date.now() - 3 * 86_400_000;
// One call per pass: only open posts that actually have comments (keeps us far below Meta's limits).
const media = await graph(cfg.token, 'GET', '/me/media?fields=id,timestamp,comments_count&limit=12');

let seen = 0;
let answered = 0;
for (const m of media.data ?? []) {
  if (!m.comments_count) continue;
  const comments = await graph(
    cfg.token,
    'GET',
    `/${m.id}/comments?fields=id,text,username,timestamp,replies{text}&limit=50`,
  );
  for (const c of comments.data ?? []) {
    if (c.username === HANDLE || c.text === PUBLIC_REPLY || Date.parse(c.timestamp) < cutoff) continue;
    const kw = keywordOf(c.text);
    if (!kw) continue;
    seen++;
    // Instagram omits usernames for most commenters, so our public reply's text marks a comment as handled.
    if ((c.replies?.data ?? []).some((r) => r.text === PUBLIC_REPLY)) continue;
    if (dry) {
      console.log(`would answer ${kw} for comment ${c.id} on ${m.id}`);
      continue;
    }
    try {
      await graph(cfg.token, 'POST', `/${cfg.userId}/messages`, {
        recipient: { comment_id: c.id },
        message: { text: MESSAGES[kw] },
      });
      await graph(cfg.token, 'POST', `/${c.id}/replies`, { message: PUBLIC_REPLY });
      answered++;
      console.log(`answered ${kw} for comment ${c.id} on ${m.id}`);
    } catch (e) {
      console.error(`could not answer comment ${c.id}: ${e.message}`);
    }
  }
}
console.log(`keyword comments in the last 3 days: ${seen}; newly answered: ${answered}`);
