"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bootstrap, Offer, PublicConfig, Rule } from "../lib/types";
import { extractSharedPromotion, sharedSourceId, type SharedPromotion } from "../lib/share";

type View = "dashboard" | "offers" | "approval" | "creative" | "robot" | "history" | "rules" | "templates" | "settings";
type AssistedDraft = { link: string; title: string; price: string; oldPrice: string; coupon: string };
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const nav: Array<{ id: View; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "offers", label: "Ofertas", icon: "🔥" },
  { id: "approval", label: "Links", icon: "🔗" },
  { id: "robot", label: "Robô", icon: "✦" },
  { id: "creative", label: "Criar arte", icon: "▣" },
  { id: "history", label: "Histórico", icon: "↺" },
  { id: "rules", label: "Regras", icon: "◎" },
  { id: "templates", label: "Modelos", icon: "✎" },
  { id: "settings", label: "Configurações", icon: "⚙" },
];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function statusLabel(status: Offer["status"]) {
  return ({ awaiting_link: "Falta link", ready: "Pronta", published: "Publicada", discarded: "Descartada" })[status];
}

function time(value: string | null | undefined) {
  return value ? shortDate.format(new Date(value)) : "—";
}

function editorImageSource(value: string) {
  return /^https?:\/\//i.test(value) ? `/api/image?url=${encodeURIComponent(value)}` : value;
}

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível abrir o arquivo."));
    reader.readAsDataURL(file);
  });
}

function loadCanvasImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    image.src = editorImageSource(source);
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type = "image/png", quality = 1) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível gerar a arte.")), type, quality);
  });
}

function fileName(value: string) {
  const clean = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return `oferta-certa-${clean.slice(0, 50) || "produto"}.png`;
}

function marketplaceLink(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    return host === "meli.la" || host === "mercadolivre.com.br" || host.endsWith(".mercadolivre.com.br") || host === "mercadolivre.com" || host.endsWith(".mercadolivre.com");
  } catch {
    return false;
  }
}

function marketplaceProductId(value: string) {
  try {
    const url = new URL(value.trim());
    if (!marketplaceLink(value)) return "";
    const match = decodeURIComponent(`${url.pathname}${url.search}`).match(/\bMLB-?(\d{6,})\b/i);
    return match ? `MLB${match[1]}` : "";
  } catch {
    return "";
  }
}

function browserProduct(raw: Record<string, unknown>, originalUrl: string) {
  const winner = raw.buy_box_winner && typeof raw.buy_box_winner === "object"
    ? raw.buy_box_winner as Record<string, unknown>
    : {};
  const shipping = (winner.shipping || raw.shipping) && typeof (winner.shipping || raw.shipping) === "object"
    ? (winner.shipping || raw.shipping) as Record<string, unknown>
    : {};
  const reviews = raw.reviews && typeof raw.reviews === "object" ? raw.reviews as Record<string, unknown> : {};
  const pictures = Array.isArray(raw.pictures) ? raw.pictures : [];
  const picture = pictures.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
  const thumbnail = raw.thumbnail && typeof raw.thumbnail === "object" ? raw.thumbnail as Record<string, unknown> : {};
  const sourceId = String(winner.item_id || raw.id || "").replace("-", "").toUpperCase();
  const title = String(raw.title || raw.name || raw.family_name || "").trim();
  const price = Number(winner.price || raw.price || raw.sale_price || 0);
  const oldPrice = Number(winner.original_price || raw.original_price || 0);
  const permalink = String(winner.permalink || raw.permalink || originalUrl);
  if (!/^MLB\d{6,}$/i.test(sourceId) || !title || !Number.isFinite(price) || price <= 0) return null;
  return {
    sourceId,
    title,
    price,
    oldPrice: oldPrice > price ? oldPrice : 0,
    rating: Number(reviews.rating_average || raw.rating_average || 0),
    reviews: Number(reviews.total || raw.reviews_total || 0),
    soldQuantity: Number(winner.sold_quantity || raw.sold_quantity || 0),
    freeShipping: shipping.free_shipping === true,
    permalink,
    image: String(picture?.secure_url || picture?.url || thumbnail.secure_url || thumbnail.url || raw.secure_thumbnail || ""),
  };
}

async function readProductInBrowser(link: string) {
  const id = marketplaceProductId(link);
  if (!id) {
    throw new Error("Use o endereço completo de um produto. Links curtos meli.la precisam ser abertos antes de copiar.");
  }
  const isCatalog = /\/p\/MLB\d+/i.test(link);
  const endpoints = isCatalog
    ? [`https://api.mercadolibre.com/products/${id}`, `https://api.mercadolibre.com/items/${id}`]
    : [`https://api.mercadolibre.com/items/${id}`, `https://api.mercadolibre.com/products/${id}`];
  let lastStatus = 0;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
      lastStatus = response.status;
      if (!response.ok) continue;
      const product = browserProduct(await response.json() as Record<string, unknown>, link);
      if (product) return product;
    } catch {
      // Tenta o segundo recurso oficial quando o primeiro não estiver disponível.
    }
  }
  throw new Error(lastStatus === 401 || lastStatus === 403
    ? "O Mercado Livre exigiu autorização para ler esse anúncio. Abra o produto e tente copiar o endereço completo novamente."
    : "Não consegui ler esse anúncio. Confira se o link abre um produto com preço disponível.");
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Erro ${response.status}`);
  return body;
}

function ProductImage({ offer }: { offer: Offer }) {
  if (!offer.image) return <span className="product-placeholder">OC</span>;
  // Imagens vêm diretamente do marketplace e não têm dimensões conhecidas.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={offer.image} alt={`Imagem de ${offer.name}`} loading="lazy" />;
}

function OfferCard({ offer, onOpen, onCreate }: { offer: Offer; onOpen: () => void; onCreate: () => void }) {
  return (
    <article className="offer-card">
      <div className="offer-image"><ProductImage offer={offer} /><span className="discount-badge">{offer.discount ? `-${offer.discount}%` : "NOVO"}</span></div>
      <div className="offer-card-body">
        <div className="offer-card-top"><span>{offer.category}</span><span className={`status ${offer.status}`}>{statusLabel(offer.status)}</span></div>
        <h3>{offer.name}</h3>
        <div className="rating">{offer.rating ? `★ ${offer.rating.toFixed(1)}` : "Avaliação não informada"}{offer.reviews ? ` · ${offer.reviews.toLocaleString("pt-BR")} avaliações` : ""}</div>
        <div className="price-row"><strong>{brl.format(offer.price)}</strong>{offer.oldPrice > offer.price && <del>{brl.format(offer.oldPrice)}</del>}</div>
        <div className="offer-footer"><span>{offer.shipping}</span><b>Score {offer.score}</b></div>
        <div className="offer-actions"><button className="button affiliate-card-button" onClick={onOpen}>🔗 Gerar meu link</button><button className="button accent" onClick={onCreate}>▣ Criar arte</button></div>
      </div>
    </article>
  );
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="empty"><div className="empty-icon">⌕</div><strong>{title}</strong><p>{children}</p></div>;
}

export default function Home() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [assisted, setAssisted] = useState<AssistedDraft | null>(null);
  const [shared, setShared] = useState<SharedPromotion | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installHelp, setInstallHelp] = useState(false);
  const [standalone, setStandalone] = useState(false);

  const refresh = useCallback(async () => {
    const fresh = await json<Bootstrap>("/api/bootstrap");
    setData(fresh);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    json<Bootstrap>("/api/bootstrap", { signal: controller.signal })
      .then(setData)
      .catch((error) => {
        if (error.name !== "AbortError") setNotice(error.message);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setStandalone(true);
      setInstallPrompt(null);
      setNotice("Oferta Certa instalado com sucesso.");
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);

    const initialize = window.setTimeout(() => {
      setStandalone(window.matchMedia("(display-mode: standalone)").matches);
      const params = new URLSearchParams(window.location.search);
      const sharedContent = [params.get("title"), params.get("text"), params.get("url")].filter(Boolean).join("\n");
      if (params.get("share") === "1" || params.get("inbox") === "1") {
        setShared(extractSharedPromotion(sharedContent));
      }
      const requestedView = params.get("view");
      if (requestedView && nav.some((item) => item.id === requestedView)) setView(requestedView as View);
      if (params.size) window.history.replaceState({}, "", window.location.pathname);
    }, 0);
    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 9000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!data?.config.autoScan) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      json<{ ok: boolean }>("/api/search", {
        method: "POST",
        body: JSON.stringify({ automatic: true }),
      }).then(refresh).catch(() => undefined);
    }, data.config.scanIntervalMinutes * 60_000);
    return () => clearInterval(timer);
  }, [data?.config.autoScan, data?.config.scanIntervalMinutes, refresh]);

  const search = async (automatic = false, useRules = false) => {
    if (busy) return;
    setBusy(true);
    try {
      const requestedTerm = useRules ? "" : term.trim();
      if (marketplaceLink(requestedTerm)) {
        const product = await readProductInBrowser(requestedTerm);
        const imported = await json<{ offer: Offer; photoImported: boolean }>("/api/import", {
          method: "POST",
          body: JSON.stringify(product),
        });
        await refresh();
        setSelectedOfferId(imported.offer.id);
        setNotice(`Produto importado com preço${imported.photoImported ? " e foto" : ""}. Agora gere seu link de afiliado.`);
        setView("offers");
        return;
      }
      const result = await json<{ accepted: number; collected: number; photosImported: number; failures: number }>("/api/search", {
        method: "POST",
        body: JSON.stringify({ term: requestedTerm, automatic }),
      });
      await refresh();
      setNotice(`${result.accepted} ofertas aprovadas, ${result.photosImported} fotos importadas entre ${result.collected} produtos.`);
      setView("offers");
    } catch (error) {
      await refresh().catch(() => undefined);
      if (marketplaceLink(term.trim())) {
        setAssisted({ link: term.trim(), title: "", price: "", oldPrice: "", coupon: "" });
        setNotice("O Mercado Livre bloqueou a leitura automática. Complete os dados e envie a foto na janela aberta.");
      } else {
        setNotice(error instanceof Error ? error.message : "Não foi possível concluir a busca.");
      }
    } finally {
      setBusy(false);
    }
  };

  const go = (next: View) => {
    setView(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openOffer = (id: string) => {
    setSelectedOfferId(id);
    go("approval");
  };

  const openCreative = (id: string) => {
    setSelectedOfferId(id);
    go("creative");
  };

  const offerAction = async (payload: Record<string, unknown>, success: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await json("/api/offer", { method: "POST", body: JSON.stringify(payload) });
      await refresh();
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar a oferta.");
    } finally {
      setBusy(false);
    }
  };

  const saveConfig = async (config: Partial<PublicConfig> & { accessToken?: string }, success: string, clearAccessToken = false) => {
    if (busy) return;
    setBusy(true);
    try {
      await json("/api/config", { method: "POST", body: JSON.stringify({ config, clearAccessToken }) });
      await refresh();
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar as configurações.");
    } finally {
      setBusy(false);
    }
  };

  const diagnostics = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await json("/api/diagnostics", { method: "POST", body: "{}" });
      await refresh();
      setNotice("Diagnóstico concluído.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível concluir o diagnóstico.");
    } finally {
      setBusy(false);
    }
  };

  const clearLogs = async () => {
    try {
      await json("/api/logs", { method: "DELETE" });
      await refresh();
      setNotice("Logs removidos.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível limpar os logs.");
    }
  };

  const installApp = async () => {
    if (!installPrompt) {
      setInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  };

  const importSharedPromotion = async (draft: SharedPromotion) => {
    if (!marketplaceLink(draft.link)) {
      setNotice("Não encontrei um link do Mercado Livre nessa mensagem.");
      return;
    }
    setShared(null);
    setTerm(draft.link);
    const productId = marketplaceProductId(draft.link);
    if (!productId) {
      setAssisted({ link: draft.link, title: draft.title, price: draft.price, oldPrice: draft.oldPrice, coupon: draft.coupon });
      setNotice("Link curto recebido. Confira os dados extraídos e envie a foto do produto.");
      return;
    }
    setBusy(true);
    try {
      const product = await readProductInBrowser(draft.link);
      const imported = await json<{ offer: Offer; photoImported: boolean }>("/api/import", {
        method: "POST",
        body: JSON.stringify({ ...product, coupon: draft.coupon }),
      });
      await refresh();
      setSelectedOfferId(imported.offer.id);
      setView("offers");
      setNotice(`Promoção recebida${imported.photoImported ? " com foto" : ""}. Agora gere seu link de afiliado.`);
    } catch {
      setAssisted({ link: draft.link, title: draft.title, price: draft.price, oldPrice: draft.oldPrice, coupon: draft.coupon });
      setNotice("O anúncio não liberou a leitura automática. Confira os dados extraídos e envie a foto.");
    } finally {
      setBusy(false);
    }
  };

  const resetData = async () => {
    if (!window.confirm("Limpar ofertas, histórico e logs? Baixe um backup antes se quiser guardar os dados.")) return;
    try {
      await json("/api/data/reset", { method: "POST", body: JSON.stringify({ confirm: "LIMPAR" }) });
      await refresh();
      setNotice("Dados limpos com segurança.");
      go("dashboard");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível limpar os dados.");
    }
  };

  const pending = data?.state.offers.filter((offer) => offer.status === "awaiting_link" || offer.status === "ready").length || 0;
  const offers = useMemo(() => {
    const list = data?.state.offers || [];
    const needle = filter.trim().toLocaleLowerCase("pt-BR");
    return needle ? list.filter((offer) => `${offer.name} ${offer.category}`.toLocaleLowerCase("pt-BR").includes(needle)) : list;
  }, [data, filter]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <button className="brand" onClick={() => go("dashboard")} aria-label="Ir ao dashboard">
          <span className="brand-mark">OC</span>
          <span><strong>Oferta Certa</strong><small>Hub de promoções</small></span>
        </button>
        <div className="nav-label">Principal</div>
        <nav>
          {nav.slice(0, 6).map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => go(item.id)}>
              <i>{item.icon}</i><span>{item.label}</span>{item.id === "approval" && <em>{pending}</em>}
            </button>
          ))}
        </nav>
        <div className="nav-label">Configuração</div>
        <nav>
          {nav.slice(6).map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => go(item.id)}>
              <i>{item.icon}</i><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-status"><span className="live-dot" /><div><strong>Site conectado</strong><small>Dados salvos online</small></div></div>
        <div className="sidebar-version">Oferta Certa Hub · {data?.app.version || "App 2.2"}</div>
      </aside>
      {menuOpen && <button className="backdrop" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">☰</button>
          <div className="page-context"><strong>{nav.find((item) => item.id === view)?.label}</strong><small>Oferta Certa Hub</small></div>
          <label className="top-search"><span>⌕</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Pesquisar nas ofertas..." /></label>
          {!standalone && <button className="install-chip" onClick={installApp}>↓ Instalar app</button>}
          <div className="online-chip"><span className="live-dot" />Online</div>
          <button className="avatar" aria-label="Perfil de Bruno">BM</button>
        </header>

        <div className="content">
          {!data ? <Loading /> : view === "dashboard" ? (
            <Dashboard data={data} term={term} setTerm={setTerm} busy={busy} search={search} go={go} openShared={() => setShared(extractSharedPromotion(""))} installApp={installApp} standalone={standalone} />
          ) : view === "offers" ? (
            <Offers offers={offers} go={go} openOffer={openOffer} openCreative={openCreative} />
          ) : view === "approval" ? (
            <Approval data={data} selectedOfferId={selectedOfferId} setSelectedOfferId={setSelectedOfferId} offerAction={offerAction} busy={busy} openCreative={openCreative} />
          ) : view === "creative" ? (
            <CreativeStudio data={data} selectedOfferId={selectedOfferId} setSelectedOfferId={setSelectedOfferId} setNotice={setNotice} refresh={refresh} />
          ) : view === "robot" ? (
            <Robot data={data} term={term} setTerm={setTerm} search={search} busy={busy} diagnostics={diagnostics} clearLogs={clearLogs} go={go} />
          ) : view === "history" ? (
            <History data={data} />
          ) : view === "rules" ? (
            <Rules key={data.serverTime + data.config.rules.length} config={data.config} saveConfig={saveConfig} busy={busy} />
          ) : view === "templates" ? (
            <Templates key={data.serverTime} config={data.config} saveConfig={saveConfig} busy={busy} />
          ) : view === "settings" ? (
            <Settings config={data.config} saveConfig={saveConfig} resetData={resetData} busy={busy} />
          ) : (
            <ComingSoon view={view} />
          )}
        </div>
      </main>

      <nav className="mobile-nav">
        {nav.filter((item) => ["dashboard", "offers", "approval", "robot", "creative"].includes(item.id)).map((item) => (
          <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => go(item.id)}><i>{item.icon}</i><span>{item.label}</span></button>
        ))}
      </nav>
      {assisted && <AssistedImport draft={assisted} busy={busy} onClose={() => setAssisted(null)} onSave={async (draft, file) => {
        setBusy(true);
        try {
          let image = "";
          if (file) {
            const form = new FormData();
            form.append("file", file);
            const uploadResponse = await fetch("/api/upload", { method: "POST", body: form });
            const upload = await uploadResponse.json() as { url?: string; error?: string };
            if (!uploadResponse.ok || !upload.url) throw new Error(upload.error || "Não foi possível salvar a foto.");
            image = upload.url;
          }
          const imported = await json<{ offer: Offer }>("/api/import", { method: "POST", body: JSON.stringify({
            title: draft.title,
            price: Number(draft.price.replace(",", ".")),
            oldPrice: Number(draft.oldPrice.replace(",", ".")) || 0,
            permalink: draft.link,
            image,
            coupon: draft.coupon,
            sourceId: marketplaceProductId(draft.link) || sharedSourceId(draft.link),
          }) });
          await refresh();
          setSelectedOfferId(imported.offer.id);
          setAssisted(null);
          setView("offers");
          setNotice(`Produto salvo${image ? " com foto" : ""}. Agora gere seu link de afiliado.`);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "Não foi possível salvar o produto.");
        } finally {
          setBusy(false);
        }
      }} />}
      {shared && <SharedPromotionDialog initial={shared} busy={busy} onClose={() => setShared(null)} onContinue={importSharedPromotion} />}
      {installHelp && <InstallHelp onClose={() => setInstallHelp(false)} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}

function AssistedImport({ draft, busy, onClose, onSave }: {
  draft: AssistedDraft;
  busy: boolean;
  onClose: () => void;
  onSave: (draft: AssistedDraft, file: File | null) => Promise<void>;
}) {
  const [value, setValue] = useState(draft);
  const [file, setFile] = useState<File | null>(null);
  const canSave = value.title.trim().length >= 3 && Number(value.price.replace(",", ".")) > 0;
  return <div className="assist-backdrop" role="presentation">
    <section className="assist-dialog" role="dialog" aria-modal="true" aria-labelledby="assist-title">
      <button className="assist-close" onClick={onClose} aria-label="Fechar">×</button>
      <span className="overline">Alternativa garantida</span>
      <h2 id="assist-title">Complete o produto</h2>
      <p>O Mercado Livre recusou a leitura automática. O link já está salvo; informe o que aparece no anúncio e envie a foto.</p>
      <label className="form-field"><span>Nome do produto</span><input autoFocus value={value.title} onChange={(event) => setValue({ ...value, title: event.target.value })} placeholder="Copie o título do anúncio" /></label>
      <div className="assist-price-grid">
        <label className="form-field"><span>Preço atual (R$)</span><input inputMode="decimal" value={value.price} onChange={(event) => setValue({ ...value, price: event.target.value })} placeholder="199,90" /></label>
        <label className="form-field"><span>Preço anterior (opcional)</span><input inputMode="decimal" value={value.oldPrice} onChange={(event) => setValue({ ...value, oldPrice: event.target.value })} placeholder="249,90" /></label>
      </div>
      <label className="form-field"><span>Cupom (opcional)</span><input value={value.coupon} onChange={(event) => setValue({ ...value, coupon: event.target.value.toUpperCase() })} placeholder="Ex.: OFERTA20" /></label>
      <label className={`assist-upload ${file ? "selected" : ""}`}>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <span>{file ? "✓" : "▣"}</span><div><strong>{file ? file.name : "Enviar foto do produto"}</strong><small>{file ? "A foto será salva junto ao produto." : "JPG, PNG ou WebP, até 8 MB."}</small></div>
      </label>
      <div className="assist-link"><strong>Link bruto salvo</strong><small>{value.link}</small></div>
      <div className="assist-actions"><button className="button" onClick={onClose}>Cancelar</button><button className="button accent" disabled={busy || !canSave} onClick={() => onSave(value, file)}>{busy ? "Salvando..." : "Salvar produto"}</button></div>
    </section>
  </div>;
}

function SharedPromotionDialog({ initial, busy, onClose, onContinue }: {
  initial: SharedPromotion;
  busy: boolean;
  onClose: () => void;
  onContinue: (draft: SharedPromotion) => Promise<void>;
}) {
  const [raw, setRaw] = useState(initial.raw);
  const [draft, setDraft] = useState(initial);
  const analyze = (value: string) => {
    setRaw(value);
    setDraft(extractSharedPromotion(value));
  };
  const update = (patch: Partial<SharedPromotion>) => setDraft((current) => ({ ...current, ...patch }));
  const ready = marketplaceLink(draft.link) && draft.title.trim().length >= 3 && Number(draft.price.replace(",", ".")) > 0;
  return <div className="assist-backdrop" role="presentation">
    <section className="assist-dialog share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <button className="assist-close" onClick={onClose} aria-label="Fechar">×</button>
      <span className="overline">Recebido do WhatsApp</span>
      <h2 id="share-title">Preparar promoção</h2>
      <p>Cole a mensagem inteira. O Oferta Certa separa link, produto, preços e cupom para você conferir.</p>
      <label className="form-field"><span>Mensagem da promoção</span><textarea autoFocus rows={5} value={raw} onChange={(event) => analyze(event.target.value)} placeholder={"🔥 Oferta imperdível!\nProduto por R$ 99,90\nCupom: OFERTA10\nhttps://..."} /></label>
      <div className={`extraction-status ${draft.link ? "ok" : "waiting"}`}><span>{draft.link ? "✓" : "⌕"}</span><div><strong>{draft.link ? "Link do Mercado Livre encontrado" : "Aguardando a mensagem"}</strong><small>{draft.link || "Compartilhe pelo WhatsApp ou cole o texto acima."}</small></div></div>
      <label className="form-field"><span>Nome do produto</span><input value={draft.title} onChange={(event) => update({ title: event.target.value })} placeholder="Nome extraído da mensagem" /></label>
      <div className="assist-price-grid">
        <label className="form-field"><span>Preço atual (R$)</span><input inputMode="decimal" value={draft.price} onChange={(event) => update({ price: event.target.value })} placeholder="99,90" /></label>
        <label className="form-field"><span>Preço anterior</span><input inputMode="decimal" value={draft.oldPrice} onChange={(event) => update({ oldPrice: event.target.value })} placeholder="129,90" /></label>
      </div>
      <label className="form-field"><span>Cupom</span><input value={draft.coupon} onChange={(event) => update({ coupon: event.target.value.toUpperCase() })} placeholder="Opcional" /></label>
      <div className="share-flow"><span>1</span><small>Receber</small><i /><span>2</span><small>Conferir</small><i /><span>3</span><small>Importar</small></div>
      <div className="assist-actions"><button className="button" onClick={onClose}>Cancelar</button><button className="button accent" disabled={busy || !ready} onClick={() => onContinue(draft)}>{busy ? "Importando..." : "Continuar"}</button></div>
    </section>
  </div>;
}

function InstallHelp({ onClose }: { onClose: () => void }) {
  return <div className="assist-backdrop" role="presentation">
    <section className="assist-dialog install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <button className="assist-close" onClick={onClose} aria-label="Fechar">×</button>
      <span className="install-logo">OC</span>
      <h2 id="install-title">Instalar Oferta Certa</h2>
      <p>O aplicativo funciona no celular e no computador usando o mesmo endereço e os mesmos dados.</p>
      <div className="install-steps"><div><b>Android</b><span>Abra o menu do Chrome e toque em “Instalar aplicativo” ou “Adicionar à tela inicial”.</span></div><div><b>iPhone</b><span>No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.</span></div><div><b>Computador</b><span>No Chrome ou Edge, clique no ícone de instalação que aparece na barra de endereço.</span></div></div>
      <div className="assist-actions"><button className="button accent" onClick={onClose}>Entendi</button></div>
    </section>
  </div>;
}

function Loading() {
  return <div className="loading"><span /><strong>Preparando seu painel...</strong></div>;
}

function Dashboard({ data, term, setTerm, busy, search, go, openShared, installApp, standalone }: {
  data: Bootstrap;
  term: string;
  setTerm: (value: string) => void;
  busy: boolean;
  search: (automatic?: boolean, useRules?: boolean) => void;
  go: (view: View) => void;
  openShared: () => void;
  installApp: () => void;
  standalone: boolean;
}) {
  const offers = data.state.offers;
  const pending = offers.filter((offer) => offer.status === "awaiting_link" || offer.status === "ready");
  const published = offers.filter((offer) => offer.status === "published");
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="live-dot" /> Central de oportunidades</span>
          <h1>Receba uma promoção direto do WhatsApp.</h1>
          <p>Compartilhe a mensagem com o Oferta Certa ou cole o texto inteiro. O aplicativo identifica produto, preços, cupom e link.</p>
          <button className="whatsapp-share-button" onClick={openShared}><span>↗</span><div><strong>Colar promoção do WhatsApp</strong><small>O aplicativo separa as informações automaticamente.</small></div><b>→</b></button>
          {!standalone && <button className="hero-install-link" onClick={installApp}>↓ Instalar no celular ou computador</button>}
          <div className="or-line"><span>ou importe somente o link</span></div>
          <div className="hero-search">
            <input value={term} onChange={(event) => setTerm(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Cole o link completo do produto..." />
            <button className="button accent" onClick={() => search()} disabled={busy || !term.trim()}>{busy ? <><span className="spinner" />Importando</> : <>↓ Importar produto</>}</button>
          </div>
          <div className="import-benefits"><span>✓ Foto do anúncio</span><span>✓ Preço atual</span><span>✓ Link bruto</span></div>
          <a className="marketplace-open" href="https://www.mercadolivre.com.br/" target="_blank" rel="noreferrer">Abrir Mercado Livre para escolher um produto ↗</a>
          <div className="or-line"><span>busca automática por nome</span></div>
          {data.config.accessTokenConfigured ? <button className="auto-hunt-button compact" onClick={() => search(true, true)} disabled={busy}>
            <span className="auto-hunt-icon">✦</span>
            <span><strong>{busy ? "Procurando produtos e fotos..." : "Buscar automaticamente com integração oficial"}</strong><small>Usa suas regras e alterna os produtos a cada busca.</small></span>
            {busy ? <span className="spinner" /> : <b>→</b>}
          </button> : <button className="auto-hunt-button compact locked" onClick={() => go("settings")}>
            <span className="auto-hunt-icon">⌁</span>
            <span><strong>Conectar busca automática oficial</strong><small>O Mercado Livre exige autorização para pesquisar por nome.</small></span><b>→</b>
          </button>}
        </div>
        <div className="hero-score">
          <span>Melhor oportunidade</span>
          <strong>{offers[0]?.score || 0}</strong>
          <small>Oferta Score</small>
          <div className="score-track"><i style={{ width: `${offers[0]?.score || 0}%` }} /></div>
          <p>{offers.length ? "Fila atualizada e pronta para sua revisão." : "Faça sua primeira busca para preencher o painel."}</p>
        </div>
      </section>

      <section className="stats-grid">
        <Stat icon="🔥" label="Ofertas encontradas" value={offers.length} hint={`${data.state.stats.productsCollected} produtos analisados`} />
        <Stat icon="✓" label="Aguardando revisão" value={pending.length} hint="Prontas para preparar" tone="yellow" />
        <Stat icon="↗" label="Publicações" value={published.length} hint={`${data.state.history.length} registros no histórico`} tone="green" />
        <Stat icon="◎" label="Regras ativas" value={data.config.rules.filter((rule) => rule.active).length} hint={`Score mínimo ${data.config.globalMinScore}`} tone="blue" />
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-head"><div><h2>Melhores oportunidades</h2><p>Ordenadas pelo Oferta Score.</p></div><button className="text-button" onClick={() => go("offers")}>Ver todas →</button></div>
          {offers.length ? <div className="compact-list">{offers.slice(0, 5).map((offer) => <button key={offer.id} onClick={() => go("offers")} className="compact-offer"><span className="compact-image"><ProductImage offer={offer} /></span><span className="compact-copy"><strong>{offer.name}</strong><small>{offer.category} · {offer.discount ? `${offer.discount}% OFF` : "preço atual"}</small></span><span className="compact-price"><strong>{brl.format(offer.price)}</strong>{offer.oldPrice > offer.price && <del>{brl.format(offer.oldPrice)}</del>}</span><span className="score-pill">{offer.score}</span></button>)}</div> : <Empty title="Sua vitrine começa aqui">Busque um produto acima para encontrar as primeiras oportunidades.</Empty>}
        </div>
        <div className="panel attention-panel">
          <div className="panel-head"><div><h2>Próximos passos</h2><p>O que precisa da sua atenção.</p></div></div>
          <button onClick={() => go("approval")} className="attention-item"><span className="attention-icon">🔗</span><span><strong>{pending.filter((offer) => !offer.affiliateUrl).length} para gerar link de afiliado</strong><small>Abra o produto e cole seu link em três passos</small></span><b>→</b></button>
          <button onClick={() => go("robot")} className="attention-item"><span className="attention-icon">✦</span><span><strong>Última busca</strong><small>{time(data.state.stats.lastSuccessAt)}</small></span><b>→</b></button>
          <button onClick={() => go("rules")} className="attention-item"><span className="attention-icon">◎</span><span><strong>{data.config.rules.filter((rule) => rule.active).length} regras monitorando</strong><small>Ajuste preço, desconto e score</small></span><b>→</b></button>
          <button onClick={() => go("creative")} className="attention-item"><span className="attention-icon">▣</span><span><strong>Criar imagem com a logo</strong><small>Use a foto importada e baixe a arte pronta</small></span><b>→</b></button>
          <div className="safe-note"><span>✓</span><p><strong>Dados protegidos</strong>Suas configurações e histórico ficam salvos online.</p></div>
        </div>
      </section>
    </>
  );
}

function Stat({ icon, label, value, hint, tone = "dark" }: { icon: string; label: string; value: number; hint: string; tone?: string }) {
  return <article className="stat-card"><div><span className={`stat-icon ${tone}`}>{icon}</span><span className="stat-label">{label}</span></div><strong>{value}</strong><small>{hint}</small></article>;
}

function Offers({ offers, go, openOffer, openCreative }: { offers: Offer[]; go: (view: View) => void; openOffer: (id: string) => void; openCreative: (id: string) => void }) {
  return <section><div className="page-head"><div><span className="overline">Vitrine inteligente</span><h1>Ofertas encontradas</h1><p>O robô já trouxe produto, preço, foto e link bruto. Toque em “Gerar meu link” para concluir no Mercado Livre.</p></div><button className="button dark" onClick={() => go("dashboard")}>+ Nova busca</button></div>{offers.length ? <div className="offer-grid">{offers.map((offer) => <OfferCard key={offer.id} offer={offer} onOpen={() => openOffer(offer.id)} onCreate={() => openCreative(offer.id)} />)}</div> : <Empty title="Nenhuma oferta encontrada">Use “Buscar ofertas automaticamente” no Dashboard para o robô trabalhar sozinho.</Empty>}</section>;
}

function postPreview(offer: Offer, config: PublicConfig) {
  if (offer.customPost) return offer.customPost;
  const template = offer.previousPrice && offer.price < offer.previousPrice ? config.templates.drop : config.templates.normal;
  const values: Record<string, string> = {
    produto: offer.name,
    preco_antigo: offer.oldPrice ? offer.oldPrice.toFixed(2).replace(".", ",") : "—",
    preco: offer.price.toFixed(2).replace(".", ","),
    avaliacao: offer.rating ? offer.rating.toFixed(1).replace(".", ",") : "não informada",
    frete: offer.shipping,
    desconto: String(offer.discount),
    link: offer.affiliateUrl || offer.url,
  };
  return template.replace(/\{([a-z_]+)\}/gi, (_, key: string) => values[key] ?? `{${key}}`);
}

function Approval({ data, selectedOfferId, setSelectedOfferId, offerAction, busy, openCreative }: {
  data: Bootstrap;
  selectedOfferId: string;
  setSelectedOfferId: (id: string) => void;
  offerAction: (payload: Record<string, unknown>, success: string) => Promise<void>;
  busy: boolean;
  openCreative: (id: string) => void;
}) {
  const queue = data.state.offers.filter((offer) => offer.status !== "discarded");
  const offer = queue.find((item) => item.id === selectedOfferId) || queue.find((item) => item.status !== "published") || queue[0];
  if (!offer) return <section><div className="page-head"><div><span className="overline">Seus links</span><h1>Gerar link de afiliado</h1><p>Encontre ofertas para começar.</p></div></div><Empty title="Fila vazia">O robô trará produto, foto, preço e link bruto para esta área.</Empty></section>;
  return (
    <section>
      <div className="page-head"><div><span className="overline">Seu link de afiliado</span><h1>Gerar link e preparar publicação</h1><p>O produto já está no site. Agora abra o anúncio, gere seu link no Mercado Livre e cole aqui.</p></div><span className="queue-count">{queue.filter((item) => !item.affiliateUrl && item.status !== "published").length} sem link</span></div>
      <div className="approval-grid">
        <ApprovalEditor key={offer.id + offer.updatedAt} offer={offer} config={data.config} offerAction={offerAction} busy={busy} openCreative={() => openCreative(offer.id)} />
        <aside className="panel queue-panel">
          <div className="panel-head"><div><h2>Fila de ofertas</h2><p>Escolha uma oportunidade.</p></div></div>
          <div className="queue-list">{queue.map((item) => <button key={item.id} onClick={() => setSelectedOfferId(item.id)} className={`queue-item ${item.id === offer.id ? "active" : ""}`}><span className="queue-thumb"><ProductImage offer={item} /></span><span><strong>{item.name}</strong><small>{brl.format(item.price)} · Score {item.score}</small></span><i className={`status ${item.status}`}>{statusLabel(item.status)}</i></button>)}</div>
        </aside>
      </div>
    </section>
  );
}

function ApprovalEditor({ offer, config, offerAction, busy, openCreative }: {
  offer: Offer;
  config: PublicConfig;
  offerAction: (payload: Record<string, unknown>, success: string) => Promise<void>;
  busy: boolean;
  openCreative: () => void;
}) {
  const [affiliateUrl, setAffiliateUrl] = useState(offer.affiliateUrl);
  const [post, setPost] = useState(postPreview(offer, config));
  const [copied, setCopied] = useState(false);
  const [rawCopied, setRawCopied] = useState(false);
  const [affiliateHint, setAffiliateHint] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const updateAffiliateUrl = (value: string) => {
    const previous = affiliateUrl || offer.url;
    setAffiliateUrl(value);
    setPost((current) => previous && current.includes(previous) ? current.replaceAll(previous, value || offer.url) : current);
  };
  const copyRawLink = async () => {
    try {
      await navigator.clipboard.writeText(offer.url);
      setRawCopied(true);
      setTimeout(() => setRawCopied(false), 1800);
    } catch {
      setAffiliateHint("Abra o produto e copie o endereço diretamente no Mercado Livre.");
    }
  };
  const pasteAffiliate = async () => {
    try {
      const value = (await navigator.clipboard.readText()).trim();
      if (!/^https?:\/\//i.test(value)) throw new Error("invalid-url");
      updateAffiliateUrl(value);
      setAffiliateHint("Link colado. Toque em “Salvar link” para concluir.");
    } catch {
      setAffiliateHint("Se o navegador não permitir, toque no campo e escolha Colar.");
    }
  };
  const copyPost = async () => {
    await navigator.clipboard.writeText(post);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <article className="panel approval-main">
      <div className="approval-product">
        <div className="approval-image"><ProductImage offer={offer} /></div>
        <div><div className="offer-card-top"><span>{offer.category} · {offer.marketplace}</span><span className={`status ${offer.status}`}>{statusLabel(offer.status)}</span></div><h2>{offer.name}</h2><div className="rating">{offer.rating ? `★ ${offer.rating.toFixed(1)}` : "Sem avaliação"}{offer.reviews ? ` · ${offer.reviews.toLocaleString("pt-BR")} avaliações` : ""}</div><div className="price-row"><strong>{brl.format(offer.price)}</strong>{offer.oldPrice > offer.price && <del>{brl.format(offer.oldPrice)}</del>}<span className="score-pill">Score {offer.score}</span></div></div>
      </div>
      <div className="metrics-row"><div><span>Desconto</span><strong>{offer.discount ? `${offer.discount}%` : "—"}</strong></div><div><span>Menor preço</span><strong>{brl.format(offer.lowestPrice)}</strong></div><div><span>Entrega</span><strong>{offer.shipping}</strong></div></div>
      <section className="affiliate-flow" aria-label="Passos para gerar seu link de afiliado">
        <div className="affiliate-flow-head"><span>🔗</span><div><h3>Gere seu link em três passos</h3><p>O robô já fez a parte de encontrar e importar o produto.</p></div></div>
        <div className="affiliate-step"><b>1</b><div><strong>Abra o produto no Mercado Livre</strong><p>O anúncio correto será aberto para você usar sua conta de afiliado.</p><div className="affiliate-step-actions"><a className="button accent affiliate-open" href={offer.url} target="_blank" rel="noreferrer">Abrir produto e gerar link ↗</a><button className="button" onClick={copyRawLink}>{rawCopied ? "✓ Link bruto copiado" : "Copiar link bruto"}</button></div></div></div>
        <div className="affiliate-step"><b>2</b><div><strong>Use a opção Compartilhar</strong><p>Na Barra ou na Central de Afiliados, gere e copie o seu link.</p></div></div>
        <div className="affiliate-step"><b>3</b><div><strong>Cole seu link de afiliado aqui</strong><p>Ele substituirá o link bruto na mensagem da publicação.</p><div className="affiliate-link-row"><input aria-label="Seu link de afiliado" value={affiliateUrl} onChange={(event) => updateAffiliateUrl(event.target.value)} placeholder="https://... seu link de afiliado" /><button className="button" type="button" onClick={pasteAffiliate}>Colar</button><button className="button success" disabled={busy || !/^https?:\/\//i.test(affiliateUrl.trim())} onClick={() => offerAction({ id: offer.id, action: "update", affiliateUrl, customPost: post }, "Link de afiliado salvo. Oferta pronta!")}>{busy ? "Salvando..." : "Salvar link"}</button></div>{affiliateHint && <small className="affiliate-hint">{affiliateHint}</small>}</div></div>
        {offer.affiliateUrl && affiliateUrl === offer.affiliateUrl && <div className="affiliate-ready"><span>✓</span><div><strong>Link de afiliado salvo</strong><small>Esta oferta já está pronta para criar a imagem e publicar.</small></div></div>}
      </section>
      <label className="form-field"><span>Mensagem da publicação</span><textarea value={post} onChange={(event) => setPost(event.target.value)} rows={11} /></label>
      <div className="approval-actions"><button className="button accent" onClick={openCreative}>▣ Criar imagem</button><button className="button" onClick={copyPost}>{copied ? "✓ Copiado" : "Copiar mensagem"}</button><button className="button danger" disabled={busy} onClick={() => offerAction({ id: offer.id, action: "update", status: "discarded", affiliateUrl, customPost: post }, "Oferta descartada.")}>Descartar</button><button className="button success review-publication-button" disabled={busy} onClick={() => setReviewOpen(true)}>◉ Revisar conjunto e publicar</button></div>
      {!affiliateUrl && <div className="inline-warning">Siga os três passos acima para liberar a publicação.</div>}
      {reviewOpen && <PublicationReview offer={offer} text={post} affiliateUrl={affiliateUrl} busy={busy} onClose={() => setReviewOpen(false)} onCreative={() => { setReviewOpen(false); openCreative(); }} onPublish={async () => {
        await offerAction({ id: offer.id, action: "publish", affiliateUrl, customPost: post }, "Publicação revisada e registrada no histórico.");
        setReviewOpen(false);
      }} />}
    </article>
  );
}

function PublicationReview({ offer, text, affiliateUrl, busy, onClose, onCreative, onPublish }: {
  offer: Offer;
  text: string;
  affiliateUrl: string;
  busy: boolean;
  onClose: () => void;
  onCreative: () => void;
  onPublish: () => Promise<void>;
}) {
  const hasArt = Boolean(offer.originalImage && offer.image);
  const hasText = text.trim().length > 0;
  const hasLink = /^https?:\/\//i.test(affiliateUrl.trim());
  const ready = hasArt && hasText && hasLink;
  return <div className="assist-backdrop" role="presentation">
    <section className="assist-dialog publication-review" role="dialog" aria-modal="true" aria-labelledby="publication-review-title">
      <button className="assist-close" onClick={onClose} aria-label="Fechar">×</button>
      <span className="overline">Conferência final</span>
      <h2 id="publication-review-title">Veja a publicação completa</h2>
      <p>Confira exatamente o conjunto que será usado: arte, texto e seu link de afiliado.</p>
      <div className="review-checklist" aria-label="Itens da publicação">
        <span className={hasArt ? "ok" : "missing"}><b>{hasArt ? "✓" : "!"}</b> Arte</span>
        <span className={hasText ? "ok" : "missing"}><b>{hasText ? "✓" : "!"}</b> Texto</span>
        <span className={hasLink ? "ok" : "missing"}><b>{hasLink ? "✓" : "!"}</b> Link</span>
      </div>
      <article className="publication-card">
        <div className={`publication-art ${hasArt ? "" : "missing"}`}><ProductImage offer={offer} />{!hasArt && <div><strong>Arte ainda não finalizada</strong><button className="button accent" onClick={onCreative}>Criar arte agora</button></div>}</div>
        <div className="publication-copy"><span>Texto da publicação</span><pre>{text || "A mensagem ainda está vazia."}</pre></div>
        <div className={`publication-link ${hasLink ? "" : "missing"}`}><span>Link de afiliado</span>{hasLink ? <a href={affiliateUrl} target="_blank" rel="noreferrer">{affiliateUrl}</a> : <strong>Adicione e salve seu link de afiliado.</strong>}</div>
      </article>
      {!ready && <div className="review-warning">Complete os itens marcados antes de publicar.</div>}
      <div className="assist-actions review-actions"><button className="button" onClick={onClose}>Voltar e editar</button><button className="button success" disabled={!ready || busy || offer.status === "published"} onClick={() => void onPublish()}>{offer.status === "published" ? "✓ Já publicada" : busy ? "Publicando..." : "✓ Confirmar e marcar publicada"}</button></div>
    </section>
  </div>;
}

type LogoPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type ImageFit = "contain" | "cover";

function CreativeStudio({ data, selectedOfferId, setSelectedOfferId, setNotice, refresh }: {
  data: Bootstrap;
  selectedOfferId: string;
  setSelectedOfferId: (id: string) => void;
  setNotice: (value: string) => void;
  refresh: () => Promise<void>;
}) {
  const offers = data.state.offers.filter((offer) => offer.status !== "discarded");
  const initialOffer = offers.find((offer) => offer.id === selectedOfferId) || offers[0];
  const [offerId, setOfferId] = useState(initialOffer?.id || "");
  const offer = offers.find((item) => item.id === offerId) || initialOffer;
  const [productSource, setProductSource] = useState(initialOffer?.originalImage || initialOffer?.image || "");
  const [logoSource, setLogoSource] = useState("/oferta-certa-logo.png");
  const [logoSize, setLogoSize] = useState(22);
  const [margin, setMargin] = useState(2);
  const [position, setPosition] = useState<LogoPosition>("top-left");
  const [fit, setFit] = useState<ImageFit>("contain");
  const [background, setBackground] = useState("#ffffff");
  const [renderStatus, setRenderStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setRenderStatus("loading");
      canvas.width = 1080;
      canvas.height = 1080;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, 1080, 1080);
      context.fillStyle = background;
      context.fillRect(0, 0, 1080, 1080);

      try {
        if (productSource) {
          const product = await loadCanvasImage(productSource);
          const scale = fit === "cover"
            ? Math.max(1080 / product.naturalWidth, 1080 / product.naturalHeight)
            : Math.min(1080 / product.naturalWidth, 1080 / product.naturalHeight);
          const width = product.naturalWidth * scale;
          const height = product.naturalHeight * scale;
          context.drawImage(product, (1080 - width) / 2, (1080 - height) / 2, width, height);
        } else {
          context.fillStyle = "#667085";
          context.font = "700 38px Arial";
          context.textAlign = "center";
          context.fillText("Escolha uma oferta ou envie uma foto", 540, 540);
        }

        const logo = await loadCanvasImage(logoSource);
        const size = 1080 * (logoSize / 100);
        const inset = 1080 * (margin / 100);
        const x = position.endsWith("right") ? 1080 - size - inset : inset;
        const y = position.startsWith("bottom") ? 1080 - size - inset : inset;
        context.save();
        context.shadowColor = "rgba(0, 0, 0, .3)";
        context.shadowBlur = 18;
        context.shadowOffsetY = 7;
        context.beginPath();
        context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
        context.clip();
        context.drawImage(logo, x, y, size, size);
        context.restore();
        if (!cancelled) setRenderStatus("ready");
      } catch {
        if (!cancelled) setRenderStatus("error");
      }
    };
    void draw();
    return () => { cancelled = true; };
  }, [productSource, logoSource, logoSize, margin, position, fit, background]);

  const chooseFile = async (file: File | undefined, kind: "product" | "logo") => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > 12_000_000) {
      setNotice("Use uma imagem com até 12 MB.");
      return;
    }
    try {
      const source = await readImageFile(file);
      if (kind === "product") setProductSource(source);
      else setLogoSource(source);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível abrir a imagem.");
    }
  };

  const chooseOffer = (id: string) => {
    setOfferId(id);
    setSelectedOfferId(id);
    const next = offers.find((item) => item.id === id);
    setProductSource(next?.originalImage || next?.image || "");
  };

  const finishAndSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !offer || renderStatus !== "ready" || saving) return;
    setSaving(true);
    try {
      const blob = await canvasBlob(canvas, "image/jpeg", 0.92);
      const form = new FormData();
      form.append("file", new File([blob], fileName(offer.name).replace(/\.png$/, ".jpg"), { type: "image/jpeg" }));
      const uploadResponse = await fetch("/api/upload", { method: "POST", body: form });
      const uploadText = await uploadResponse.text();
      let upload: { url?: string; error?: string } = {};
      try { upload = JSON.parse(uploadText) as typeof upload; } catch { /* resposta não estruturada */ }
      if (!uploadResponse.ok || !upload.url) throw new Error(upload.error || `Não foi possível salvar a imagem final (erro ${uploadResponse.status}).`);
      await json("/api/offer", { method: "POST", body: JSON.stringify({ id: offer.id, action: "update", image: upload.url }) });
      await refresh();
      setNotice("Arte finalizada e salva como imagem principal do produto.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível finalizar a arte.");
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    const canvas = canvasRef.current;
    if (!canvas || renderStatus !== "ready") return;
    try {
      const blob = await canvasBlob(canvas);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(offer?.name || "produto");
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setNotice("Imagem pronta baixada em PNG.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível baixar a arte.");
    }
  };

  const share = async () => {
    const canvas = canvasRef.current;
    if (!canvas || renderStatus !== "ready") return;
    try {
      const blob = await canvasBlob(canvas);
      const file = new File([blob], fileName(offer?.name || "produto"), { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: offer?.name || "Oferta Certa" });
      } else {
        await download();
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setNotice("Seu navegador não permitiu compartilhar; use o botão Baixar PNG.");
    }
  };

  return (
    <section>
      <div className="page-head"><div><span className="overline">Estúdio Oferta Certa</span><h1>Criar imagem com sua logo</h1><p>A foto do anúncio é carregada automaticamente. Ajuste a marca e baixe a arte quadrada pronta para WhatsApp, Telegram ou Instagram.</p></div><span className={`render-chip ${renderStatus}`}>{renderStatus === "ready" ? "✓ Arte pronta" : renderStatus === "error" ? "Imagem indisponível" : "Montando arte..."}</span></div>
      <div className="creative-grid">
        <article className="panel creative-preview">
          <div className="canvas-wrap"><canvas ref={canvasRef} aria-label="Prévia da arte com a logo Oferta Certa" /></div>
          <div className="creative-actions"><button className="button success creative-finish" disabled={renderStatus !== "ready" || !offer || saving} onClick={finishAndSave}>{saving ? "Salvando arte..." : "✓ Finalizar e salvar no produto"}</button><button className="button accent" disabled={renderStatus !== "ready"} onClick={download}>↓ Baixar PNG</button><button className="button dark" disabled={renderStatus !== "ready"} onClick={share}>↗ Compartilhar</button></div>
          <small>Formato final: 1080 × 1080 pixels, ideal para publicações.</small>
        </article>
        <aside className="panel creative-controls">
          <div className="panel-head"><div><h2>Personalizar arte</h2><p>A logo enviada já está configurada.</p></div></div>
          <label className="form-field"><span>Produto encontrado</span><select value={offerId} onChange={(event) => chooseOffer(event.target.value)}><option value="">Escolher produto</option>{offers.map((item) => <option key={item.id} value={item.id}>{item.name}{item.image ? "" : " (sem foto)"}</option>)}</select></label>
          <div className="upload-grid">
            <label className="upload-tile"><span>▣</span><strong>Trocar foto</strong><small>JPG, PNG ou WEBP</small><input type="file" accept="image/*" onChange={(event) => void chooseFile(event.target.files?.[0], "product")} /></label>
            <label className="upload-tile"><span>OC</span><strong>Trocar logo</strong><small>Opcional</small><input type="file" accept="image/*" onChange={(event) => void chooseFile(event.target.files?.[0], "logo")} /></label>
          </div>
          <button className="text-button reset-logo" onClick={() => setLogoSource("/oferta-certa-logo.png")}>Usar novamente a logo Oferta Certa</button>
          <div className="control-group"><span>Enquadramento da foto</span><div className="segmented"><button className={fit === "contain" ? "active" : ""} onClick={() => setFit("contain")}>Mostrar inteira</button><button className={fit === "cover" ? "active" : ""} onClick={() => setFit("cover")}>Preencher</button></div></div>
          <label className="range-field"><span><strong>Tamanho da logo</strong><b>{logoSize}%</b></span><input type="range" min="12" max="34" value={logoSize} onChange={(event) => setLogoSize(Number(event.target.value))} /></label>
          <label className="range-field"><span><strong>Distância da borda</strong><b>{margin}%</b></span><input type="range" min="1" max="8" value={margin} onChange={(event) => setMargin(Number(event.target.value))} /></label>
          <div className="control-group"><span>Posição da logo</span><div className="position-grid">{(["top-left", "top-right", "bottom-left", "bottom-right"] as LogoPosition[]).map((value) => <button key={value} className={position === value ? "active" : ""} onClick={() => setPosition(value)} aria-label={`Posição ${value}`}><i className={value} /></button>)}</div></div>
          <label className="color-field"><span><strong>Cor do fundo</strong><small>Usada quando a foto não preencher tudo</small></span><input type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label>
          {offer?.image && <div className="image-source-ok"><span>✓</span><p><strong>Foto importada automaticamente</strong>Você pode usar a imagem do anúncio ou enviar outra.</p></div>}
        </aside>
      </div>
    </section>
  );
}

function Robot({ data, term, setTerm, search, busy, diagnostics, clearLogs, go }: {
  data: Bootstrap;
  term: string;
  setTerm: (value: string) => void;
  search: (automatic?: boolean, useRules?: boolean) => void;
  busy: boolean;
  diagnostics: () => void;
  clearLogs: () => void;
  go: (view: View) => void;
}) {
  const result = data.state.lastDiagnostics;
  const latestError = data.state.robotLogs[0]?.level === "error" ? data.state.robotLogs[0] : null;
  const recoveryTerm = latestError && !/^https?:\/\//i.test(latestError.term) ? latestError.term : "ofertas";
  const recoveryUrl = `https://lista.mercadolivre.com.br/${encodeURIComponent(recoveryTerm.trim().replace(/\s+/g, "-"))}`;
  return (
    <section>
      <div className="page-head">
        <div><span className="overline">Coleta testada</span><h1>Importar produto do Mercado Livre</h1><p>Cole o link completo de um anúncio para trazer produto, preço e foto para o site.</p></div>
        <button className="button" onClick={diagnostics} disabled={busy}>◎ Executar diagnóstico</button>
      </div>
      <div className="robot-grid">
        <div className="panel robot-search-card">
          <span className="robot-orb">↓</span>
          <h2>{busy ? "Importando o anúncio" : "Traga um produto pelo link"}</h2>
          <p>Abra um produto no Mercado Livre, copie o endereço completo e cole abaixo.</p>
          <div className="input-action">
            <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Cole o link completo do produto..." />
            <button className="button accent" onClick={() => search()} disabled={busy || !term.trim()}>{busy ? "Importando..." : "Importar produto"}</button>
          </div>
          <a className="marketplace-open robot-marketplace-open" href="https://www.mercadolivre.com.br/" target="_blank" rel="noreferrer">Abrir Mercado Livre para escolher ↗</a>
          <div className="import-note"><span>✓</span><p><strong>Use o endereço completo</strong> Links curtos “meli.la” devem ser abertos primeiro; depois copie o endereço que aparece no navegador.</p></div>
          {data.config.accessTokenConfigured ? <button className="smart-scan-button" onClick={() => search(true, true)} disabled={busy}>{busy ? <><span className="spinner" /><span><strong>Buscando produtos e fotos...</strong><small>Isso pode levar alguns segundos.</small></span></> : <><span className="smart-scan-icon">✦</span><span><strong>Buscar automaticamente por nome</strong><small>Integração oficial conectada</small></span><b>→</b></>}</button> : <button className="smart-scan-button integration-cta" onClick={() => go("settings")}><span className="smart-scan-icon">⌁</span><span><strong>Conectar busca automática</strong><small>Necessária para pesquisar produtos por nome</small></span><b>→</b></button>}
          <div className={`source-mode ${data.config.accessTokenConfigured ? "official" : "recovery"}`}><span>{data.config.accessTokenConfigured ? "✓" : "i"}</span><div><strong>{data.config.accessTokenConfigured ? "Integração oficial conectada" : "Importação por link disponível"}</strong><small>{data.config.accessTokenConfigured ? "A busca por nome usa o catálogo oficial." : "Sem autorização, a busca por nome fica desativada; a importação pelo link continua disponível."}</small></div></div>
          <div className="automation-note"><span className={data.config.autoScan ? "live-dot" : "paused-dot"} /><div><strong>{data.config.autoScan ? "Busca automática ativa" : "Busca automática pausada"}</strong><small>{data.config.autoScan ? `Repete a cada ${data.config.scanIntervalMinutes} minutos enquanto este site estiver aberto.` : "Ative nas configurações quando desejar."}</small></div></div>
        </div>
        <div className="panel">
          <div className="panel-head"><div><h2>Diagnóstico</h2><p>{result ? `Última verificação: ${time(result.at)}` : "Ainda não executado."}</p></div>{result && <span className={`health ${result.status}`}>{result.status === "ok" ? "Tudo certo" : "Atenção"}</span>}</div>
          {result ? <div className="diagnostics">{result.tests.map((test) => <div key={test.id} className={`diagnostic ${test.status}`}><i /><div><strong>{test.label}</strong><small>{test.detail}</small></div></div>)}</div> : <Empty title="Verificação pendente">Execute o diagnóstico para testar uma busca real.</Empty>}
        </div>
      </div>
      {latestError && <div className="recovery-banner"><span>!</span><div><strong>A busca por nome foi recusada</strong><p>A solução está acima: abra um produto, copie o endereço completo e importe pelo link.</p></div><a className="button" href={recoveryUrl} target="_blank" rel="noreferrer">Escolher produto ↗</a></div>}
      <div className="robot-grid lower">
        <div className="panel"><div className="panel-head"><div><h2>Últimas execuções</h2><p>Produtos coletados, aprovados e rejeitados.</p></div></div>{data.state.robotRuns.length ? <div className="run-list">{data.state.robotRuns.slice(0, 10).map((run) => <div key={run.id} className="run-item"><span className={run.success ? "run-ok" : "run-error"}>{run.success ? "✓" : "!"}</span><div><strong>{run.term}</strong><small>{time(run.at)} · {run.source}</small></div><div><b>{run.accepted}</b><small>aprovadas</small></div><div><b>{run.rejected}</b><small>rejeitadas</small></div></div>)}</div> : <Empty title="Nenhuma execução">Sua primeira busca será registrada aqui.</Empty>}</div>
        <div className="panel"><div className="panel-head"><div><h2>Logs da busca</h2><p>Resposta das fontes e dos filtros.</p></div><button className="text-button" disabled={!data.state.robotLogs.length} onClick={clearLogs}>Limpar</button></div>{data.state.robotLogs.length ? <div className="log-list">{data.state.robotLogs.slice(0, 20).map((log) => <div key={log.id} className={`log-item ${log.level}`}><div><strong>{log.term}</strong><span>{time(log.at)}</span></div><p>{log.message}</p></div>)}</div> : <Empty title="Sem logs">As mensagens das buscas aparecerão aqui.</Empty>}</div>
      </div>
    </section>
  );
}

function History({ data }: { data: Bootstrap }) {
  return (
    <section><div className="page-head"><div><span className="overline">Registro de publicações</span><h1>Histórico</h1><p>“Marcar publicada” registra a ação aqui; o envio ao WhatsApp ou Telegram continua sob seu controle.</p></div><a className="button" href="/api/data/export">Baixar backup JSON</a></div><div className="table-wrap"><table><thead><tr><th>Produto</th><th>Preço</th><th>Score</th><th>Destino</th><th>Data</th></tr></thead><tbody>{data.state.history.length ? data.state.history.map((item) => <tr key={item.id}><td><strong>{item.offerName}</strong></td><td>{brl.format(item.price)}</td><td><span className="score-pill">{item.score}</span></td><td>{item.destination}</td><td>{time(item.publishedAt)}</td></tr>) : <tr><td colSpan={5}><Empty title="Sem publicações">As ofertas marcadas como publicadas aparecerão aqui.</Empty></td></tr>}</tbody></table></div></section>
  );
}

function Rules({ config, saveConfig, busy }: { config: PublicConfig; saveConfig: (config: Partial<PublicConfig>, success: string) => Promise<void>; busy: boolean }) {
  const [rules, setRules] = useState<Rule[]>(JSON.parse(JSON.stringify(config.rules)));
  const update = (index: number, patch: Partial<Rule>) => setRules((current) => current.map((rule, position) => position === index ? { ...rule, ...patch } : rule));
  const add = () => setRules((current) => [...current, { id: `regra-${Date.now()}`, name: "Nova regra", active: true, terms: ["novo produto"], minPrice: 20, maxPrice: 1000, minDiscount: 5, minRating: 0, minReviews: 0, minScore: config.globalMinScore }]);
  return (
    <section><div className="page-head"><div><span className="overline">Filtros verificáveis</span><h1>Regras de busca</h1><p>Defina o que é uma boa oportunidade. Dados não informados pela fonte não serão inventados.</p></div><div className="head-actions"><button className="button" onClick={add}>+ Nova regra</button><button className="button accent" disabled={busy} onClick={() => saveConfig({ rules }, "Regras salvas e ativas.")}>Salvar regras</button></div></div><div className="rules-list">{rules.map((rule, index) => <article key={rule.id} className="panel rule-card"><div className="rule-title"><input value={rule.name} onChange={(event) => update(index, { name: event.target.value })} /><button className={`switch ${rule.active ? "on" : ""}`} onClick={() => update(index, { active: !rule.active })} aria-label={rule.active ? "Desativar regra" : "Ativar regra"}><span /></button></div><div className="form-grid"><NumberField label="Preço mínimo" value={rule.minPrice} onChange={(value) => update(index, { minPrice: value })} /><NumberField label="Preço máximo" value={rule.maxPrice} onChange={(value) => update(index, { maxPrice: value })} /><NumberField label="Desconto mínimo %" value={rule.minDiscount} onChange={(value) => update(index, { minDiscount: value })} /><NumberField label="Avaliação mínima" value={rule.minRating} step="0.1" onChange={(value) => update(index, { minRating: value })} /><NumberField label="Mínimo de avaliações" value={rule.minReviews} onChange={(value) => update(index, { minReviews: value })} /><NumberField label="Score mínimo" value={rule.minScore} onChange={(value) => update(index, { minScore: value })} /></div><label className="form-field"><span>Produtos monitorados — um por linha</span><textarea rows={4} value={rule.terms.join("\n")} onChange={(event) => update(index, { terms: event.target.value.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean) })} /></label><div className="rule-footer"><span>{rule.active ? `${rule.terms.length} termos ativos` : "Regra pausada"}</span><button className="text-button danger-text" onClick={() => setRules((current) => current.filter((_, position) => position !== index))}>Excluir regra</button></div></article>)}</div></section>
  );
}

function NumberField({ label, value, onChange, step = "1" }: { label: string; value: number; onChange: (value: number) => void; step?: string }) {
  return <label className="form-field"><span>{label}</span><input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function Templates({ config, saveConfig, busy }: { config: PublicConfig; saveConfig: (config: Partial<PublicConfig>, success: string) => Promise<void>; busy: boolean }) {
  const [normal, setNormal] = useState(config.templates.normal);
  const [drop, setDrop] = useState(config.templates.drop);
  return <section><div className="page-head"><div><span className="overline">Copy pronta</span><h1>Modelos de publicação</h1><p>Use: {"{produto}"}, {"{preco_antigo}"}, {"{preco}"}, {"{avaliacao}"}, {"{frete}"}, {"{desconto}"} e {"{link}"}.</p></div><button className="button accent" disabled={busy} onClick={() => saveConfig({ templates: { normal, drop } }, "Modelos salvos.")}>Salvar modelos</button></div><div className="template-grid"><label className="panel form-field"><span>OFERTA NORMAL</span><textarea rows={17} value={normal} onChange={(event) => setNormal(event.target.value)} /></label><label className="panel form-field"><span>PREÇO CAIU</span><textarea rows={17} value={drop} onChange={(event) => setDrop(event.target.value)} /></label></div></section>;
}

function Settings({ config, saveConfig, resetData, busy }: { config: PublicConfig; saveConfig: (config: Partial<PublicConfig> & { accessToken?: string }, success: string, clear?: boolean) => Promise<void>; resetData: () => void; busy: boolean }) {
  const [autoScan, setAutoScan] = useState(config.autoScan);
  const [interval, setIntervalValue] = useState(config.scanIntervalMinutes);
  const [limit, setLimit] = useState(config.limitPerTerm);
  const [score, setScore] = useState(config.globalMinScore);
  const [drop, setDrop] = useState(config.requeuePriceDropPercent);
  const [token, setToken] = useState("");
  return (
    <section><div className="page-head"><div><span className="overline">Preferências</span><h1>Configurações</h1><p>Ajustes gerais da busca, qualidade das ofertas e manutenção dos dados.</p></div><button className="button accent" disabled={busy} onClick={() => saveConfig({ autoScan: config.accessTokenConfigured && autoScan, scanIntervalMinutes: interval, limitPerTerm: limit, globalMinScore: score, requeuePriceDropPercent: drop, accessToken: token || undefined }, "Configurações salvas.")}>Salvar alterações</button></div><div className="settings-grid"><article className="panel setting-card"><span className="setting-icon">✦</span><h2>Automação</h2><p>A busca recorrente exige a integração oficial e funciona enquanto o painel estiver aberto.</p><label className="toggle-row"><span><strong>Busca automática</strong><small>{config.accessTokenConfigured ? "Usar regras ativas no intervalo definido" : "Conecte a integração oficial para ativar"}</small></span><button disabled={!config.accessTokenConfigured} className={`switch ${autoScan && config.accessTokenConfigured ? "on" : ""}`} onClick={() => setAutoScan(!autoScan)}><span /></button></label><NumberField label="Intervalo em minutos" value={interval} onChange={setIntervalValue} /><NumberField label="Resultados por produto" value={limit} onChange={setLimit} /></article><article className="panel setting-card"><span className="setting-icon">◎</span><h2>Qualidade</h2><p>Controle a exigência mínima para entrar na fila.</p><NumberField label="Score mínimo global" value={score} onChange={setScore} /><NumberField label="Reabrir após nova queda de %" value={drop} onChange={setDrop} /><div className="inline-info">Quanto maior o score, mais seletiva fica a busca.</div></article><article className="panel setting-card"><span className="setting-icon">⌁</span><h2>Integração oficial do Mercado Livre</h2><p>{config.accessTokenConfigured ? "Integração conectada. O robô pode buscar produtos por nome." : "Sem token, use a importação pelo link do produto, que não depende da busca geral."}</p><label className="form-field"><span>Access token oficial</span><input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder={config.accessTokenConfigured ? "Token já configurado" : "Cole o token da sua aplicação"} /></label>{config.accessTokenConfigured && <button className="button danger" disabled={busy} onClick={() => saveConfig({}, "Token removido.", true)}>Remover token</button>}<div className="inline-info">A API oficial exige uma aplicação autorizada e o token expira periodicamente. Ele não aparece no painel nem no backup.</div><a className="source-link settings-guide" href="https://developers.mercadolivre.com.br/devcenter/crie-uma-aplicacao-no-mercado-livre" target="_blank" rel="noreferrer">Abrir guia oficial para criar a integração ↗</a></article><article className="panel setting-card"><span className="setting-icon">↺</span><h2>Dados e manutenção</h2><p>Exporte uma cópia ou recomece com o painel limpo.</p><div className="settings-actions"><a className="button" href="/api/data/export">Baixar backup JSON</a><button className="button danger" onClick={resetData}>Limpar dados</button></div><div className="inline-warning">A limpeza remove ofertas, histórico e logs. As regras são preservadas.</div></article></div></section>
  );
}

function ComingSoon({ view }: { view: View }) {
  return <div className="panel coming"><span>OC</span><h1>{nav.find((item) => item.id === view)?.label}</h1><p>Esta área está sendo conectada à versão web.</p></div>;
}
