import { getBucket } from "../../../../lib/storage";

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> | { key: string[] } }) {
  const params = await context.params;
  const key = Array.isArray(params.key) ? params.key.join("/") : "";
  if (!/^products\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(key)) {
    return new Response("Imagem não encontrada.", { status: 404 });
  }
  const object = await (await getBucket()).get(key);
  if (!object) return new Response("Imagem não encontrada.", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", headers.get("cache-control") || "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
