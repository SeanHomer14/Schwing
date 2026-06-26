const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8_000_000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function languageFromProfile(profile = {}, context = {}) {
  if (context.coachingLanguage) return context.coachingLanguage;
  if (profile.coachLanguage && profile.coachLanguage !== "auto") return profile.coachLanguage;
  const handicap = Number(profile.handicap);
  if (!Number.isFinite(handicap)) return "balanced";
  if (handicap >= 24) return "plain";
  if (handicap < 10) return "technical";
  return "balanced";
}

function localSwingReply({ profile = {}, context = {}, swingImageData = "", swingFrameData = [] }) {
  const language = languageFromProfile(profile, context);
  const view = context.cameraView || "selected camera view";
  const flight = context.ballFlight || profile.commonMiss || "your usual miss";
  const mediaCount = swingFrameData.length || (swingImageData ? 1 : 0);
  const mediaLine = mediaCount
    ? "I have your upload, but the AI image review is not connected right now, so this is a swing checklist rather than a visual diagnosis."
    : "Upload a swing photo or short video first for a better review.";

  if (language === "plain") {
    return `${mediaLine}\n\nWhat to check:\n- ${view}: start balanced and keep your height through the swing.\n- For a ${flight.toLowerCase()}, focus on finishing with your chest facing the target.\n\nPriority fix: make one smooth swing and hold your finish for two seconds.\n\nSwing thought: balanced finish.`;
  }

  if (language === "technical") {
    return `${mediaLine}\n\nWhat to check:\n- ${view}: check setup alignment, posture, face angle, and whether your body keeps rotating through impact.\n- For a ${flight.toLowerCase()}, match the face and path with a calmer transition.\n\nPriority fix: improve rotation through impact before chasing hand action.\n\nSwing thought: chest through, held finish.`;
  }

  return `${mediaLine}\n\nWhat to check:\n- ${view}: setup, balance, posture, and finish position.\n- For a ${flight.toLowerCase()}, keep the swing thought simple and avoid forcing the hands.\n\nPriority fix: turn through to a balanced finish.\n\nSwing thought: smooth turn, hold the finish.`;
}

function localCoachReply({ question = "", clubs = [], profile = {}, memories = [], context = {}, swingImageData = "", swingFrameData = [] }) {
  if (context.mode === "swing-media-review") {
    return localSwingReply({ profile, context, swingImageData, swingFrameData });
  }

  const language = languageFromProfile(profile, context);
  const match = question.match(/\b(\d{2,3})\b/);
  const yardage = match ? Number(match[1]) : 0;
  const playable = clubs.filter(([, distance]) => Number(distance) > 0);
  const nearest = playable.reduce((best, club) => {
    if (!best) return club;
    return Math.abs(club[1] - yardage) < Math.abs(best[1] - yardage) ? club : best;
  }, null);
  if (!yardage) {
    return language === "plain"
      ? "Give me a yardage, lie, wind, and current miss. Simple answer: aim at the safest part, take enough club, and make one smooth swing."
      : "Give me a yardage, lie, wind, and current miss. On-course answer: pick the safest third, use enough club, and commit to one balanced swing.";
  }
  if (language === "plain") {
    const memoryLine = memories[0]?.note ? ` Recent pattern: ${memories[0].note}` : "";
    return `For ${yardage} yards, ${nearest ? `your closest saved club is ${nearest[0]}. ` : ""}Aim away from trouble, choose enough club, and think only about a smooth swing and balanced finish.${memoryLine}`;
  }
  if (language === "technical") {
    return `For ${yardage} yards, ${nearest ? `${nearest[0]} is the closest stock carry at ${nearest[1]}. ` : ""}Pick the start line based on dispersion, favour the no-short-side miss, and commit to tempo through a held finish.`;
  }
  return `For ${yardage} yards, ${nearest ? `your closest saved carry is ${nearest[0]} at ${nearest[1]} yards. ` : ""}Favour the safe side, take dead aim only if the miss is harmless, and use one swing thought: smooth tempo to a held finish.`;
}

function buildInput({ question = "", clubs = [], profile = {}, memories = [], context = {}, swingImageData = "", swingFrameData = [] }) {
  const language = languageFromProfile(profile, context);
  const player = `Handicap: ${profile.handicap || "unknown"}. Coaching language: ${language}. Common miss: ${profile.commonMiss || "unknown"}. Preferred shot shape: ${profile.shotShape || "unknown"}. Goal: ${profile.playerGoal || "not set"}. Coach style: ${profile.coachTone || "not set"}. Club carries: ${clubs.map(([club, distance]) => `${club} ${distance}`).join(", ")}. Recent memories: ${memories.map((memory) => `${memory.type}: ${memory.note}`).join(" | ") || "none"}. Context: ${JSON.stringify(context)}.`;
  const isSwingReview = context.mode === "swing-media-review";
  const swingFormat = isSwingReview
    ? "For swing media reviews, use exactly this format: What I can see: 2 short bullets. Main issue: 1 sentence. Priority fix: 1 simple action. Swing thought: 1 short phrase. Do not do: 1 warning. Be specific to visible frames and say when a view is unclear. Avoid telling slicers to flip, roll, or turn the hands over; prefer setup, alignment, grip checkpoint, chest/body rotation, and balanced finish cues."
    : "";
  const content = [
    {
      type: "input_text",
      text: `${player}\n\nYou are Schwing, a concise on-course golf coach. Match the explanation to the player's handicap and coaching language. Plain English means avoid jargon; if a technical term is essential, define it briefly. Technical means you can mention face, path, low point, pressure shift, and dispersion. Give practical, safe advice. If swing images or video frames are present, comment only on visible setup/position clues and ask for ball flight when uncertain. ${swingFormat}\n\nQuestion: ${question}`
    }
  ];
  const imageInputs = swingFrameData.length ? swingFrameData.slice(0, 3) : swingImageData ? [swingImageData] : [];
  imageInputs.forEach((image) => {
    content.push({
      type: "input_image",
      image_url: image
    });
  });
  return [{ role: "user", content }];
}

async function callOpenAI(payload) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: buildInput(payload),
      max_output_tokens: 450
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${detail}`);
  }
  const data = await response.json();
  return extractResponseText(data) || (
    payload.context?.mode === "swing-media-review"
      ? "I could not produce a swing review from that upload. Try one clear face-on or down-the-line image."
      : "I could not produce a coach response. Try adding the yardage, lie, wind, and intended target."
  );
}

function extractResponseText(data) {
  if (data.output_text) return data.output_text;
  const chunks = [];
  (data.output || []).forEach((item) => {
    (item.content || []).forEach((content) => {
      if (content.text) chunks.push(content.text);
    });
  });
  return chunks.join("\n").trim();
}

function sendJson(res, status, data, includeBody = true) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(includeBody ? JSON.stringify(data) : undefined);
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(root, requested));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const type = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store"
    });
    res.end(req.method === "HEAD" ? undefined : content);
  });
}

const server = http.createServer(async (req, res) => {
  if ((req.method === "GET" || req.method === "HEAD") && req.url === "/health") {
    sendJson(res, 200, {
      ok: true,
      mode: process.env.OPENAI_API_KEY ? "ai" : "local",
      model
    }, req.method !== "HEAD");
    return;
  }

  if (req.method === "POST" && req.url === "/api/coach") {
    try {
      const payload = await readJson(req);
      if (!process.env.OPENAI_API_KEY) {
        sendJson(res, 200, { mode: "local", answer: localCoachReply(payload) });
        return;
      }
      const answer = await callOpenAI(payload);
      sendJson(res, 200, { mode: "ai", answer });
    } catch (error) {
      sendJson(res, 500, { mode: "error", answer: error.message });
    }
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(port, host, () => {
  console.log(`Schwing Golf Coach running at http://${host}:${port}/`);
});
