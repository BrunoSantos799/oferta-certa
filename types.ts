export type OfferStatus = "awaiting_link" | "ready" | "published" | "discarded";

export type Rule = {
  id: string;
  name: string;
  active: boolean;
  terms: string[];
  minPrice: number;
  maxPrice: number;
  minDiscount: number;
  minRating: number;
  minReviews: number;
  minScore: number;
};

export type Templates = {
  normal: string;
  drop: string;
};

export type AppConfig = {
  autoScan: boolean;
  scanIntervalMinutes: number;
  limitPerTerm: number;
  globalMinScore: number;
  requeuePriceDropPercent: number;
  accessToken: string;
  rules: Rule[];
  templates: Templates;
};

export type PublicConfig = Omit<AppConfig, "accessToken"> & {
  accessTokenConfigured: boolean;
};

export type PricePoint = { at: string; price: number };

export type Offer = {
  id: string;
  sourceId: string;
  name: string;
  category: string;
  marketplace: string;
  oldPrice: number;
  price: number;
  previousPrice: number | null;
  lowestPrice: number;
  rating: number;
  reviews: number;
  shipping: string;
  score: number;
  status: OfferStatus;
  url: string;
  image: string;
  originalImage?: string;
  affiliateUrl: string;
  customPost: string;
  createdAt: string;
  updatedAt: string;
  lastPublishedPrice?: number;
  discount: number;
  priceHistory: PricePoint[];
};

export type RobotRun = {
  id: string;
  at: string;
  term: string;
  collected: number;
  accepted: number;
  rejected: number;
  source: string;
  success: boolean;
  message: string;
};

export type RobotLog = {
  id: string;
  at: string;
  level: "ok" | "warn" | "error";
  term: string;
  source: string;
  message: string;
};

export type HistoryItem = {
  id: string;
  offerId: string;
  offerName: string;
  price: number;
  score: number;
  publishedAt: string;
  destination: string;
};

export type Diagnostics = {
  at: string;
  status: "ok" | "attention" | "error";
  tests: Array<{
    id: string;
    label: string;
    status: "ok" | "warn" | "error";
    detail: string;
  }>;
};

export type AppState = {
  offers: Offer[];
  history: HistoryItem[];
  robotRuns: RobotRun[];
  robotLogs: RobotLog[];
  lastDiagnostics: Diagnostics | null;
  stats: {
    productsCollected: number;
    offersAccepted: number;
    offersRejected: number;
    failedSearches: number;
    lastSource: string;
    lastSuccessAt: string | null;
  };
};

export type Bootstrap = {
  app: { name: string; version: string };
  config: PublicConfig;
  state: AppState;
  serverTime: string;
};

export type MarketplaceItem = {
  sourceId: string;
  title: string;
  price: number;
  oldPrice: number;
  rating: number;
  reviews: number;
  soldQuantity: number;
  freeShipping: boolean;
  permalink: string;
  image: string;
  source: string;
};
