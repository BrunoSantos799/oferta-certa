import { eq } from "drizzle-orm";
import { getD1, getDb } from "../db";
import { appState } from "../db/schema";
import type { AppConfig, AppState, PublicConfig, Rule } from "./types";

const defaultRules: Rule[] = [
  {
    id: "tecnologia",
    name: "Tecnologia",
    active: true,
    terms: ["ssd 1tb", "monitor 144hz", "carregador usb-c", "smartphone"],
    minPrice: 30,
    maxPrice: 2500,
    minDiscount: 5,
    minRating: 0,
    minReviews: 0,
    minScore: 42,
  },
  {
    id: "games",
    name: "Games",
    active: true,
    terms: ["headset gamer", "mouse gamer", "teclado mecanico", "controle pc"],
    minPrice: 25,
    maxPrice: 1500,
    minDiscount: 5,
    minRating: 0,
    minReviews: 0,
    minScore: 42,
  },
  {
    id: "casa",
    name: "Casa",
    active: true,
    terms: ["air fryer", "cafeteira", "aspirador vertical", "panela eletrica"],
    minPrice: 20,
    maxPrice: 1400,
    minDiscount: 5,
    minRating: 0,
    minReviews: 0,
    minScore: 42,
  },
];

export const DEFAULT_CONFIG: AppConfig = {
  autoScan: false,
  scanIntervalMinutes: 30,
  limitPerTerm: 20,
  globalMinScore: 42,
  requeuePriceDropPercent: 5,
  accessToken: "",
  rules: defaultRules,
  templates: {
    normal:
      "🔥 OFERTA ENCONTRADA\n\n{produto}\n\nDe R$ {preco_antigo}\nPor R$ {preco}\n\n⭐ {avaliacao}/5\n🚚 {frete}\n\n🛒 Aproveite:\n{link}\n\n⚠️ Preço pode mudar a qualquer momento.",
    drop:
      "🚨 BAIXOU MAIS!\n\n{produto}\n\nO preço caiu para R$ {preco}\n\n🔥 {desconto}% OFF\n\n🛒 {link}\n\n⚠️ Oferta sujeita a alteração.",
  },
};

export const DEFAULT_STATE: AppState = {
  offers: [],
  history: [],
  robotRuns: [],
  robotLogs: [],
  lastDiagnostics: null,
  stats: {
    productsCollected: 0,
    offersAccepted: 0,
    offersRejected: 0,
    failedSearches: 0,
    lastSource: "—",
    lastSuccessAt: null,
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return clone(fallback);
  }
}

export function ownerKey(request: Request): string {
  return request.headers.get("oai-authenticated-user-email")?.toLowerCase() || "site-owner";
}

async function ensureStore() {
  const d1 = await getD1();
  await d1.prepare(`
    CREATE TABLE IF NOT EXISTS app_state (
      owner_key TEXT PRIMARY KEY NOT NULL,
      config_json TEXT NOT NULL,
      state_json TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `).run();
}

export async function loadData(request: Request): Promise<{ config: AppConfig; state: AppState }> {
  await ensureStore();
  const key = ownerKey(request);
  const db = await getDb();
  const row = await db.query.appState.findFirst({ where: eq(appState.ownerKey, key) });
  if (!row) {
    const config = clone(DEFAULT_CONFIG);
    const state = clone(DEFAULT_STATE);
    await db.insert(appState).values({
      ownerKey: key,
      configJson: JSON.stringify(config),
      stateJson: JSON.stringify(state),
      updatedAt: new Date().toISOString(),
    });
    return { config, state };
  }
  return {
    config: normalizeConfig(safeJson(row.configJson, DEFAULT_CONFIG)),
    state: normalizeState(safeJson(row.stateJson, DEFAULT_STATE)),
  };
}

export async function saveData(request: Request, config: AppConfig, state: AppState) {
  await ensureStore();
  const key = ownerKey(request);
  const db = await getDb();
  await db
    .insert(appState)
    .values({
      ownerKey: key,
      configJson: JSON.stringify(normalizeConfig(config)),
      stateJson: JSON.stringify(normalizeState(state)),
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: appState.ownerKey,
      set: {
        configJson: JSON.stringify(normalizeConfig(config)),
        stateJson: JSON.stringify(normalizeState(state)),
        updatedAt: new Date().toISOString(),
      },
    });
}

export function publicConfig(config: AppConfig): PublicConfig {
  const { accessToken, ...rest } = config;
  return { ...rest, accessTokenConfigured: Boolean(accessToken) };
}

function bounded(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function text(value: unknown, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
}

function normalizeRule(rule: Partial<Rule>, index: number): Rule {
  return {
    id: text(rule.id || `regra-${index + 1}`, 80),
    name: text(rule.name || `Regra ${index + 1}`, 80),
    active: rule.active !== false,
    terms: Array.isArray(rule.terms)
      ? rule.terms.map((term) => text(term, 100)).filter(Boolean).slice(0, 20)
      : [],
    minPrice: bounded(rule.minPrice, 0, 1_000_000, 0),
    maxPrice: bounded(rule.maxPrice, 0, 1_000_000, 10_000),
    minDiscount: bounded(rule.minDiscount, 0, 95, 0),
    minRating: bounded(rule.minRating, 0, 5, 0),
    minReviews: bounded(rule.minReviews, 0, 10_000_000, 0),
    minScore: bounded(rule.minScore, 0, 100, 42),
  };
}

export function normalizeConfig(value: Partial<AppConfig>): AppConfig {
  const rules = Array.isArray(value.rules)
    ? value.rules.slice(0, 20).map(normalizeRule).filter((rule) => rule.name)
    : clone(defaultRules);
  return {
    autoScan: value.autoScan === true,
    scanIntervalMinutes: bounded(value.scanIntervalMinutes, 10, 720, 30),
    limitPerTerm: bounded(value.limitPerTerm, 5, 50, 20),
    globalMinScore: bounded(value.globalMinScore, 0, 100, 42),
    requeuePriceDropPercent: bounded(value.requeuePriceDropPercent, 0, 50, 5),
    accessToken: text(value.accessToken, 5000),
    rules: rules.length ? rules : clone(defaultRules),
    templates: {
      normal: text(value.templates?.normal || DEFAULT_CONFIG.templates.normal, 20_000),
      drop: text(value.templates?.drop || DEFAULT_CONFIG.templates.drop, 20_000),
    },
  };
}

export function normalizeState(value: Partial<AppState>): AppState {
  return {
    offers: Array.isArray(value.offers) ? value.offers.slice(0, 1500) : [],
    history: Array.isArray(value.history) ? value.history.slice(0, 2000) : [],
    robotRuns: Array.isArray(value.robotRuns) ? value.robotRuns.slice(0, 100) : [],
    robotLogs: Array.isArray(value.robotLogs) ? value.robotLogs.slice(0, 300) : [],
    lastDiagnostics: value.lastDiagnostics || null,
    stats: { ...clone(DEFAULT_STATE.stats), ...(value.stats || {}) },
  };
}

export function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro inesperado";
  if (message.includes("no such table") || message.includes("app_state")) {
    return "O banco do site ainda está sendo preparado. Tente novamente em alguns instantes.";
  }
  return message.slice(0, 600);
}
