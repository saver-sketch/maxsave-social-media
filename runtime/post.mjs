// Publishes today's scheduled post (carousel, single image, or Reel; Pacific date) from schedule.json.
// Flags: --date=YYYY-MM-DD  --dry-run (no Instagram calls)  --no-publish (build container only)
import { readFileSync } from 'node:fs';
import { IMAGE_BASE, createCarousel, createImage, createReel, env, graph, publish } from './ig.mjs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const today =
  args.find((a) => a.startsWith('--date='))?.slice(7) ||
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());

const schedule = JSON.parse(readFileSync(new URL('../schedule.json', import.meta.url), 'utf8'));
const entry = schedule.find((e) => e.date === today);
if (!entry) {
  console.error(`No post scheduled for ${today} (bank ends ${schedule.at(-1)?.date}). Refill the bank.`);
  process.exit(1);
}

const type = entry.type ?? 'carousel';
const files =
  type === 'reel' ? [entry.video, entry.cover] : type === 'image' ? [entry.image] : entry.images;
const urls = files.map((f) => `${IMAGE_BASE}/${f}`);
console.log(`${today} ${type} ${entry.pillar}: ${entry.headline} (${urls.length} file${urls.length > 1 ? 's' : ''})`);
for (const u of urls) {
  const r = await fetch(u, { method: 'HEAD' });
  if (!r.ok) throw new Error(`image not reachable: ${r.status} ${u}`);
}
if (has('--dry-run')) {
  console.log(`dry run\n\n${entry.caption}`);
  process.exit(0);
}

const cfg = env();
// Idempotent: a rerun or a late schedule never double-posts.
const firstLine = entry.caption.split('\n')[0];
const recent = await graph(cfg.token, 'GET', '/me/media?fields=caption&limit=5');
if (recent.data?.some((m) => m.caption?.startsWith(firstLine))) {
  console.log('already posted; nothing to do');
  process.exit(0);
}

const creation =
  type === 'reel'
    ? await createReel(cfg, urls[0], urls[1], entry.caption)
    : type === 'image'
      ? await createImage(cfg, urls[0], entry.caption, entry.alt_text)
      : await createCarousel(cfg, urls, entry.caption);
if (has('--no-publish')) {
  console.log(`${type} container ${creation} FINISHED; not publishing (expires in 24 hours)`);
  process.exit(0);
}
const { id, permalink } = await publish(cfg, creation);
console.log(`published ${id} ${permalink}`);
