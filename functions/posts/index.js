export async function onRequestGet({ env }) {
  const obj = await env.BLOG.get('posts/index.html');
  if (!obj) return new Response(emptyIndex(), { headers: { 'content-type': 'text/html;charset=utf-8' } });
  return new Response(obj.body, { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public,max-age=60' } });
}

function emptyIndex() {
  return pageShell('Blog', '<p>No posts yet.</p>');
}

function pageShell(title, body) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title} - James Bell</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Bebas+Neue&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles/main.css">
</head><body>
<nav class="site-nav"><a href="/" class="nav-logo">JRBNZ</a>
<ul class="nav-links"><li><a href="/now/">Now</a></li><li><a href="/photos/">Photos</a></li><li><a href="/posts/">Blog</a></li></ul></nav>
<header class="page-header"><h1>${title}</h1></header>
<section class="content-section">${body}</section>
<footer class="footer"><div class="footer-fineprint">&copy; ${new Date().getFullYear()} James Bell</div>
<div class="footer-fineprint">Tāmaki Makaurau, Aotearoa</div></footer>
</body></html>`;
}
