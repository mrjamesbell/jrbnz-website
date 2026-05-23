# Test Photos for Local Development

Drop your test photos in the category subdirectories for local testing.

## Directory Structure

```
public/images/placeholders/
├── theatre/
│   ├── theatre1.jpg
│   ├── theatre2.jpg
│   ├── theatre3.jpg
│   ├── theatre4.jpg
│   ├── theatre5.jpg
│   └── theatre6.jpg
└── travel/
    ├── travel1.jpg
    ├── travel2.jpg
    ├── travel3.jpg
    ├── travel4.jpg
    ├── travel5.jpg
    └── travel6.jpg
```

## How to Use

1. Copy your photos into `theatre/` or `travel/` folders
2. Name them: `theatre1.jpg`, `theatre2.jpg`, etc. or `travel1.jpg`, `travel2.jpg`, etc.
3. Refresh the browser at http://localhost:8080
4. Your test photos will appear in the gallery

## For Production

These test images are NOT used in production. The production site uses:
- Cloudflare R2 for image storage
- The upload script to process and upload photos
- Real metadata from Workers KV

This directory is only for local development and testing.
