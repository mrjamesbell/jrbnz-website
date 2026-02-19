// Shared component loader
// Fetches header and footer partials and injects them into the page.
// Pages should include:
//   <div id="site-header"></div>  — before the page-header
//   <div id="site-footer"></div>  — at the end of body

async function loadPartial(id, url) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
        const res = await fetch(url);
        if (!res.ok) return;
        el.outerHTML = await res.text();
    } catch (e) {
        // Silently fail — page still works without shared partials
    }
}

(async function () {
    await Promise.all([
        loadPartial('site-header', '/partials/header.html'),
        loadPartial('site-footer', '/partials/footer.html'),
    ]);
})();
