import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });
  const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
  if (!r.ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  const d = await r.json();
  return NextResponse.json({ title: d.title, author: d.author_name, authorUrl: d.author_url });
}
