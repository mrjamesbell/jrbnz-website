export async function onRequestGet({ params, env }) {
  const slug = params.slug;
  if (!slug) return new Response('Not found', { status: 404 });

  const cached = await env.BLOG.get(`posts/${slug}/index.html`);
  if (!cached) return new Response('Not found', { status: 404 });
  return new Response(cached.body, {
    headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public,max-age=60' },
  });
}
