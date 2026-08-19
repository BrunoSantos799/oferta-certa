export async function getBucket() {
  const { env } = await import("cloudflare:workers");
  if (!env.BUCKET) {
    throw new Error("O armazenamento de imagens não está disponível.");
  }
  return env.BUCKET;
}
