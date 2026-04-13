import type { ModelCapabilities } from "./model-capabilities";
import {
  canonicalizeModelId,
  compactModelId,
  getSimpleModelId,
} from "../utils/model-identity";

export interface RuntimeModelMetadata {
  provider: string;
  source: string;
  sourceModelId: string;
  modelId: string;
  displayName?: string;
  family?: string;
  capabilities?: ModelCapabilities;
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

const RUNTIME_METADATA_PREFIX = "runtime_model_metadata_";

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

function getStorageKey(modelName: string) {
  return `${RUNTIME_METADATA_PREFIX}${modelName}`;
}

export function getRuntimeModelMetadata(
  modelName: string,
): RuntimeModelMetadata | null {
  const storage = getStorage();
  if (!storage) return null;

  const candidates = [
    modelName,
    getSimpleModelId(modelName),
    canonicalizeModelId(modelName),
    compactModelId(modelName),
  ];

  let raw: string | null = null;
  for (const candidate of candidates) {
    raw = storage.getItem(getStorageKey(candidate));
    if (raw) break;
  }

  if (!raw) {
    const targetCompact = compactModelId(modelName);
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key || !key.startsWith(RUNTIME_METADATA_PREFIX)) continue;
      const candidateModel = key.slice(RUNTIME_METADATA_PREFIX.length);
      const candidateCompact = compactModelId(candidateModel);
      if (
        candidateCompact &&
        (targetCompact === candidateCompact ||
          targetCompact.includes(candidateCompact) ||
          candidateCompact.includes(targetCompact))
      ) {
        raw = storage.getItem(key);
        if (raw) break;
      }
    }
  }

  if (!raw) return null;

  try {
    return JSON.parse(raw) as RuntimeModelMetadata;
  } catch (error) {
    console.warn(
      `[RuntimeModelMetadata] Failed to parse metadata for ${modelName}:`,
      error,
    );
    return null;
  }
}

export function saveRuntimeModelMetadataBatch(
  metadataList: RuntimeModelMetadata[],
) {
  const storage = getStorage();
  if (!storage || metadataList.length === 0) return;

  metadataList.forEach((metadata) => {
    if (!metadata?.modelId) return;
    const aliases = [
      metadata.modelId,
      getSimpleModelId(metadata.modelId),
      canonicalizeModelId(metadata.modelId),
      compactModelId(metadata.modelId),
    ];
    try {
      const payload = JSON.stringify(metadata);
      aliases.forEach((alias) => {
        if (!alias) return;
        storage.setItem(getStorageKey(alias), payload);
      });
    } catch (error) {
      console.warn(
        `[RuntimeModelMetadata] Failed to save metadata for ${metadata.modelId}:`,
        error,
      );
    }
  });
}
