// Reusable content snippets — each is a self-contained HTML+CSS block.
// Add new snippets here; they appear automatically in the toolbar picker.

export const SNIPPETS = [
  {
    id: 'timeline',
    label: 'Timeline',
    insert: `<style>
.tl{position:relative;margin:32px 0;padding-top:4px}
.tl::before{position:absolute;top:0;bottom:0;left:60px;width:1px;background:oklch(18% 0.01 50 / 0.18);content:''}
.tl-entry{display:grid;grid-template-columns:48px 36px 1fr;min-height:46px;align-items:start;color:var(--accent-color,oklch(68% 0.13 50))}
.tl-year{padding-top:4px;font-family:Georgia,serif;font-size:18px;letter-spacing:-0.03em;line-height:1;color:oklch(28% 0.01 50)}
.tl-mark{position:relative;min-height:46px}
.tl-mark::before{position:absolute;top:10px;left:18px;width:10px;height:10px;border:2px solid currentColor;border-radius:50%;background:var(--text-color,#f0ede8);transform:translateX(-50%);content:''}
.tl-copy{padding-bottom:14px;color:oklch(18% 0.01 50)}
.tl-copy h3{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;margin:0 0 3px;font-family:Lora,serif;font-size:16px;font-weight:600;line-height:1.2;color:oklch(18% 0.01 50)}
.tl-copy p{margin:0;font-size:12px;line-height:1.4;color:oklch(28% 0.01 50 / 0.65);font-family:'Bebas Neue',sans-serif;letter-spacing:0.07em;text-transform:uppercase}
.tl-copy p em{font-style:normal}
.tl-copy p span{padding:0 3px;opacity:.45}
.tl-tag{display:inline-block;padding:2px 6px;border:1px solid oklch(18% 0.01 50 / 0.28);border-radius:999px;color:oklch(28% 0.01 50 / 0.55);font-family:'Bebas Neue',sans-serif;font-size:9px;letter-spacing:.1em;text-transform:uppercase}
.tl-win{color:#af7b22;font-size:14px}
</style>
<div class="tl">
<div class="tl-entry">
<div class="tl-year">2026</div>
<div class="tl-mark"></div>
<div class="tl-copy">
<h3>Production title <span class="tl-win">★</span> <span class="tl-tag">Tag</span></h3>
<p><em>Playwright</em> <span>/</span> Company</p>
</div>
</div>
<div class="tl-entry">
<div class="tl-year">2025</div>
<div class="tl-mark"></div>
<div class="tl-copy">
<h3>Production title</h3>
<p><em>Playwright</em> <span>/</span> Company</p>
</div>
</div>
</div>`,
  },
];
