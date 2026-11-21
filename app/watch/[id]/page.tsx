"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  chHref,
  handleOf,
  metaLine,
  pct,
  recommend,
  useStore,
} from "@/lib/store";
import { ApiPlaylist, ApiVideo, compact, ytGet } from "@/lib/yt";
import { ChannelAvatar, Thumb, invBtn, pill } from "@/components/VideoCard";
import Player from "@/components/Player";

export default function WatchPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={<p className="p-10 text-yt-sec">Loading…</p>}>
      <Watch key={id} id={id} />
    </Suspense>
  );
}

function Watch({ id }: { id: string }) {
  const {
    videos,
    channels,
    progress,
    info,
    setProgress,
    removeVideo,
    removeChannel,
    openVideo,
    ready,
  } = useStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const listId = searchParams.get("list") ?? "";

  const v = videos.find((x) => x.id === id);
  const c = v && channels.find((x) => x.id === v.channelId);

  const p = v ? progress[v.yt] : undefined;
  const start = v && p && pct(p) < 95 ? p.t : 0;

  const rel = useMemo(() => {
    const others = videos.filter((x) => x.id !== id);
    const stableSeeds: Record<string, number> = {};
    others.forEach((x, index) => {
      stableSeeds[x.id] = index;
    });
    return recommend(others, progress, stableSeeds, v?.channelId);
  }, [videos, progress, id, v?.channelId]);

  if (!ready) return null;
  if (!v || !c) return <p className="p-10 text-yt-sec">Video not found.</p>;

  const subs = info[c.id]?.subs;

  return (
    <div className="mx-auto flex max-w-[1800px] flex-col gap-6 p-4 lg:flex-row lg:p-6">
      <div className="min-w-0 flex-1">
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          <Player yt={v.yt} start={start} onProgress={setProgress} />
        </div>
        <h1 className="mt-3 text-xl font-semibold">{v.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link href={chHref(c)}>
            <ChannelAvatar c={c} />
          </Link>
          <Link href={chHref(c)} className="leading-tight">
            <span className="block text-base font-medium">{c.name}</span>
            <span className="block text-xs text-yt-sec">
              {subs ? `${compact(subs)} subscribers` : handleOf(c)}
            </span>
          </Link>
          <button
            className={invBtn}
            onClick={() => {
              if (
                confirm("Unsubscribe and remove this channel and its videos?")
              ) {
                removeChannel(c.id);
                router.push("/");
              }
            }}
          >
            Subscribed
          </button>
          <span className="flex-1" />
          <a
            className={pill}
            href={`https://www.youtube.com/watch?v=${v.yt}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open on YouTube
          </a>
          <button
            className={pill}
            onClick={() => {
              removeVideo(v.id);
              router.push("/");
            }}
          >
            Remove
          </button>
        </div>
        <div className="mt-3 rounded-xl bg-yt-chip p-3 text-sm font-medium">
          {metaLine(v)}
          {p && p.d > 0 && (
            <span className="ml-2 font-normal text-yt-sec">
              · {Math.round(pct(p))}% watched
            </span>
          )}
        </div>
      </div>
      {listId ? (
        <div className="w-full shrink-0 lg:w-[402px]">
          <PlaylistPanel
            listId={listId}
            ytId={c.ytId ?? info[c.id]?.ytId}
            currentYt={v.yt}
            onOpen={(item, index) => {
              const localId = openVideo(c.id, item);
              router.push(
                `/watch/${localId}?list=${encodeURIComponent(listId)}&index=${index}`,
              );
            }}
          />
        </div>
      ) : (
        <div className="w-full shrink-0 space-y-2 lg:w-[402px]">
          {rel.map((x) => {
            const k = channels.find((ch) => ch.id === x.channelId);
            if (!k) return null;
            return (
              <Link key={x.id} href={`/watch/${x.id}`} className="flex gap-2">
                <Thumb
                  yt={x.yt}
                  dur={x.dur}
                  className="w-40 shrink-0 rounded-lg sm:w-44"
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium">{x.title}</p>
                  <p className="text-xs text-yt-sec">{k.name}</p>
                  <p className="text-xs text-yt-sec">{metaLine(x)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlaylistPanel({
  listId,
  ytId,
  currentYt,
  onOpen,
}: {
  listId: string;
  ytId?: string;
  currentYt: string;
  onOpen: (item: ApiVideo, index: number) => void;
}) {
  const [items, setItems] = useState<ApiVideo[]>([]);
  const [next, setNext] = useState("");
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("Playlist");
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let dead = false;
    setItems([]);
    setNext("");
    ytGet<{ videos: ApiVideo[]; next: string }>({
      type: "videos",
      playlist: listId,
    })
      .then((r) => {
        if (dead) return;
        setItems(
          ytId ? r.videos.filter((item) => item.chId === ytId) : r.videos,
        );
        setNext(r.next);
      })
      .catch(() => {
        if (!dead) setItems([]);
      });

    if (ytId) {
      ytGet<{ playlists: ApiPlaylist[] }>({ type: "playlists", id: ytId })
        .then((r) => {
          if (!dead) {
            const found = r.playlists.find(
              (playlist) => playlist.id === listId,
            );
            if (found) setTitle(found.title);
          }
        })
        .catch(() => {});
    }
    return () => {
      dead = true;
    };
  }, [listId, ytId]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentYt, items]);

  const loadMore = () => {
    if (!next || loading) return;
    setLoading(true);
    ytGet<{ videos: ApiVideo[]; next: string }>({
      type: "videos",
      playlist: listId,
      page: next,
    })
      .then((r) => {
        setItems((old) => {
          const seen = new Set(old.map((item) => item.yt));
          return [
            ...old,
            ...r.videos.filter(
              (item) => (!ytId || item.chId === ytId) && !seen.has(item.yt),
            ),
          ];
        });
        setNext(r.next);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-yt-line bg-yt-bg">
      <div className="border-b border-yt-line px-4 py-3">
        <h2 className="line-clamp-2 text-base font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-yt-sec">
          Playlist · {items.length} video{items.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="max-h-[560px] overflow-y-auto overscroll-contain lg:max-h-[calc(100vh-180px)]">
        {!items.length ? (
          <p className="px-4 py-8 text-center text-sm text-yt-sec">
            Loading playlist…
          </p>
        ) : (
          items.map((item, index) => {
            const active = item.yt === currentYt;
            return (
              <button
                ref={active ? activeRef : undefined}
                key={item.yt}
                type="button"
                onClick={() => onOpen(item, index)}
                className={`flex w-full gap-3 px-3 py-2 text-left transition-colors hover:bg-yt-chip ${active ? "bg-yt-chip" : ""}`}
              >
                <span className="mt-2 w-5 shrink-0 text-center text-xs font-medium text-yt-sec">
                  {active ? <span className="text-red-500">▶</span> : index + 1}
                </span>
                <Thumb
                  yt={item.yt}
                  dur={item.dur}
                  className="w-32 shrink-0 rounded-lg sm:w-36"
                />
                <span className="min-w-0 py-0.5">
                  <span className="line-clamp-2 block text-sm font-medium leading-snug">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-xs text-yt-sec">
                    Playlist video
                  </span>
                </span>
              </button>
            );
          })
        )}
        {next && (
          <button
            className="w-full px-4 py-3 text-sm font-medium text-yt-blue hover:bg-yt-chip"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}
