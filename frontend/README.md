<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1GA80pEv9RpbyWhYILBYR9ufMCpOJky-g

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Optional Community + AdSense Env

- `VITE_FORMSPREE_ENDPOINT`
- `VITE_DISQUS_SHORTNAME`
- `VITE_DISQUS_IDENTIFIER`
- `VITE_GISCUS_REPO`
- `VITE_GISCUS_REPO_ID`
- `VITE_GISCUS_CATEGORY`
- `VITE_GISCUS_CATEGORY_ID`
- `VITE_ADSENSE_CLIENT` (for example `ca-pub-xxxxxxxxxxxxxxxx`)
- `VITE_ADSENSE_SLOT`

AdSense review helpers are provided in `public/ads.txt`, `public/robots.txt`, `public/sitemap.xml`, `public/about.html`, `public/compliance.html`, and `public/_headers`.

## BYO LLM API Key (Per User)

Users can connect their own key in the app UI:

- Open `내 API 키 연결` panel in the right column.
- Fill `API Key` and optional `Model` / `Base URL`.
- Save, then chat/analyze/upload requests are sent with per-request headers:
  - `X-LLM-Api-Key`
  - `X-LLM-Model`
  - `X-LLM-Base-URL`

Keys are stored only in the browser `localStorage` and are not persisted in backend DB.
