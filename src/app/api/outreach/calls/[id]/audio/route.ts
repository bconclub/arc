import { callDetail, callProvider, callSession } from "@/lib/outreach-calls";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await callSession()))
    return Response.json(
      { error: "Sign in to play recordings." },
      { status: 401 },
    );
  try {
    const d = await callDetail(params.id);
    if (!d || !d.has_audio)
      return Response.json(
        { error: "No recording is available for this attempt." },
        { status: 404 },
      );
    const r = await callProvider(
      "conversations/" + encodeURIComponent(params.id) + "/audio",
    );
    if (!r.ok)
      return Response.json(
        { error: "Recording unavailable. Retry shortly." },
        { status: 502 },
      );
    // A lengthless MP3 stream gives browsers Infinity for duration. Serve explicit
    // byte ranges so metadata, playback and seeking work on the native player.
    const bytes = new Uint8Array(await r.arrayBuffer());
    const headers: Record<string, string> = {
      "Content-Type": r.headers.get("content-type") || "audio/mpeg",
      "Cache-Control": "private, no-store",
      "Accept-Ranges": "bytes",
    };
    const range = req.headers.get("range");
    if (!range)
      return new Response(bytes, {
        headers: { ...headers, "Content-Length": String(bytes.length) },
      });
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]))
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": "bytes */" + bytes.length },
      });
    const start = match[1]
      ? Number(match[1])
      : Math.max(0, bytes.length - Number(match[2]));
    const end =
      match[1] && match[2]
        ? Math.min(Number(match[2]), bytes.length - 1)
        : bytes.length - 1;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end ||
      start >= bytes.length
    )
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": "bytes */" + bytes.length },
      });
    const part = bytes.slice(start, end + 1);
    return new Response(part, {
      status: 206,
      headers: {
        ...headers,
        "Content-Length": String(part.length),
        "Content-Range": "bytes " + start + "-" + end + "/" + bytes.length,
      },
    });
  } catch {
    return Response.json(
      { error: "Recording unavailable. Retry shortly." },
      { status: 503 },
    );
  }
}
