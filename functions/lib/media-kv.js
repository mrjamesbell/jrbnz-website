// KV key prefix for media entries
const PREFIX = 'media:';

export const kvKey = id => `${PREFIX}${id}`;

// Full metadata shape stored as the KV value
// Condensed subset stored in the KV metadata field for fast listing (1024 byte limit)
export async function putMeta(env, imageId, meta) {
  const { displayName, alt, caption, uploadedAt, size, w, h, focalX, focalY } = meta;
  await env.MEDIA_KV.put(
    kvKey(imageId),
    JSON.stringify(meta),
    { metadata: { displayName, alt, caption, uploadedAt, size, w, h, focalX, focalY } }
  );
}

export async function getMeta(env, imageId) {
  return env.MEDIA_KV.get(kvKey(imageId), 'json');
}

export async function deleteMeta(env, imageId) {
  await env.MEDIA_KV.delete(kvKey(imageId));
}

// Returns items with metadata from the KV list (no value reads needed)
export async function listMeta(env, { limit = 48, cursor } = {}) {
  const opts = { prefix: PREFIX, limit };
  if (cursor) opts.cursor = cursor;
  const result = await env.MEDIA_KV.list(opts);
  return {
    items: result.keys
      .filter(k => !k.name.endsWith(':_test'))
      .map(k => ({ id: k.name.slice(PREFIX.length), ...k.metadata })),
    nextCursor: result.list_complete ? null : result.cursor,
  };
}
