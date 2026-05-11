export async function onRequestGet({ request, params, env }) {
  const key = 'media/' + params.path.join('/');
  const obj = await env.BLOG.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const type = obj.httpMetadata?.contentType || 'application/octet-stream';
  const headers = { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable' };
  if (obj.httpEtag) {
    headers['ETag'] = obj.httpEtag;
    if (request.headers.get('If-None-Match') === obj.httpEtag) {
      await obj.body.cancel();
      return new Response(null, { status: 304, headers });
    }
  }
  return new Response(obj.body, { headers });
}
