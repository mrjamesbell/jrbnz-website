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

  // Fall back to static index.html with theme + accent injection
  const [staticRes, accentObj, siteObj] = await Promise.all([
    env.ASSETS.fetch(request),
    env.BLOG.get('settings/accent.json'),
    env.BLOG.get('settings/site.json'),
  ]);

  let accent = null;
  try { ({ accent } = JSON.parse(await accentObj.text())); } catch {}

  let theme = 'cinematic';
  try { ({ theme = 'cinematic' } = JSON.parse(await siteObj.text())); } catch {}

  let html = await staticRes.text();

  // Inject data-theme onto <html>
  html = html.replace(/(<html[^>]*)\bdata-theme="[^"]*"/, `$1data-theme="${theme}"`);

  // Swap theme CSS link
  html = html.replace(
    /href="\/styles\/themes\/[^"]+"/,
    `href="/styles/themes/${theme}.css"`
  );

  // Inject accent if set
  if (accent) {
    const safe = accent.replace(/<\/style>/gi, '');
    html = html.replace('</head>', `<style>:root{--color-accent:${safe};--accent-color:${safe}}</style></head>`);
  }

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public,max-age=60' },
  });
}
