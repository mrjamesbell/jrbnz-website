/**
 * Cloudflare Worker for Photo Gallery API
 * Handles photo listing and click tracking
 */

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Route requests
        if (url.pathname === '/api/photos') {
            return handleGetPhotos(request, env, corsHeaders);
        } else if (url.pathname === '/api/click') {
            return handleTrackClick(request, env, corsHeaders);
        } else if (url.pathname.startsWith('/api/image/')) {
            return handleGetImage(request, env, corsHeaders);
        }

        return new Response('Not Found', { status: 404 });
    },
};

/**
 * GET /api/photos
 * Fetch photos with sorting by click count and pagination
 */
async function handleGetPhotos(request, env, corsHeaders) {
    try {
        const url = new URL(request.url);
        const category = url.searchParams.get('category');
        const page = parseInt(url.searchParams.get('page')) || 1;
        const perPage = parseInt(url.searchParams.get('perPage')) || 30;

        // Fetch photo metadata from KV
        const metadataJson = await env.PHOTO_METADATA.get('photo-metadata');
        if (!metadataJson) {
            return jsonResponse({ photos: [], totalCount: 0, page: 1, perPage, totalPages: 0 }, corsHeaders);
        }

        const metadata = JSON.parse(metadataJson);
        let photos = metadata.photos || [];

        // Filter by category if specified
        if (category && category !== 'all') {
            photos = photos.filter(photo => photo.category === category);
        }

        // Fetch click counts for all photos
        const photosWithClicks = await Promise.all(
            photos.map(async (photo) => {
                const clicks = await env.PHOTO_METADATA.get(`clicks-${photo.id}`);
                return {
                    ...photo,
                    clicks: parseInt(clicks) || 0
                };
            })
        );

        // Sort by click count (descending), then by ID for consistent ordering
        photosWithClicks.sort((a, b) => {
            if (b.clicks !== a.clicks) {
                return b.clicks - a.clicks;
            }
            // For photos with same click count, sort by ID to maintain consistent pagination
            return a.id.localeCompare(b.id);
        });

        // Paginate results
        const totalCount = photosWithClicks.length;
        const totalPages = Math.ceil(totalCount / perPage);
        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        const paginatedPhotos = photosWithClicks.slice(startIndex, endIndex);

        return jsonResponse({
            photos: paginatedPhotos,
            totalCount,
            page,
            perPage,
            totalPages
        }, corsHeaders);

    } catch (error) {
        console.error('Error fetching photos:', error);
        return jsonResponse({ error: 'Internal Server Error' }, corsHeaders, 500);
    }
}

/**
 * POST /api/click
 * Track click on a photo
 */
async function handleTrackClick(request, env, corsHeaders) {
    try {
        if (request.method !== 'POST') {
            return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
        }

        const body = await request.json();
        const { photoId } = body;

        if (!photoId) {
            return jsonResponse({ error: 'photoId is required' }, corsHeaders, 400);
        }

        // Get current click count
        const clickKey = `clicks-${photoId}`;
        const currentClicks = await env.PHOTO_METADATA.get(clickKey);
        const newClicks = (parseInt(currentClicks) || 0) + 1;

        // Update click count
        await env.PHOTO_METADATA.put(clickKey, newClicks.toString());

        return jsonResponse({
            success: true,
            clicks: newClicks
        }, corsHeaders);

    } catch (error) {
        console.error('Error tracking click:', error);
        return jsonResponse({ error: 'Internal Server Error' }, corsHeaders, 500);
    }
}

/**
 * GET /api/image/:type/:id
 * Serve images from R2 storage
 */
async function handleGetImage(request, env, corsHeaders) {
    try {
        const url = new URL(request.url);
        // Path format: /api/image/thumbnails/photo-id.jpg or /api/image/photos/photo-id.jpg
        const pathParts = url.pathname.split('/').filter(Boolean);

        if (pathParts.length < 4) {
            return new Response('Invalid image path', { status: 400 });
        }

        const type = pathParts[2]; // 'thumbnails' or 'photos'
        const filename = pathParts[3]; // 'photo-id.jpg'
        const key = `${type}/${filename}`;

        // Fetch from R2
        const object = await env.PHOTO_STORAGE.get(key);

        if (!object) {
            return new Response('Image not found', { status: 404 });
        }

        // Return image with appropriate headers
        return new Response(object.body, {
            headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000',
                ...corsHeaders
            }
        });

    } catch (error) {
        console.error('Error serving image:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

/**
 * Helper function to create JSON response
 */
function jsonResponse(data, corsHeaders, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
}
