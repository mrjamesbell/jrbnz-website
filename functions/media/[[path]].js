export async function onRequestGet({ request, params, env }) {
  const key = 'media/' + params.path.join('/');

  // Check metadata first so we can handle 304 without streaming the body
  const meta = await env.BLOG.head(key);
  if (!meta) return new Response('Not found', { status: 404 });

  const etag = meta.httpEtag;
  const cacheHeaders = { 'cache-control': 'public, max-age=31536000, immutable', ...(etag ? { ETag: etag } : {}) };

  if (etag && request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: cacheHeaders });
  }

  const obj = await env.BLOG.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const type = obj.httpMetadata?.contentType || 'application/octet-stream';
  return new Response(obj.body, { headers: { 'content-type': type, ...cacheHeaders } });
}
