"use client";
import Image from "next/image";
import Link from "next/link";
import { Channel, Video, chHref, fmt, metaLine, pct, useStore } from "@/lib/store";

export const pill = "inline-flex h-9 items-center rounded-full bg-yt-chip px-4 text-sm font-medium hover:bg-yt-chiph";
export const invBtn = "inline-flex h-9 items-center rounded-full bg-yt-text px-4 text-sm font-medium text-yt-bg hover:opacity-85 disabled:opacity-50";

export const hue = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 50% 38%)`;
};

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div className="grid shrink-0 place-items-center rounded-full font-medium text-white"
      style={{ width: size, height: size, background: hue(name), fontSize: size * 0.4 }}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

// Real channel picture from YouTube when available, letter avatar otherwise
export function ChannelAvatar({ c, size = 36 }: { c: Channel; size?: number }) {
  const { info } = useStore();
  const src = info[c.id]?.avatar;
  if (!src) return <Avatar name={c.name} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" referrerPolicy="no-referrer" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  );
}

// Thumbnail with duration badge and YouTube's red "already watched" progress bar
export function Thumb({ yt, dur, className = "" }: { yt: string; dur?: number; className?: string }) {
  const { progress } = useStore();
  const p = progress[yt];
  const w = pct(p);
  const d = dur ?? p?.d;
  return (
    <div className={`relative aspect-video overflow-hidden bg-yt-chip ${className}`}>
      <Image src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" fill sizes="400px" className="object-cover" />
      {d ? <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1 text-xs font-medium text-white">{fmt(d)}</span> : null}
      {w >= 90 && (
        <span className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">WATCHED</span>
      )}
      {w > 0 && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
          <div className="h-full bg-red-600" style={{ width: `${w}%` }} />
        </div>
      )}
    </div>
  );
}

export function VideoCard({ v, c }: { v: Video; c: Channel }) {
  return (
    <div>
      <Link href={`/watch/${v.id}`}><Thumb yt={v.yt} dur={v.dur} className="rounded-xl" /></Link>
      <div className="mt-3 flex gap-3">
        <Link href={chHref(c)}><ChannelAvatar c={c} /></Link>
        <div className="min-w-0">
          <Link href={`/watch/${v.id}`} className="line-clamp-2 text-base font-medium leading-snug">{v.title}</Link>
          <Link href={chHref(c)} className="block text-sm text-yt-sec hover:text-yt-text">{c.name}</Link>
          <p className="text-sm text-yt-sec">{metaLine(v)}</p>
        </div>
      </div>
    </div>
  );
}
