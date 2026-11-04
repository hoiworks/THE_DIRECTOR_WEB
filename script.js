"use strict";

const stage = document.querySelector(".stage");
const intro = document.querySelector(".intro");
const branch = document.querySelector(".branch");
const spatialReaction = document.querySelector(".spatial-reaction");
const cinematicBlack = document.querySelector(".cinematic-black");
const prologue = document.querySelector(".prologue");
const prologueShade = document.querySelector(".prologue-shade");
const prologueEnter = document.querySelector(".prologue-enter");
const prologueStatus = document.querySelector(".prologue-status");
const soundButton = document.querySelector(".sound-control");
const startLayer = document.querySelector(".start-layer");
const startButton = document.querySelector(".start-button");
const choiceLayer = document.querySelector(".choice-layer");
const choiceButtons = [...document.querySelectorAll(".choice-button")];
const loading = document.querySelector(".loading");
const message = document.querySelector(".message");
const endingLayer = document.querySelector(".ending-layer");
const endingTitle = document.querySelector(".ending-title");
const endingMessage = document.querySelector(".ending-message");
const endingActions = document.querySelector(".ending-actions");
const replayButton = document.querySelector(".replay-button");
const chooseAgainButton = document.querySelector(".choose-again-button");
const enterButton = document.querySelector(".enter-button");
const invitation = document.querySelector(".invitation");
const invitationTitle = document.querySelector("#invitation-title");
const invitationBack = document.querySelector(".invitation-back");

const sources = Object.freeze({ ICE: "assets/ICE.mp4", NATURE: "assets/NATURE.mp4" });
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let state = "PROLOGUE";
let selectedChoice = null;
let soundOn = true;
let generation = 0;
let loadingTimer = 0;
let responseTimer = 0;
let introHoldTimer = 0;
let introPaintFrame = 0;
let endingMessageTimer = 0;
let responseAnimation = null;
let transitionAnimation = null;
let endingTitleTimer = 0;
let cutFrameRequest = 0;
let cutAnimationFrame = 0;
let pendingFrame = null;
let pendingAccept = false;
const hapticReview = new URLSearchParams(location.search).get("hapticReview");
const hapticPatterns = Object.freeze({ ICE: [18, 28, 18, 28, 30], NATURE: [55, 100, 110] });
let hapticActive = false;
const cinematicHaptics = Object.freeze({
  ICE: { end: 4.5, cues: [
    { time: 1.5, pattern: [18, 35, 18] },
    { time: 2.25, pattern: [18, 30, 18, 30, 22] },
    { time: 3.0, pattern: [18, 25, 18, 25, 22] },
    { time: 3.8, pattern: [18, 22, 18, 22, 22] },
  ] },
  NATURE: { end: 4.5, cues: [
    { time: 1.0, pattern: [65] },
    { time: 1.9, pattern: [75, 130, 85] },
    { time: 3.0, pattern: [90, 150, 105] },
    { time: 4.0, pattern: [110] },
  ] },
});
const frameAccentHaptics = Object.freeze({
  ICE: { end: 4.5, cues: [
    { time: 1.5, pattern: [20] },
    { time: 2.25, pattern: [18, 28, 20] },
    { time: 3.9, pattern: [30] },
  ] },
  NATURE: { end: 4.5, cues: [
    { time: 1.0, pattern: [55] },
    { time: 1.75, pattern: [75] },
    { time: 3.45, pattern: [95] },
  ] },
});
const videoHapticReview = hapticReview === "2" || hapticReview === "3";
let hapticTimeline = null;
let hapticStalled = false;

function cancelHaptic() {
  if (!hapticActive) return;
  hapticActive = false;
  try { if (typeof navigator.vibrate === "function") navigator.vibrate(0); } catch (_error) { /* Optional enhancement. */ }
}

function playHaptic(choice) {
  if (!hapticPatterns[choice] || videoHapticReview || typeof navigator.vibrate !== "function") return;
  const pattern = hapticReview === "1" ? hapticPatterns[choice] : 25;
  try { hapticActive = navigator.vibrate(pattern) !== false; } catch (_error) { hapticActive = false; }
}
function startHapticTimeline(choice) {
  hapticStalled = false;
  const timelines = hapticReview === "2" ? cinematicHaptics : hapticReview === "3" ? frameAccentHaptics : null;
  hapticTimeline = timelines && timelines[choice]
    ? { ...timelines[choice], next: 0, last: 0 } : null;
}
function rebaseHapticTimeline() {
  if (!hapticTimeline) return;
  const now = branch.currentTime;
  while (hapticTimeline.next < hapticTimeline.cues.length && hapticTimeline.cues[hapticTimeline.next].time <= now) hapticTimeline.next++;
  hapticTimeline.last = now;
}
function advanceHapticTimeline(now) {
  const timeline = hapticTimeline;
  if (!timeline || hapticStalled || state !== "TRANSFORMATION" || branch.paused || branch.seeking || branch.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;
  if (now >= timeline.end) { cancelHaptic(); timeline.next = timeline.cues.length; timeline.last = now; return; }
  if (now < timeline.last || now - timeline.last > .5) { rebaseHapticTimeline(); return; }
  let cue = null;
  while (timeline.next < timeline.cues.length && timeline.cues[timeline.next].time <= now) cue = timeline.cues[timeline.next++];
  timeline.last = now;
  if (!cue || now - cue.time > .25 || typeof navigator.vibrate !== "function") return;
  try { hapticActive = navigator.vibrate(cue.pattern) !== false; } catch (_error) { hapticActive = false; }
}
window.addEventListener("pagehide", cancelHaptic);
document.addEventListener("visibilitychange", () => { if (document.hidden) cancelHaptic(); });
const sfxSourcesA = Object.freeze({
  accept: "audio/03_APPROVED/SFX_INVITATION_ACCEPT.wav",
  select: "audio/03_APPROVED/SFX_WORLD_SELECT.wav",
  enter: "audio/03_APPROVED/SFX_INVITATION_ENTER.wav",
});
const sfxSourcesB = Object.freeze({
  accept: "audio/02_REVIEW/SFX_INVITATION_ACCEPT_v003_TIMING_REVIEW.wav",
  select: "audio/02_REVIEW/SFX_WORLD_SELECT_v003_TIMING_REVIEW.wav",
  enter: "audio/02_REVIEW/SFX_INVITATION_ENTER_v003_TIMING_REVIEW.wav",
});
const sfxParameter = new URLSearchParams(location.search).get("sfxReview");
const sfxReview = sfxParameter === null ? "SELECTED" : (sfxParameter === "B" || sfxParameter === "ENTER_V004" ? sfxParameter : "A");
function usesReviewCandidate(name) {
  return sfxReview === "B" || (sfxReview === "SELECTED" && (name === "accept" || name === "enter")) ||
    (sfxReview === "ENTER_V004" && (name === "accept" || name === "enter"));
}
const sfxPlayers = new Map();
const sfxFallbacks = new Set();
let activeSfx = null;
let sfxGeneration = 0;

function createSfxPlayer(name, useB) {
  const player = new Audio();
  player.preload = "auto";
  player.volume = 0.25;
  if (useB) player.addEventListener("error", () => fallbackSfx(name, player));
  player.src = useB && (sfxReview === "SELECTED" || sfxReview === "ENTER_V004") && name === "enter"
    ? "audio/02_REVIEW/SFX_INVITATION_ENTER_v004_ONSET_REVIEW.wav"
    : (useB ? sfxSourcesB : sfxSourcesA)[name];
  sfxPlayers.set(name, player);
  player.load();
  return player;
}

function fallbackSfx(name, failedPlayer) {
  if (sfxPlayers.get(name) !== failedPlayer || sfxFallbacks.has(name)) return;
  const wasActive = activeSfx === failedPlayer;
  sfxFallbacks.add(name);
  console.error(`SFX review candidate failed to load: ${name}; using A.`);
  try {
    createSfxPlayer(name, false);
    if (wasActive && soundOn) playSfx(name);
  } catch (_error) {
    sfxPlayers.delete(name);
    if (wasActive) stopSfx();
  }
}

function preloadSfx() {
  for (const name of Object.keys(sfxSourcesA)) {
    try {
      createSfxPlayer(name, usesReviewCandidate(name));
    } catch (_error) {
      if (usesReviewCandidate(name)) {
        console.error(`SFX review candidate failed to load: ${name}; using A.`);
        sfxFallbacks.add(name);
        sfxPlayers.delete(name);
      }
    }
  }
}

function stopSfx() {
  sfxGeneration += 1;
  if (!activeSfx) return;
  activeSfx.pause();
  activeSfx = null;
}

function playSfx(name) {
  stopSfx();
  if (!soundOn) return;
  try {
    let player = sfxPlayers.get(name);
    if (!player) {
      player = createSfxPlayer(name, usesReviewCandidate(name) && !sfxFallbacks.has(name));
    }
    player.currentTime = 0;
    activeSfx = player;
    const token = sfxGeneration;
    player.play().catch(() => {
      if (player.error && usesReviewCandidate(name) && !sfxFallbacks.has(name)) {
        fallbackSfx(name, player);
      }
      if (token === sfxGeneration && activeSfx === player) activeSfx = null;
    });
  } catch (_error) {
    activeSfx = null;
  }
}

function setState(next) {
  state = next;
  stage.dataset.state = next;
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

function clearTimersAndFrames() {
  window.clearTimeout(loadingTimer);
  window.clearTimeout(responseTimer);
  window.clearTimeout(introHoldTimer);
  window.clearTimeout(endingMessageTimer);
  window.clearTimeout(endingTitleTimer);
  window.cancelAnimationFrame(introPaintFrame);
  window.cancelAnimationFrame(cutAnimationFrame);
  if (cutFrameRequest && typeof branch.cancelVideoFrameCallback === "function") branch.cancelVideoFrameCallback(cutFrameRequest);
  cutFrameRequest = 0;
  if (responseAnimation) responseAnimation.cancel();
  responseAnimation = null;
  if (transitionAnimation) transitionAnimation.cancel();
  transitionAnimation = null;
  cinematicBlack.style.opacity = "0";
  if (pendingFrame) pendingFrame.cancel();
  pendingFrame = null;
}

function nextGeneration() {
  cancelHaptic();
  hapticTimeline = null;
  generation += 1;
  clearTimersAndFrames();
  return generation;
}

function waitForFirstFrame(video) {
  const source = video.querySelector("source");
  let settled = false;
  let callbackId = 0;
  let fallbackId = 0;
  let timeoutId = 0;
  let resolvePromise;
  let rejectPromise;

  const cleanup = () => {
    video.removeEventListener("error", onError);
    if (source) source.removeEventListener("error", onError);
    video.removeEventListener("playing", onPlaying);
    video.removeEventListener("loadeddata", onPlaying);
    if (callbackId && typeof video.cancelVideoFrameCallback === "function") video.cancelVideoFrameCallback(callbackId);
    window.cancelAnimationFrame(fallbackId);
    window.clearTimeout(timeoutId);
  };
  const finish = () => {
    if (settled) return;
    settled = true;
    cleanup();
    resolvePromise();
  };
  const fail = (error) => {
    if (settled) return;
    settled = true;
    cleanup();
    rejectPromise(error);
  };
  const onError = () => fail(new Error("Video could not be loaded."));
  const onPlaying = () => {
    if (typeof video.requestVideoFrameCallback === "function") return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    fallbackId = window.requestAnimationFrame(() => {
      fallbackId = window.requestAnimationFrame(finish);
    });
  };
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  video.addEventListener("error", onError);
  if (source) source.addEventListener("error", onError);
  video.addEventListener("playing", onPlaying);
  video.addEventListener("loadeddata", onPlaying);
  timeoutId = window.setTimeout(() => fail(new Error("Video preparation timed out.")), 15000);
  if (typeof video.requestVideoFrameCallback === "function") {
    callbackId = video.requestVideoFrameCallback(finish);
  } else {
    onPlaying();
  }
  return { promise, cancel: () => fail(new Error("Playback canceled.")) };
}

function waitForStillFrame(video) {
  let settled = false;
  let timeoutId = 0;
  let resolvePromise;
  let rejectPromise;
  const cleanup = () => {
    video.removeEventListener("loadeddata", onReady);
    video.removeEventListener("error", onError);
    window.clearTimeout(timeoutId);
  };
  const finish = () => {
    if (settled) return;
    settled = true;
    cleanup();
    resolvePromise();
  };
  const fail = (error) => {
    if (settled) return;
    settled = true;
    cleanup();
    rejectPromise(error);
  };
  const onReady = () => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) finish();
  };
  const onError = () => fail(new Error("Intro could not be loaded."));
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  video.addEventListener("loadeddata", onReady);
  video.addEventListener("error", onError);
  timeoutId = window.setTimeout(() => fail(new Error("Intro frame timed out.")), 15000);
  if (video.error) onError();
  else onReady();
  return { promise, cancel: () => fail(new Error("Intro preparation canceled.")) };
}

function beginIntroHold(token, holdDuration = 2000) {
  if (token !== generation || state !== "INTRO_PREPARING") return;
  intro.pause();
  stage.dataset.frameSource = "intro";
  intro.classList.add("is-visible");
  loading.hidden = true;
  setState("INTRO_HOLD");
  // Count the still interval after the first frame has had a chance to paint.
  introPaintFrame = window.requestAnimationFrame(() => {
    introPaintFrame = window.requestAnimationFrame(() => {
      if (token !== generation || state !== "INTRO_HOLD") return;
      introHoldTimer = window.setTimeout(() => playIntroAfterHold(token), holdDuration);
    });
  });
}

async function playIntroAfterHold(token) {
  if (token !== generation || state !== "INTRO_HOLD") return;
  stopSfx();
  intro.muted = !soundOn;
  setState("INTRO_PLAYING");
  try {
    await intro.play();
  } catch (_error) {
    if (token !== generation || state !== "INTRO_PLAYING") return;
    intro.pause();
    setState("INTRO_WAIT_START");
    startLayer.hidden = false;
    if (intro.error) {
      stage.dataset.frameSource = "fallback";
      intro.classList.remove("is-visible");
    }
    showMessage(intro.error ? "INTRO COULD NOT LOAD" : "TAP START TO CONTINUE");
  }
}

async function prepareIntroStill() {
  if (!["INTRO_PREPARING", "INTRO_WAIT_START"].includes(state)) return;
  const token = nextGeneration();
  setState("INTRO_PREPARING");
  intro.pause();
  startLayer.hidden = true;
  loading.hidden = false;
  showMessage("");
  if (intro.error) intro.load();
  if (intro.readyState > 0 && intro.currentTime !== 0) intro.currentTime = 0;
  intro.muted = !soundOn;
  const stillFrame = waitForStillFrame(intro);
  pendingFrame = stillFrame;
  try {
    await stillFrame.promise;
    if (token !== generation || state !== "INTRO_PREPARING") return;
    pendingFrame = null;
    beginIntroHold(token);
  } catch (_error) {
    stillFrame.cancel();
    if (token !== generation || state !== "INTRO_PREPARING") return;
    pendingFrame = null;
    loading.hidden = true;
    stage.dataset.frameSource = "fallback";
    intro.classList.remove("is-visible");
    setState("INTRO_WAIT_START");
    startLayer.hidden = false;
    showMessage("INTRO COULD NOT LOAD");
  }
}

function showChoice() {
  stopSfx();
  nextGeneration();
  const useIntroFrame = intro.ended && intro.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && intro.videoWidth > 0;
  stage.dataset.frameSource = useIntroFrame ? "intro" : "fallback";
  setState("CHOICE");
  if (useIntroFrame) intro.classList.add("is-visible");
  else {
    intro.pause();
    intro.classList.remove("is-visible");
  }
  branch.pause();
  branch.classList.remove("is-visible");
  branch.removeAttribute("src");
  branch.load();
  startLayer.hidden = true;
  choiceLayer.classList.remove("is-leaving");
  choiceLayer.hidden = false;
  choiceButtons.forEach((button) => {
    button.disabled = false;
    button.classList.remove("is-selected", "is-dimmed");
  });
  endingTitle.classList.remove("is-visible");
  endingMessage.classList.remove("is-visible");
  endingActions.hidden = true;
  endingLayer.hidden = true;
  loading.hidden = true;
  showMessage("");
}

intro.addEventListener("ended", () => {
  if (state !== "INTRO_PLAYING") return;
  showChoice();
});

intro.addEventListener("error", () => {
  if (!state.startsWith("INTRO") || state === "INTRO_WAIT_START") return;
  nextGeneration();
  intro.pause();
  loading.hidden = true;
  stage.dataset.frameSource = "fallback";
  intro.classList.remove("is-visible");
  setState("INTRO_WAIT_START");
  startLayer.hidden = false;
  showMessage("INTRO COULD NOT LOAD");
});

async function finishBranchStart(token, playPromise, firstFrame) {
  try {
    await Promise.all([playPromise, firstFrame.promise]);
    if (token !== generation || !["BUTTON_RESPONSE", "TRANSFORMATION"].includes(state)) return;
    pendingFrame = null;
    window.clearTimeout(loadingTimer);
    loading.hidden = true;
    choiceLayer.hidden = true;
    branch.classList.add("is-visible");
    setState("TRANSFORMATION");
    watchBranchCut(token);
  } catch (_error) {
    firstFrame.cancel();
    if (token !== generation) return;
    showChoice();
    showMessage("PLAYBACK FAILED. CHOOSE AGAIN.");
  }
}

function playBranch(choice, isReplay = false) {
  if (!(isReplay ? state === "ENDING" : state === "CHOICE")) return;
  const token = nextGeneration();
  startHapticTimeline(choice);
  selectedChoice = choice;
  setState("BUTTON_RESPONSE");
  showMessage("");
  endingLayer.hidden = false;
  endingTitle.classList.remove("is-visible");
  endingMessage.classList.remove("is-visible");
  endingActions.hidden = true;
  branch.classList.remove("is-visible");
  branch.pause();
  branch.removeAttribute("src");
  branch.load();

  if (!isReplay) {
    playSfx("select");
    choiceButtons.forEach((button) => {
      button.disabled = true;
      button.classList.toggle("is-selected", button.dataset.choice === choice);
      button.classList.toggle("is-dimmed", button.dataset.choice !== choice);
    });
    playHaptic(choice);
    spatialReaction.dataset.choice = choice;
    if (!reducedMotion.matches) {
      responseAnimation = spatialReaction.animate(
        [{ opacity: 0 }, { opacity: .5, offset: .42 }, { opacity: 0 }],
        { duration: 200, easing: "ease-out" },
      );
    }
    responseTimer = window.setTimeout(() => {
      if (token === generation) choiceLayer.classList.add("is-leaving");
    }, 90);
  } else {
    stopSfx();
    choiceLayer.hidden = true;
  }

  branch.src = sources[choice];
  branch.setAttribute("aria-label", `${choice} transformation`);
  branch.muted = !soundOn;
  branch.load();
  const firstFrame = waitForFirstFrame(branch);
  pendingFrame = firstFrame;
  // play() stays in the button's user-activation call stack.
  const playPromise = branch.play();
  loadingTimer = window.setTimeout(() => {
    if (token === generation && state === "BUTTON_RESPONSE") loading.hidden = false;
  }, 450);
  finishBranchStart(token, playPromise, firstFrame);
}

branch.addEventListener("waiting", () => {
  if (videoHapticReview) { hapticStalled = true; cancelHaptic(); }
  if (state === "TRANSFORMATION") loading.hidden = false;
});
branch.addEventListener("playing", () => {
  hapticStalled = false;
  if (videoHapticReview && state === "TRANSFORMATION") rebaseHapticTimeline();
  if (state === "TRANSFORMATION") loading.hidden = true;
});
branch.addEventListener("pause", () => { if (videoHapticReview) cancelHaptic(); });
branch.addEventListener("seeking", () => { if (videoHapticReview) cancelHaptic(); });
branch.addEventListener("seeked", () => { if (videoHapticReview) rebaseHapticTimeline(); });
branch.addEventListener("error", () => {
  if (state !== "TRANSFORMATION") return;
  showChoice();
  showMessage("PLAYBACK FAILED. CHOOSE AGAIN.");
});
const OUTGOING_LAST_FRAME = 123 / 24;
const ENDING_FIRST_FRAME = 124 / 24;

function seekFrame(video, time) {
  return new Promise((resolve, reject) => {
    let timeout;
    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
    };
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error("Frame seek failed.")); };
    if (Math.abs(video.currentTime - time) < .001 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return resolve();
    video.addEventListener("seeked", done, { once: true });
    video.addEventListener("error", fail, { once: true });
    timeout = setTimeout(fail, 5000);
    video.currentTime = time;
  });
}

function watchBranchCut(token) {
  if (token !== generation || state !== "TRANSFORMATION") return;
  if (typeof branch.requestVideoFrameCallback === "function") {
    cutFrameRequest = branch.requestVideoFrameCallback((_now, metadata) => {
      cutFrameRequest = 0;
      if (token !== generation || state !== "TRANSFORMATION") return;
      if (metadata.mediaTime >= 122 / 24) beginEndingCut(token);
      else { advanceHapticTimeline(branch.currentTime); watchBranchCut(token); }
    });
  } else {
    const check = () => {
      if (token !== generation || state !== "TRANSFORMATION") return;
      if (branch.currentTime >= 118 / 24) beginEndingCut(token);
      else { advanceHapticTimeline(branch.currentTime); cutAnimationFrame = requestAnimationFrame(check); }
    };
    cutAnimationFrame = requestAnimationFrame(check);
  }
}

async function beginEndingCut(token) {
  if (token !== generation || state !== "TRANSFORMATION") return;
  cancelHaptic();
  stopSfx();
  setState("ENDING_TRANSITION");
  branch.pause();
  clearTimersAndFrames();
  loading.hidden = true;
  endingLayer.hidden = true;
  try {
    await seekFrame(branch, OUTGOING_LAST_FRAME);
    if (token !== generation || state !== "ENDING_TRANSITION") return;
    transitionAnimation = cinematicBlack.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: "ease-in-out", fill: "forwards" });
    await transitionAnimation.finished;
    cinematicBlack.style.opacity = "1";
    transitionAnimation.cancel();
    transitionAnimation = null;
    await Promise.all([seekFrame(branch, ENDING_FIRST_FRAME), new Promise(resolve => setTimeout(resolve, 200))]);
    if (token !== generation || state !== "ENDING_TRANSITION") return;
    transitionAnimation = cinematicBlack.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1300, easing: "ease-in-out", fill: "forwards" });
    await transitionAnimation.finished;
    cinematicBlack.style.opacity = "0";
    transitionAnimation.cancel();
    transitionAnimation = null;
  } catch (_error) {
    if (token !== generation) return;
    cinematicBlack.style.opacity = "0";
    showChoice();
    showMessage("PLAYBACK FAILED. CHOOSE AGAIN.");
    return;
  }
  if (token !== generation || state !== "ENDING_TRANSITION") return;
  endingLayer.hidden = false;
  setState("ENDING");
  endingTitle.classList.add("is-visible");
  endingTitleTimer = window.setTimeout(() => {
    if (token !== generation || state !== "ENDING") return;
    endingMessage.classList.add("is-visible");
    endingMessageTimer = window.setTimeout(() => {
      if (token === generation && state === "ENDING") endingActions.hidden = false;
    }, reducedMotion.matches ? 120 : 1100);
  }, reducedMotion.matches ? 120 : 1000);
}

branch.addEventListener("ended", () => {
  if (state !== "TRANSFORMATION") return;
  showChoice();
  showMessage("PLAYBACK FAILED. CHOOSE AGAIN.");
});

choiceButtons.forEach((button) => button.addEventListener("click", () => playBranch(button.dataset.choice)));
replayButton.addEventListener("click", () => {
  if (selectedChoice) playBranch(selectedChoice, true);
});
chooseAgainButton.addEventListener("click", () => {
  if (state !== "ENDING") return;
  selectedChoice = null;
  showChoice();
});
enterButton.addEventListener("click", async () => {
  if (state !== "ENDING" || endingActions.hidden) return;
  cancelHaptic();
  playSfx("enter");
  setState("INVITATION_TRANSITION");
  enterButton.disabled = true;
  endingLayer.inert = true;
  const fade = cinematicBlack.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: reducedMotion.matches ? 0 : 500, easing: "ease-in-out", fill: "forwards",
  });
  await fade.finished;
  cinematicBlack.style.opacity = "1";
  fade.cancel();
  endingLayer.hidden = true;
  invitation.hidden = false;
  invitation.inert = true;
  const appear = invitation.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: reducedMotion.matches ? 0 : 700, easing: "ease-out", fill: "forwards",
  });
  await appear.finished;
  appear.cancel();
  setState("INVITATION");
  invitation.inert = false;
  invitationTitle.focus({ preventScroll: true });
});
invitationBack.addEventListener("click", async () => {
  if (state !== "INVITATION") return;
  cancelHaptic();
  stopSfx();
  setState("ENDING_RETURN");
  invitationBack.disabled = true;
  invitation.inert = true;
  const fade = invitation.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: reducedMotion.matches ? 0 : 500, easing: "ease-in-out", fill: "forwards",
  });
  await fade.finished;
  invitation.hidden = true;
  fade.cancel();
  endingLayer.hidden = false;
  const reveal = cinematicBlack.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: reducedMotion.matches ? 0 : 700, easing: "ease-out", fill: "forwards",
  });
  await reveal.finished;
  cinematicBlack.style.opacity = "0";
  reveal.cancel();
  invitationBack.disabled = false;
  enterButton.disabled = false;
  endingLayer.inert = false;
  setState("ENDING");
  enterButton.focus({ preventScroll: true });
});
startButton.addEventListener("click", prepareIntroStill);

async function preparePrologue(retry = false) {
  const token = nextGeneration();
  setState("PROLOGUE_PREPARING");
  prologueEnter.disabled = false;
  prologueStatus.hidden = true;
  intro.pause();
  if (retry) intro.load();
  intro.muted = !soundOn;
  const stillFrame = waitForStillFrame(intro);
  pendingFrame = stillFrame;
  try {
    await stillFrame.promise;
    if (token !== generation || state !== "PROLOGUE_PREPARING") return;
    pendingFrame = null;
    stage.dataset.frameSource = "intro";
    intro.classList.add("is-visible");
    prologueEnter.textContent = "ACCEPT INVITATION";
    prologueEnter.disabled = false;
    prologueStatus.hidden = true;
    setState("PROLOGUE");
    if (pendingAccept) { pendingAccept = false; enterPrologue(); }
  } catch (_error) {
    if (token !== generation) return;
    pendingFrame = null;
    intro.pause();
    prologueStatus.textContent = "INTRO COULD NOT LOAD. TRY AGAIN.";
    prologueStatus.hidden = false;
    prologueEnter.textContent = "RETRY";
    prologueEnter.disabled = false;
    prologueEnter.classList.remove("is-accepted");
    pendingAccept = false;
    setState("PROLOGUE_ERROR");
  }
}

async function enterPrologue() {
  if (state === "PROLOGUE_PREPARING") {
    if (pendingAccept) return;
    pendingAccept = true;
    prologueEnter.disabled = true;
    prologueEnter.classList.add("is-accepted");
    prologueStatus.textContent = "LOADING";
    prologueStatus.hidden = false;
    return;
  }
  if (state === "PROLOGUE_ERROR") { preparePrologue(true); return; }
  if (state !== "PROLOGUE") return;
  const token = nextGeneration();
  setState("PROLOGUE_REVEAL");
  prologueEnter.disabled = true;
  prologueEnter.classList.add("is-accepted");
  prologueStatus.hidden = true;
  const animation = prologueShade.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: reducedMotion.matches ? 0 : 1800, easing: "ease-in-out", fill: "forwards",
  });
  await animation.finished;
  if (token !== generation || state !== "PROLOGUE_REVEAL") return;
  prologue.hidden = true;
  setState("INTRO_PREPARING");
  beginIntroHold(token, 500);
}

function syncSound() {
  soundButton.textContent = soundOn ? "SOUND ON" : "SOUND OFF";
  soundButton.setAttribute("aria-label", soundOn ? "Turn sound off" : "Turn sound on");
  soundButton.setAttribute("aria-pressed", String(soundOn));
  intro.muted = !soundOn;
  branch.muted = !soundOn;
}

prologueEnter.addEventListener("click", () => {
  if ((state === "PROLOGUE" || state === "PROLOGUE_PREPARING") && !pendingAccept) playSfx("accept");
  enterPrologue();
});
soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  if (!soundOn) stopSfx();
  syncSound();
});
syncSound();
preloadSfx();
preparePrologue();

