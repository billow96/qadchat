import { ServiceProvider, DEFAULT_MODELS } from "../constant";
import { useAccessStore } from "../store/access";
import { LLMModel } from "./api";
import { getHeaders, getClientApi } from "./api";
import {
  RuntimeModelMetadata,
  saveRuntimeModelMetadataBatch,
} from "../config/model-runtime-metadata";
import {
  canonicalizeModelId,
  compactModelId,
  getSimpleModelId,
} from "../utils/model-identity";

// 统一的模型响应接口
export interface ModelFetchResponse {
  models: LLMModel[];
  success: boolean;
  error?: string;
  metadata?: RuntimeModelMetadata[];
}

// OpenAI格式的模型响应
interface OpenAIModelResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    owned_by?: string;
    created?: number;
  }>;
}

// Anthropic格式的模型响应
interface AnthropicModelResponse {
  data: Array<{
    id: string;
    display_name: string;
    created_at: string;
    type: string;
  }>;
  has_more: boolean;
  first_id?: string;
  last_id?: string;
}

// Google格式的模型响应（基于官方API）
interface GoogleModelResponse {
  models: Array<{
    name: string;
    baseModelId: string;
    version: string;
    displayName: string;
    description?: string;
    supportedGenerationMethods?: string[];
    inputTokenLimit?: number;
    outputTokenLimit?: number;
  }>;
  nextPageToken?: string;
}

interface RegistryModelEntry {
  provider: string;
  source: string;
  sourceModelId: string;
  modelId: string;
  displayName?: string;
  family?: string;
  capabilities?: {
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

/**
 * 统一的模型获取服务
 */
export class ModelFetcher {
  private static async fetchOpenRouterMetadataMap() {
    const res = await fetch("/api/model-registry/openrouter", {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch openrouter registry: ${res.status}`);
    }
    const payload = (await res.json()) as {
      error?: boolean;
      models?: RegistryModelEntry[];
    };
    const list = payload.models || [];
    const map = new Map<string, RegistryModelEntry>();
    list.forEach((entry) => {
      const compact = compactModelId(entry.modelId);
      const sourceCompact = compactModelId(entry.sourceModelId);
      map.set(entry.modelId, entry);
      map.set(entry.sourceModelId, entry);
      map.set(canonicalizeModelId(entry.modelId), entry);
      map.set(canonicalizeModelId(entry.sourceModelId), entry);
      map.set(compact, entry);
      map.set(sourceCompact, entry);
    });
    return map;
  }

  private static findRegistryEntry(
    registryMap: Map<string, RegistryModelEntry>,
    modelId: string,
  ) {
    const simpleId = getSimpleModelId(modelId);
    const canonical = canonicalizeModelId(simpleId);
    const compact = compactModelId(simpleId);

    const direct =
      registryMap.get(simpleId) ||
      registryMap.get(modelId) ||
      registryMap.get(canonical) ||
      registryMap.get(compact);

    if (direct) return direct;

    // 紧凑匹配用于处理 4.6 / 4-6 / 4-6-1m / :free 等变体
    for (const [key, entry] of registryMap.entries()) {
      const keyCompact = key.replace(/[^a-z0-9]/g, "");
      if (!keyCompact) continue;
      if (compact === keyCompact) return entry;
      if (compact.includes(keyCompact) || keyCompact.includes(compact)) {
        return entry;
      }
    }

    return undefined;
  }

  private static toRuntimeMetadata(
    entry: RegistryModelEntry | undefined,
  ): RuntimeModelMetadata | null {
    if (!entry) return null;
    return {
      provider: entry.provider,
      source: entry.source,
      sourceModelId: entry.sourceModelId,
      modelId: entry.modelId,
      displayName: entry.displayName,
      family: entry.family,
      capabilities: {
        vision: entry.capabilities?.vision,
        reasoning: entry.capabilities?.reasoning,
        tools: entry.capabilities?.tools,
        structuredOutput: entry.capabilities?.structuredOutput,
      },
      contextTokens: entry.contextTokens,
      maxOutputTokens: entry.maxOutputTokens,
      modalities: entry.modalities,
      pricing: entry.pricing,
      knowledge: entry.knowledge,
      releaseDate: entry.releaseDate,
      lastUpdated: entry.lastUpdated,
      openWeights: entry.openWeights,
    };
  }

  private static persistMetadata(metadata?: RuntimeModelMetadata[]) {
    if (metadata && metadata.length > 0) {
      saveRuntimeModelMetadataBatch(metadata);
    }
  }

  private static async enrichModelsWithOpenRouterMetadata(models: LLMModel[]) {
    try {
      const registryMap = await this.fetchOpenRouterMetadataMap();
      const metadata: RuntimeModelMetadata[] = [];

      const enriched = models.map((model) => {
        const originalName = String(model.name);
        const simpleId = getSimpleModelId(originalName);
        const registryEntry = this.findRegistryEntry(registryMap, originalName);
        const runtimeMetadata = this.toRuntimeMetadata(registryEntry);
        if (runtimeMetadata) {
          metadata.push({
            ...runtimeMetadata,
            modelId: originalName,
          });
        }

        if (!registryEntry) {
          return model;
        }

        return {
          ...model,
          name: originalName,
          displayName:
            model.displayName || registryEntry.displayName || simpleId,
          contextTokens: registryEntry.contextTokens ?? model.contextTokens,
        };
      });

      this.persistMetadata(metadata);
      return enriched;
    } catch (error) {
      console.warn(
        "[ModelFetcher] failed to enrich models from registry:",
        error,
      );
      return models;
    }
  }
  /**
   * 从指定服务商获取可用模型列表
   */
  static async fetchModels(
    provider: ServiceProvider | string,
  ): Promise<ModelFetchResponse> {
    try {
      const accessStore = useAccessStore.getState();

      switch (provider) {
        case ServiceProvider.OpenAI:
          return await this.fetchOpenAIModels(ServiceProvider.OpenAI);

        case ServiceProvider.Anthropic:
          return await this.fetchAnthropicModels();

        case ServiceProvider.Google:
          return await this.fetchGoogleModels();

        case ServiceProvider.DeepSeek:
          return await this.fetchDeepSeekModels();

        case ServiceProvider.Moonshot:
          return await this.fetchMoonshotModels();

        case ServiceProvider.ByteDance:
          return await this.fetchByteDanceModels();

        case ServiceProvider.Alibaba:
          return await this.fetchAlibabaModels();

        case ServiceProvider.XAI:
          return await this.fetchXAIModels();

        case ServiceProvider.SiliconFlow:
          return await this.fetchSiliconFlowModels();

        default:
          // 处理自定义服务商
          if (typeof provider === "string" && provider.startsWith("custom_")) {
            const customProvider = accessStore.customProviders.find(
              (p) => p.id === provider,
            );
            if (customProvider) {
              return await this.fetchCustomProviderModels(customProvider);
            }
          }

          return {
            models: [],
            success: false,
            error: `不支持的服务商: ${provider}`,
          };
      }
    } catch (error) {
      console.error(`[ModelFetcher] 获取 ${provider} 模型失败:`, error);
      return {
        models: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取OpenAI格式的模型（OpenAI、Moonshot、ByteDance等）
   */
  private static async fetchOpenAIModels(
    provider: ServiceProvider,
  ): Promise<ModelFetchResponse> {
    const api = getClientApi(provider);
    try {
      const models = await this.enrichModelsWithOpenRouterMetadata(
        await api.llm.models(),
      );
      return {
        models,
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        models: [],
        success: false,
        error: `${provider}模型列表获取失败。\n\n错误详情: ${errorMessage}\n\n如果问题持续存在，建议使用内置模型列表。`,
      };
    }
  }

  /**
   * 获取Anthropic模型
   * 注意：Anthropic目前没有公开的模型列表API，尝试使用OpenAI兼容格式
   */
  private static async fetchAnthropicModels(): Promise<ModelFetchResponse> {
    const api = getClientApi(ServiceProvider.Anthropic);
    try {
      const models = await this.enrichModelsWithOpenRouterMetadata(
        await api.llm.models(),
      );
      return {
        models,
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        models: [],
        success: false,
        error: `Anthropic模型列表获取失败。\n\n错误详情: ${errorMessage}\n\n如果问题持续存在，建议使用内置模型列表。`,
      };
    }
  }

  /**
   * 获取Google模型
   * 使用Google Generative Language API的正确端点
   */
  private static async fetchGoogleModels(): Promise<ModelFetchResponse> {
    const api = getClientApi(ServiceProvider.Google);
    try {
      const models = await this.enrichModelsWithOpenRouterMetadata(
        await api.llm.models(),
      );
      return {
        models,
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        models: [],
        success: false,
        error: `Google模型列表获取失败。\n\n错误详情: ${errorMessage}\n\n如果问题持续存在，建议使用内置模型列表。`,
      };
    }
  }

  /**
   * 获取DeepSeek模型
   * 使用DeepSeek官方API端点
   */
  private static async fetchDeepSeekModels(): Promise<ModelFetchResponse> {
    const api = getClientApi(ServiceProvider.DeepSeek);
    try {
      const models = await this.enrichModelsWithOpenRouterMetadata(
        await api.llm.models(),
      );
      return {
        models,
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        models: [],
        success: false,
        error: `DeepSeek模型列表获取失败。\n\n错误详情: ${errorMessage}\n\n如果问题持续存在，建议使用内置模型列表。`,
      };
    }
  }

  /**
   * 获取Moonshot模型（兼容OpenAI格式）
   */
  private static async fetchMoonshotModels(): Promise<ModelFetchResponse> {
    return await this.fetchOpenAICompatibleModels(ServiceProvider.Moonshot);
  }

  /**
   * 获取ByteDance模型（兼容OpenAI格式）
   */
  private static async fetchByteDanceModels(): Promise<ModelFetchResponse> {
    return await this.fetchOpenAICompatibleModels(ServiceProvider.ByteDance);
  }

  /**
   * 获取Alibaba模型（兼容OpenAI格式）
   */
  private static async fetchAlibabaModels(): Promise<ModelFetchResponse> {
    return await this.fetchOpenAICompatibleModels(ServiceProvider.Alibaba);
  }

  /**
   * 获取XAI模型（兼容OpenAI格式）
   */
  private static async fetchXAIModels(): Promise<ModelFetchResponse> {
    return await this.fetchOpenAICompatibleModels(ServiceProvider.XAI);
  }

  /**
   * 获取SiliconFlow模型（兼容OpenAI格式）
   */
  private static async fetchSiliconFlowModels(): Promise<ModelFetchResponse> {
    return await this.fetchOpenAICompatibleModels(ServiceProvider.SiliconFlow);
  }

  /**
   * 通用的OpenAI兼容格式模型获取
   */
  private static async fetchOpenAICompatibleModels(
    provider: ServiceProvider,
  ): Promise<ModelFetchResponse> {
    const api = getClientApi(provider);
    try {
      const models = await this.enrichModelsWithOpenRouterMetadata(
        await api.llm.models(),
      );
      return {
        models,
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        models: [],
        success: false,
        error: `${provider}模型列表获取失败。\n\n错误详情: ${errorMessage}\n\n如果问题持续存在，建议使用内置模型列表。`,
      };
    }
  }

  /**
   * 获取自定义服务商模型
   */
  private static async fetchCustomProviderModels(
    customProvider: any,
  ): Promise<ModelFetchResponse> {
    try {
      // 自定义服务商需携带其配置头部，强制覆盖 getHeaders 的模型配置
      const providerId = customProvider.id as string;

      if (customProvider.type === "openai") {
        let registryMap: Map<string, RegistryModelEntry> | null = null;
        try {
          registryMap = await this.fetchOpenRouterMetadataMap();
        } catch (error) {
          console.warn(
            "[ModelFetcher] openrouter registry unavailable:",
            error,
          );
        }

        const res = await fetch(`/api/openai/v1/models`, {
          method: "GET",
          headers: getHeaders(false, {
            providerName: providerId, // 关键：让 getHeaders 注入 x-custom-provider-config 与正确的鉴权头
            model: "",
          }),
        } as any);

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`HTTP ${res.status} ${res.statusText}: ${err}`);
        }

        const data = (await res.json()) as OpenAIModelResponse;
        const metadata: RuntimeModelMetadata[] = [];
        const list = (data?.data ?? []).map((m) => {
          const rawId = String(m.id);
          const simpleId = getSimpleModelId(rawId);
          const registryEntry = registryMap
            ? this.findRegistryEntry(registryMap, rawId)
            : undefined;
          const runtimeMetadata = this.toRuntimeMetadata(registryEntry);
          if (runtimeMetadata) {
            metadata.push({
              ...runtimeMetadata,
              modelId: rawId,
            });
          }

          return {
            name: rawId,
            displayName: rawId,
            available: true,
            contextTokens: registryEntry?.contextTokens,
            provider: {
              id: providerId,
              providerName: providerId,
              providerType: "openai",
              sorted: 1,
            },
            sorted: 1,
          };
        }) as LLMModel[];

        this.persistMetadata(metadata);

        return { models: list, success: true, metadata };
      }

      if (customProvider.type === "google") {
        const res = await fetch(`/api/google/v1beta/models`, {
          method: "GET",
          headers: getHeaders(false, {
            providerName: providerId,
            model: "",
          }),
        } as any);
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`HTTP ${res.status} ${res.statusText}: ${err}`);
        }
        const data = (await res.json()) as any;
        const arr: any[] = data?.models || [];
        const models: LLMModel[] = arr.map((m) => ({
          name: String(m.name).replace(/^models\//, ""),
          displayName: m.displayName,
          available: true,
          provider: {
            id: providerId,
            providerName: providerId,
            providerType: "google",
            sorted: 1,
          },
          sorted: 1,
          contextTokens: m.inputTokenLimit,
        }));
        this.persistMetadata();
        return { models, success: true };
      }

      if (customProvider.type === "anthropic") {
        // Anthropic 暂无标准的 models 列表接口；退化为默认内置列表
        const models: LLMModel[] = (DEFAULT_MODELS || [])
          .filter(
            (m: any) => m?.provider?.providerName === ServiceProvider.Anthropic,
          )
          .map((m: any) => ({
            ...m,
            provider: {
              ...(m.provider || {}),
              id: providerId,
              providerName: providerId,
              providerType: "anthropic",
            },
          }));
        this.persistMetadata();
        return { models, success: true };
      }

      return {
        models: [],
        success: false,
        error: `不支持的自定义服务商类型: ${customProvider.type}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { models: [], success: false, error: message };
    }
  }
}
