// Proxy for Cloudflare Images delivery
// /img/{imageId}/{variant} → imagedelivery.net/{accountHash}/{imageId}/{variant}
//
// Keeps CF Images URLs out of published content — all image srcs reference
// jrbnz.com/img/... so the backend can be swapped without rewriting posts.

export async function onRequest({ request, env, params }) {
  const path = params.path; // e.g. "coastal-walk-1748000000/hero"
  if (!path || !env.CF_ACCOUNT_HASH) {
    return new Response('Not found', { status: 404 });
  }

  const upstream = `https://imagedelivery.net/${env.CF_ACCOUNT_HASH}/${path}`;

  // Proxy the request, forwarding Accept header so CF Images can serve AVIF/WebP
  const upstreamRes = await fetch(upstream, {
    headers: { Accept: request.headers.get('Accept') ?? '*/*' },
    cf: { cacheEverything: true, cacheTtl: 31536000 }, // cache at edge for 1 year
  });

  // Pass through the response with cache headers
  const headers = new Headers(upstreamRes.headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers,
  });
}
