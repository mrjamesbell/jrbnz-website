export async function onRequestGet({ env, request }) {
  // Try Worker-rendered homepage from R2 first
  try {
    const r2 = await env.BLOG.get('pages/homepage/index.html');
    if (r2) {
      return new Response(r2.body, {
        headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public,max-age=60' },
      });
    }
  } catch {}

  // Fall back to static index.html with accent injection
  const [staticRes, accentObj] = await Promise.all([
    env.ASSETS.fetch(request),
    env.BLOG.get('settings/accent.json'),
  ]);

  if (!accentObj) return staticRes;

  let accent;
  try {
    ({ accent } = JSON.parse(await accentObj.text()));
  } catch {
    return staticRes;
  }

  if (!accent) return staticRes;

  const html = await staticRes.text();
  const injected = html.replace(
    '</head>',
    `<style>:root{--accent-color:${accent.replace(/<\/style>/gi, '')}}</style></head>`
  );

  return new Response(injected, {
    headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public,max-age=60' },
  });
}
