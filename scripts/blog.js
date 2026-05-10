(function () {
    var tag = new URLSearchParams(location.search).get('tag');
    if (!tag) return;

    var bar = document.getElementById('tag-filter-bar');
    var label = document.getElementById('tag-filter-label');
    if (bar) bar.hidden = false;
    if (label) label.textContent = '#' + tag;

    document.querySelectorAll('.post-list-item').forEach(function (li) {
        var tags = (li.dataset.tags || '').split(',').map(function (t) { return t.trim(); });
        if (!tags.includes(tag)) li.style.display = 'none';
    });
})();
