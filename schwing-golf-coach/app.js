const defaultClubs = [
  ["Driver", 230],
  ["3 Wood", 210],
  ["Hybrid", 190],
  ["4 Iron", 180],
  ["5 Iron", 170],
  ["6 Iron", 160],
  ["7 Iron", 150],
  ["8 Iron", 140],
  ["9 Iron", 130],
  ["PW", 118],
  ["GW", 105],
  ["SW", 90],
  ["LW", 70]
];

const state = {
  clubs: JSON.parse(localStorage.getItem("loopClubs") || "null") || defaultClubs,
  profile: JSON.parse(localStorage.getItem("loopProfile") || "null") || {
    handicap: "",
    coachLanguage: "auto",
    commonMiss: "",
    shotShape: "",
    playerGoal: "",
    coachTone: "Calm and simple"
  },
  memories: JSON.parse(localStorage.getItem("loopMemories") || "[]"),
  swingImageData: "",
  swingFrameData: []
};

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
const clubList = document.querySelector("#clubList");
const activeClubCount = document.querySelector("#activeClubCount");
const handicapInput = document.querySelector("#handicap");
const coachLanguageSelect = document.querySelector("#coachLanguage");
const commonMissSelect = document.querySelector("#commonMiss");
const shotShapeSelect = document.querySelector("#shotShape");
const playerGoalInput = document.querySelector("#playerGoal");
const coachToneSelect = document.querySelector("#coachTone");
const memoryList = document.querySelector("#memoryList");

function showPanel(panelId) {
  const activeTab = document.querySelector(`.tab[data-tab="${panelId}"]`) ? panelId : "home";
  tabs.forEach((item) => item.classList.toggle("active", item.dataset.tab === activeTab));
  panels.forEach((panel) => panel.classList.toggle("active-panel", panel.id === panelId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function saveProfile() {
  localStorage.setItem("loopProfile", JSON.stringify(state.profile));
}

function saveMemories() {
  localStorage.setItem("loopMemories", JSON.stringify(state.memories));
}

function handicapBand() {
  const handicap = Number(state.profile.handicap);
  if (!Number.isFinite(handicap) || state.profile.handicap === "") return "unknown";
  if (handicap >= 24) return "high";
  if (handicap >= 10) return "mid";
  return "low";
}

function coachingLanguage() {
  if (state.profile.coachLanguage !== "auto") return state.profile.coachLanguage;
  const band = handicapBand();
  if (band === "high") return "plain";
  if (band === "low") return "technical";
  return "balanced";
}

function plainSwingTerm(term) {
  if (coachingLanguage() !== "plain") return term;
  const plainTerms = {
    "club face": "where the club is pointing",
    "lead wrist": "front wrist",
    "dynamic loft": "extra loft added at impact",
    "low point": "where the club brushes the ground",
    "path": "the direction the club travels"
  };
  return plainTerms[term] || term;
}

function saveClubs() {
  localStorage.setItem("loopClubs", JSON.stringify(state.clubs));
  const savedCount = state.clubs.filter(([, distance]) => Number(distance) > 0).length;
  activeClubCount.textContent = savedCount;
  const homeClubSummary = document.querySelector("#homeClubSummary");
  if (homeClubSummary) {
    homeClubSummary.textContent = `${savedCount} club${savedCount === 1 ? "" : "s"} saved.`;
  }
}

function renderClubs() {
  clubList.innerHTML = "";
  state.clubs.forEach(([club, distance], index) => {
    const row = document.createElement("div");
    row.className = "club-row";
    row.innerHTML = `
      <span class="club-name">${club}</span>
      <input aria-label="${club} carry distance" type="number" inputmode="numeric" min="0" value="${distance}">
    `;
    row.querySelector("input").addEventListener("input", (event) => {
      state.clubs[index][1] = Number(event.target.value);
      saveClubs();
    });
    clubList.appendChild(row);
  });
  saveClubs();
}

function nearestClub(yardage) {
  const playable = state.clubs.filter(([, distance]) => Number(distance) > 0);
  return playable.reduce((best, club) => {
    if (!best) return club;
    return Math.abs(club[1] - yardage) < Math.abs(best[1] - yardage) ? club : best;
  }, null);
}

function clubForAdjustedNumber(yardage, lie, wind) {
  let adjusted = yardage;
  if (wind === "Into") adjusted += 8;
  if (wind === "Helping") adjusted -= 6;
  if (lie === "Heavy rough" || lie === "Fairway bunker") adjusted += 8;
  if (lie === "Upslope") adjusted += 4;
  if (lie === "Downslope") adjusted -= 4;
  return { adjusted, club: nearestClub(adjusted) };
}

function localCoachReply(question) {
  const yardageMatch = question.match(/\b(\d{2,3})\b/);
  const yardage = yardageMatch ? Number(yardageMatch[1]) : 0;
  const lower = question.toLowerCase();
  const lie = lower.includes("rough") ? "Heavy rough" :
    lower.includes("bunker") ? "Fairway bunker" :
    lower.includes("downslope") ? "Downslope" :
    lower.includes("upslope") ? "Upslope" :
    "Fairway";
  const wind = lower.includes("into") || lower.includes("against") ? "Into" :
    lower.includes("help") || lower.includes("downwind") ? "Helping" :
    "Calm";
  const miss = lower.includes("slice") || lower.includes("right") || state.profile.commonMiss === "Slice" ? "right" :
    lower.includes("hook") || lower.includes("left") || state.profile.commonMiss === "Hook" ? "left" :
    "";
  if (!yardage) {
    return coachingLanguage() === "plain"
      ? "Give me the yardage, lie, wind and your current miss. Keep the play simple: aim at the safest part of the green, take enough club, and finish balanced."
      : "Give me the yardage, lie, wind and your current miss. For now, keep the play simple: aim at the safest third, take enough club, and make a balanced finish.";
  }
  const { adjusted, club } = clubForAdjustedNumber(yardage, lie, wind);
  const target = miss === "right" ? "aim a shade left of your final target" :
    miss === "left" ? "aim a shade right of your final target" :
    "aim at the middle third";
  const goalLine = state.profile.playerGoal ? ` Keep the bigger goal in mind: ${state.profile.playerGoal}.` : "";
  return `I make that about ${Math.round(adjusted)} yards after lie/wind. ${club ? `That is closest to your ${club[0]} carry. ` : ""}${target}, commit to smooth tempo, and hold the finish.${goalLine}`;
}

async function askCoach(question, context = {}) {
  const response = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      clubs: state.clubs,
      profile: state.profile,
      memories: state.memories.slice(0, 5),
      context: {
        ...context,
        handicapBand: handicapBand(),
        coachingLanguage: coachingLanguage()
      },
      swingImageData: state.swingImageData,
      swingFrameData: state.swingFrameData
    })
  });
  const data = await response.json().catch(() => ({
    mode: "error",
    answer: "Coach API returned an unreadable response."
  }));
  if (!response.ok) {
    throw new Error(data.answer || "Coach API unavailable");
  }
  return data;
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    showPanel(tab.dataset.tab);
  });
});

document.querySelectorAll("[data-open-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    showPanel(button.dataset.openPanel);
  });
});

function renderProfile() {
  handicapInput.value = state.profile.handicap;
  coachLanguageSelect.value = state.profile.coachLanguage;
  commonMissSelect.value = state.profile.commonMiss;
  shotShapeSelect.value = state.profile.shotShape;
  playerGoalInput.value = state.profile.playerGoal;
  coachToneSelect.value = state.profile.coachTone;
  const language = coachingLanguage();
  const handicap = state.profile.handicap ? `${state.profile.handicap} handicap` : "handicap not set";
  const miss = state.profile.commonMiss ? ` Common miss: ${state.profile.commonMiss}.` : "";
  document.querySelector("#swingProfileSummary").textContent = `Using your profile: ${handicap}, ${language} coaching language.${miss}`;
  const homeProfileSummary = document.querySelector("#homeProfileSummary");
  const homeMissSummary = document.querySelector("#homeMissSummary");
  if (homeProfileSummary) homeProfileSummary.textContent = state.profile.handicap ? `${state.profile.handicap} handicap` : "Handicap not set";
  if (homeMissSummary) homeMissSummary.textContent = state.profile.commonMiss || "Not sure";
}

function renderMemories() {
  memoryList.innerHTML = "";
  if (!state.memories.length) {
    const empty = document.createElement("article");
    empty.className = "advice-card quiet";
    empty.textContent = "Save round notes here and Schwing will use the most recent ones when answering.";
    memoryList.appendChild(empty);
    return;
  }
  state.memories.slice(0, 6).forEach((memory) => {
    const item = document.createElement("article");
    item.className = "memory-item";
    const type = document.createElement("strong");
    type.textContent = memory.type;
    const note = document.createElement("span");
    note.textContent = memory.note;
    const date = document.createElement("small");
    date.textContent = memory.date;
    item.append(type, note, date);
    memoryList.appendChild(item);
  });
}

document.querySelector("#profileForm").addEventListener("input", () => {
  state.profile.handicap = handicapInput.value;
  state.profile.coachLanguage = coachLanguageSelect.value;
  state.profile.commonMiss = commonMissSelect.value;
  state.profile.shotShape = shotShapeSelect.value;
  state.profile.playerGoal = playerGoalInput.value;
  state.profile.coachTone = coachToneSelect.value;
  saveProfile();
  renderProfile();
});

document.querySelector("#memoryForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const noteInput = document.querySelector("#memoryNote");
  const note = noteInput.value.trim();
  if (!note) return;
  state.memories.unshift({
    type: document.querySelector("#memoryType").value,
    note,
    date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })
  });
  state.memories = state.memories.slice(0, 20);
  noteInput.value = "";
  saveMemories();
  renderMemories();
});

document.querySelector("#shotForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const yardage = Number(document.querySelector("#shotYardage").value);
  const lie = document.querySelector("#shotLie").value;
  const wind = document.querySelector("#shotWind").value;
  const miss = document.querySelector("#shotMiss").value;
  if (!yardage) return;

  const { adjusted, club } = clubForAdjustedNumber(yardage, lie, wind);
  const target = miss === "Slice" || miss === "Push" ? "aim a touch left of centre" :
    miss === "Hook" || miss === "Pull" ? "aim a touch right of centre" :
    "aim at the safest middle third";
  const contact = miss === "Heavy" ? "feel chest staying over the ball through impact" :
    miss === "Thin" ? "finish with your sternum moving through the strike" :
    "make a balanced three-quarter finish";

  document.querySelector("#coachHeadline").textContent = club ? `${club[0]} to the middle` : "Play the number";
  document.querySelector("#coachAnswer").innerHTML = `Adjusted number is <strong>${Math.round(adjusted)} yards</strong>. ${club ? `Your closest stock club is <strong>${club[0]} (${club[1]})</strong>. ` : ""}${target}; ${contact}.`;
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    const prompt = button.dataset.prompt;
    const replies = {
      "Lay up decision": ["Take the boring win", "If the carry brings penalty trouble into play and you need more than 8/10 contact, lay up to your favourite wedge number."],
      "Bunker reset": ["Splash, not scoop", "Open the face first, set your feet after, then enter the sand a couple of inches behind it and keep turning."],
      "Driver fix": ["Tempo before speed", "Tee it, pick a wide target, feel 80 percent speed and finish in balance. One swing thought only: chest turns through."]
    };
    document.querySelector("#coachHeadline").textContent = replies[prompt][0];
    document.querySelector("#coachAnswer").textContent = replies[prompt][1];
  });
});

document.querySelector("#coachQuestionForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = document.querySelector("#coachQuestion").value.trim();
  const answer = document.querySelector("#coachQuestionAnswer");
  const button = document.querySelector("#askCoachButton");
  if (!question) return;

  answer.textContent = "Thinking...";
  button.disabled = true;
  try {
    const data = await askCoach(question);
    answer.innerHTML = `<strong>${data.mode === "ai" ? "AI coach" : "Local coach"}:</strong> ${data.answer}`;
  } catch (error) {
    answer.innerHTML = `<strong>Coach setup issue:</strong> ${error.message}<br><br><strong>Local coach:</strong> ${localCoachReply(question)}`;
  } finally {
    button.disabled = false;
  }
});

function updateGreenAdvice() {
  const front = Number(document.querySelector("#frontDistance").value);
  const pin = Number(document.querySelector("#pinDepth").value);
  const depth = Number(document.querySelector("#greenDepth").value);
  const trouble = document.querySelector("#greenTrouble").value;
  const advice = document.querySelector("#greenAdvice");
  const marker = document.querySelector("#pinMarker");
  if (!front || !depth) {
    advice.textContent = "Add front distance and pin depth to get an adjusted number.";
    return;
  }
  const flag = front + pin;
  const frontThird = front + Math.round(depth * 0.42);
  const backThird = front + Math.round(depth * 0.68);
  const rawSafeNumber = trouble === "Long" ? Math.min(frontThird, flag - 4) :
    trouble === "Short" ? Math.max(backThird, flag + 4) :
    flag;
  const safeNumber = Math.max(front + 2, Math.min(front + depth - 2, rawSafeNumber));
  const pinPercent = Math.max(10, Math.min(88, (pin / depth) * 76 + 12));
  marker.style.bottom = `${pinPercent}%`;
  const club = nearestClub(safeNumber);
  advice.innerHTML = `Flag is <strong>${flag} yards</strong>. ${trouble === "None" ? "Play the flag number if the lie is clean." : `With trouble ${trouble.toLowerCase()}, favour <strong>${safeNumber} yards</strong>.`} ${club ? `That points to <strong>${club[0]}</strong> for your stock carry.` : ""}`;
}

document.querySelectorAll("#greenForm input, #greenForm select").forEach((field) => {
  field.addEventListener("input", updateGreenAdvice);
});

function resetSwingMedia() {
  state.swingImageData = "";
  state.swingFrameData = [];
  document.querySelector("#swingPreview").classList.remove("visible");
  document.querySelector("#swingVideoPreview").classList.remove("visible");
  const frames = document.querySelector("#videoFrames");
  frames.classList.remove("visible");
  frames.innerHTML = "";
}

function frameLabelOptions(selected) {
  return ["Setup", "Top", "Impact", "Finish"].map((label) => (
    `<option${label === selected ? " selected" : ""}>${label}</option>`
  )).join("");
}

function renderSwingFrames(frames, labels = []) {
  const strip = document.querySelector("#videoFrames");
  strip.innerHTML = frames.map((frame, index) => {
    const label = labels[index] || ["Setup", "Top", "Impact", "Finish"][index] || `Frame ${index + 1}`;
    return `
      <div class="frame-card">
        <img src="${frame}" alt="Swing ${label.toLowerCase()} frame">
        <select aria-label="Frame ${index + 1} label">
          ${frameLabelOptions(label)}
        </select>
      </div>
    `;
  }).join("");
  strip.classList.add("visible");
}

function selectedSwingFrameLabels() {
  return [...document.querySelectorAll("#videoFrames select")].map((select) => select.value);
}

function canvasToImageData(canvas) {
  return canvas.toDataURL("image/jpeg", 0.72);
}

function drawResizedImage(source, maxSize = 900) {
  const width = source.videoWidth || source.naturalWidth || source.width;
  const height = source.videoHeight || source.naturalHeight || source.height;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => {
      resolve(canvasToImageData(drawResizedImage(image)));
      URL.revokeObjectURL(image.src);
    });
    image.addEventListener("error", reject);
    image.src = URL.createObjectURL(file);
  });
}

function captureVideoFrame(video, seconds) {
  return new Promise((resolve) => {
    const onSeeked = () => {
      const canvas = drawResizedImage(video);
      video.removeEventListener("seeked", onSeeked);
      resolve(canvasToImageData(canvas));
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = Math.min(Math.max(seconds, 0), Math.max(video.duration - 0.1, 0));
  });
}

async function extractVideoFrames(video) {
  const duration = video.duration || 1;
  const points = [0.2, 0.5, 0.8].map((point) => duration * point);
  const frames = [];
  for (const point of points) {
    frames.push(await captureVideoFrame(video, point));
  }
  state.swingFrameData = frames;
  renderSwingFrames(frames, ["Setup", "Impact", "Finish"]);
}

document.querySelector("#swingMedia").addEventListener("change", async (event) => {
  const files = [...event.target.files].slice(0, 4);
  if (!files.length) return;
  resetSwingMedia();
  const file = files[0];
  const preview = document.querySelector("#swingPreview");
  const videoPreview = document.querySelector("#swingVideoPreview");
  const frame = document.querySelector(".swing-frame");
  if (file.type.startsWith("video/")) {
    frame.classList.add("visible");
    videoPreview.src = URL.createObjectURL(file);
    videoPreview.classList.add("visible");
    videoPreview.addEventListener("loadedmetadata", () => {
      extractVideoFrames(videoPreview);
    }, { once: true });
  } else {
    const images = [];
    for (const imageFile of files.filter((item) => item.type.startsWith("image/"))) {
      images.push(await compressImageFile(imageFile));
    }
    state.swingFrameData = images;
    state.swingImageData = images[0] || "";
    if (images.length === 1) {
      frame.classList.add("visible");
      preview.src = URL.createObjectURL(file);
      preview.classList.add("visible");
    }
    renderSwingFrames(images);
  }
});

document.querySelector("#swingForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const view = document.querySelector("#cameraView").value;
  const flight = document.querySelector("#ballFlight").value;
  const advice = document.querySelector("#swingAdvice");
  const plain = coachingLanguage() === "plain";
  const viewChecks = plain
    ? view === "Down the line"
      ? "Check that you start balanced, stay in posture, and swing through to a steady finish."
      : "Check ball position, balance, and whether your head moves a long way away from the ball."
    : view === "Down the line"
    ? "Check posture, hand path, club face at the top, and whether the shaft gets too steep coming down."
    : "Check setup tilt, ball position, pressure shift, lead wrist, and whether your head drifts off the ball.";
  const flightFixes = {
    Slice: plain ? "The club is probably pointing right when it hits the ball. Feel the front wrist flatter and swing to a balanced finish." : "Face is usually open to path. Start by strengthening grip slightly and feeling the lead wrist flatter at halfway down.",
    Hook: plain ? "The club is probably closing too quickly. Turn your chest through and keep the hands quieter." : "Face is usually closing too fast. Feel quieter hands and rotate your chest through instead of throwing the clubhead.",
    Push: plain ? "The club is travelling too much to the right. Feel your chest turning left through the strike." : "Path may be too far inside-out with face open. Aim the chest more left through impact.",
    Pull: plain ? "The club is travelling too much left. Feel a smoother start down before turning through." : "Path may be too far left. Feel the club falling behind you for a beat before turning through.",
    Thin: plain ? "The club is brushing the ground too far behind the ball or you are standing up. Keep pressure moving to your front foot." : "Low point is too far back or body is rising. Keep pressure moving into lead foot and brush the turf after the ball.",
    Heavy: plain ? "The club is hitting the ground before the ball. Keep your body moving toward the target." : "Low point is too far behind the ball. Narrow the backswing sway and feel belt buckle moving to target.",
    "High weak shot": plain ? "You may be adding loft at impact. Feel your hands slightly ahead of the clubhead as you strike it." : "Dynamic loft may be high. Check that hands are not adding loft through impact."
  };
  const mediaLine = state.swingFrameData.length
    ? `I have ${state.swingFrameData.length} labelled frame${state.swingFrameData.length === 1 ? "" : "s"} ready for AI review.`
    : state.swingImageData
      ? "This still is ready for the AI coach when the API key is enabled."
      : "Upload a still or short video for a better review.";
  advice.innerHTML = `<strong>${view} review:</strong> ${viewChecks}<br><br><strong>Likely ${flight.toLowerCase()} priority:</strong> ${flightFixes[flight]}<br><br><strong>One swing thought:</strong> balanced finish, hold it for two seconds.<br><br><strong>Media:</strong> ${mediaLine}`;
});

document.querySelector("#aiSwingForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const advice = document.querySelector("#swingAdvice");
  const button = document.querySelector("#aiSwingButton");
  const view = document.querySelector("#cameraView").value;
  const flight = document.querySelector("#ballFlight").value;
  const hasMedia = state.swingImageData || state.swingFrameData.length;

  if (!hasMedia) {
    advice.innerHTML = "<strong>Add media first:</strong> upload a swing photo or short video before using AI review.";
    return;
  }

  advice.textContent = "AI coach is reviewing the swing...";
  button.disabled = true;
  try {
    const data = await askCoach(`Review my golf swing ${state.swingFrameData.length ? "video frames" : "photo"}. Camera view: ${view}. Ball flight problem: ${flight}. Give me 2 visible observations, 1 priority fix, and 1 simple swing thought. Keep it matched to my handicap and avoid guessing what is not visible.`, {
      mode: "swing-media-review",
      cameraView: view,
      ballFlight: flight,
      mediaType: state.swingFrameData.length > 1 ? "labelled still frames" : "photo",
      swingFrameLabels: selectedSwingFrameLabels()
    });
    advice.innerHTML = `<strong>${data.mode === "ai" ? "AI swing review" : "Local swing review"}:</strong> ${data.answer}`;
  } catch (error) {
    advice.innerHTML = `<strong>Coach setup issue:</strong> ${error.message}`;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#resetClubs").addEventListener("click", () => {
  state.clubs = defaultClubs.map((club) => [...club]);
  renderClubs();
});

renderClubs();
renderProfile();
renderMemories();
updateGreenAdvice();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
