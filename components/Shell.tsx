"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import { chHref, useStore } from "@/lib/store";
import { ChannelAvatar, invBtn, pill } from "./VideoCard";

function Logo() {
  return (
    <Link
      href="/"
      aria-label="YouTube Home"
      className="flex items-center gap-1 pr-2"
    >
      <svg viewBox="0 0 28 20" className="h-6 w-7.5 shrink-0">
        <rect width="28" height="20" rx="5" fill="#ff0033" />
        <path d="M11.2 5.7l7.2 4.3-7.2 4.3z" fill="#fff" />
      </svg>
      <span className="text-[20px] font-bold leading-none tracking-[-1.5px]">
        YouTube
      </span>
    </Link>
  );
}

function Modal({
  title,
  hint,
  onClose,
  children,
}: {
  title: string;
  hint: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-xl bg-yt-modal p-6 shadow-xl">
        <h2 className="text-xl font-medium">{title}</h2>
        <p className="mb-3 mt-1 text-sm text-yt-sec">{hint}</p>
        {children}
      </div>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const { channels, importChannels, addVideos } = useStore();
  const router = useRouter();
  const rawPath = usePathname();
  let path = rawPath;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    /* keep raw */
  }

  const [mini, setMini] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState<"" | "ch" | "vid">("");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setModal("");
    setText("");
    setMsg("");
  };
  const onFile = (f?: File) => f && f.text().then(setText);

  const submit = async () => {
    if (modal === "ch") {
      const n = importChannels(text);
      if (!n) return setMsg("No new channels found.");
      close();
    } else {
      setBusy(true);
      const errs = await addVideos(text);
      setBusy(false);
      if (errs.length) setMsg(errs.join("\n"));
      else close();
    }
  };

  const item = (href: string, active: boolean, content: ReactNode) => (
    <Link
      key={href}
      href={href}
      onClick={() => setDrawer(false)}
      className={`flex h-10 items-center gap-6 rounded-lg px-3 hover:bg-yt-chip ${active ? "bg-yt-chip font-medium" : ""}`}
    >
      {content}
    </Link>
  );

  const side = (
    <nav className="space-y-0.5">
      {item(
        "/",
        path === "/",
        <>
          <span className="text-xl">⌂</span>
          <span>Home</span>
        </>,
      )}
      <hr className="my-3 border-yt-line" />
      <p className="px-3 py-1 text-base font-medium">Subscriptions</p>
      {channels.map((c) =>
        item(
          chHref(c),
          path.toLowerCase() === chHref(c).toLowerCase(),
          <>
            <ChannelAvatar c={c} size={24} />
            <span className="truncate">{c.name}</span>
          </>,
        ),
      )}
      <hr className="my-3 border-yt-line" />
      <div className="mb-1 flex h-10 items-center gap-3 px-3 text-base font-medium">
        <span>You</span>
        <span aria-hidden="true" className="text-lg">
          ›
        </span>
      </div>
      {item(
        channels[0] ? chHref(channels[0]) : "/you/channel",
        channels[0]
          ? path.toLowerCase() === chHref(channels[0]).toLowerCase()
          : false,
        <>
          <span className="text-xl">♙</span>
          <span>Your channel</span>
        </>,
      )}
      {item(
        "/you/history",
        path === "/you/history",
        <>
          <span className="text-xl">◷</span>
          <span>History</span>
        </>,
      )}
      {item(
        "/you/playlists",
        path === "/you/playlists",
        <>
          <span className="text-xl">▤</span>
          <span>Playlists</span>
        </>,
      )}
      {item(
        "/you/watch-later",
        path === "/you/watch-later",
        <>
          <span className="text-xl">◷</span>
          <span>Watch later</span>
        </>,
      )}
      {item(
        "/you/liked",
        path === "/you/liked",
        <>
          <span className="text-xl">♨</span>
          <span>Liked videos</span>
        </>,
      )}
      {item(
        "/you/videos",
        path === "/you/videos",
        <>
          <span className="text-xl">▣</span>
          <span>Your videos</span>
        </>,
      )}
      {item(
        "/you/downloads",
        path === "/you/downloads",
        <>
          <span className="text-xl">⇩</span>
          <span>Downloads</span>
        </>,
      )}
    </nav>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-yt-bg text-yt-text">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 px-4">
        <div className="flex shrink-0 items-center gap-2 md:w-52">
          <button
            aria-label="Guide"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl hover:bg-yt-chip"
            onClick={() =>
              window.innerWidth < 1100 || path.startsWith("/watch")
                ? setDrawer((d) => !d)
                : setMini((m) => !m)
            }
          >
            ☰
          </button>
          <Logo />
        </div>
        <form
          className="mx-auto flex max-w-160 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q") as string;
            if (q.trim())
              router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <input
            name="q"
            placeholder="Search"
            autoComplete="off"
            className="h-10 min-w-0 flex-1 rounded-l-full border border-yt-line bg-transparent px-4 text-base outline-none focus:border-yt-blue focus:shadow-[inset_0_1px_2px_rgba(0,0,0,.12)]"
          />
          <button
            aria-label="Search"
            className="grid h-10 w-16 shrink-0 place-items-center rounded-r-full border border-l-0 border-yt-line bg-yt-chip text-lg hover:bg-yt-chiph"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 fill-current"
              aria-hidden="true"
            >
              <path d="M10.5 4a6.5 6.5 0 104.03 11.59l5.44 5.44 1.06-1.06-5.44-5.44A6.5 6.5 0 0010.5 4zm0 2a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" />
            </svg>
          </button>
        </form>
        <div className="flex shrink-0 items-center justify-end gap-2 md:w-52">
          <button className={pill} onClick={() => setModal("vid")}>
            + Add
          </button>
          <button className={pill} onClick={() => setModal("ch")}>
            Import
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {!path.startsWith("/watch") && (
          <aside
            className={`hidden shrink-0 overflow-y-auto p-3 min-[1100px]:block ${mini ? "w-18 [&_span:not(.text-xl)]:hidden [&_p]:hidden [&_hr]:hidden" : "w-60"}`}
          >
            {side}
          </aside>
        )}
        {drawer && (
          <>
            <div
              className="absolute inset-0 z-20 bg-black/50"
              onClick={() => setDrawer(false)}
            />
            <aside className="absolute inset-y-0 left-0 z-30 w-60 overflow-y-auto bg-yt-bg p-3 shadow-xl">
              {side}
            </aside>
          </>
        )}
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      {modal && (
        <Modal
          onClose={close}
          title={modal === "ch" ? "Import channels" : "Add videos"}
          hint={
            modal === "ch"
              ? "Paste channel names (one per line), a JSON array, or upload YouTube Takeout’s subscriptions.csv. Only these channels will ever appear."
              : "Paste YouTube links, one per line. Title and channel are fetched automatically. Links from channels you haven’t imported are blocked."
          }
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={
              modal === "ch"
                ? "Fireship\nVeritasium\n3Blue1Brown"
                : "https://www.youtube.com/watch?v=..."
            }
            className="w-full rounded-lg border border-yt-line bg-transparent p-3 font-mono text-sm"
          />
          {modal === "ch" && (
            <input
              type="file"
              accept=".csv,.json,.txt"
              className="mt-2 text-sm"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          )}
          {msg && (
            <p className="mt-2 whitespace-pre-line text-sm text-yt-sec">
              {msg}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button className={pill} onClick={close}>
              Cancel
            </button>
            <button disabled={busy} onClick={submit} className={invBtn}>
              {busy ? "Checking…" : modal === "ch" ? "Import" : "Add"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
