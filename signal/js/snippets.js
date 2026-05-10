// Reusable content snippets — each is a self-contained HTML+CSS block.
// Add new snippets here; they appear automatically in the toolbar picker.

export const SNIPPETS = [
  {
    id: 'stats',
    label: 'Stats bar',
    insert: `<style>
.st{display:flex;flex-wrap:wrap;gap:24px 36px;margin:32px 0;padding:18px 0 16px;border-top:1px solid oklch(18% 0.01 50 / 0.18);border-bottom:1px solid oklch(18% 0.01 50 / 0.18)}
.st-n{display:block;font-family:Georgia,serif;font-size:30px;font-weight:400;letter-spacing:-0.03em;line-height:1;color:oklch(18% 0.01 50)}
.st-l{display:block;margin-top:5px;color:oklch(28% 0.01 50 / 0.55);font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase}
</style>
<div class="st">
<div><strong class="st-n">42</strong><span class="st-l">Label</span></div>
<div><strong class="st-n">3.2k</strong><span class="st-l">Label</span></div>
<div><strong class="st-n">18</strong><span class="st-l">Label</span></div>
</div>`,
  },
  {
    id: 'grid',
    label: 'Two-column grid',
    insert: `<style>
.gr{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:32px 0}
.gr-c{padding-top:14px;border-top:2px solid var(--accent-color,oklch(68% 0.13 50))}
.gr-c h4{margin:0 0 8px;font-family:Lora,serif;font-size:18px;font-weight:700;line-height:1.2;color:oklch(18% 0.01 50)}
.gr-c p{margin:0;font-size:15px;line-height:1.6;color:oklch(28% 0.01 50 / 0.75)}
@media(max-width:600px){.gr{grid-template-columns:1fr}}
</style>
<div class="gr">
<div class="gr-c"><h4>Column heading</h4><p>Column body text goes here.</p></div>
<div class="gr-c"><h4>Column heading</h4><p>Column body text goes here.</p></div>
</div>`,
  },
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
