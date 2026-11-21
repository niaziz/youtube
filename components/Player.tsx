"use client";
import { useEffect, useRef } from "react";

type YTPlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
};
type YTNS = { Player: new (el: HTMLElement, opts: object) => YTPlayer };
declare global {
  interface Window {
    YT?: YTNS;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    if (window.YT?.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return apiPromise;
}

export default function Player({
  yt,
  start,
  onProgress,
}: {
  yt: string;
  start: number;
  onProgress: (yt: string, t: number, d: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef(onProgress);
  const startRef = useRef(start);
  cb.current = onProgress;

  useEffect(() => {
    let player: YTPlayer | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let dead = false;

    const report = () => {
      try {
        if (!player) return;
        const d = player.getDuration(),
          t = player.getCurrentTime();
        if (d > 0 && t >= 0) cb.current(yt, t, d);
      } catch {
        /* player not ready */
      }
    };

    loadApi().then(() => {
      if (dead || !host.current || !window.YT) return;
      const el = document.createElement("div");
      host.current.innerHTML = "";
      host.current.appendChild(el);
      player = new window.YT.Player(el, {
        videoId: yt,
        width: "100%",
        height: "100%",
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          autoplay: 1,
          rel: 0,
          playsinline: 1,
          start: Math.floor(startRef.current),
        },
        events: {
          onStateChange: (e: { data: number }) => {
            clearInterval(timer);
            if (e.data === 1) timer = setInterval(report, 5000); // playing
            if (e.data === 0 || e.data === 2 || e.data === 1) report(); // ended, paused, started
          },
        },
      });
    });

    return () => {
      report();
      dead = true;
      clearInterval(timer);
      try {
        player?.destroy();
      } catch {
        /* ignore */
      }
    };
  }, [yt]);

  return (
    <div
      ref={host}
      className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full"
    />
  );
}
