// Gallery — fetches photos.json from R2, handles filtering, pagination, hero, lightbox

const PHOTOS_JSON_URL = 'https://i.jrbnz.com/photos.json';
const PHOTOS_PER_PAGE = 16;

// State
let manifest = null;   // full photos.json
let currentPage = 1;
let currentCategory = 'all';
let lightbox = null;

document.addEventListener('DOMContentLoaded', async () => {
    initializeNavigation();
    initializePagination();
    await loadManifest();
    loadPhotosFromURL();
});

// ── Data ─────────────────────────────────────────────────────────────────────

async function loadManifest() {
    try {
        const res = await fetch(PHOTOS_JSON_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        manifest = await res.json();
    } catch (err) {
        console.error('Failed to load photos manifest:', err);
        showError('Failed to load photos. Please try again later.');
    }
}

// ── Navigation ───────────────────────────────────────────────────────────────

function initializeNavigation() {
    const navLinks = document.querySelectorAll('.filter-link');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const category = link.dataset.category;

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const url = category === 'all' ? '/photos' : `/photos?category=${category}`;
            window.history.pushState({ category }, '', url);

            currentCategory = category;
            currentPage = 1;
            render();
        });
    });

    window.addEventListener('popstate', () => {
        loadPhotosFromURL();
    });
}

function loadPhotosFromURL() {
    const params = new URLSearchParams(window.location.search);
    currentCategory = params.get('category') || 'all';
    currentPage = parseInt(params.get('page')) || 1;

    document.querySelectorAll('.filter-link').forEach(link => {
        link.classList.toggle('active', link.dataset.category === currentCategory);
    });

    render();
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
    if (!manifest) return;
    renderHero();
    renderGallery();
}

function renderHero() {
    const panel = document.getElementById('hero-panel');
    const heroImg = document.getElementById('hero-image');
    const heroLink = document.getElementById('hero-link');
    const heroDesc = document.getElementById('hero-description');

    const catData = currentCategory !== 'all' && manifest.categories?.[currentCategory];
    const hero = catData?.hero || null;
    const description = catData?.description || null;

    if (!hero) {
        panel.classList.add('hidden');
        return;
    }

    heroLink.href = hero.fullUrl;
    heroImg.src = hero.fullUrl;
    heroImg.alt = hero.filename || '';
    heroDesc.textContent = description || '';
    heroDesc.style.display = description ? '' : 'none';
    panel.classList.remove('hidden');

    // Reinitialise lightbox so it picks up the (possibly new) hero anchor
    initializeLightbox();
}

function renderGallery() {
    const gallery = document.getElementById('gallery');
    const loading = document.getElementById('loading');
    const pagination = document.getElementById('pagination');

    loading.style.display = 'none';
    gallery.innerHTML = '';
    hideError();

    const all = manifest.photos || [];
    const filtered = currentCategory === 'all'
        ? all
        : all.filter(p => p.category === currentCategory);

    if (filtered.length === 0) {
        showError('No photos found.');
        pagination.style.display = 'none';
        return;
    }

    const totalPages = Math.ceil(filtered.length / PHOTOS_PER_PAGE);
    // Clamp page in case filter changed
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PHOTOS_PER_PAGE;
    const page = filtered.slice(start, start + PHOTOS_PER_PAGE);

    page.forEach(photo => {
        const item = document.createElement('a');
        item.className = 'gallery-item glightbox';
        item.href = photo.fullUrl;
        item.dataset.gallery = 'gallery';

        const img = document.createElement('img');
        img.src = photo.thumbnailUrl;
        img.alt = photo.filename || 'Photo';
        img.loading = 'lazy';
        img.addEventListener('load', () => img.classList.add('loaded'));

        item.appendChild(img);
        gallery.appendChild(item);
    });

    updatePagination(totalPages);
    initializeLightbox();
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function initializeLightbox() {
    if (lightbox) {
        lightbox.destroy();
    }

    lightbox = GLightbox({
        selector: '.glightbox',
        touchNavigation: true,
        loop: true,
        autoplayVideos: false,
        width: '90vw',
        height: '90vh',
    });
}

// ── Pagination ────────────────────────────────────────────────────────────────

function initializePagination() {
    document.getElementById('prev-btn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    document.getElementById('next-btn').addEventListener('click', () => {
        const all = manifest?.photos || [];
        const filtered = currentCategory === 'all' ? all : all.filter(p => p.category === currentCategory);
        const totalPages = Math.ceil(filtered.length / PHOTOS_PER_PAGE);
        if (currentPage < totalPages) {
            currentPage++;
            render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

function updatePagination(totalPages) {
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');

    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    pagination.style.display = totalPages > 1 ? 'flex' : 'none';
}

// ── Error helpers ─────────────────────────────────────────────────────────────

function showError(msg) {
    const el = document.getElementById('error');
    el.textContent = msg;
    el.style.display = 'block';
}

function hideError() {
    const el = document.getElementById('error');
    el.style.display = 'none';
}
