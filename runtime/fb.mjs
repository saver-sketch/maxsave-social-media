// Minimal Facebook Page publisher (Graph API, Page access token). No dependencies.
// Carousel → multi-photo feed post · image → photo post · reel → video post.
const GRAPH = 'https://graph.facebook.com/v21.0';

export function fbEnv() {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_TOKEN;
  return pageId && token ? { pageId, token } : null;
}

async function call(token, method, path, params = {}) {
  const body = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH}${path}${method === 'GET' ? `?${body}` : ''}`, {
    method,
    ...(method === 'GET' ? {} : { body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`facebook ${method} ${path}: ${json.error?.message ?? res.status}`);
  return json;
}

/** True when a post whose message starts with firstLine is already on the Page (idempotency). */
export async function fbAlreadyPosted({ pageId, token }, firstLine) {
  const { data = [] } = await call(token, 'GET', `/${pageId}/feed`, { fields: 'message', limit: '10' });
  return data.some((p) => p.message?.startsWith(firstLine));
}

export async function fbPublish(cfg, entry, urls) {
  const { pageId, token } = cfg;
  const type = entry.type ?? 'carousel';
  // Facebook captions: hashtags add nothing on Pages; keep the copy, drop the tag line.
  const message = entry.caption
    .split('\n')
    .filter((l) => !/^#/.test(l.trim()))
    .join('\n')
    .trim();
  if (type === 'reel') {
    const { id } = await call(token, 'POST', `/${pageId}/videos`, {
      file_url: urls[0],
      description: message,
      title: entry.headline ?? '',
    });
    return { id, kind: 'video' };
  }
  if (type === 'image') {
    const { post_id, id } = await call(token, 'POST', `/${pageId}/photos`, { url: urls[0], message });
    return { id: post_id ?? id, kind: 'photo' };
  }
  const ids = [];
  for (const url of urls) {
    const { id } = await call(token, 'POST', `/${pageId}/photos`, { url, published: 'false' });
    ids.push(id);
  }
  const params = { message };
  ids.forEach((id, i) => (params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
  const { id } = await call(token, 'POST', `/${pageId}/feed`, params);
  return { id, kind: 'album' };
}
