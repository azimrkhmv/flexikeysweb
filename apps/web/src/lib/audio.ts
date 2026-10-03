"use client";

import type { Lang } from "./i18n";

// ponytail: on-device speechSynthesis stands in for the pre-generated Azure audio manifest (PRD §9.8).
// Only `localService` voices are used so no text leaves the device. Swap `speak()` for manifest playback
// once content audio exists.

const BCP: Record<Lang, string> = { uz: "uz", ru: "ru", en: "en" };
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
  if (m) stopSpeech();
}

/** Call from the first user gesture (tap-to-start) — browsers block audio before it. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  window.speechSynthesis?.getVoices();
}

function voiceFor(lang: Lang) {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const local = voices.filter((v) => v.localService);
  return local.find((v) => v.lang.toLowerCase().startsWith(BCP[lang])) ?? null;
}

export function speak(text: string, lang: Lang) {
  if (muted || typeof window === "undefined" || !window.speechSynthesis) return;
  const voice = voiceFor(lang);
  if (!voice) return; // no local voice for this language: stay silent rather than send text to a cloud voice
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.85;
  u.pitch = 1.1;
  window.speechSynthesis.speak(u);
}

export function stopSpeech() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

type Sfx = "tap" | "success" | "soft" | "chime" | "pop";

// Gentle sine tones. "soft" is the neutral miss sound — never a buzzer.
const TONES: Record<Sfx, [number, number][]> = {
  tap: [[660, 0.06]],
  pop: [[880, 0.05], [1175, 0.07]],
  soft: [[392, 0.18]],
  success: [[523, 0.1], [659, 0.1], [784, 0.18]],
  chime: [[784, 0.12], [988, 0.12], [1175, 0.12], [1568, 0.3]],
};

export function sfx(kind: Sfx) {
  if (muted || !ctx) return;
  let t = ctx.currentTime;
  for (const [freq, dur] of TONES[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    t += dur * 0.9;
  }
}

/** Plays a recorded clip (a parent's own voice on a My Voice card) instead of the synthetic voice. */
export function playClip(url: string) {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
  void new Audio(url).play().catch(() => {});
}

