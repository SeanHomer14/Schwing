# Loop Golf Coach

A mobile-first golf coach prototype for on-course questions, saved club distances, green/pin yardage adjustment, handicap-aware coaching, player memory, and swing media review.

## Run Locally

```bash
node server.js
```

Open `http://127.0.0.1:8080/`.

If you need a different port:

```bash
PORT=8081 node server.js
```

## Enable AI Coach

Set an API key on the server, never in browser code:

```bash
export OPENAI_API_KEY="your_key_here"
node server.js
```

Optionally set a model:

```bash
export OPENAI_MODEL="your_preferred_model"
```

Without `OPENAI_API_KEY`, the app still runs and returns local rule-based advice.

## Deployment

See [DEPLOY.md](DEPLOY.md) and [ROLL_OUT.md](ROLL_OUT.md). The short version:

- Host `golf-coach-app` as a Node.js web service.
- Use `npm start` as the start command.
- Add `OPENAI_API_KEY` as a private environment variable.
- Use `/health` as the health check path.

## Swing Video

Video upload is supported in the browser. The app extracts three key frames from a short clip, compresses them, and sends those frames to the coach endpoint. Still photos are compressed before review too, and you can upload up to four labelled stills for setup, top, impact, and finish. This is the practical path for AI swing review because the vision API accepts image inputs, including multiple images, while direct video-file analysis is not the right fit for this prototype.

Use Quick checklist for a no-cost local swing reminder. Use AI swing review after uploading media when you want the model to inspect the photo or extracted video frames.

## Player Memory

Use the Me tab to save handicap, common miss, preferred shot shape, current goal, coach style, and round notes. The most recent notes are included in coach requests so advice can reflect patterns from recent rounds.

## Install On Phone

When hosted over HTTPS, open the site on your iPhone in Safari and use Share -> Add to Home Screen. The app includes iPhone Home Screen icons, a manifest, and a service worker so the main screens can load offline after first visit.
