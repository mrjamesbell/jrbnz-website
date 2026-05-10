export async function onRequestGet({ params, env, request }) {
  const slug = params.slug;

  // Try R2 CMS page first
  const obj = await env.BLOG.get(`pages/${slug}/index.html`);
  if (obj) {
    return new Response(obj.body, {
      headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public,max-age=60' }
    });
  }

  // Fall back to static asset (e.g. /directing/, /now/)
  // ASSETS returns the root index.html for unknown paths, so only use it when
  // the slug matches a real directory (status 200 on the exact path).
  const staticRes = await env.ASSETS.fetch(request);
  if (staticRes.status === 200) return staticRes;

  return new Response('Page not found', { status: 404 });
}
