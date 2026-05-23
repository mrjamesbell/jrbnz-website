# Photo Gallery

A portfolio photo gallery built with Cloudflare infrastructure, integrated into the jrbnz.com website at `/photos`.

## Quick Start

This photo gallery is now part of the main jrbnz-website repository. The gallery lives at `/photos` instead of a separate subdomain.

## Architecture

- **Cloudflare Pages**: Static site hosting (served from `/photos` path)
- **Cloudflare Workers**: API endpoints for photos and click tracking
- **Cloudflare R2**: Object storage for images
- **Cloudflare Workers KV**: Metadata and click count storage

## Setup

### 1. Configuration Files

Create your configuration files from the examples:

```bash
cd photos
cp .env.example .env
cp wrangler.toml.example wrangler.toml
```

Edit `.env` with your Cloudflare credentials and R2 bucket details.
Edit `wrangler.toml` with your KV namespace ID.

### 2. Deploy Worker

The Worker handles API requests at `jrbnz.com/photos/api/*`:

```bash
cd photos
npx wrangler deploy
```

### 3. Deploy Pages

The entire jrbnz-website repository (including the `/photos` directory) should be deployed to Cloudflare Pages:

1. Connect your GitHub repository to Cloudflare Pages
2. Set the build output directory to `/` (root)
3. Every push to `main` will auto-deploy

## File Structure

```
photos/
├── index.html           # Photo gallery page
├── styles/
│   └── gallery.css      # Gallery-specific styles
├── scripts/
│   ├── gallery.js       # Gallery functionality
│   └── mock-api.js      # Mock API for local dev
├── worker/
│   └── index.js         # Cloudflare Worker API
├── config.js            # Shared configuration
├── wrangler.toml        # Worker configuration (create from .example)
└── .env                 # Environment variables (create from .example)
```

Note: The gallery uses the shared `/styles/main.css` from the main website for consistency.

## Uploading Photos

See the original photo-site repository for the upload scripts and tools:
- Photo upload script
- Metadata generation
- R2 sync utilities

## Local Development

For local testing, the gallery includes a mock API that will activate when running on localhost or via file:// protocol.

## Integration

The photo gallery is integrated with the main website:
- Main page links to `/photos` instead of external URL
- Uses shared CSS variables and styles from `/styles/main.css`
- Consistent header, footer, and navigation

## Routes

- **Gallery**: `jrbnz.com/photos`
- **Category filter**: `jrbnz.com/photos?category=theatre`
- **API endpoints**: `jrbnz.com/photos/api/*` (handled by Worker)
