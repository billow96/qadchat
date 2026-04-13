import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

type RegistryProvider = "openrouter";

export interface NormalizedModelRegistryEntry {
  provider: RegistryProvider;
  source: string;
  sourceModelId: string;
  modelId: string;
  displayName?: string;
  family?: string;
  capabilities: {
    vision?: boolean;
    reasoning?: boolean;
    tools?: boolean;
    structuredOutput?: boolean;
  };
  contextTokens?: number;
  maxOutputTokens?: number;
  modalities?: {
    input?: string[];
    output?: string[];
  };
  pricing?: Record<string, number>;
  knowledge?: string;
  releaseDate?: string;
  lastUpdated?: string;
  openWeights?: boolean;
}

interface RegistryCachePayload {
  provider: RegistryProvider;
  sourceUrl: string;
  fetchedAt: number;
  sourceEtag?: string;
  models: Record<string, NormalizedModelRegistryEntry>;
}

interface RegistryState {
  refreshPromise?: Promise<RegistryCachePayload>;
  lastAccessTriggeredAt: number;
  consecutiveFailures: number;
  lastFailureAt: number;
}

const SOURCE_URL = "https://models.dev/api.json";
const FULL_REFRESH_TTL_MS = 72 * 60 * 60 * 1000;
const ACCESS_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const FAILURE_BACKOFF_STEPS_MS = [
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
];
const CACHE_DIR = path.join(process.cwd(), ".cache", "model-registry");

const registryState: Record<RegistryProvider, RegistryState> = {
  openrouter: {
    lastAccessTriggeredAt: 0,
    consecutiveFailures: 0,
    lastFailureAt: 0,
  },
};

function getCacheFile(provider: RegistryProvider) {
  return path.join(CACHE_DIR, `${provider}.json`);
}

async function readCache(
  provider: RegistryProvider,
): Promise<RegistryCachePayload | null> {
  try {
    const raw = await readFile(getCacheFile(provider), "utf-8");
    return JSON.parse(raw) as RegistryCachePayload;
  } catch {
    return null;
  }
}

async function writeCache(payload: RegistryCachePayload) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(
    getCacheFile(payload.provider),
    JSON.stringify(payload, null, 2),
    "utf-8",
  );
}

function getFailureBackoffMs(consecutiveFailures: number) {
  const idx = Math.max(
    0,
    Math.min(FAILURE_BACKOFF_STEPS_MS.length - 1, consecutiveFailures - 1),
  );
  return FAILURE_BACKOFF_STEPS_MS[idx];
}

function shouldRefreshByAccess(
  state: RegistryState,
  cache: RegistryCachePayload | null,
  now: number,
) {
  const failedRecently =
    state.consecutiveFailures > 0 &&
    now - state.lastFailureAt < getFailureBackoffMs(state.consecutiveFailures);
  if (failedRecently) return false;
  if (now - state.lastAccessTriggeredAt < ACCESS_COOLDOWN_MS) return false;
  if (!cache) return true;
  return now - cache.fetchedAt >= FULL_REFRESH_TTL_MS;
}

function normalizeOpenRouterModel(
  sourceModelId: string,
  model: any,
): NormalizedModelRegistryEntry {
  const modelId = sourceModelId.includes("/")
    ? sourceModelId.split("/").pop() || sourceModelId
    : sourceModelId;
  const inputModalities = Array.isArray(model?.modalities?.input)
    ? model.modalities.input
    : [];
  const outputModalities = Array.isArray(model?.modalities?.output)
    ? model.modalities.output
    : [];

  return {
    provider: "openrouter",
    source: "models.dev/openrouter",
    sourceModelId,
    modelId,
    displayName: model?.name,
    family: model?.family,
    capabilities: {
      vision: inputModalities.includes("image"),
      reasoning: model?.reasoning === true,
      tools: model?.tool_call === true,
      structuredOutput: model?.structured_output === true,
    },
    contextTokens:
      typeof model?.limit?.context === "number"
        ? model.limit.context
        : undefined,
    maxOutputTokens:
      typeof model?.limit?.output === "number" ? model.limit.output : undefined,
    modalities: {
      input: inputModalities,
      output: outputModalities,
    },
    pricing: typeof model?.cost === "object" ? model.cost : undefined,
    knowledge: model?.knowledge,
    releaseDate: model?.release_date,
    lastUpdated: model?.last_updated,
    openWeights: model?.open_weights,
  };
}

async function fetchOpenRouterRegistry(
  previous?: RegistryCachePayload | null,
): Promise<RegistryCachePayload> {
  const headers: Record<string, string> = {};
  if (previous?.sourceEtag) {
    headers["If-None-Match"] = previous.sourceEtag;
  }

  const res = await fetch(SOURCE_URL, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (res.status === 304 && previous) {
    return {
      ...previous,
      fetchedAt: Date.now(),
    };
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch models.dev registry: ${res.status}`);
  }

  const data = (await res.json()) as Record<string, any>;
  const openrouter = data?.openrouter;
  if (!openrouter?.models || typeof openrouter.models !== "object") {
    throw new Error("Invalid openrouter registry payload");
  }

  const models = Object.fromEntries(
    Object.entries(openrouter.models).map(([modelId, model]) => [
      modelId.includes("/") ? modelId.split("/").pop() || modelId : modelId,
      normalizeOpenRouterModel(modelId, model),
    ]),
  );

  return {
    provider: "openrouter",
    sourceUrl: SOURCE_URL,
    fetchedAt: Date.now(),
    sourceEtag: res.headers.get("etag") || previous?.sourceEtag,
    models,
  };
}

async function refreshProvider(
  provider: RegistryProvider,
  previous?: RegistryCachePayload | null,
) {
  const state = registryState[provider];
  if (state.refreshPromise) {
    return state.refreshPromise;
  }

  state.refreshPromise = (async () => {
    try {
      const payload = await fetchOpenRouterRegistry(previous);
      await writeCache(payload);
      state.consecutiveFailures = 0;
      state.lastFailureAt = 0;
      return payload;
    } catch (error) {
      state.consecutiveFailures += 1;
      state.lastFailureAt = Date.now();
      throw error;
    } finally {
      state.refreshPromise = undefined;
    }
  })();

  return state.refreshPromise;
}

export async function getModelRegistry(
  provider: RegistryProvider,
  options?: {
    forceRefresh?: boolean;
    trigger?: "scheduled" | "startup" | "access";
  },
) {
  const now = Date.now();
  const state = registryState[provider];
  let cache = await readCache(provider);
  const trigger = options?.trigger || "access";

  const shouldForceRefresh = options?.forceRefresh === true;
  const shouldRefresh =
    shouldForceRefresh ||
    !cache ||
    now - cache.fetchedAt >= FULL_REFRESH_TTL_MS ||
    (trigger === "access" && shouldRefreshByAccess(state, cache, now));

  if (trigger === "access" && shouldRefreshByAccess(state, cache, now)) {
    state.lastAccessTriggeredAt = now;
  }

  if (shouldRefresh) {
    try {
      cache = await refreshProvider(provider, cache);
    } catch (error) {
      if (!cache) {
        throw error;
      }
    }
  }

  if (!cache) {
    throw new Error(`Model registry unavailable for provider: ${provider}`);
  }

  return cache;
}
