export interface ModelIdentityParts {
  raw: string;
  simple: string;
  canonical: string;
  compact: string;
  familyKey: string;
}

const CATEGORY_NAME_MAP: Record<string, string> = {
  gpt: "GPT",
  chatgpt: "GPT",
  claude: "Claude",
  gemini: "Gemini",
  glm: "GLM",
  grok: "Grok",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  qwq: "Qwen",
  qvq: "Qwen",
  kimi: "Kimi",
  moonshot: "Moonshot",
  minimax: "MiniMax",
  doubao: "Doubao",
  llama: "Llama",
  mistral: "Mistral",
  gemma: "Gemma",
  z: "ZAI",
  zai: "ZAI",
  flux: "Flux",
  nano: "Nano",
  openrouter: "OpenRouter",
};

export function getSimpleModelId(modelId: string) {
  const trimmed = String(modelId || "").trim();
  const rightPart = trimmed.includes("/")
    ? trimmed.split("/").pop() || trimmed
    : trimmed;
  return rightPart.trim();
}

export function canonicalizeModelId(modelId: string) {
  return getSimpleModelId(modelId)
    .toLowerCase()
    .replace(/[/:]+/g, "-")
    .replace(/[._\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function compactModelId(modelId: string) {
  return canonicalizeModelId(modelId).replace(/[^a-z0-9]/g, "");
}

export function getModelFamilyKey(modelId: string) {
  const canonical = canonicalizeModelId(modelId);
  const [firstToken] = canonical.split("-");
  return firstToken || canonical;
}

export function getModelIdentityParts(modelId: string): ModelIdentityParts {
  return {
    raw: modelId,
    simple: getSimpleModelId(modelId),
    canonical: canonicalizeModelId(modelId),
    compact: compactModelId(modelId),
    familyKey: getModelFamilyKey(modelId),
  };
}

export function getUnifiedCategoryName(modelId: string) {
  const familyKey = getModelFamilyKey(modelId);
  return CATEGORY_NAME_MAP[familyKey] || familyKey.toUpperCase() || "其他";
}
