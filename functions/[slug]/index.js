export async function onRequestGet({ params, env, request }) {
  // Try static asset first (handles /directing/, /now/, etc.)
  const staticRes = await env.ASSETS.fetch(request);
  if (staticRes.status !== 404) return staticRes;

  // Fall back to R2 CMS page
  const slug = params.slug;
  const obj = await env.BLOG.get(`pages/${slug}/index.html`);
  if (!obj) return new Response('Page not found', { status: 404 });
  return new Response(obj.body, {
    headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public,max-age=60' }
  });
}
