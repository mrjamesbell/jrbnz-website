const SITE_URL = 'https://jrbnz.com';
const FEED_TITLE = 'James Bell';
const FEED_DESCRIPTION = 'Writing by James Bell — Tāmaki Makaurau, Aotearoa';

function xmlEsc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtRfc822(dateStr) {
  return new Date(dateStr).toUTCString();
}

export async function onRequestGet({ env }) {
  const obj = await env.BLOG.get('posts/index.json');
  if (!obj) {
    return new Response('<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>', {
      headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
    });
  }

  const posts = await obj.json();
  const published = posts
    .filter(p => p.status === 'published')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20);

  const lastBuildDate = published.length ? fmtRfc822(published[0].date) : fmtRfc822(new Date());

  const items = published.map(p => {
    const url = `${SITE_URL}/posts/${p.slug}/`;
    const tags = (p.tags || []).map(t => `    <category>${xmlEsc(t)}</category>`).join('\n');
    const description = p.excerpt ? `<![CDATA[${p.excerpt}]]>` : '';
    return `  <item>
    <title>${xmlEsc(p.title)}</title>
    <link>${url}</link>
    <guid isPermaLink="true">${url}</guid>
    <pubDate>${fmtRfc822(p.date)}</pubDate>
${tags}
    <description>${description}</description>
  </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEsc(FEED_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${xmlEsc(FEED_DESCRIPTION)}</description>
    <language>en-nz</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
