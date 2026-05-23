const SITE_URL = 'https://jrbnz.com';

function fmtDate(iso) {
  return iso ? iso.slice(0, 10) : '';
}

function url(loc, lastmod) {
  return `  <url>\n    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`;
}

export async function onRequestGet({ env }) {
  const cached = await env.BLOG.get('sitemap.xml');
  if (cached) {
    return new Response(await cached.text(), {
      headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
    });
  }

  const [postsObj, pagesObj] = await Promise.all([
    env.BLOG.get('posts/index.json'),
    env.BLOG.get('pages/index.json'),
  ]);

  const posts = postsObj ? await postsObj.json() : [];
  const pages = pagesObj ? await pagesObj.json() : [];

  const publishedPosts = posts
    .filter(p => p.status === 'published')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const publishedPages = pages
    .filter(p => p.status === 'published' && !p.nav_url);

  const urls = [
    url(`${SITE_URL}/`),
    url(`${SITE_URL}/posts/`),
    url(`${SITE_URL}/photos/`),
    ...publishedPosts.map(p => url(`${SITE_URL}/posts/${p.slug}/`, fmtDate(p.date))),
    ...publishedPages.map(p => url(`${SITE_URL}/${p.slug}/`, fmtDate(p.date || p.updatedAt))),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
