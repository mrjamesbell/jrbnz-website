// Gallery functionality

// Configuration
const USE_MOCK_API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
const API_ENDPOINT = USE_MOCK_API ? '/api' : 'https://photo-gallery-worker.jrbnz.workers.dev/api';
const PHOTOS_PER_PAGE = 30;

// State
let currentPage = 1;
let currentCategory = 'all';
let totalPages = 1;
let lightbox = null;
let mockGetPhotos, mockTrackClick;

// Initialize gallery on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Load mock API if in local dev mode
    if (USE_MOCK_API) {
        const module = await import('./mock-api.js');
        mockGetPhotos = module.mockGetPhotos;
        mockTrackClick = module.mockTrackClick;
        console.log('🔧 Using mock API for local development');
    }

    initializeNavigation();
    initializePagination();
    loadPhotosFromURL();
});

// Initialize navigation links
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.filter-link');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const category = link.dataset.category;

            // Update active state
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Update URL and load photos
            const url = category === 'all' ? '/photos' : `/photos?category=${category}`;
            window.history.pushState({ category }, '', url);

            currentCategory = category;
            currentPage = 1;
            loadPhotos();
        });
    });

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
        loadPhotosFromURL();
    });
}

// Initialize pagination controls
function initializePagination() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadPhotos();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadPhotos();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

// Load photos based on current URL
function loadPhotosFromURL() {
    const params = new URLSearchParams(window.location.search);
    currentCategory = params.get('category') || 'all';
    currentPage = parseInt(params.get('page')) || 1;

    // Update active navigation
    const navLinks = document.querySelectorAll('.filter-link');
    navLinks.forEach(link => {
        if (link.dataset.category === currentCategory) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    loadPhotos();
}

// Fetch and display photos
async function loadPhotos() {
    const gallery = document.getElementById('gallery');
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const pagination = document.getElementById('pagination');

    // Show loading state
    loading.style.display = 'block';
    gallery.innerHTML = '';
    error.style.display = 'none';
    pagination.style.display = 'none';

    try {
        let data;

        if (USE_MOCK_API && mockGetPhotos) {
            // Use mock API for local development
            data = await mockGetPhotos(currentCategory, currentPage, PHOTOS_PER_PAGE);
        } else {
            // Use real API
            const params = new URLSearchParams({
                page: currentPage,
                perPage: PHOTOS_PER_PAGE
            });

            if (currentCategory !== 'all') {
                params.append('category', currentCategory);
            }

            const response = await fetch(`${API_ENDPOINT}/photos?${params}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            data = await response.json();
        }

        loading.style.display = 'none';

        if (data.photos.length === 0) {
            error.textContent = 'No photos found.';
            error.style.display = 'block';
            return;
        }

        renderGallery(data.photos);
        updatePagination(data);

    } catch (err) {
        console.error('Error loading photos:', err);
        loading.style.display = 'none';
        error.textContent = 'Failed to load photos. Please try again later.';
        error.style.display = 'block';
    }
}

// Render gallery grid
function renderGallery(photos) {
    const gallery = document.getElementById('gallery');

    photos.forEach(photo => {
        const item = document.createElement('a');
        item.className = 'gallery-item glightbox';
        item.href = photo.fullUrl;
        item.dataset.photoId = photo.id;
        item.dataset.gallery = 'gallery';

        const img = document.createElement('img');
        img.src = photo.thumbnailUrl;
        img.alt = photo.filename || 'Photo';
        img.loading = 'lazy';

        // Fade in when loaded
        img.addEventListener('load', () => {
            img.classList.add('loaded');
        });

        item.appendChild(img);
        gallery.appendChild(item);
    });

    // Initialize GLightbox
    initializeLightbox();
}

// Initialize GLightbox with click tracking
function initializeLightbox() {
    // Destroy existing instance if any
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
        onOpen: () => {
            // Track click when lightbox opens
            const element = lightbox.elements[lightbox.index];
            if (element && element.node) {
                const photoId = element.node.dataset.photoId;
                if (photoId) {
                    trackClick(photoId);
                }
            }
        },
        onSlideChange: ({ prev, current }) => {
            // Track click when slide changes
            const element = lightbox.elements[current.index];
            if (element && element.node) {
                const photoId = element.node.dataset.photoId;
                if (photoId) {
                    trackClick(photoId);
                }
            }
        }
    });
}

// Track photo click
async function trackClick(photoId) {
    try {
        if (USE_MOCK_API && mockTrackClick) {
            // Use mock API for local development
            await mockTrackClick(photoId);
        } else {
            // Use real API
            await fetch(`${API_ENDPOINT}/click`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ photoId })
            });
        }
    } catch (err) {
        // Silent fail - don't interrupt user experience
        console.error('Error tracking click:', err);
    }
}

// Update pagination controls
function updatePagination(data) {
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');

    totalPages = data.totalPages;

    // Update button states
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;

    // Update page info
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    // Show pagination only if there's more than one page
    if (totalPages > 1) {
        pagination.style.display = 'flex';
    }
}
