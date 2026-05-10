export async function onRequestGet({ params, env, request }) {
  const slug = params.slug;

  // Try R2 CMS page first
  try {
    const obj = await env.BLOG.get(`pages/${slug}/index.html`);
    if (obj) {
      return new Response(obj.body, {
        headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public,max-age=60' }
      });
    }
  } catch (e) {
    return new Response(`R2 error for pages/${slug}/index.html: ${e.message}`, { status: 500 });
  }

  // Fall back to a real static file if one exists (e.g. /photos/).
  // Fetch the explicit index.html path — avoids Cloudflare's SPA fallback
  // which returns root index.html with status 200 for any unknown path.
  const staticUrl = new URL(request.url);
  staticUrl.pathname = `/${slug}/index.html`;
  const staticRes = await env.ASSETS.fetch(staticUrl.toString());
  if (staticRes.status === 200) return staticRes;

  return new Response(`Page not found: no CMS page or static file for /${slug}/`, { status: 404 });
}
