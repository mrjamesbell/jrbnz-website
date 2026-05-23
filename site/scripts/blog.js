(function () {
  var tag = new URLSearchParams(location.search).get('tag');

  var bar = document.getElementById('tag-filter-bar');
  var label = document.getElementById('tag-filter-label');

  function applyFilter(t) {
    if (!bar || !label) return;
    if (t) {
      bar.hidden = false;
      label.textContent = '#' + t;
    } else {
      bar.hidden = true;
      label.textContent = '';
    }

    // Filter post list items
    document.querySelectorAll('.post-list-item').forEach(function (el) {
      var tags = (el.dataset.tags || '').split(',').map(function (s) { return s.trim(); });
      el.style.display = (!t || tags.includes(t)) ? '' : 'none';
    });

    // Show/hide the featured hero section
    var featured = document.getElementById('ci-featured');
    if (featured) {
      var ftags = (featured.dataset.tags || '').split(',').map(function (s) { return s.trim(); });
      featured.style.display = (!t || ftags.includes(t)) ? '' : 'none';
    }
  }

  // Intercept tag chip clicks — filter in place, update URL without reload
  document.querySelectorAll('.tag-chip').forEach(function (chip) {
    chip.addEventListener('click', function (e) {
      e.preventDefault();
      var clicked = new URLSearchParams(new URL(chip.href).search).get('tag');
      // Clicking the active tag clears the filter
      var next = (clicked === tag) ? null : clicked;
      tag = next;
      history.pushState({}, '', next ? '?tag=' + encodeURIComponent(next) : location.pathname);
      applyFilter(next);
    });
  });

  // Apply on load
  applyFilter(tag);
})();
