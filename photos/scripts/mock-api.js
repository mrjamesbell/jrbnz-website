/**
 * Mock API for local development without Cloudflare infrastructure
 *
 * To use your own test photos:
 * 1. Place images in public/images/placeholders/theatre/ or /travel/
 * 2. Name them: theatre1.jpg, theatre2.jpg, ... theatreN.jpg (up to 50)
 * 3. Same for travel: travel1.jpg, travel2.jpg, ... travelN.jpg
 * 4. The mock API will automatically detect how many you have
 */

// Generate mock photos - will detect up to 50 images per category
async function generateMockPhotos() {
    const photos = [];
    let id = 1;

    // Try to load theatre photos (check up to 50)
    for (let i = 1; i <= 50; i++) {
        const filename = `theatre${i}.jpg`;
        const url = `/images/placeholders/theatre/${filename}`;

        // Check if image exists by trying to load it
        if (await imageExists(url)) {
            photos.push({
                id: String(id++),
                filename: filename,
                category: 'theatre',
                uploadDate: new Date(2026, 1, i).toISOString(),
                width: 1920,
                height: 1280,
                clicks: Math.floor(Math.random() * 50) + 10,
                thumbnailUrl: url,
                fullUrl: url
            });
        }
    }

    // Try to load travel photos (check up to 50)
    for (let i = 1; i <= 50; i++) {
        const filename = `travel${i}.jpg`;
        const url = `/images/placeholders/travel/${filename}`;

        if (await imageExists(url)) {
            photos.push({
                id: String(id++),
                filename: filename,
                category: 'travel',
                uploadDate: new Date(2026, 1, i + 50).toISOString(),
                width: 1920,
                height: 1280,
                clicks: Math.floor(Math.random() * 50) + 10,
                thumbnailUrl: url,
                fullUrl: url
            });
        }
    }

    return photos;
}

// Check if image exists
function imageExists(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

// Initialize photos (will be populated on first API call)
let MOCK_PHOTOS = null;
let photosLoading = null;

// Get or initialize photos
async function getPhotos() {
    if (MOCK_PHOTOS) {
        return MOCK_PHOTOS;
    }

    // If already loading, wait for that
    if (photosLoading) {
        return await photosLoading;
    }

    // Start loading
    photosLoading = generateMockPhotos();
    MOCK_PHOTOS = await photosLoading;
    photosLoading = null;

    console.log(`🔧 Loaded ${MOCK_PHOTOS.length} test photos`);
    return MOCK_PHOTOS;
}

// Mock API handlers
export async function mockGetPhotos(category = 'all', page = 1, perPage = 30) {
    // Get all photos (will load on first call)
    const allPhotos = await getPhotos();

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Filter by category
    let photos = [...allPhotos];
    if (category !== 'all') {
        photos = photos.filter(p => p.category === category);
    }

    // Sort by clicks (descending), then randomize ties
    photos.sort((a, b) => {
        if (b.clicks !== a.clicks) {
            return b.clicks - a.clicks;
        }
        return Math.random() - 0.5;
    });

    // Paginate
    const totalCount = photos.length;
    const totalPages = Math.ceil(totalCount / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedPhotos = photos.slice(startIndex, endIndex);

    return {
        photos: paginatedPhotos,
        totalCount,
        page,
        perPage,
        totalPages
    };
}

export async function mockTrackClick(photoId) {
    // Get all photos
    const allPhotos = await getPhotos();

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Find photo and increment
    const photo = allPhotos.find(p => p.id === photoId);
    if (photo) {
        photo.clicks++;
        return {
            success: true,
            clicks: photo.clicks
        };
    }

    return {
        success: false,
        error: 'Photo not found'
    };
}
