# Cloudflare Pages Deploy

- Root directory: `frontend`
- Build command: `cd frontend && npm ci && npm run build`
- Output directory: `frontend/dist`

AdSense/Review automation:
- `tools/release_ops.sh cloudflare`
- `tools/release_ops.sh apply-adsense <ca-pub-xxxxxxxxxxxxxxxx> <slot-id>`
- `tools/release_ops.sh check`
