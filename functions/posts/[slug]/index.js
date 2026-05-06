export async function onRequestGet({ params, env }) {
  const slug = params.slug;
  if (!slug) return new Response('Not found', { status: 404 });

  const obj = await env.BLOG.get(`posts/${slug}/index.html`);
  if (!obj) return new Response('Post not found', { status: 404 });

  return new Response(obj.body, {
    headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public,max-age=60' }
  });
}
