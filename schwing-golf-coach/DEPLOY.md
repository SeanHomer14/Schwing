# Deploy Schwing Golf Coach

Schwing needs one hosted web service. The same Node server serves the app screens and the private `/api/coach` endpoint.

## Before Deploying

1. Keep the OpenAI API key only as a private environment variable on the host.
2. Do not paste the key into `app.js`, `index.html`, or any other browser file.
3. Keep a small monthly spend limit in OpenAI billing while testing.
4. Optional but recommended later: create a fresh key for the deployed version and revoke old test keys.

## Render Blueprint

This folder includes `render.yaml`. Render Blueprints use this file to define the web service. Render's current docs describe `buildCommand`, `startCommand`, `healthCheckPath`, and secret environment variables with `sync: false`.

If you create a GitHub repo that contains this folder as the repo root, use the included `render.yaml` directly.

If this folder sits inside a larger repo, either:

- set Render's root directory to `golf-coach-app`, or
- move/copy `render.yaml` to the repo root and change `rootDir` to `golf-coach-app`.

## Manual Host Settings

Use these settings on your hosting provider:

- Runtime: Node.js
- Root directory: `golf-coach-app`
- Build command: none, or `npm run check`
- Start command: `npm start`
- Health check path: `/health`

Environment variables:

```text
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4.1-mini
NODE_ENV=production
```

Optional v2 cloud player profiles:

```text
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_PLAYERS_TABLE=schwing_players
```

Do not add `HOST` unless your hosting provider specifically asks for it. In production, the app listens on `0.0.0.0` automatically.

## Phone Install

After deployment, open the HTTPS URL on your iPhone in Safari.

1. Tap the share button.
2. Tap Add to Home Screen.
3. Name it Schwing.
4. Open it from the Home Screen icon.

This is the best first rollout path for iPhone. You do not need an APK, and you do not need the App Store for the first private version.

If you later want a real App Store app, the next step would be wrapping this web app in a native iOS shell or rebuilding it in React Native/Swift. That is a later step, not needed for the first version.
