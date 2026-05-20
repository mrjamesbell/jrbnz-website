// Proxy for Cloudflare Images delivery
// /img/{imageId}/{variant} → imagedelivery.net/{accountHash}/{imageId}/{variant}
//
// Keeps CF Images URLs out of published content — all image srcs reference
// jrbnz.com/img/... so the backend can be swapped without rewriting posts.

export async function onRequest({ request, env }) {
  if (!env.CF_ACCOUNT_HASH) {
    return new Response('Image delivery not configured', { status: 503 });
  }

  // Strip the leading /img/ prefix to get {imageId}/{variant}
  const reqUrl = new URL(request.url);
  const imgPath = reqUrl.pathname.replace(/^\/img\//, '');

  if (!imgPath) return new Response('Not found', { status: 404 });

  const upstream = `https://imagedelivery.net/${env.CF_ACCOUNT_HASH}/${imgPath}`;

  const upstreamRes = await fetch(upstream, {
    headers: { Accept: request.headers.get('Accept') ?? '*/*' },
    cf: { cacheEverything: true, cacheTtl: 31536000 },
  });

  const headers = new Headers(upstreamRes.headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers,
  });
}
