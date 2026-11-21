"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { chHref, handleOf, metaLine, useStore } from "@/lib/store";
import { compact } from "@/lib/yt";
import { ChannelAvatar, Thumb } from "@/components/VideoCard";

function Results() {
  const q = (useSearchParams().get("q") ?? "").toLowerCase();
  const { videos, channels, info, ready } = useStore();
  if (!ready) return null;

  const chs = channels.filter((c) => c.name.toLowerCase().includes(q) || handleOf(c).toLowerCase().includes(q));
  const list = videos.filter((v) => {
    const c = channels.find((x) => x.id === v.channelId);
    return v.title.toLowerCase().includes(q) || c?.name.toLowerCase().includes(q);
  });
  if (!list.length && !chs.length)
    return <p className="p-16 text-center text-yt-sec">No results. Only your channels and their videos are searched.</p>;

  return (
    <div className="space-y-4 py-4">
      {chs.map((c) => {
        const subs = info[c.id]?.subs;
        return (
          <Link key={c.id} href={chHref(c)} className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-2">
            <div className="grid w-full max-w-[360px] place-items-center sm:w-[360px]"><ChannelAvatar c={c} size={136} /></div>
            <div>
              <h3 className="text-lg">{c.name}</h3>
              <p className="text-xs text-yt-sec">
                {handleOf(c)}{subs ? ` · ${compact(subs)} subscribers` : ""}
              </p>
            </div>
          </Link>
        );
      })}
      {list.map((v) => {
        const c = channels.find((x) => x.id === v.channelId);
        if (!c) return null;
        return (
          <Link key={v.id} href={`/watch/${v.id}`} className="mx-auto flex max-w-5xl flex-col gap-4 px-4 sm:flex-row">
            <Thumb yt={v.yt} dur={v.dur} className="w-full shrink-0 rounded-xl sm:w-[360px]" />
            <div>
              <h3 className="text-lg">{v.title}</h3>
              <p className="text-xs text-yt-sec">{metaLine(v)}</p>
              <div className="my-3 flex items-center gap-2 text-xs text-yt-sec"><ChannelAvatar c={c} size={24} />{c.name}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function SearchPage() {
  return <Suspense><Results /></Suspense>;
}
