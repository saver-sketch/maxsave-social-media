// Minimal Instagram Graph API client (Instagram API with Instagram Login). No dependencies.
export const GRAPH = 'https://graph.instagram.com/v23.0';
export const IMAGE_BASE = 'https://raw.githubusercontent.com/saver-sketch/maxsave-social-media/main';

export function env() {
  const userId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!userId || !token) throw new Error('Missing IG_USER_ID or IG_ACCESS_TOKEN');
  return { userId, token };
}

export async function graph(token, method, pathAndQuery, body) {
  const res = await fetch(`${GRAPH}${pathAndQuery}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(`graph ${method} ${pathAndQuery.split('?')[0]}: ${json.error?.message ?? res.status}`);
  }
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFinished(token, id) {
  for (let i = 0; i < 20; i++) {
    const { status_code } = await graph(token, 'GET', `/${id}?fields=status_code`);
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') {
      throw new Error(`container ${id} ${status_code}`);
    }
    await sleep(15_000);
  }
  throw new Error(`container ${id} not ready after 5 minutes`);
}

/** Builds a carousel container from 2-10 JPEG URLs and returns its id (not published). */
export async function createCarousel({ userId, token }, imageUrls, caption) {
  const children = [];
  for (const url of imageUrls) {
    const { id } = await graph(token, 'POST', `/${userId}/media`, {
      image_url: url,
      is_carousel_item: 'true',
    });
    children.push(id);
  }
  for (const id of children) await waitFinished(token, id);
  const { id } = await graph(token, 'POST', `/${userId}/media`, {
    media_type: 'CAROUSEL',
    children: children.join(','),
    caption,
  });
  await waitFinished(token, id);
  return id;
}

export async function publish({ userId, token }, creationId) {
  const { id } = await graph(token, 'POST', `/${userId}/media_publish`, { creation_id: creationId });
  const { permalink } = await graph(token, 'GET', `/${id}?fields=permalink`);
  return { id, permalink };
}
