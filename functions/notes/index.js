export async function onRequestGet({ env }) {
  if (!env.BLOG) return new Response('R2 binding BLOG not configured.', { status: 500 });
  const obj = await env.BLOG.get('pages/notes/index.html');
  if (!obj) return new Response('No notes yet.', { status: 404 });
  return new Response(obj.body, {
    headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public,max-age=60' },
  });
}
