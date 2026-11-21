"use client";
import { useMemo, useRef, useState } from "react";
import { recommend, useStore } from "@/lib/store";
import { VideoCard } from "@/components/VideoCard";

export default function Home() {
  const { channels, videos, progress, ready } = useStore();
  const [chip, setChip] = useState("");
  const seeds = useRef<Record<string, number>>({});

  // Unwatched videos first (favouring channels you watch most), finished ones last
  const sorted = useMemo(() => {
    videos.forEach((v) => {
      if (seeds.current[v.id] === undefined)
        seeds.current[v.id] = Math.random();
    });
    return recommend(videos, progress, seeds.current);
  }, [videos, progress]);

  if (!ready) return null;

  if (!channels.length)
    return (
      <div className="px-6 py-24 text-center text-yt-sec">
        <h2 className="text-lg font-medium text-yt-text">
          Your library is empty
        </h2>
        <p>
          Click <b>Import</b> (top right) to add the channels you want. Only
          they will appear here.
        </p>
      </div>
    );

  const list = sorted.filter((v) => !chip || v.channelId === chip);
  const chipCls = (on: boolean) =>
    `inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-sm font-medium ${on ? "bg-yt-text text-yt-bg" : "bg-yt-chip hover:bg-yt-chiph"}`;

  return (
    <>
      <div className="no-scrollbar sticky top-0 z-10 flex gap-3 overflow-x-auto bg-yt-bg px-6 py-3">
        <button className={chipCls(chip === "")} onClick={() => setChip("")}>
          All
        </button>
        {channels.map((c) => (
          <button
            key={c.id}
            className={chipCls(chip === c.id)}
            onClick={() => setChip(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="grid gap-x-4 gap-y-10 px-6 pb-10 pt-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.map((v) => {
            const c = channels.find((x) => x.id === v.channelId);
            return c ? <VideoCard key={v.id} v={v} c={c} /> : null;
          })}
        </div>
      ) : (
        <p className="px-6 py-20 text-center text-yt-sec">
          No videos yet. Click <b>+ Add</b> and paste some links.
        </p>
      )}
    </>
  );
}
