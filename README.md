# Ming Chang — personal website

A minimalist single-page profile with left navigation and persistent professional chat, based on Ming's supplied workspace design.

## Run

Requires Node.js 24.5 or newer in the cloud environment so AI requests use the platform's HTTPS proxy. Install the locked image-processing dependency before running:

```sh
npm ci
```

```sh
npm run dev
```

The server listens on port 3000 (override with `PORT`). Run `npm run check` and `npm test` for syntax and agent guardrail checks.

You can also open `index.html` directly to browse the styled website without a server. Chat and shared place editing require the running Node server. `npm run build` embeds the page templates, styles, application scripts, and globe assets into a self-contained HTML file; `npm run dev` and `npm start` rebuild it automatically. The homepage is included as real HTML so it also remains visible without JavaScript.

## Travel and hobbies

Travel and Hobbies are separate pages in the sidebar and home page. Travel shows Places with a timeline and an orthographic globe that follow the entry in view. Hobbies contains placeholders for Swimming, Raising chickens, and Woodwork. Initial places come from `places.seed.json`; unspecified dates remain blank.

Places and the timeline show the newest start date first. Undated entries appear afterward in their saved order. Date ranges can overlap: a home marked Present remains ongoing while a trip is recorded separately. Each entry independently selects its location on the globe.

Each place can have up to five optional highlights, shown as simple bullet points under its description. The editor supports adding and removing highlight fields; each accepts up to 200 characters of plain text and a monochrome icon. Icon choices include food, outdoors, beach, culture, people, activity, travel, and a plain bullet. Existing entries continue working without highlights.

Place headings automatically show the country's flag emoji. Location search supplies the country; pins chosen manually and older entries use reverse lookup through Photon. The initial Beijing, New York, and Bay Area coordinates have built-in country information. Flags are omitted when the lookup cannot determine a country, and remain separate from the site's monochrome icons.

The Places overview counts distinct countries and places; repeated visits count once. Nearby entries with the same location name count as one place. Countries show a `+` when some locations have not resolved yet. Estimated miles sum great-circle distances between dated entries in arrival order, including repeated visits; they do not infer transport routes or unrecorded return trips. Undated entries are excluded from mileage.

Visitors can rotate the globe by dragging or with arrow keys. Enter or Escape returns to the selected place. Clicking a timeline entry or scrolling to a different entry recenters the globe. Manual location picking still requires entering the place editor.

A static monochrome world map beneath the stats marks each distinct place. It updates when entries change and does not pan or zoom.

Each place supports up to three photos. Add them in the place editor, then Save place to publish. Thumbnails open in a larger viewer. Uploads accept JPEG, PNG, and WebP files up to 10 MB each. The browser resizes them before uploading, and the server verifies, resizes to at most 1600 pixels, converts to WebP, and strips metadata. Files live in the persistent data directory's `photos/` subdirectory. Removing a saved photo or deleting its place removes unreferenced files; cancelled uploads are discarded, with old abandoned uploads cleaned up after 24 hours.

Open Places → Edit places to edit directly. Password protection is disabled for this initial version; anyone with the website link can add, update, or remove entries.

To restore password protection later, set `MING_SITE_EDIT_PROTECTED=true` on the server. In protected mode, the server uses `MING_SITE_EDIT_KEY` when supplied, or generates a private password in `.data/owner-key.txt`. The password is never included in the website or public API. Sessions expire after eight hours and end with Done editing or a server restart. An HttpOnly, SameSite cookie is used normally; embedded previews can use a session token kept only in page memory when cookies are blocked.

Entries save atomically to `.data/places.json` and are shared with all visitors. `.data/` is excluded from Git and from static serving. Preserve this directory across deployments, or set `MING_SITE_DATA_DIR` to a persistent directory. Storage assumes one running server process. Concurrent editors receive a conflict instead of overwriting a newer revision. To update the initial places for a fresh installation, edit `places.seed.json` and rebuild.

Location search uses Photon / OpenStreetMap through the server and displays attribution. A manual globe picker works when search is unavailable, including arrow-key rotation and Enter to select the center. The globe uses bundled D3 libraries (licenses in `vendor/`) and public-domain Natural Earth outlines from world-atlas 2. No external requests are needed to render it.

## Writing

Writing lists published essays, newest first. Each has a stable link such as `/#notes/time-well-spent`. The previous Writing page is preserved as the initial essay, “Time well spent,” without an invented publication date.

New essay opens a simple editor with a title, plain text, bold, italic, underline, headings, quotes, lists, and pictures. Save draft keeps it out of the public essay list; Publish makes it readable at its link. Manage writing shows drafts and archived essays and offers Edit, Archive, and Restore. Restoring an archived draft keeps it a draft. Archiving hides an essay from the public list and its reading link but preserves the text and pictures for restoration.

Writing shares Places' editing access. With password protection disabled, anyone can enter editing mode and access drafts and archives; these are not private. In protected mode, unlock editing through Travel first. Unsaved changes prompt before leaving the editor. Essays are stored atomically in the persistent data directory's `writing/essays.json`; essay pictures use `writing/photos/`. Existing Places data remains separate. Revisions prevent editors from silently overwriting each other.

Each essay supports up to 10 JPEG, PNG, or WebP pictures. Uploads are resized and stripped of metadata like Places photos. The combined stored pictures share the existing 800 MB limit within the 1 GB disk. Removed essay pictures are cleaned up when saved; archived and draft pictures remain stored. Cancelled uploads are discarded, and old abandoned uploads are cleaned up after 24 hours. Formatting is stored as validated text and structured blocks, never arbitrary HTML or executable URLs.

## Profile assistant

`knowledge.json` contains the public profile supplied by Ming. Page templates live in `site-content.js`. On startup and whenever Places or Writing is saved, the server refreshes `assistant-knowledge.json` in the persistent data directory and caches it in memory. It includes shared page content, published Places descriptions and highlights, and text from published essays. Drafts and archived essays are excluded. Chat searches this cached knowledge locally and sends only relevant records to AI; it does not fetch or scrape the website per question.

Without credentials, chat uses a clearly labelled local profile search. For AI question interpretation and conversational follow-ups, securely set `MING_AI_KEY` to an OpenAI API key on the server. `MING_AI_MODEL` optionally overrides the default `gpt-4.1-mini`. Never place a key in frontend files or commit it. AI mode sends the public profile and up to six recent conversation messages to OpenAI; conversations otherwise remain in browser memory and are not logged or stored by this app.

The model can select up to three approved fact IDs. The server validates those IDs and renders the corresponding approved text, discarding all model-generated prose. This limits flexibility but prevents invented factual claims. Each answer includes source labels. Missing details, confidential information, and unsupported metrics are not supplied; template metrics like `x%` are intentionally omitted. Provider failures fall back to profile search with the mode visibly labelled.

The endpoint enforces question/body limits, same-origin requests, and a basic per-IP rate limit. Public production deployment should use a trusted reverse proxy, HTTPS, and shared rate limiting if multiple instances are used. Configure the real client IP at the proxy before adapting the limiter; forwarded headers are not trusted by this server.

## Deploy to Render

The repository includes `render.yaml` for a single Node web service with a 1 GB persistent disk. This uses a paid Starter instance and paid disk; review the current pricing in Render before creating it. Render supplies HTTPS and an `onrender.com` address, so no domain purchase is required.

1. Open [Deploy to Render](https://render.com/deploy?repo=https://github.com/mingchanghello-code/personal-website) and sign in. Connect the GitHub repository if prompted.
2. Enter the OpenAI API key in the `MING_AI_KEY` secret field. The Codex environment's key is not automatically copied to Render.
3. Review the service and disk costs, then create the Blueprint. Wait for the service to become Live and open its URL.
4. Check chat and Travel → Places → Edit places. The current configuration allows editing without a password, as requested. Updates save on the persistent disk across restarts and redeploys.

For a service created before photo uploads were added, update Settings → Build Command to `npm ci && npm run check && npm test && npm run build` before the first photo deployment. New Blueprint deployments already include this command.

For automatic updates, connect your GitHub account to Render, link this repository's `main` branch, and set Settings → Auto-Deploy to On Commit. A service created using only a public Git repository URL requires Manual Deploy → Deploy latest commit, even when the Blueprint requests automatic deploys. See [Render's deploy documentation](https://render.com/docs/deploys#automatic-deploys).

Keep one instance because place storage is file-based. `MING_SITE_DATA_DIR` must continue pointing at the mounted disk. Existing workspace entries are separate from the new hosted installation; the first deployment initializes from `places.seed.json`.

To add a domain later, use the service's Settings → Custom Domains and follow Render's DNS instructions. To enable editing protection later, change `MING_SITE_EDIT_PROTECTED` to `true` and set `MING_SITE_EDIT_KEY` in Render's environment settings, then redeploy.
