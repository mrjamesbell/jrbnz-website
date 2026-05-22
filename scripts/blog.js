(function () {
    var tag = new URLSearchParams(location.search).get('tag');
    if (!tag) return;

    var bar = document.getElementById('tag-filter-bar');
    var label = document.getElementById('tag-filter-label');
    if (bar) bar.hidden = false;
    if (label) label.textContent = '#' + tag;

    // Show matching essay cards, hide non-matching
    document.querySelectorAll('.post-list-item').forEach(function (el) {
        var tags = (el.dataset.tags || '').split(',').map(function (t) { return t.trim(); });
        el.style.display = tags.includes(tag) ? 'block' : 'none';
    });

    // Hide the featured hero if it doesn't match the active tag
    var featured = document.getElementById('ci-featured');
    if (featured) {
        var ftags = (featured.dataset.tags || '').split(',').map(function (t) { return t.trim(); });
        if (!ftags.includes(tag)) featured.style.display = 'none';
    }
})();
