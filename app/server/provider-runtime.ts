import { ApiPath, type ModelProvider, ServiceProvider } from "../constant";
import {
  type AccessGroupDefinition,
  type ProviderKey,
  getProviderRuntimeConfig,
} from "./access-groups";

export type ProviderRuntimeConfig = {
  providerKey: ProviderKey;
  serviceProvider: ServiceProvider;
  apiPath: string;
  apiKey: string;
  baseUrl: string;
};

const MODEL_PROVIDER_TO_KEY: Record<ModelProvider, ProviderKey> = {
  GPT: "openai",
  GeminiPro: "google",
  Claude: "anthropic",
  Doubao: "bytedance",
  Qwen: "alibaba",
  Moonshot: "moonshot",
  XAI: "xai",
  DeepSeek: "deepseek",
  SiliconFlow: "siliconflow",
};

const PROVIDER_KEY_TO_SERVICE: Record<ProviderKey, ServiceProvider> = {
  openai: ServiceProvider.OpenAI,
  google: ServiceProvider.Google,
  anthropic: ServiceProvider.Anthropic,
  bytedance: ServiceProvider.ByteDance,
  alibaba: ServiceProvider.Alibaba,
  moonshot: ServiceProvider.Moonshot,
  deepseek: ServiceProvider.DeepSeek,
  xai: ServiceProvider.XAI,
  siliconflow: ServiceProvider.SiliconFlow,
};

const PROVIDER_KEY_TO_API_PATH: Record<ProviderKey, string> = {
  openai: ApiPath.OpenAI,
  google: ApiPath.Google,
  anthropic: ApiPath.Anthropic,
  bytedance: ApiPath.ByteDance,
  alibaba: ApiPath.Alibaba,
  moonshot: ApiPath.Moonshot,
  deepseek: ApiPath.DeepSeek,
  xai: ApiPath.XAI,
  siliconflow: ApiPath.SiliconFlow,
};

export function getProviderKeyFromModelProvider(modelProvider: ModelProvider) {
  return MODEL_PROVIDER_TO_KEY[modelProvider];
}

export function getProviderRuntimeByModelProvider(
  group: AccessGroupDefinition,
  modelProvider: ModelProvider,
): ProviderRuntimeConfig | null {
  const providerKey = getProviderKeyFromModelProvider(modelProvider);
  const config = getProviderRuntimeConfig(group, providerKey);
  if (!config?.apiKey) return null;

  return {
    providerKey,
    serviceProvider: PROVIDER_KEY_TO_SERVICE[providerKey],
    apiPath: PROVIDER_KEY_TO_API_PATH[providerKey],
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  };
}
