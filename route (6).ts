const allowedHosts = ["mlstatic.com", "mercadolivre.com.br", "mercadolivre.com", "meli.la"];

function allowedUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (url.protocol === "https:" || url.protocol === "http:")
      && allowedHosts.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

async function fetchAllowedImage(source: string, signal: AbortSignal) {
  let current = source;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const response = await fetch(current, {
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,*/*" },
      redirect: "manual",
      signal,
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    const next = location ? new URL(location, current).toString() : "";
    if (!allowedUrl(next)) throw new Error("redirect-not-allowed");
    current = next;
  }
  throw new Error("too-many-redirects");
}

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("url") || "";
  if (!allowedUrl(source)) {
    return Response.json({ error: "Endereço de imagem não permitido." }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchAllowedImage(source, controller.signal);
    if (!response.ok || !response.body) {
      return Response.json({ error: `Imagem respondeu HTTP ${response.status}.` }, { status: 502 });
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return Response.json({ error: "A fonte não retornou uma imagem." }, { status: 415 });
    }
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 8_000_000) {
      return Response.json({ error: "A imagem é grande demais para o editor." }, { status: 413 });
    }
    return new Response(response.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Não foi possível carregar a imagem do anúncio." }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
