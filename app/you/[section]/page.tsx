"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { chHref, metaLine, pct, useStore } from "@/lib/store";
import { Thumb } from "@/components/VideoCard";

const titles: Record<string, string> = {
  history: "History",
  playlists: "Playlists",
  "watch-later": "Watch later",
  liked: "Liked videos",
  downloads: "Downloads",
  channel: "Your channel",
  videos: "Your videos",
};

export default function YouSectionPage() {
  const { section } = useParams<{ section: string }>();
  const { videos, channels, progress, ready } = useStore();

  if (!ready) return null;

  const title = titles[section] ?? "You";

  if (section === "history") {
    const history = videos
      .filter((video) => progress[video.yt])
      .sort((a, b) => (progress[b.yt]?.ts ?? 0) - (progress[a.yt]?.ts ?? 0));

    return (
      <div className="mx-auto max-w-[1284px] p-6">
        <h1 className="mb-6 text-2xl font-bold">{title}</h1>
        {history.length ? (
          <div className="grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {history.map((video) => {
              const channel = channels.find(
                (item) => item.id === video.channelId,
              );
              if (!channel) return null;
              return (
                <Link key={video.id} href={`/watch/${video.id}`}>
                  <Thumb yt={video.yt} dur={video.dur} className="rounded-xl" />
                  <h2 className="mt-2 line-clamp-2 text-sm font-medium">
                    {video.title}
                  </h2>
                  <p className="text-xs text-yt-sec">
                    {channel.name} · {metaLine(video)} ·{" "}
                    {Math.round(pct(progress[video.yt]))}% watched
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="py-16 text-center text-yt-sec">
            Videos you watch will appear here.
          </p>
        )}
      </div>
    );
  }

  const message =
    section === "channel"
      ? "Import a channel to make it available as Your channel."
      : section === "videos"
        ? "Videos from your imported channel library will appear here."
        : section === "playlists"
          ? "Open a channel to view and play its playlists."
          : section === "watch-later"
            ? "Videos saved for later will appear here."
            : section === "liked"
              ? "Liked videos will appear here."
              : section === "downloads"
                ? "Downloaded videos will appear here."
                : "This section is not available.";

  return (
    <div className="mx-auto max-w-[1284px] p-6">
      <h1 className="mb-6 text-2xl font-bold">{title}</h1>
      <p className="py-16 text-center text-yt-sec">{message}</p>
      {section === "playlists" && channels[0] && (
        <div className="text-center">
          <Link
            href={chHref(channels[0])}
            className="inline-flex h-9 items-center rounded-full bg-yt-chip px-4 text-sm font-medium hover:bg-yt-chiph"
          >
            Browse channel playlists
          </Link>
        </div>
      )}
    </div>
  );
}
