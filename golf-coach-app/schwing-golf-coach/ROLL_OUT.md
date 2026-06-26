# Rollout Checklist

Use this when you are ready to put Schwing on your iPhone.

## 1. Put The App In GitHub

Create a new GitHub repo containing the contents of this `golf-coach-app` folder.

The repo should include:

- `server.js`
- `app.js`
- `index.html`
- `styles.css`
- `manifest.webmanifest`
- `package.json`
- `render.yaml`
- the icon files

Do not include a `.env` file.

## 2. Deploy On Render

Render is a good first host because this app needs a small Node web service, not just static hosting.

1. Go to Render.
2. Choose New > Blueprint or New > Web Service.
3. Connect the GitHub repo.
4. If using the manual web service path, use:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/health`
5. Add environment variables:
   - `OPENAI_API_KEY`: your API key
   - `OPENAI_MODEL`: `gpt-4.1-mini`
   - `NODE_ENV`: `production`

Keep the key in Render's environment variable screen only. Do not put it in the files you upload to GitHub.

## 3. Test The Live URL

Open:

```text
https://your-render-url.onrender.com/health
```

You should see:

```json
{"ok":true,"mode":"ai","model":"gpt-4.1-mini"}
```

Then open the main app URL.

## 4. Install On iPhone

1. Open the live HTTPS URL in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Name it Schwing.
5. Open Schwing from the Home Screen.

## 5. First Live Test

Do these in order:

1. Save your handicap and common miss in Me.
2. Save club distances in Clubs.
3. Ask one text shot question.
4. Upload one swing photo and run AI swing review.
5. Upload 3 labelled swing photos and run AI swing review.
