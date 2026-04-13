// 模型上下文Token数配置
// 基于各个模型提供商的官方文档和API规格整理

import { getRuntimeModelMetadata } from "./model-runtime-metadata";

export interface ModelContextConfig {
  contextTokens: number; // 上下文窗口大小（输入+输出）
  maxOutputTokens?: number; // 最大输出Token数（如果有特殊限制）
  description?: string; // 模型描述
}

// 模型上下文Token数映射
export const MODEL_CONTEXT_TOKENS: Record<string, ModelContextConfig> = {
  // OpenAI 模型
  // GPT-3.5 系列
  "gpt-3.5-turbo": { contextTokens: 16385, maxOutputTokens: 4096 },
  "gpt-3.5-turbo-1106": { contextTokens: 16385, maxOutputTokens: 4096 },
  "gpt-3.5-turbo-0125": { contextTokens: 16385, maxOutputTokens: 4096 },
  "gpt-3.5-turbo-instruct": { contextTokens: 4096, maxOutputTokens: 4096 },

  // GPT-4 系列
  "gpt-4": { contextTokens: 8192, maxOutputTokens: 4096 },
  "gpt-4-0613": { contextTokens: 8192, maxOutputTokens: 4096 },
  "gpt-4-32k": { contextTokens: 32768, maxOutputTokens: 4096 },
  "gpt-4-32k-0613": { contextTokens: 32768, maxOutputTokens: 4096 },
  "gpt-4-turbo": { contextTokens: 128000, maxOutputTokens: 4096 },
  "gpt-4-turbo-preview": { contextTokens: 128000, maxOutputTokens: 4096 },
  "gpt-4-turbo-2024-04-09": { contextTokens: 128000, maxOutputTokens: 4096 },
  "gpt-4-1106-preview": { contextTokens: 128000, maxOutputTokens: 4096 },
  "gpt-4-0125-preview": { contextTokens: 128000, maxOutputTokens: 4096 },
  "gpt-4-vision-preview": { contextTokens: 128000, maxOutputTokens: 4096 },

  // GPT-4.1 系列
  "gpt-4.1": {
    contextTokens: 1000000,
    maxOutputTokens: 16384,
    description: "1M context window",
  },
  "gpt-4.1-2025-04-14": { contextTokens: 1000000, maxOutputTokens: 16384 },
  "gpt-4.1-mini": { contextTokens: 1000000, maxOutputTokens: 16384 },
  "gpt-4.1-mini-2025-04-14": { contextTokens: 1000000, maxOutputTokens: 16384 },
  "gpt-4.1-nano": { contextTokens: 1000000, maxOutputTokens: 16384 },
  "gpt-4.1-nano-2025-04-14": { contextTokens: 1000000, maxOutputTokens: 16384 },

  // GPT-4.5 系列
  "gpt-4.5-preview": { contextTokens: 1000000, maxOutputTokens: 16384 },
  "gpt-4.5-preview-2025-02-27": {
    contextTokens: 1000000,
    maxOutputTokens: 16384,
  },

  // GPT-4o 系列
  "gpt-4o": { contextTokens: 128000, maxOutputTokens: 16384 },
  "gpt-4o-2024-05-13": { contextTokens: 128000, maxOutputTokens: 16384 },
  "gpt-4o-2024-08-06": { contextTokens: 128000, maxOutputTokens: 16384 },
  "gpt-4o-2024-11-20": { contextTokens: 128000, maxOutputTokens: 16384 },
  "gpt-4o-mini": { contextTokens: 128000, maxOutputTokens: 16384 },
  "gpt-4o-mini-2024-07-18": { contextTokens: 128000, maxOutputTokens: 16384 },
  "gpt-4o-mini-search-preview": {
    contextTokens: 128000,
    maxOutputTokens: 16384,
  },
  "chatgpt-4o-latest": { contextTokens: 128000, maxOutputTokens: 16384 },

  // GPT-5 系列
  "gpt-5": { contextTokens: 400000, maxOutputTokens: 16384 },
  "gpt-5-mini": { contextTokens: 400000, maxOutputTokens: 16384 },
  "gpt-5-nano": { contextTokens: 400000, maxOutputTokens: 16384 },
  "gpt-5-chat": { contextTokens: 400000, maxOutputTokens: 16384 },

  // 推理模型系列
  "o1-2024-12-17": {
    contextTokens: 200000,
    maxOutputTokens: 100000,
    description: "Reasoning model",
  },
  "o1-preview": {
    contextTokens: 128000,
    maxOutputTokens: 32768,
    description: "Reasoning model",
  },
  "o1-mini": {
    contextTokens: 128000,
    maxOutputTokens: 65536,
    description: "Reasoning model",
  },
  o3: {
    contextTokens: 1000000,
    maxOutputTokens: 100000,
    description: "Advanced reasoning",
  },
  "o3-mini": {
    contextTokens: 1000000,
    maxOutputTokens: 100000,
    description: "Advanced reasoning",
  },
  "o3-mini-high": {
    contextTokens: 1000000,
    maxOutputTokens: 100000,
    description: "Advanced reasoning",
  },
  "o4-mini": {
    contextTokens: 1000000,
    maxOutputTokens: 100000,
    description: "Advanced reasoning",
  },
  // 嵌入模型
  "text-embedding-3-large": {
    contextTokens: 8191,
    maxOutputTokens: 0,
    description: "Embedding model",
  },
  "text-embedding-3-small": {
    contextTokens: 8191,
    maxOutputTokens: 0,
    description: "Embedding model",
  },
  "text-embedding-ada-002": {
    contextTokens: 8191,
    maxOutputTokens: 0,
    description: "Embedding model",
  },

  // 图像生成模型
  "dall-e-3": {
    contextTokens: 4000,
    maxOutputTokens: 0,
    description: "Image generation",
  },
  "dall-e-2": {
    contextTokens: 1000,
    maxOutputTokens: 0,
    description: "Image generation",
  },
  "gpt-image-1": {
    contextTokens: 4000,
    maxOutputTokens: 0,
    description: "Image generation",
  },

  // OSS 模型系列
  "gpt-oss-120b": {
    contextTokens: 131072,
    maxOutputTokens: 131072,
    description: "OSS 120B model with reasoning and tool use capabilities",
  },
  "gpt-oss-20b": {
    contextTokens: 131072,
    maxOutputTokens: 131072,
    description: "OSS 20B model with reasoning and tool use capabilities",
  },

  // Google Gemini 模型
  // Gemini 2.5 系列
  "gemini-2.5-pro": {
    contextTokens: 1048576,
    maxOutputTokens: 65536,
    description: "Advanced reasoning model",
  },
  "gemini-2.5-flash": {
    contextTokens: 1048576,
    maxOutputTokens: 65536,
    description: "Best price-performance model",
  },
  "gemini-2.5-flash-lite": {
    contextTokens: 1048576,
    maxOutputTokens: 65536,
    description: "Cost-efficient model",
  },
  "gemini-2.5-flash-preview-05-20": {
    contextTokens: 1048576,
    maxOutputTokens: 65536,
  },
  "gemini-2.5-flash-lite-06-17": {
    contextTokens: 1048576,
    maxOutputTokens: 65536,
  },
  "gemini-live-2.5-flash-preview": {
    contextTokens: 1048576,
    maxOutputTokens: 8192,
    description: "Live API model",
  },
  "gemini-2.5-flash-preview-native-audio-dialog": {
    contextTokens: 128000,
    maxOutputTokens: 8000,
    description: "Native audio dialog",
  },
  "gemini-2.5-flash-exp-native-audio-thinking-dialog": {
    contextTokens: 128000,
    maxOutputTokens: 8000,
    description: "Native audio with thinking",
  },
  "gemini-2.5-flash-preview-tts": {
    contextTokens: 8000,
    maxOutputTokens: 16000,
    description: "Text-to-speech model",
  },
  "gemini-2.5-pro-preview-tts": {
    contextTokens: 8000,
    maxOutputTokens: 16000,
    description: "Pro text-to-speech model",
  },

  // Gemini 2.0 系列
  "gemini-2.0-flash": { contextTokens: 1048576, maxOutputTokens: 8192 },
  "gemini-2.0-flash-001": { contextTokens: 1048576, maxOutputTokens: 8192 },
  "gemini-2.0-flash-exp": { contextTokens: 1048576, maxOutputTokens: 8192 },
  "gemini-2.0-flash-thinking-exp": {
    contextTokens: 1048576,
    maxOutputTokens: 8192,
    description: "With thinking",
  },
  "gemini-2.0-flash-lite": { contextTokens: 1048576, maxOutputTokens: 8192 },
  "gemini-2.0-flash-lite-001": {
    contextTokens: 1048576,
    maxOutputTokens: 8192,
  },
  "gemini-2.0-flash-live-001": {
    contextTokens: 1048576,
    maxOutputTokens: 8192,
    description: "Live API model",
  },
  "gemini-2.0-flash-preview-image-generation": {
    contextTokens: 32000,
    maxOutputTokens: 8192,
    description: "Image generation",
  },

  // Gemini 1.5 系列
  "gemini-1.5-pro": {
    contextTokens: 2000000,
    maxOutputTokens: 8192,
    description: "2M context window",
  },
  "gemini-1.5-pro-002": { contextTokens: 2000000, maxOutputTokens: 8192 },
  "gemini-1.5-pro-001": { contextTokens: 1000000, maxOutputTokens: 8192 },
  "gemini-1.5-pro-exp-0827": { contextTokens: 2000000, maxOutputTokens: 8192 },
  "gemini-1.5-flash": { contextTokens: 1000000, maxOutputTokens: 8192 },
  "gemini-1.5-flash-002": { contextTokens: 1000000, maxOutputTokens: 8192 },
  "gemini-1.5-flash-001": { contextTokens: 1000000, maxOutputTokens: 8192 },
  "gemini-1.5-flash-8b": { contextTokens: 1000000, maxOutputTokens: 8192 },

  // Gemini Pro 系列
  "gemini-pro": { contextTokens: 32768, maxOutputTokens: 8192 },

  // Gemma 系列
  "gemma-2-27b-it": { contextTokens: 8192, maxOutputTokens: 8192 },
  "gemma-2-9b-it": { contextTokens: 8192, maxOutputTokens: 8192 },
  "gemma-3-27b": { contextTokens: 8192, maxOutputTokens: 8192 },

  // Anthropic Claude 模型
  // Claude 4.1 系列
  "claude-opus-4-1-20250805": {
    contextTokens: 200000,
    maxOutputTokens: 8192,
    description: "Latest Claude 4.1",
  },

  // Claude 4 系列
  "claude-sonnet-4-20250514": {
    contextTokens: 200000,
    maxOutputTokens: 8192,
    description: "Latest Claude 4",
  },

  // Claude 3.5 系列
  "claude-3-5-sonnet-20241022": {
    contextTokens: 200000,
    maxOutputTokens: 8192,
  },
  "claude-3-5-sonnet-20240620": {
    contextTokens: 200000,
    maxOutputTokens: 8192,
  },
  "claude-3-5-haiku-20241022": { contextTokens: 200000, maxOutputTokens: 8192 },

  // Claude 3 系列
  "claude-3-opus-20240229": { contextTokens: 200000, maxOutputTokens: 4096 },
  "claude-3-sonnet-20240229": { contextTokens: 200000, maxOutputTokens: 4096 },
  "claude-3-haiku-20240307": { contextTokens: 200000, maxOutputTokens: 4096 },

  // 字节跳动 Doubao 模型
  "doubao-pro-4k": { contextTokens: 4096, maxOutputTokens: 4096 },
  "doubao-pro-32k": { contextTokens: 32768, maxOutputTokens: 4096 },
  "doubao-pro-128k": { contextTokens: 128000, maxOutputTokens: 4096 },
  "doubao-pro-256k": { contextTokens: 256000, maxOutputTokens: 4096 },
  "doubao-lite-4k": { contextTokens: 4096, maxOutputTokens: 4096 },
  "doubao-lite-32k": { contextTokens: 32768, maxOutputTokens: 4096 },
  "doubao-lite-128k": { contextTokens: 128000, maxOutputTokens: 4096 },

  // 阿里巴巴 Qwen 模型
  // Qwen3 系列
  "qwen3-72b": { contextTokens: 128000, maxOutputTokens: 8192 },
  "qwen3-14b": { contextTokens: 128000, maxOutputTokens: 8192 },
  "qwen3-7b": { contextTokens: 128000, maxOutputTokens: 8192 },
  "qwen3-1.8b": { contextTokens: 128000, maxOutputTokens: 8192 },
  "qwen3-0.5b": { contextTokens: 128000, maxOutputTokens: 8192 },

  // Qwen2.5 系列
  "qwen2.5-72b-instruct": { contextTokens: 131072, maxOutputTokens: 8192 },
  "qwen2.5-32b-instruct": { contextTokens: 131072, maxOutputTokens: 8192 },
  "qwen2.5-14b-instruct": { contextTokens: 131072, maxOutputTokens: 8192 },
  "qwen2.5-7b-instruct": { contextTokens: 131072, maxOutputTokens: 8192 },
  "qwen2.5-3b-instruct": { contextTokens: 131072, maxOutputTokens: 8192 },
  "qwen2.5-1.5b-instruct": { contextTokens: 131072, maxOutputTokens: 8192 },
  "qwen2.5-0.5b-instruct": { contextTokens: 131072, maxOutputTokens: 8192 },

  // Qwen2.5-Coder 系列
  "qwen2.5-coder-32b-instruct": {
    contextTokens: 131072,
    maxOutputTokens: 8192,
  },
  "qwen2.5-coder-14b-instruct": {
    contextTokens: 131072,
    maxOutputTokens: 8192,
  },
  "qwen2.5-coder-7b-instruct": { contextTokens: 131072, maxOutputTokens: 8192 },
  "qwen2.5-coder-3b-instruct": { contextTokens: 131072, maxOutputTokens: 8192 },
  "qwen2.5-coder-1.5b-instruct": {
    contextTokens: 131072,
    maxOutputTokens: 8192,
  },
  "qwen2.5-coder-0.5b-instruct": {
    contextTokens: 131072,
    maxOutputTokens: 8192,
  },

  // Qwen2.5-Math 系列
  "qwen2.5-math-72b-instruct": { contextTokens: 131072, maxOutputTokens: 8192 },
  "qwen2.5-math-7b-instruct": { contextTokens: 131072, maxOutputTokens: 8192 },
  "qwen2.5-math-1.5b-instruct": {
    contextTokens: 131072,
    maxOutputTokens: 8192,
  },

  // QwQ 推理模型
  "qwq-32b": {
    contextTokens: 32768,
    maxOutputTokens: 32768,
    description: "Reasoning model",
  },
  "qvq-32b": {
    contextTokens: 32768,
    maxOutputTokens: 32768,
    description: "Vision reasoning model",
  },

  // 服务版本 (DashScope)
  "qwen-max": { contextTokens: 30000, maxOutputTokens: 8000 },
  "qwen-plus": { contextTokens: 30000, maxOutputTokens: 8000 },
  "qwen-turbo": { contextTokens: 30000, maxOutputTokens: 8000 },
  "qwen-coder-plus": { contextTokens: 30000, maxOutputTokens: 8000 },
  "qwen3-coder-plus": { contextTokens: 128000, maxOutputTokens: 8192 },

  // 嵌入模型
  "text-embedding-v2": {
    contextTokens: 8192,
    maxOutputTokens: 0,
    description: "Embedding model",
  },
  "qwen3-embedding-8b": {
    contextTokens: 8192,
    maxOutputTokens: 0,
    description: "Embedding model",
  },
  "qwen3-reranker-8b": {
    contextTokens: 8192,
    maxOutputTokens: 0,
    description: "Reranker model",
  },

  // Moonshot Kimi 模型
  "kimi-k2": {
    contextTokens: 200000,
    maxOutputTokens: 4096,
    description: "Kimi K2 with web search",
  },
  "kimi-latest": {
    contextTokens: 200000,
    maxOutputTokens: 4096,
    description: "Latest Kimi model",
  },
  "kimi-thinking-preview": {
    contextTokens: 200000,
    maxOutputTokens: 4096,
    description: "Thinking model",
  },
  "moonshot-v1-auto": { contextTokens: 200000, maxOutputTokens: 4096 },

  // DeepSeek 模型
  "deepseek-chat": { contextTokens: 64000, maxOutputTokens: 4096 },
  "deepseek-reasoner": {
    contextTokens: 64000,
    maxOutputTokens: 8192,
    description: "Reasoning model",
  },

  // XAI Grok 模型
  // Grok 3 系列
  "grok-3": {
    contextTokens: 128000,
    maxOutputTokens: 4096,
    description: "With web search",
  },
  "grok-3-fast": {
    contextTokens: 128000,
    maxOutputTokens: 4096,
    description: "Fast variant",
  },
  "grok-3-mini": {
    contextTokens: 128000,
    maxOutputTokens: 4096,
    description: "Mini variant",
  },
  "grok-3-mini-fast": {
    contextTokens: 128000,
    maxOutputTokens: 4096,
    description: "Fast mini variant",
  },

  // Grok 2 系列
  "grok-2-vision-1212": {
    contextTokens: 128000,
    maxOutputTokens: 4096,
    description: "With vision",
  },
  "grok-2-1212": { contextTokens: 128000, maxOutputTokens: 4096 },
  "grok-vision-beta": {
    contextTokens: 128000,
    maxOutputTokens: 4096,
    description: "Vision beta",
  },

  // SiliconFlow 模型
  "deepseek-ai/DeepSeek-R1": {
    contextTokens: 64000,
    maxOutputTokens: 8192,
    description: "Reasoning model",
  },
  "deepseek-ai/DeepSeek-V3": { contextTokens: 64000, maxOutputTokens: 4096 },
  "Qwen/Qwen2.5-7B-Instruct": { contextTokens: 131072, maxOutputTokens: 8192 },
  "Qwen/Qwen3-8B": { contextTokens: 128000, maxOutputTokens: 8192 },
  "BAAI/bge-m3": {
    contextTokens: 8192,
    maxOutputTokens: 0,
    description: "Embedding model",
  },
  "Kwai-Kolors/Kolors": {
    contextTokens: 4000,
    maxOutputTokens: 0,
    description: "Image generation",
  },
};

// 获取模型上下文Token数的函数
export function getModelContextTokens(
  modelName: string,
): ModelContextConfig | null {
  if (typeof window !== "undefined") {
    try {
      const metadata = getRuntimeModelMetadata(modelName);
      if (
        typeof metadata?.contextTokens === "number" &&
        metadata.contextTokens > 0
      ) {
        return {
          contextTokens: metadata.contextTokens,
          maxOutputTokens: metadata.maxOutputTokens,
        };
      }
    } catch (e) {
      console.warn(
        `Failed to read runtime context tokens for ${modelName}:`,
        e,
      );
    }
  }

  // 检查是否在浏览器环境中
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    // 首先检查是否有自定义配置
    const customKey = `model_context_tokens_${modelName}`;
    const customConfig = localStorage.getItem(customKey);
    if (customConfig) {
      try {
        const parsed = JSON.parse(customConfig);
        if (typeof parsed === "number") {
          // 兼容旧格式，只有contextTokens
          return { contextTokens: parsed };
        } else if (parsed && typeof parsed.contextTokens === "number") {
          // 新格式，包含完整配置
          return parsed;
        }
      } catch (e) {
        console.warn(
          `Failed to parse custom context tokens for ${modelName}:`,
          e,
        );
      }
    }
  }

  // 返回默认配置
  return MODEL_CONTEXT_TOKENS[modelName] || null;
}

export function getModelContextTokensFromModels(
  modelName: string,
  models?: Array<{
    name: string;
    contextTokens?: number;
  }>,
): ModelContextConfig | null {
  const exactModel = models?.find((model) => model.name === modelName);
  if (
    typeof exactModel?.contextTokens === "number" &&
    exactModel.contextTokens > 0
  ) {
    return { contextTokens: exactModel.contextTokens };
  }

  const normalizedTarget = modelName.toLowerCase();
  const fuzzyModel = models?.find((model) => {
    const normalizedName = model.name.toLowerCase();
    return (
      normalizedName === normalizedTarget ||
      normalizedName.startsWith(`${normalizedTarget}-`) ||
      normalizedTarget.startsWith(`${normalizedName}-`)
    );
  });
  if (
    typeof fuzzyModel?.contextTokens === "number" &&
    fuzzyModel.contextTokens > 0
  ) {
    return { contextTokens: fuzzyModel.contextTokens };
  }

  return getModelContextTokens(modelName);
}

// 保存自定义上下文Token数配置
export function saveCustomContextTokens(
  modelName: string,
  contextTokens: number,
): void {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    const customKey = `model_context_tokens_${modelName}`;
    const config: ModelContextConfig = { contextTokens };
    localStorage.setItem(customKey, JSON.stringify(config));
  }
}

// 删除自定义上下文Token数配置
export function removeCustomContextTokens(modelName: string): void {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    const customKey = `model_context_tokens_${modelName}`;
    localStorage.removeItem(customKey);
  }
}

// 格式化Token数显示
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}K`;
  }
  return tokens.toString();
}

/**
 * 根据模型的上下文Token数自动计算压缩阈值
 * @param modelName 模型名称
 * @returns 压缩阈值（Token数）
 */
export function getModelCompressThreshold(modelName: string): number {
  const DEFAULT_THRESHOLD = 128000; // 默认128K Token

  const contextConfig = getModelContextTokens(modelName);
  if (!contextConfig?.contextTokens) {
    return DEFAULT_THRESHOLD;
  }

  // 直接使用Token数作为压缩阈值，不进行字符转换
  return contextConfig.contextTokens;
}
