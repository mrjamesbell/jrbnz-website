export async function onRequest({ request, env }) {
  // Try to serve the actual static asset first (CSS, JS, images etc.)
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404) return response;

  // Unknown route — serve the admin SPA and let the client-side router handle it
  const url = new URL(request.url);
  url.pathname = '/admin/index.html';
  return env.ASSETS.fetch(url);
}
