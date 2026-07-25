"use client";

import { useEffect, useRef, useState } from "react";

const EVOLVE_INTERVAL_MS = 20_000;

// Ambient audio clips that play alongside the procedural drone, one at a
// time, in random order — never two at once.
const TRACKS = ["/1.mp3", "/2.mp3", "/3.mp3", "/4.mp3"];
const TRACK_VOLUME = 0.5;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Procedurally generated ambient drone (brown noise bed + slow detuned sine drones)
 * built with the Web Audio API — no external audio asset required. The graph is
 * built immediately on mount; browsers keep it suspended until a user gesture, so
 * we resume it on the first click/keypress anywhere on the page instead of gating
 * behind a dedicated button. Every ~20 seconds the drone frequencies and noise
 * filter drift by a small random amount so the soundscape never loops identically.
 *
 * Alongside the drone, a single audio clip from /public plays at a time, chosen
 * at random from TRACKS; when it finishes, another random clip (never the same
 * one twice in a row) starts — only ever one clip playing at once.
 */
export default function AmbientAudio() {
  const [muted, setMuted] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const trackElRef = useRef<HTMLAudioElement | null>(null);
  const lastTrackIndex = useRef(-1);

  useEffect(() => {
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    masterGainRef.current = master;

    // Brown noise bed for a low ominous hiss.
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 450;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.45;

    noiseSource.connect(noiseFilter).connect(noiseGain).connect(master);
    noiseSource.start();

    // Slow, detuned sine drones with LFO-driven throb.
    const droneBases = [
      { freq: 55, gain: 0.13 },
      { freq: 55.6, gain: 0.11 },
      { freq: 110.3, gain: 0.05 },
    ];
    const droneOscillators: OscillatorNode[] = [];
    const lfoOscillators: OscillatorNode[] = [];

    droneBases.forEach(({ freq, gain }, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const oscGain = ctx.createGain();
      oscGain.gain.value = gain;

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.045 + i * 0.02;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = gain * 0.6;

      lfo.connect(lfoGain).connect(oscGain.gain);
      osc.connect(oscGain).connect(master);

      osc.start();
      lfo.start();

      droneOscillators.push(osc);
      lfoOscillators.push(lfo);
    });

    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 3.5);

    // One clip at a time: pick a random track (never repeating the previous
    // one back-to-back) and play it; the "ended" listener chains the next.
    const trackEl = new Audio();
    trackEl.volume = TRACK_VOLUME;
    trackElRef.current = trackEl;

    const playRandomTrack = () => {
      let idx = Math.floor(Math.random() * TRACKS.length);
      if (TRACKS.length > 1 && idx === lastTrackIndex.current) {
        idx = (idx + 1) % TRACKS.length;
      }
      lastTrackIndex.current = idx;
      trackEl.src = TRACKS[idx];
      trackEl.currentTime = 0;
      trackEl.play().catch(() => {
        // Blocked by autoplay policy until the user gesture below fires.
      });
    };
    trackEl.addEventListener("ended", playRandomTrack);

    const resume = () => {
      if (ctx.state === "suspended") ctx.resume();
      if (trackEl.paused) playRandomTrack();
    };
    resume();
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });

    // Every ~20s, drift the drones and filter by a small random amount so the
    // ambience slowly evolves instead of looping identically forever.
    const evolve = () => {
      const now = ctx.currentTime;
      const rampTime = rand(3, 6);

      droneBases.forEach(({ freq }, i) => {
        const drifted = freq * (1 + rand(-0.015, 0.015));
        droneOscillators[i].frequency.linearRampToValueAtTime(drifted, now + rampTime);
        lfoOscillators[i].frequency.linearRampToValueAtTime(rand(0.03, 0.09), now + rampTime);
      });

      noiseFilter.frequency.linearRampToValueAtTime(rand(320, 560), now + rampTime);
    };
    const evolveInterval = window.setInterval(evolve, EVOLVE_INTERVAL_MS);

    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      window.clearInterval(evolveInterval);
      trackEl.removeEventListener("ended", playRandomTrack);
      trackEl.pause();
      trackEl.src = "";
      ctx.close();
    };
  }, []);

  const toggleMute = () => {
    const ctx = ctxRef.current;
    const gainParam = masterGainRef.current?.gain;
    if (!ctx || !gainParam) return;
    if (muted) {
      gainParam.cancelScheduledValues(ctx.currentTime);
      gainParam.linearRampToValueAtTime(0.55, ctx.currentTime + 1);
    } else {
      gainParam.cancelScheduledValues(ctx.currentTime);
      gainParam.linearRampToValueAtTime(0, ctx.currentTime + 1);
    }
    if (trackElRef.current) trackElRef.current.muted = !muted;
    setMuted((m) => !m);
  };

  return (
    <button
      onClick={toggleMute}
      aria-label={muted ? "Unmute ambience" : "Mute ambience"}
      className="rounded-full border border-amber-200/30 px-4 py-2 text-xs tracking-widest text-amber-100/70 transition-colors hover:border-amber-200/70 hover:text-amber-100"
    >
      {muted ? "SOUND OFF" : "SOUND ON"}
    </button>
  );
}
