// Configuration for photo gallery
export const CONFIG = {
  // Image processing settings
  thumbnailMaxSize: 400,
  webMaxSize: 1920,
  thumbnailQuality: 80,
  webQuality: 85,

  // Gallery display settings
  photosPerPage: 30,

  // Available categories
  categories: ['theatre', 'travel'],

  // R2 bucket configuration (will be set via environment variables)
  r2: {
    bucketName: process.env.R2_BUCKET_NAME || 'photos',
    publicUrl: process.env.R2_PUBLIC_URL || ''
  },

  // API endpoint (for local development vs production)
  apiEndpoint: process.env.API_ENDPOINT || '/api'
};
