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
    const path = window.location.pathname;
    document.querySelectorAll('.site-nav .nav-links a').forEach(function (a) {
        const href = a.getAttribute('href');
        if (href && href !== '/' && path.startsWith(href)) a.classList.add('active');
    });
    document.querySelectorAll('.footer-year').forEach(function (el) {
        el.textContent = new Date().getFullYear();
    });

    // Apply live accent colour from settings to static pages
    try {
        const res = await fetch('/api/site/accent');
        if (res.ok) {
            const { accent } = await res.json();
            if (accent) document.documentElement.style.setProperty('--accent-color', accent);
        }
    } catch (e) {}
})();
