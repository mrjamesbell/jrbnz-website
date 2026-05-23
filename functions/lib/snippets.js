// Built-in snippet CSS — keyed by id. Duplicated from signal/js/snippets.js.
// Custom snippets saved in R2 (settings/snippets.json) are merged on top.

export const BUILT_IN_SNIPPET_CSS = {
  stats: `.st{display:flex;flex-wrap:wrap;gap:24px 36px;margin:32px 0;padding:18px 0 16px;border-top:1px solid var(--color-border);border-bottom:1px solid var(--color-border)}.st-n{display:block;font-family:Georgia,serif;font-size:30px;font-weight:400;letter-spacing:-0.03em;line-height:1;color:var(--color-text)}.st-l{display:block;margin-top:5px;color:var(--color-text-muted);font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase}`,
  grid: `.gr{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:32px 0}.gr-c{padding-top:14px;border-top:2px solid var(--color-accent,oklch(68% 0.13 50))}.gr-c h4{margin:0 0 8px;font-family:Lora,serif;font-size:18px;font-weight:700;line-height:1.2;color:var(--color-text)}.gr-c p{margin:0;font-size:15px;line-height:1.6;color:var(--color-text-muted)}@media(max-width:600px){.gr{grid-template-columns:1fr}}`,
  timeline: `.tl{position:relative;margin:32px 0;padding-top:4px}.tl::before{position:absolute;top:0;bottom:0;left:60px;width:1px;background:var(--color-border);content:''}.tl-entry{display:grid;grid-template-columns:48px 36px 1fr;min-height:46px;align-items:start;color:var(--color-accent,oklch(68% 0.13 50))}.tl-year{padding-top:4px;font-family:Georgia,serif;font-size:18px;letter-spacing:-0.03em;line-height:1;color:var(--color-text-muted)}.tl-mark{position:relative;min-height:46px}.tl-mark::before{position:absolute;top:10px;left:18px;width:10px;height:10px;border:2px solid currentColor;border-radius:50%;background:var(--color-bg,#f0ede8);transform:translateX(-50%);content:''}.tl-copy{padding-bottom:14px;color:var(--color-text)}.tl-copy h3{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;margin:0 0 3px;font-family:Lora,serif;font-size:16px;font-weight:600;line-height:1.2;color:var(--color-text)}.tl-copy p{margin:0;font-size:12px;line-height:1.4;color:var(--color-text-muted);font-family:'Bebas Neue',sans-serif;letter-spacing:0.07em;text-transform:uppercase}.tl-copy p em{font-style:normal}.tl-copy p span{padding:0 3px;opacity:.45}.tl-tag{display:inline-block;padding:2px 6px;border:1px solid var(--color-border-strong);border-radius:999px;color:var(--color-text-muted);font-family:'Bebas Neue',sans-serif;font-size:9px;letter-spacing:.1em;text-transform:uppercase}.tl-win{color:#af7b22;font-size:14px}`,
};

export async function loadSnippetCss(env) {
  let snippets = [];
  try {
    const obj = await env.BLOG.get('settings/snippets.json');
    if (obj) snippets = await obj.json();
  } catch {}

  // Build CSS map: start with built-ins, custom snippets override by id
  const map = { ...BUILT_IN_SNIPPET_CSS };
  for (const s of snippets) {
    if (s.id && s.css) map[s.id] = s.css.split('\n').map(l => l.trim()).filter(Boolean).join(' ');
  }

  return Object.values(map).join('\n');
}
