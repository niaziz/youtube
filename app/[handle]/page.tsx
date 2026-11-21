"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiPlaylist, ApiVideo, compact, ytGet } from "@/lib/yt";
import { ago, handleOf, pct, Progress, useStore } from "@/lib/store";
import {
  ChannelAvatar,
  Thumb,
  VideoCard,
  hue,
  pill,
} from "@/components/VideoCard";

type Tab = "home" | "videos" | "playlists" | "about";

function ApiCard({
  v,
  onOpen,
  wide,
}: {
  v: ApiVideo;
  onOpen: (v: ApiVideo) => void;
  wide?: boolean;
}) {
  return (
    <div
      className={`cursor-pointer ${wide ? "w-[250px] shrink-0" : ""}`}
      onClick={() => onOpen(v)}
    >
      <Thumb yt={v.yt} dur={v.dur} className="rounded-xl" />
      <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug">
        {v.title}
      </h3>
      <p className="text-xs text-yt-sec">
        {compact(v.views)} views • {ago(v.pub)}
      </p>
    </div>
  );
}

function Row({
  title,
  desc,
  onPlayAll,
  children,
}: {
  title: string;
  desc?: string;
  onPlayAll?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <section className="px-6 pt-8">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold">{title}</h2>
        {onPlayAll && (
          <button className="text-sm font-medium" onClick={onPlayAll}>
            ▶ Play all
          </button>
        )}
      </div>
      {desc && (
        <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-yt-sec">
          {desc}
        </p>
      )}
      <div className="relative mt-4">
        <div ref={ref} className="no-scrollbar flex gap-4 overflow-x-auto">
          {children}
        </div>
        <button
          aria-label="Next"
          onClick={() =>
            ref.current?.scrollBy({ left: 640, behavior: "smooth" })
          }
          className="absolute right-0 top-14 grid h-10 w-10 place-items-center rounded-full border border-yt-line bg-yt-bg text-xl shadow"
        >
          ›
        </button>
      </div>
    </section>
  );
}

// Only videos that really belong to this channel (playlists can contain other channels’ videos)
function usePlaylist(
  id: string,
  ytId: string,
  progress: Record<string, Progress>,
) {
  const [v, setV] = useState<ApiVideo[] | null>(null);
  useEffect(() => {
    let dead = false;
    ytGet<{ videos: ApiVideo[] }>({ type: "videos", playlist: id })
      .then((r) => {
        if (!dead) {
          setV(
            r.videos.filter((x) => x.chId === ytId && pct(progress[x.yt]) < 90),
          );
        }
      })
      .catch(() => {
        if (!dead) setV([]);
      });
    return () => {
      dead = true;
    };
  }, [id, ytId, progress]);
  return v;
}

type PlaylistOpen = (v: ApiVideo, index: number) => void;

function PlaylistRow({
  pl,
  ytId,
  progress,
  onOpen,
}: {
  pl: ApiPlaylist;
  ytId: string;
  progress: Record<string, Progress>;
  onOpen: PlaylistOpen;
}) {
  const v = usePlaylist(pl.id, ytId, progress);
  if (!v?.length) return null;
  return (
    <Row title={pl.title} desc={pl.desc} onPlayAll={() => onOpen(v[0], 0)}>
      {v.slice(0, 14).map((x, index) => (
        <ApiCard key={x.yt} v={x} wide onOpen={(item) => onOpen(item, index)} />
      ))}
    </Row>
  );
}

function PlaylistVideos({
  pl,
  ytId,
  progress,
  onOpen,
}: {
  pl: ApiPlaylist;
  ytId: string;
  progress: Record<string, Progress>;
  onOpen: PlaylistOpen;
}) {
  const v = usePlaylist(pl.id, ytId, progress);
  if (!v) return <p className="py-10 text-yt-sec">Loading…</p>;
  if (!v.length)
    return (
      <p className="py-10 text-yt-sec">
        No videos from this channel in this playlist.
      </p>
    );
  return (
    <div className="grid gap-x-4 gap-y-8 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {v.map((x, index) => (
        <ApiCard key={x.yt} v={x} onOpen={(item) => onOpen(item, index)} />
      ))}
    </div>
  );
}

export default function ChannelRoute() {
  const { handle } = useParams<{ handle: string }>();
  return <ChannelPage key={handle} handle={handle} />;
}

function ChannelPage({ handle }: { handle: string }) {
  const {
    channels,
    videos,
    progress,
    info: infos,
    apiError,
    removeChannel,
    mergeVideos,
    openVideo,
    ready,
  } = useStore();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("home");
  const [uploads, setUploads] = useState<ApiVideo[]>([]);
  const [next, setNext] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [lists, setLists] = useState<ApiPlaylist[]>([]);
  const [sort, setSort] = useState<"latest" | "popular" | "oldest">("latest");
  const [sel, setSel] = useState<ApiPlaylist | null>(null);

  let h = handle;
  try {
    h = decodeURIComponent(handle);
  } catch {
    /* keep raw */
  }
  const c =
    ready && h.startsWith("@")
      ? channels.find((x) => handleOf(x).toLowerCase() === h.toLowerCase())
      : undefined;
  const info = c ? infos[c.id] : undefined;
  const cid = c?.id,
    up = info?.uploads,
    yid = info?.ytId;

  // Import the channel's latest videos + playlists from YouTube
  useEffect(() => {
    if (!cid || !up || !yid) return;
    let dead = false;
    ytGet<{ videos: ApiVideo[]; next: string }>({
      type: "videos",
      playlist: up,
    })
      .then((r) => {
        if (dead) return;
        setUploads(r.videos);
        setNext(r.next);
        mergeVideos(cid, r.videos);
      })
      .catch(() => {});
    ytGet<{ playlists: ApiPlaylist[] }>({ type: "playlists", id: yid })
      .then((r) => {
        if (!dead) setLists(r.playlists);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, up, yid]);

  if (!ready) return null;
  if (!c)
    return (
      <p className="p-10 text-center text-yt-sec">This page isn’t available.</p>
    );

  const own = videos.filter((v) => v.channelId === c.id);
  const handleName = handleOf(c);
  const onOpen = (v: ApiVideo) => router.push(`/watch/${openVideo(c.id, v)}`);
  const onPlaylistOpen = (pl: ApiPlaylist) => (v: ApiVideo, index: number) => {
    const localId = openVideo(c.id, v);
    router.push(
      `/watch/${localId}?list=${encodeURIComponent(pl.id)}&index=${index}`,
    );
  };
  const loadMore = () => {
    if (!up || !next) return;
    setLoadingMore(true);
    ytGet<{ videos: ApiVideo[]; next: string }>({
      type: "videos",
      playlist: up,
      page: next,
    })
      .then((r) => {
        setUploads((u) => [...u, ...r.videos]);
        setNext(r.next);
        mergeVideos(c.id, r.videos);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const links = [
    ...new Set(info?.description.match(/https?:\/\/[^\s)]+/g) ?? []),
  ];
  const firstLine = info?.description.split("\n").find((l) => l.trim()) ?? "";
  const visibleUploads = uploads.filter((v) => pct(progress[v.yt]) < 90);
  const sorted = [...visibleUploads].sort(
    sort === "popular"
      ? (a, b) => b.views - a.views
      : sort === "oldest"
        ? (a, b) => a.pub - b.pub
        : (a, b) => b.pub - a.pub,
  );
  const watched = own.filter((v) => pct(progress[v.yt]) >= 90).length;
  const tabCls = (on: boolean) =>
    `border-b-2 px-4 py-3 text-base font-medium ${on ? "border-yt-text" : "border-transparent text-yt-sec hover:text-yt-text"}`;
  const chipCls = (on: boolean) =>
    `inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium ${on ? "bg-yt-text text-yt-bg" : "bg-yt-chip hover:bg-yt-chiph"}`;

  const libraryGrid = own.length ? (
    <div className="grid gap-x-4 gap-y-10 px-6 py-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {own.map((v) => (
        <VideoCard key={v.id} v={v} c={c} />
      ))}
    </div>
  ) : (
    <p className="px-6 py-16 text-center text-yt-sec">
      No videos yet. Click <b>+ Add</b> and paste a link.
    </p>
  );

  return (
    <div className="mx-auto max-w-[1284px] pb-16">
      <div className="px-6 pt-4">
        {info?.banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.banner}
            alt=""
            referrerPolicy="no-referrer"
            className="h-28 w-full rounded-xl object-cover sm:h-48"
          />
        ) : (
          <div
            className="h-28 rounded-xl sm:h-48"
            style={{
              background: `linear-gradient(135deg, ${hue(c.name)}, ${hue(c.name + "x")})`,
            }}
          />
        )}
      </div>

      <div className="flex flex-col items-center gap-6 px-6 pt-6 sm:flex-row sm:items-start">
        <ChannelAvatar c={c} size={160} />
        <div className="min-w-0 text-center sm:text-left">
          <h1 className="text-4xl font-bold">{c.name}</h1>
          <p className="my-2 text-sm text-yt-sec">
            <span className="font-medium text-yt-text">{handleName}</span>
            {info && info.subs !== null && (
              <> · {compact(info.subs)} subscribers</>
            )}
            {info && <> · {compact(info.videos)} videos</>}
            {!info && (
              <>
                {" "}
                · {own.length} video{own.length === 1 ? "" : "s"}
              </>
            )}
          </p>
          {firstLine && (
            <p className="max-w-2xl text-sm text-yt-sec">
              <span className="line-clamp-1 inline">{firstLine}</span>{" "}
              <button
                className="font-medium text-yt-text"
                onClick={() => setTab("about")}
              >
                ...more
              </button>
            </p>
          )}
          {links[0] && (
            <p className="mt-2 text-sm">
              <a
                className="text-yt-blue"
                href={links[0]}
                target="_blank"
                rel="noopener noreferrer"
              >
                {links[0].replace(/^https?:\/\//, "").slice(0, 40)}
              </a>
              {links.length > 1 && (
                <button
                  className="ml-1 font-medium"
                  onClick={() => setTab("about")}
                >
                  and {links.length - 1} more link{links.length > 2 ? "s" : ""}
                </button>
              )}
            </p>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <button
              className={`${pill} gap-2 !h-10`}
              onClick={() => {
                if (
                  confirm("Unsubscribe and remove this channel and its videos?")
                ) {
                  removeChannel(c.id);
                  router.push("/");
                }
              }}
            >
              🔔 Subscribed ▾
            </button>
            <a
              className={`${pill} !h-10`}
              href={`https://www.youtube.com/${handleName}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open on YouTube
            </a>
          </div>
        </div>
      </div>

      {!info && apiError === "missing_key" && (
        <div className="mx-6 mt-6 rounded-xl bg-yt-chip p-4 text-sm">
          <p className="font-medium">
            Banner, subscribers, videos and playlists need a YouTube API key.
          </p>
          <p className="mt-1 text-yt-sec">
            Add <code>YOUTUBE_API_KEY=your_key</code> to a file called{" "}
            <code>.env.local</code> in your project root, then restart{" "}
            <code>npm run dev</code>.
          </p>
        </div>
      )}
      {!info && apiError === "quota" && (
        <div className="mx-6 mt-6 rounded-xl bg-yt-chip p-4 text-sm">
          YouTube’s free daily API quota is used up. It resets once a day; your
          saved data still works.
        </div>
      )}

      <div className="mt-6 flex overflow-x-auto border-b border-yt-line px-6">
        {(["home", "videos", "playlists", "about"] as Tab[]).map((t) => (
          <button
            key={t}
            className={tabCls(tab === t)}
            onClick={() => {
              setTab(t);
              setSel(null);
            }}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "home" &&
        (info && visibleUploads.length ? (
          <>
            <Row
              title="Latest videos"
              onPlayAll={() => onOpen(visibleUploads[0])}
            >
              {visibleUploads.slice(0, 14).map((v) => (
                <ApiCard key={v.yt} v={v} wide onOpen={onOpen} />
              ))}
            </Row>
            {lists.slice(0, 3).map((pl) => (
              <PlaylistRow
                key={pl.id}
                pl={pl}
                ytId={info.ytId}
                progress={progress}
                onOpen={onPlaylistOpen(pl)}
              />
            ))}
          </>
        ) : info ? (
          <p className="px-6 py-16 text-center text-yt-sec">
            {uploads.length ? "No unwatched videos." : "Loading from YouTube…"}
          </p>
        ) : (
          libraryGrid
        ))}

      {tab === "videos" &&
        (info && visibleUploads.length ? (
          <div className="px-6 py-4">
            <div className="mb-4 flex gap-3">
              <button
                className={chipCls(sort === "latest")}
                onClick={() => setSort("latest")}
              >
                Latest
              </button>
              <button
                className={chipCls(sort === "popular")}
                onClick={() => setSort("popular")}
              >
                Popular
              </button>
              <button
                className={chipCls(sort === "oldest")}
                onClick={() => setSort("oldest")}
              >
                Oldest
              </button>
            </div>
            <div className="grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sorted.map((v) => (
                <ApiCard key={v.yt} v={v} onOpen={onOpen} />
              ))}
            </div>
            {next && (
              <div className="mt-8 text-center">
                <button
                  className={pill}
                  disabled={loadingMore}
                  onClick={loadMore}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        ) : info ? (
          <p className="px-6 py-16 text-center text-yt-sec">
            Loading from YouTube…
          </p>
        ) : (
          libraryGrid
        ))}

      {tab === "playlists" && (
        <div className="px-6 py-6">
          {sel && info ? (
            <>
              <button className={pill} onClick={() => setSel(null)}>
                ← All playlists
              </button>
              <h2 className="mt-4 text-xl font-bold">{sel.title}</h2>
              <PlaylistVideos
                pl={sel}
                ytId={info.ytId}
                progress={progress}
                onOpen={onPlaylistOpen(sel)}
              />
            </>
          ) : lists.length ? (
            <div className="grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {lists.map((pl) => (
                <div
                  key={pl.id}
                  className="cursor-pointer"
                  onClick={() => setSel(pl)}
                >
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-yt-chip">
                    {pl.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pl.thumb}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 text-xs font-medium text-white">
                      {pl.count} videos
                    </span>
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-sm font-medium">
                    {pl.title}
                  </h3>
                  <p className="text-xs text-yt-sec">View full playlist</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-yt-sec">
              {info
                ? "This channel has no public playlists."
                : "Playlists need the YouTube API key."}
            </p>
          )}
        </div>
      )}

      {tab === "about" && (
        <div className="max-w-3xl space-y-6 px-6 py-6">
          {info?.description && (
            <div>
              <h2 className="mb-2 text-lg font-medium">Description</h2>
              <p className="whitespace-pre-wrap break-words text-sm">
                {info.description}
              </p>
            </div>
          )}
          {links.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-medium">Links</h2>
              <ul className="space-y-1 text-sm">
                {links.map((l) => (
                  <li key={l}>
                    <a
                      className="break-all text-yt-blue"
                      href={l}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {l.replace(/^https?:\/\//, "")}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h2 className="mb-2 text-lg font-medium">More info</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-yt-sec">Channel</dt>
                <dd>
                  <a
                    className="text-yt-blue"
                    href={`https://www.youtube.com/${handleName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    youtube.com/{handleName}
                  </a>
                </dd>
              </div>
              {info?.joined && (
                <div>
                  <dt className="text-yt-sec">Joined</dt>
                  <dd>
                    {new Date(info.joined).toLocaleDateString("en", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </dd>
                </div>
              )}
              {info && info.subs !== null && (
                <div>
                  <dt className="text-yt-sec">Subscribers</dt>
                  <dd>{compact(info.subs)}</dd>
                </div>
              )}
              {info && (
                <div>
                  <dt className="text-yt-sec">Videos on YouTube</dt>
                  <dd>{info.videos.toLocaleString()}</dd>
                </div>
              )}
              {info && (
                <div>
                  <dt className="text-yt-sec">Total views</dt>
                  <dd>{info.views.toLocaleString()} views</dd>
                </div>
              )}
              {info?.country && (
                <div>
                  <dt className="text-yt-sec">Country</dt>
                  <dd>{info.country}</dd>
                </div>
              )}
              <div>
                <dt className="text-yt-sec">In your library</dt>
                <dd>
                  {own.length} videos · {watched} watched
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
