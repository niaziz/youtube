export type ChannelInfo = {
  ytId: string; title: string; handle: string; description: string; avatar: string; banner: string;
  subs: number | null; videos: number; views: number; country: string; joined: string; uploads: string; at: number;
};
export type ApiVideo = { yt: string; title: string; pub: number; views: number; dur: number; chId: string };
export type ApiPlaylist = { id: string; title: string; desc: string; count: number; thumb: string };

const cache = new Map<string, Promise<unknown>>();

export function ytGet<T>(params: Record<string, string | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const key = qs.toString();
  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;
  const p = fetch("/api/yt?" + key).then(async (r) => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? "error");
    return d as T;
  });
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

export const compact = (n: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(n);
