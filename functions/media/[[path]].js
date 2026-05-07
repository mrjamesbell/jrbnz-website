export async function onRequestGet({ params, env }) {
  const key = 'media/' + params.path.join('/');
  const obj = await env.BLOG.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const type = obj.httpMetadata?.contentType || 'application/octet-stream';
  return new Response(obj.body, {
    headers: { 'content-type': type, 'cache-control': 'public,max-age=31536000' }
  });
}
