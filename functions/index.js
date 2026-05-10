export async function onRequestGet({ env, request }) {
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
    headers: {
      'content-type': 'text/html;charset=utf-8',
      'cache-control': 'public,max-age=60',
    },
  });
}
