import { NextRequest, NextResponse } from "next/server";

const API = "https://www.googleapis.com/youtube/v3";
const KEY = process.env.YOUTUBE_API_KEY;

interface Thumbs { high?: { url: string }; medium?: { url: string }; default?: { url: string } }
interface YTChannel {
  id: string;
  snippet: { title: string; customUrl?: string; description?: string; country?: string; publishedAt: string; thumbnails?: Thumbs };
  statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string; hiddenSubscriberCount?: boolean };
  brandingSettings?: { image?: { bannerExternalUrl?: string } };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}
interface YTVideo {
  id: string;
  snippet: { title: string; publishedAt: string; channelId: string };
  contentDetails: { duration: string };
  statistics?: { viewCount?: string };
}
interface YTPlaylist {
  id: string;
  snippet: { title: string; description?: string; thumbnails?: Thumbs };
  contentDetails: { itemCount: number };
}
interface YTList<T> { items?: T[]; nextPageToken?: string }

async function g<T>(path: string, params: Record<string, string>): Promise<T> {
  const r = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key: KEY ?? "" })}`, { next: { revalidate: 1800 } });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.errors?.[0]?.reason === "quotaExceeded" ? "quota" : "api");
  return d as T;
}

const parseDur = (iso: string) => {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
};

export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: "missing_key" }, { status: 500 });
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type");

  try {
    if (type === "channel") {
      const part = "snippet,statistics,brandingSettings,contentDetails";
      const id = sp.get("id"), handle = sp.get("handle"), q = sp.get("q");
      let items: YTChannel[] = [];
      if (id) items = (await g<YTList<YTChannel>>("channels", { part, id })).items ?? [];
      if (!items.length && handle) {
        try { items = (await g<YTList<YTChannel>>("channels", { part, forHandle: handle })).items ?? []; } catch { /* try search */ }
      }
      if (!items.length && q) {
        const s = await g<{ items?: { id?: { channelId?: string } }[] }>("search", { part: "snippet", type: "channel", q, maxResults: "1" });
        const cid = s.items?.[0]?.id?.channelId;
        if (cid) items = (await g<YTList<YTChannel>>("channels", { part, id: cid })).items ?? [];
      }
      const c = items[0];
      if (!c) return NextResponse.json({ error: "notfound" }, { status: 404 });
      const st = c.statistics;
      const banner = c.brandingSettings?.image?.bannerExternalUrl;
      return NextResponse.json({
        ytId: c.id,
        title: c.snippet.title,
        handle: c.snippet.customUrl ?? "",
        description: c.snippet.description ?? "",
        avatar: c.snippet.thumbnails?.high?.url ?? c.snippet.thumbnails?.default?.url ?? "",
        banner: banner ? `${banner}=w2120-fcrop64=1,00000000ffffffff-k-c0xffffffff-no-nd-rj` : "",
        subs: st?.hiddenSubscriberCount ? null : Number(st?.subscriberCount ?? 0),
        videos: Number(st?.videoCount ?? 0),
        views: Number(st?.viewCount ?? 0),
        country: c.snippet.country ?? "",
        joined: c.snippet.publishedAt,
        uploads: c.contentDetails?.relatedPlaylists?.uploads ?? "",
        at: Date.now(),
      });
    }

    if (type === "videos") {
      const playlist = sp.get("playlist");
      if (!playlist) return NextResponse.json({ error: "bad_request" }, { status: 400 });
      const page = sp.get("page");
      const pl = await g<{ items?: { contentDetails: { videoId: string } }[]; nextPageToken?: string }>("playlistItems", {
        part: "contentDetails", playlistId: playlist, maxResults: "50", ...(page ? { pageToken: page } : {}),
      });
      const ids = (pl.items ?? []).map((i) => i.contentDetails.videoId);
      if (!ids.length) return NextResponse.json({ videos: [], next: "" });
      const vd = await g<YTList<YTVideo>>("videos", { part: "snippet,contentDetails,statistics", id: ids.join(",") });
      const byId = new Map((vd.items ?? []).map((v) => [v.id, v]));
      const videos = ids.flatMap((vid) => {
        const v = byId.get(vid);
        return v ? [{
          yt: v.id,
          title: v.snippet.title,
          pub: Date.parse(v.snippet.publishedAt),
          views: Number(v.statistics?.viewCount ?? 0),
          dur: parseDur(v.contentDetails.duration),
          chId: v.snippet.channelId,
        }] : [];
      });
      return NextResponse.json({ videos, next: pl.nextPageToken ?? "" });
    }

    if (type === "playlists") {
      const id = sp.get("id");
      if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
      const pl = await g<YTList<YTPlaylist>>("playlists", { part: "snippet,contentDetails", channelId: id, maxResults: "50" });
      return NextResponse.json({
        playlists: (pl.items ?? []).map((p) => ({
          id: p.id,
          title: p.snippet.title,
          desc: p.snippet.description ?? "",
          count: p.contentDetails.itemCount,
          thumb: p.snippet.thumbnails?.medium?.url ?? p.snippet.thumbnails?.default?.url ?? "",
        })),
      });
    }

    return NextResponse.json({ error: "bad_type" }, { status: 400 });
  } catch (e) {
    const m = e instanceof Error ? e.message : "api";
    return NextResponse.json({ error: m }, { status: m === "quota" ? 429 : 502 });
  }
}
