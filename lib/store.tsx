"use client";
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { ApiVideo, ChannelInfo, ytGet } from "./yt";

export type Channel = { id: string; name: string; handle?: string; ytId?: string };
export type Video = {
  id: string; yt: string; channelId: string; title: string; ts: number;
  pub?: number; views?: number; dur?: number;
};
export type Progress = { t: number; d: number; ts: number };
type State = {
  channels: Channel[]; videos: Video[]; progress: Record<string, Progress>;
  info: Record<string, ChannelInfo>; miss: Record<string, number>;
};
type Parsed = { name: string; ytId?: string };

const KEY = "channelhub.v1";
const uid = () => Math.random().toString(36).slice(2, 9);
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export const handleOf = (c: Channel) => c.handle ?? "@" + c.name.toLowerCase().replace(/[^\p{L}\p{N}._-]/gu, "");
export const chHref = (c: Channel) => "/" + handleOf(c);
export const pct = (p?: Progress) => (p && p.d > 0 ? Math.min(100, (p.t / p.d) * 100) : 0);
export const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`;
};

export const ago = (t: number) => {
  const s = (Date.now() - t) / 1000;
  const units: [number, number, string][] = [
    [3600, 60, "minute"], [86400, 3600, "hour"], [604800, 86400, "day"],
    [2592000, 604800, "week"], [31536000, 2592000, "month"], [1e12, 31536000, "year"],
  ];
  if (s < 60) return "just now";
  for (const [limit, div, name] of units)
    if (s < limit) { const n = Math.floor(s / div); return `${n} ${name}${n > 1 ? "s" : ""} ago`; }
};

export const viewsText = (n?: number) =>
  n === undefined ? "" : new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n) + " views";
export const when = (v: Video) => (v.pub ? ago(v.pub) : "Added " + ago(v.ts));
export const metaLine = (v: Video) => [viewsText(v.views), when(v)].filter(Boolean).join(" • ");

// Unwatched first, then partly watched, then finished. Inside each group: channels you
// watch most, fresh uploads and a stable random nudge.
export function recommend(videos: Video[], progress: Record<string, Progress>, seeds: Record<string, number>, focusChannel?: string) {
  const affinity: Record<string, number> = {};
  for (const v of videos) if (progress[v.yt]) affinity[v.channelId] = (affinity[v.channelId] ?? 0) + 1;
  const max = Math.max(1, ...Object.values(affinity));
  const score = (v: Video) => {
    const p = progress[v.yt];
    const tier = !p ? 2 : pct(p) >= 90 ? 0 : 1;
    const fresh = v.pub ? Math.max(0, 1 - (Date.now() - v.pub) / (90 * 864e5)) * 0.7 : 0;
    return tier * 10 + ((affinity[v.channelId] ?? 0) / max) * 0.5 + (seeds[v.id] ?? 0) + fresh + (focusChannel && v.channelId === focusChannel ? 0.8 : 0);
  };
  return [...videos].sort((a, b) => score(b) - score(a));
}

// Accepts Takeout subscriptions.csv, a JSON array, or one name/@handle/URL per line
export function parseChannels(text: string): Parsed[] {
  const t = text.trim();
  if (!t) return [];
  try {
    const j = JSON.parse(t);
    if (Array.isArray(j))
      return j.map((x) => (typeof x === "string" ? { name: x } : { name: String(x.name ?? x.title ?? ""), ytId: x.channelId ?? x.ytId }))
        .filter((x) => x.name);
  } catch { /* not JSON */ }
  const lines = t.split(/\r?\n/);
  if (/channel id/i.test(lines[0]) && lines[0].includes(",")) {
    return lines.slice(1).map((l) => {
      const p = (l.match(/("([^"]*)"|[^,]+)/g) ?? []).map((x) => x.replace(/^"|"$/g, "").trim());
      return { name: p[2] || p[1] || p[0] || "", ytId: /^UC[\w-]{22}$/.test(p[0] ?? "") ? p[0] : undefined };
    }).filter((x) => x.name);
  }
  return lines.map((l) => {
    const s = l.trim();
    return {
      name: s.replace(/^.*youtube\.com\/(channel\/)?@?/i, "").replace(/^@/, ""),
      ytId: s.match(/youtube\.com\/channel\/(UC[\w-]{22})/)?.[1],
    };
  }).filter((x) => x.name);
}

type StoreType = State & {
  ready: boolean;
  apiError: string;
  importChannels: (text: string) => number;
  addVideos: (text: string) => Promise<string[]>;
  removeChannel: (id: string) => void;
  removeVideo: (id: string) => void;
  setProgress: (yt: string, t: number, d: number) => void;
  mergeVideos: (channelId: string, list: ApiVideo[]) => void;
  openVideo: (channelId: string, v: ApiVideo) => string;
};
const Ctx = createContext<StoreType>(null!);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ channels: [], videos: [], progress: {}, info: {}, miss: {} });
  const [ready, setReady] = useState(false);
  const [apiError, setApiError] = useState("");
  const tried = useRef(new Set<string>());

  useEffect(() => {
    try {
      const r = localStorage.getItem(KEY);
      if (r) setState({ channels: [], videos: [], progress: {}, info: {}, miss: {}, ...JSON.parse(r) });
    } catch { /* ignore */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state, ready]);

  // Look up every channel on YouTube (avatar, banner, stats…). Each channel is tried once per visit.
  useEffect(() => {
    if (!ready || apiError) return;
    for (const c of state.channels) {
      const cached = state.info[c.id];
      const stale = !cached || Date.now() - cached.at > 432e5;
      const recentMiss = state.miss[c.id] && Date.now() - state.miss[c.id] < 864e5;
      if (!stale || recentMiss || tried.current.has(c.id)) continue;
      tried.current.add(c.id);
      ytGet<ChannelInfo>({ type: "channel", id: c.ytId, handle: c.handle ?? handleOf(c), q: c.name })
        .then((info) =>
          setState((s) => ({
            ...s,
            info: { ...s.info, [c.id]: info },
            channels: s.channels
              .map((x) => x.id === c.id
                ? { ...x, name: info.title || x.name, ytId: info.ytId, handle: info.handle.startsWith("@") ? info.handle : x.handle }
                : x)
              .sort((a, b) => a.name.localeCompare(b.name)),
          })))
        .catch((e: Error) => {
          if (e.message === "notfound") setState((s) => ({ ...s, miss: { ...s.miss, [c.id]: Date.now() } }));
          else if (e.message === "missing_key" || e.message === "quota") setApiError(e.message);
        });
    }
  }, [ready, apiError, state.channels, state.info, state.miss]);

  const importChannels = (text: string) => {
    const fresh = parseChannels(text).filter(
      (n, i, a) => a.findIndex((x) => norm(x.name) === norm(n.name)) === i &&
        !state.channels.some((c) => norm(c.name) === norm(n.name) || (c.handle && norm(c.handle) === norm(n.name)) || (n.ytId && c.ytId === n.ytId))
    );
    setState((s) => ({
      ...s,
      channels: [...s.channels, ...fresh.map((n) => ({ id: uid(), name: n.name, ytId: n.ytId }))]
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
    return fresh.length;
  };

  const addVideos = async (text: string) => {
    const msgs: string[] = [];
    const added: Video[] = [];
    const handles: Record<string, string> = {};
    for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
      const m = line.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/) ?? line.match(/^([\w-]{11})$/);
      if (!m) { msgs.push(`Not a YouTube link: ${line}`); continue; }
      const res = await fetch(`/api/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + m[1])}`);
      if (!res.ok) { msgs.push(`Could not read: ${line}`); continue; }
      const d = await res.json();
      const hm = String(d.authorUrl ?? "").match(/youtube\.com\/(@[^/?#]+)/);
      let authorHandle = "";
      if (hm) { try { authorHandle = decodeURIComponent(hm[1]); } catch { authorHandle = hm[1]; } }
      const ch = state.channels.find((c) =>
        norm(c.name) === norm(d.author) ||
        (authorHandle && c.handle?.toLowerCase() === authorHandle.toLowerCase()) ||
        (state.info[c.id] && norm(state.info[c.id].title) === norm(d.author)));
      if (!ch) { msgs.push(`Blocked: "${d.author}" is not in your channels`); continue; }
      if (authorHandle) handles[ch.id] = authorHandle;
      if (state.videos.some((v) => v.yt === m[1]) || added.some((v) => v.yt === m[1])) continue;
      added.push({ id: uid(), yt: m[1], channelId: ch.id, title: d.title, ts: Date.now() });
    }
    if (added.length || Object.keys(handles).length)
      setState((s) => ({
        ...s,
        channels: s.channels.map((c) => (handles[c.id] ? { ...c, handle: handles[c.id] } : c)),
        videos: [...added, ...s.videos],
      }));
    return msgs;
  };

  const removeChannel = (id: string) =>
    setState((s) => {
      const info = { ...s.info }; delete info[id];
      return { ...s, info, channels: s.channels.filter((c) => c.id !== id), videos: s.videos.filter((v) => v.channelId !== id) };
    });
  const removeVideo = (id: string) =>
    setState((s) => ({ ...s, videos: s.videos.filter((v) => v.id !== id) }));
  const setProgress = (yt: string, t: number, d: number) =>
    setState((s) => ({ ...s, progress: { ...s.progress, [yt]: { t, d, ts: Date.now() } } }));

  // Import a channel's videos into your library (updates views/duration/date of ones you already have)
  const mergeVideos = (channelId: string, list: ApiVideo[]) =>
    setState((s) => {
      const api = new Map(list.map((a) => [a.yt, a]));
      const have = new Set(s.videos.map((v) => v.yt));
      const updated = s.videos.map((v) => {
        const a = api.get(v.yt);
        return a && v.channelId === channelId ? { ...v, title: a.title, pub: a.pub, views: a.views, dur: a.dur } : v;
      });
      const fresh: Video[] = list.filter((a) => !have.has(a.yt)).map((a) => ({
        id: uid(), yt: a.yt, channelId, title: a.title, ts: a.pub, pub: a.pub, views: a.views, dur: a.dur,
      }));
      return { ...s, videos: [...fresh, ...updated].sort((a, b) => (b.pub ?? b.ts) - (a.pub ?? a.ts)) };
    });

  const openVideo = (channelId: string, a: ApiVideo) => {
    const ex = state.videos.find((v) => v.yt === a.yt);
    if (ex) return ex.id;
    const id = uid();
    setState((s) => ({
      ...s,
      videos: [{ id, yt: a.yt, channelId, title: a.title, ts: a.pub, pub: a.pub, views: a.views, dur: a.dur }, ...s.videos],
    }));
    return id;
  };

  return (
    <Ctx.Provider value={{ ...state, ready, apiError, importChannels, addVideos, removeChannel, removeVideo, setProgress, mergeVideos, openVideo }}>
      {children}
    </Ctx.Provider>
  );
}
