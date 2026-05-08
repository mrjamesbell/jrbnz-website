# jrbnz.com TODO

## Bugs

- **Published posts not moving from drafts**: `allPosts` cache in `signal/js/app.js` is never cleared after publish — stale until page reload. Fix: invalidate `allPosts` in `_publish()` / `loadPosts()` should re-fetch after publish.
- **Stale published HTML — travel post**: `my-unabridged-life-in-travel` published HTML still has broken Xi'an sunset image. Needs republish via admin once logged in.
- **Publish/Republish button state**: Verify button correctly shows "Publish" vs "Republish" based on post status, and resets correctly after publish.

## Autosave / Draft behaviour

- Confirm: new posts autosaved but never published should appear in Drafts (not visible on public site). Verify this is working correctly end-to-end.
- Clarify UX: what happens if a published post is edited and autosaved without republishing? Draft and live versions diverge — should there be an indicator?

## Posts to import

Still missing from import (need Bear exports):

1. How to figure out what jobs you might like to do
2. How to actually negotiate your freelance rate
3. Help, someone just gave me flyers to give out!
4. 17 Random Facts About Me
5. How I Make Roast Beef

Full archive: https://mrjamesbell.com/blog-archive/
