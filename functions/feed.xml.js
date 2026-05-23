import { mdToHtml } from './lib/markdown.js';

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
  const cached = await env.BLOG.get('feed.xml');
  if (cached) {
    return new Response(await cached.text(), {
      headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=300' },
    });
  }

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

  // Fetch all post bodies in parallel
  const bodies = await Promise.all(
    published.map(p => env.BLOG.get(`posts/${p.slug}/draft.md`).then(o => o ? o.text() : ''))
  );

  const items = published.map((p, idx) => {
    const url = `${SITE_URL}/posts/${p.slug}/`;
    const tags = (p.tags || []).map(t => `    <category>${xmlEsc(t)}</category>`).join('\n');
    const description = p.excerpt ? `<![CDATA[${p.excerpt}]]>` : '';
    const contentHtml = bodies[idx] ? mdToHtml(bodies[idx]) : '';
    const content = contentHtml ? `<![CDATA[${contentHtml}]]>` : '';
    return `  <item>
    <title>${xmlEsc(p.title)}</title>
    <link>${url}</link>
    <guid isPermaLink="true">${url}</guid>
    <pubDate>${fmtRfc822(p.date)}</pubDate>
${tags}
    <description>${description}</description>
    <content:encoded>${content}</content:encoded>
  </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
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
