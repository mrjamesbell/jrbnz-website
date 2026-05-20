const CF_BASE = 'https://api.cloudflare.com/client/v4/accounts';

export function cfImageUrl(accountHash, imageId, variant) {
  return `https://imagedelivery.net/${accountHash}/${imageId}/${variant}`;
}

// Construct all four standard variant URLs
export function cfImageUrls(accountHash, imageId) {
  return {
    thumb:  cfImageUrl(accountHash, imageId, 'thumb'),
    md:     cfImageUrl(accountHash, imageId, 'md'),
    hero:   cfImageUrl(accountHash, imageId, 'hero'),
    public: cfImageUrl(accountHash, imageId, 'public'),
  };
}

export function slugify(name) {
  return name
    .replace(/\.[^.]+$/, '')           // strip extension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanum → hyphen
    .replace(/^-+|-+$/g, '');          // trim leading/trailing hyphens
}

export function generateImageId(slug) {
  return `${slug}-${Math.floor(Date.now() / 1000)}`;
}

export async function uploadToCFImages(env, buffer, contentType, imageId) {
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: contentType }), imageId);
  formData.append('id', imageId);
  formData.append('requireSignedURLs', 'false');

  const res = await fetch(`${CF_BASE}/${env.CF_ACCOUNT_ID}/images/v1`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CF_IMAGES_TOKEN}` },
    body: formData,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.errors?.[0]?.message ?? 'CF Images upload failed');
  return data.result;
}

export async function deleteCFImage(env, imageId) {
  const res = await fetch(
    `${CF_BASE}/${env.CF_ACCOUNT_ID}/images/v1/${encodeURIComponent(imageId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${env.CF_IMAGES_TOKEN}` } }
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.errors?.[0]?.message ?? 'CF Images delete failed');
}
