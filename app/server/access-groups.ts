import { readFile } from "fs/promises";
import path from "path";
import { createHash, timingSafeEqual } from "crypto";
import { hashWithSecret } from "../utils/hmac";
import {
  ACCESS_CODE_PREFIX,
  ALIBABA_BASE_URL,
  ANTHROPIC_BASE_URL,
  BYTEDANCE_BASE_URL,
  DEEPSEEK_BASE_URL,
  GEMINI_BASE_URL,
  MOONSHOT_BASE_URL,
  OPENAI_BASE_URL,
  SILICONFLOW_BASE_URL,
  XAI_BASE_URL,
  type ServiceProvider,
} from "../constant";
import type { ServerConfig } from "../mcp/types";

export type ProviderKey =
  | "openai"
  | "google"
  | "anthropic"
  | "bytedance"
  | "alibaba"
  | "moonshot"
  | "deepseek"
  | "xai"
  | "siliconflow";

type RuntimeProviderConfig = {
  apiKey: string;
  baseUrl: string;
};

type RuntimeProviderMap = Partial<Record<ProviderKey, RuntimeProviderConfig>>;

export type AccessGroupDefinition = {
  id: string;
  name?: string;
  accessCode: string;
  defaultProvider?: ProviderKey;
  defaultModel?: string;
  summaryModel?: string;
  enabledModels?: Partial<Record<ProviderKey, string[]>>;
  providers?: RuntimeProviderMap;
  mcpServers?: Record<string, ServerConfig>;
};

type AccessGroupsFile = {
  version?: number;
  groups?: AccessGroupDefinition[];
};

export type PublicProviderPresence = Record<
  ProviderKey,
  {
    hasApiKey: boolean;
    hasBaseUrl: boolean;
  }
>;

export type GroupBootstrap = {
  groupId: string;
  groupName: string;
  defaultProvider: ProviderKey | "";
  defaultModel: string;
  summaryModel: string;
  enabledModels: Record<string, string[]>;
  mcpServers: Record<string, ServerConfig>;
  serverProviders: PublicProviderPresence;
  hasServerProviderConfig: boolean;
};

type AccessSessionPayload = {
  groupId: string;
  issuedAt: number;
};

export const ACCESS_SESSION_COOKIE = "qadchat_access_session";
const ACCESS_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_SESSION_SECRET_ENV = "ACCESS_SESSION_SECRET";
const ACCESS_GROUPS_DIR_ENV = "ACCESS_GROUPS_DIR";
const ACCESS_GROUPS_FILE_ENV = "ACCESS_GROUPS_FILE";
const DEFAULT_ACCESS_GROUPS_DIR = "/app/data";
const DEFAULT_ACCESS_GROUPS_FILE = "access-groups.json";

const PROVIDER_DEFAULTS: Record<ProviderKey, string> = {
  openai: OPENAI_BASE_URL,
  google: GEMINI_BASE_URL,
  anthropic: ANTHROPIC_BASE_URL,
  bytedance: BYTEDANCE_BASE_URL,
  alibaba: ALIBABA_BASE_URL,
  moonshot: MOONSHOT_BASE_URL,
  deepseek: DEEPSEEK_BASE_URL,
  xai: XAI_BASE_URL,
  siliconflow: SILICONFLOW_BASE_URL,
};

const PROVIDER_ENV_KEYS: Record<
  ProviderKey,
  { apiKey: string; baseUrl: string }
> = {
  openai: {
    apiKey: "OPENAI_API_KEY",
    baseUrl: "OPENAI_BASE_URL",
  },
  google: {
    apiKey: "GOOGLE_API_KEY",
    baseUrl: "GOOGLE_BASE_URL",
  },
  anthropic: {
    apiKey: "ANTHROPIC_API_KEY",
    baseUrl: "ANTHROPIC_BASE_URL",
  },
  bytedance: {
    apiKey: "BYTEDANCE_API_KEY",
    baseUrl: "BYTEDANCE_BASE_URL",
  },
  alibaba: {
    apiKey: "ALIBABA_API_KEY",
    baseUrl: "ALIBABA_BASE_URL",
  },
  moonshot: {
    apiKey: "MOONSHOT_API_KEY",
    baseUrl: "MOONSHOT_BASE_URL",
  },
  deepseek: {
    apiKey: "DEEPSEEK_API_KEY",
    baseUrl: "DEEPSEEK_BASE_URL",
  },
  xai: {
    apiKey: "XAI_API_KEY",
    baseUrl: "XAI_BASE_URL",
  },
  siliconflow: {
    apiKey: "SILICONFLOW_API_KEY",
    baseUrl: "SILICONFLOW_BASE_URL",
  },
};

const PROVIDER_KEYS = Object.keys(PROVIDER_ENV_KEYS) as ProviderKey[];

function normalizeBaseUrl(baseUrl: string | undefined, fallback: string) {
  const value = (baseUrl || fallback || "").trim();
  return value || fallback;
}

function sanitizeEnabledModels(
  enabledModels?: Partial<Record<ProviderKey, string[]>>,
) {
  const result: Record<string, string[]> = {};
  PROVIDER_KEYS.forEach((provider) => {
    const models = enabledModels?.[provider];
    result[provider] = Array.isArray(models)
      ? models.filter((model) => typeof model === "string" && model.trim())
      : [];
  });
  return result;
}

function sanitizeMcpServers(input?: Record<string, ServerConfig>) {
  if (!input || typeof input !== "object") return {};
  const result: Record<string, ServerConfig> = {};

  for (const [key, value] of Object.entries(input)) {
    if (!value || typeof value !== "object") continue;
    if (!value.baseUrl || typeof value.baseUrl !== "string") continue;
    if (value.type !== "sse" && value.type !== "streamableHttp") continue;

    result[key] = {
      ...value,
      timeout: Math.max(600, Number(value.timeout ?? 600)),
      headers:
        value.headers && typeof value.headers === "object"
          ? { ...value.headers }
          : undefined,
    };
  }

  return result;
}

function createPublicProviderPresence(
  providers: RuntimeProviderMap,
): PublicProviderPresence {
  return PROVIDER_KEYS.reduce((acc, provider) => {
    const cfg = providers[provider];
    acc[provider] = {
      hasApiKey: !!cfg?.apiKey,
      hasBaseUrl: !!cfg?.baseUrl,
    };
    return acc;
  }, {} as PublicProviderPresence);
}

function normalizeGroup(
  definition: AccessGroupDefinition,
): AccessGroupDefinition {
  const providers: RuntimeProviderMap = {};

  PROVIDER_KEYS.forEach((provider) => {
    const rawProvider = definition.providers?.[provider];
    if (!rawProvider?.apiKey) return;

    providers[provider] = {
      apiKey: rawProvider.apiKey.trim(),
      baseUrl: normalizeBaseUrl(
        rawProvider.baseUrl,
        PROVIDER_DEFAULTS[provider],
      ),
    };
  });

  const fallbackProvider =
    (Object.keys(providers)[0] as ProviderKey | undefined) || undefined;

  return {
    id: definition.id.trim(),
    name: definition.name?.trim() || definition.id.trim(),
    accessCode: definition.accessCode.trim(),
    defaultProvider:
      definition.defaultProvider && providers[definition.defaultProvider]
        ? definition.defaultProvider
        : fallbackProvider,
    defaultModel: definition.defaultModel?.trim() || "",
    summaryModel: definition.summaryModel?.trim() || "",
    enabledModels: sanitizeEnabledModels(definition.enabledModels),
    providers,
    mcpServers: sanitizeMcpServers(definition.mcpServers),
  };
}

function getLegacyProvidersFromEnv(): RuntimeProviderMap {
  const providers: RuntimeProviderMap = {};

  PROVIDER_KEYS.forEach((provider) => {
    const envKeys = PROVIDER_ENV_KEYS[provider];
    const apiKey = (process.env[envKeys.apiKey] || "").trim();
    if (!apiKey) return;

    providers[provider] = {
      apiKey,
      baseUrl: normalizeBaseUrl(
        process.env[envKeys.baseUrl],
        PROVIDER_DEFAULTS[provider],
      ),
    };
  });

  return providers;
}

function buildLegacyGroup(): AccessGroupDefinition | null {
  const accessCode = (process.env.ACCESS_CODE || "").trim();
  const providers = getLegacyProvidersFromEnv();
  const hasProviders = Object.keys(providers).length > 0;

  if (!accessCode && !hasProviders) {
    return null;
  }

  const defaultProvider = (Object.keys(providers)[0] ||
    "openai") as ProviderKey;

  return normalizeGroup({
    id: "legacy-env",
    name: "Legacy Environment",
    accessCode,
    defaultProvider,
    providers,
    defaultModel: "",
    summaryModel: "",
    enabledModels: {},
    mcpServers: {},
  });
}

async function readConfigFile(): Promise<AccessGroupsFile | null> {
  const candidatePaths = [
    process.env[ACCESS_GROUPS_FILE_ENV],
    path.join(
      process.env[ACCESS_GROUPS_DIR_ENV] || DEFAULT_ACCESS_GROUPS_DIR,
      DEFAULT_ACCESS_GROUPS_FILE,
    ),
    path.join(process.cwd(), "data", DEFAULT_ACCESS_GROUPS_FILE),
  ].filter(Boolean) as string[];

  for (const filePath of candidatePaths) {
    try {
      const raw = await readFile(filePath, "utf-8");
      return JSON.parse(raw) as AccessGroupsFile;
    } catch {
      // Continue trying the next candidate path.
    }
  }

  return null;
}

export async function loadAccessGroups() {
  const fileConfig = await readConfigFile();
  const fileGroups = Array.isArray(fileConfig?.groups)
    ? fileConfig!.groups
        .filter(
          (group) =>
            group &&
            typeof group.id === "string" &&
            typeof group.accessCode === "string",
        )
        .map(normalizeGroup)
        .filter((group) => group.id && group.accessCode)
    : [];

  const legacyGroup = buildLegacyGroup();

  return {
    groups: fileGroups,
    legacyGroup,
    hasFileGroups: fileGroups.length > 0,
  };
}

export async function getAccessControlStatus() {
  const { groups, legacyGroup } = await loadAccessGroups();
  return {
    hasServerAccessCode:
      groups.some((group) => !!group.accessCode) || !!legacyGroup?.accessCode,
    hasLegacyAccessCode: !!legacyGroup?.accessCode,
    hasAccessGroupsConfig: groups.length > 0,
  };
}

export async function resolveGroupByAccessCode(accessCode: string) {
  const trimmed = accessCode.trim();
  if (!trimmed) return null;

  const { groups, legacyGroup } = await loadAccessGroups();
  const fileMatch = groups.find((group) => group.accessCode === trimmed);
  if (fileMatch) return fileMatch;

  if (legacyGroup?.accessCode && legacyGroup.accessCode === trimmed) {
    return legacyGroup;
  }

  if (legacyGroup && !legacyGroup.accessCode && groups.length === 0) {
    return legacyGroup;
  }

  return null;
}

export function hasAnyProviderConfig(group: AccessGroupDefinition | null) {
  return !!group && Object.keys(group.providers || {}).length > 0;
}

export function getGroupBootstrap(
  group: AccessGroupDefinition,
): GroupBootstrap {
  const providers = group.providers || {};
  const serverProviders = createPublicProviderPresence(providers);

  return {
    groupId: group.id,
    groupName: group.name || group.id,
    defaultProvider:
      (group.defaultProvider && providers[group.defaultProvider]
        ? group.defaultProvider
        : "") || "",
    defaultModel: group.defaultModel || "",
    summaryModel: group.summaryModel || "",
    enabledModels: sanitizeEnabledModels(group.enabledModels),
    mcpServers: sanitizeMcpServers(group.mcpServers),
    serverProviders,
    hasServerProviderConfig: Object.values(serverProviders).some(
      (value) => value.hasApiKey || value.hasBaseUrl,
    ),
  };
}

export function getProviderRuntimeConfig(
  group: AccessGroupDefinition,
  provider: ProviderKey,
) {
  return group.providers?.[provider] || null;
}

function getAccessSessionSecret() {
  const configured = (process.env[ACCESS_SESSION_SECRET_ENV] || "").trim();
  if (configured) return configured;

  return (
    process.env.ACCESS_CODE ||
    process.env.OPENAI_API_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "qadchat-default-access-session-secret"
  );
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function encodeSessionPayload(payload: AccessSessionPayload) {
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf-8").toString("base64url");
}

function decodeSessionPayload(encoded: string) {
  const json = Buffer.from(encoded, "base64url").toString("utf-8");
  return JSON.parse(json) as AccessSessionPayload;
}

export function createAccessSessionToken(groupId: string) {
  const payload: AccessSessionPayload = {
    groupId,
    issuedAt: Date.now(),
  };
  const encodedPayload = encodeSessionPayload(payload);
  const signature = hashWithSecret(encodedPayload, getAccessSessionSecret());
  return `${encodedPayload}.${signature}`;
}

export function verifyAccessSessionToken(token: string) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = hashWithSecret(
    encodedPayload,
    getAccessSessionSecret(),
  );
  if (!safeEqual(expectedSignature, signature)) return null;

  try {
    const payload = decodeSessionPayload(encodedPayload);
    if (!payload.groupId || !payload.issuedAt) return null;
    if (Date.now() - payload.issuedAt > ACCESS_SESSION_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function resolveGroupBySessionToken(token?: string | null) {
  if (!token) return null;
  const payload = verifyAccessSessionToken(token);
  if (!payload) return null;

  const { groups, legacyGroup } = await loadAccessGroups();
  return (
    groups.find((group) => group.id === payload.groupId) ||
    (legacyGroup?.id === payload.groupId ? legacyGroup : null)
  );
}

export function getAccessSessionCookieOptions() {
  return {
    name: ACCESS_SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(ACCESS_SESSION_TTL_MS / 1000),
  };
}

export function getAccessTokenAuthorization(accessCode: string) {
  return `${ACCESS_CODE_PREFIX}${accessCode}`;
}

export function getGroupHash(group: AccessGroupDefinition) {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        id: group.id,
        defaultProvider: group.defaultProvider,
        defaultModel: group.defaultModel,
        summaryModel: group.summaryModel,
        enabledModels: group.enabledModels,
        providers: Object.keys(group.providers || {}),
        mcpServers: Object.keys(group.mcpServers || {}),
      }),
    )
    .digest("hex");
  return digest;
}
