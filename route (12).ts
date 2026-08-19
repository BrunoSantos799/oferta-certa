import { getBucket } from "../../../lib/storage";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !allowedTypes.has(file.type)) {
      return Response.json({ error: "Envie uma foto JPG, PNG ou WebP." }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return Response.json({ error: "A foto deve ter no máximo 8 MB." }, { status: 400 });
    }
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const key = `products/${crypto.randomUUID()}.${extension}`;
    const bucket = await getBucket();
    await bucket.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
    });
    return Response.json({ ok: true, url: `/api/media/${key}` });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível salvar a foto." }, { status: 500 });
  }
}
