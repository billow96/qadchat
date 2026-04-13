import React from "react";
import { ServiceProvider } from "../constant";
import {
  OpenAI,
  DeepSeek,
  SiliconCloud,
  Grok,
  Claude,
  Gemini,
  Kimi,
  Qwen,
  Wenxin,
  Doubao,
  Meta,
  Ollama,
} from "@lobehub/icons";

// 导入项目自带的 SVG 图标
import BotIconDefault from "../icons/llm-icons/default.svg";
import BotIconOpenAI from "../icons/llm-icons/openai.svg";
import BotIconGemini from "../icons/llm-icons/gemini.svg";
import BotIconGemma from "../icons/llm-icons/gemma.svg";
import BotIconClaude from "../icons/llm-icons/claude.svg";
import BotIconMeta from "../icons/llm-icons/meta.svg";
import BotIconMistral from "../icons/llm-icons/mistral.svg";
import BotIconDeepseek from "../icons/llm-icons/deepseek.svg";
import BotIconMoonshot from "../icons/llm-icons/moonshot.svg";
import BotIconQwen from "../icons/llm-icons/qwen.svg";
import BotIconGrok from "../icons/llm-icons/grok.svg";
import BotIconDoubao from "../icons/llm-icons/doubao.svg";
import BotIconMinimax from "../icons/llm-icons/minimax.svg";
import BotIconZAI from "../icons/llm-icons/zai.svg";
import { getModelIdentityParts } from "../utils/model-identity";

const MONO_ICON_STYLE: React.CSSProperties = {
  color: "#111111",
};

function renderOpenAIAvatar(size: number) {
  return (
    <OpenAI.Avatar
      size={size}
      style={{
        background: "#000000",
        color: "#ffffff",
      }}
    />
  );
}

function renderMonochromeIcon(
  IconComponent: React.ComponentType<{ width?: number; height?: number }>,
  size: number,
) {
  return (
    <div
      className="no-dark"
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#111111",
        lineHeight: 0,
        flexShrink: 0,
      }}
    >
      <IconComponent width={size} height={size} />
    </div>
  );
}

export function resolveProviderForModel(
  provider: ServiceProvider | string,
  customProviderType?: string,
): ServiceProvider {
  if (typeof provider === "string" && provider.startsWith("custom_")) {
    switch (customProviderType) {
      case "openai":
        return ServiceProvider.OpenAI;
      case "google":
        return ServiceProvider.Google;
      case "anthropic":
        return ServiceProvider.Anthropic;
      default:
        return ServiceProvider.OpenAI;
    }
  }

  return provider as ServiceProvider;
}

function getModelMatchName(modelName?: string) {
  const parts = getModelIdentityParts(modelName || "");
  const lowerModelName = parts.raw.toLowerCase();
  const rightPart = parts.simple.toLowerCase();

  return {
    full: lowerModelName,
    match: rightPart,
  };
}

// 根据模型名称判断应该使用的图标类型
function getModelIconType(
  provider: ServiceProvider,
  modelName?: string,
):
  | "gpt3"
  | "gpt4"
  | "o1"
  | "claude"
  | "gemini"
  | "kimi"
  | "qwen"
  | "wenxin"
  | "doubao"
  | "minimax"
  | "zai"
  | "llama"
  | "deepseek"
  | "default" {
  if (!modelName) return "default";

  const { full: lowerModelName, match: matchedModelName } =
    getModelMatchName(modelName);

  // 跨服务商模型识别 - 优先级最高（SiliconFlow等聚合服务）
  if (matchedModelName.includes("llama") || lowerModelName.includes("llama"))
    return "llama";
  if (
    matchedModelName.includes("deepseek") ||
    lowerModelName.includes("deepseek")
  )
    return "deepseek";
  if (
    matchedModelName.includes("qwen") ||
    matchedModelName.includes("qwq") ||
    matchedModelName.includes("qvq") ||
    lowerModelName.includes("qwen") ||
    lowerModelName.includes("qwq") ||
    lowerModelName.includes("qvq")
  )
    return "qwen";
  if (matchedModelName.includes("glm") || lowerModelName.includes("glm"))
    return "zai";
  if (
    matchedModelName.includes("z.ai") ||
    matchedModelName.includes("zai") ||
    lowerModelName.includes("z.ai") ||
    lowerModelName.includes("zai")
  )
    return "zai";
  if (
    matchedModelName.includes("minimax") ||
    lowerModelName.includes("minimax")
  )
    return "minimax";
  if (matchedModelName.includes("claude")) return "claude";
  if (matchedModelName.includes("gemini")) return "gemini";
  if (
    matchedModelName.includes("gpt-4") ||
    matchedModelName.includes("chatgpt-4o") ||
    lowerModelName.includes("gpt-4") ||
    lowerModelName.includes("chatgpt-4o")
  )
    return "gpt4";
  if (matchedModelName.includes("gpt-3") || lowerModelName.includes("gpt-3"))
    return "gpt3";
  if (
    matchedModelName.includes("o1") ||
    matchedModelName.includes("o3") ||
    matchedModelName.includes("o4") ||
    lowerModelName.includes("o1") ||
    lowerModelName.includes("o3") ||
    lowerModelName.includes("o4")
  )
    return "o1";
  // 嵌入模型的特殊处理 - 根据具体模型名称识别提供商
  if (lowerModelName.includes("embedding")) {
    // 豆包嵌入模型
    if (lowerModelName.includes("doubao")) return "doubao";
    // 阿里云Qwen嵌入模型
    if (
      lowerModelName.includes("qwen") ||
      lowerModelName.includes("text-embedding-v2")
    )
      return "qwen";
    // SiliconFlow平台的嵌入模型
    if (lowerModelName.includes("baai") || lowerModelName.includes("bge"))
      return "default";
    // OpenAI嵌入模型（默认）
    if (
      lowerModelName.includes("text-embedding") ||
      lowerModelName.includes("ada")
    )
      return "gpt4";
    // 其他嵌入模型使用默认图标
    return "default";
  }
  if (
    matchedModelName.includes("doubao") ||
    lowerModelName.includes("doubao") ||
    lowerModelName.includes("豆包")
  )
    return "doubao";
  if (
    matchedModelName.includes("kimi") ||
    lowerModelName.includes("kimi") ||
    lowerModelName.includes("moonshot")
  )
    return "kimi";
  if (lowerModelName.includes("wenxin") || lowerModelName.includes("文心"))
    return "wenxin";
  if (matchedModelName.includes("grok") || lowerModelName.includes("grok"))
    return "default";

  // 服务商特定模型判断 - 作为后备
  if (provider === ServiceProvider.OpenAI) {
    if (
      lowerModelName.includes("o1") ||
      lowerModelName.includes("o3") ||
      lowerModelName.includes("o4")
    )
      return "o1";
    if (
      lowerModelName.includes("gpt-4") ||
      lowerModelName.includes("chatgpt-4o")
    )
      return "gpt4";
    if (lowerModelName.includes("gpt-3")) return "gpt3";
    if (
      lowerModelName.includes("text-embedding") ||
      lowerModelName.includes("embedding")
    )
      return "gpt4"; // 嵌入模型使用GPT-4图标
  }

  if (provider === ServiceProvider.Anthropic) {
    return "claude"; // Anthropic 主要提供 Claude 模型
  }

  if (provider === ServiceProvider.Google) {
    return "gemini"; // Google 主要提供 Gemini 模型
  }

  if (provider === ServiceProvider.Moonshot) {
    return "kimi"; // 月之暗面主要提供 Kimi 模型
  }

  if (provider === ServiceProvider.Alibaba) {
    return "qwen"; // 阿里云主要提供 Qwen 模型
  }

  if (provider === ServiceProvider.ByteDance) {
    return "doubao"; // 字节跳动主要提供豆包模型
  }

  if (provider === ServiceProvider.DeepSeek) {
    return "deepseek"; // DeepSeek 主要提供 DeepSeek 模型
  }

  return "default";
}

interface ProviderIconProps {
  provider: ServiceProvider | string; // 支持自定义服务商ID
  size?: number;
  modelName?: string; // 新增：模型名称，用于显示具体模型的图标
  customProviderType?: string; // 新增：自定义服务商的兼容类型
}

export function ProviderIcon({
  provider,
  size = 24,
  modelName,
  customProviderType,
}: ProviderIconProps) {
  const iconProps = { size };

  // 如果是自定义服务商，根据兼容类型确定实际的服务商类型
  const actualProvider = resolveProviderForModel(provider, customProviderType);

  const iconType = getModelIconType(actualProvider, modelName);

  // 根据模型类型显示相应的图标
  switch (iconType) {
    case "gpt3":
      return renderOpenAIAvatar(size);

    case "gpt4":
      return renderOpenAIAvatar(size);

    case "o1":
      return renderOpenAIAvatar(size);

    case "claude":
      return <Claude.Color {...iconProps} />;

    case "gemini":
      return <Gemini.Color {...iconProps} />;

    case "kimi":
      return <Kimi.Color {...iconProps} />;

    case "qwen":
      return <Qwen.Color {...iconProps} />;

    case "wenxin":
      return <Wenxin.Color {...iconProps} />;

    case "doubao":
      return <Doubao.Color {...iconProps} />;

    case "minimax":
      return renderMonochromeIcon(BotIconMinimax, size);

    case "zai":
      return renderMonochromeIcon(BotIconZAI, size);

    case "llama":
      return <Meta.Color {...iconProps} />;

    case "deepseek":
      return <DeepSeek.Color {...iconProps} />;

    default:
      // 如果没有具体模型信息，则根据服务商显示图标
      switch (actualProvider) {
        case ServiceProvider.OpenAI:
          return renderOpenAIAvatar(size);

        case ServiceProvider.Google:
          // Google 主要提供 Gemini 模型，显示 Gemini 彩色图标
          return <Gemini.Color {...iconProps} />;

        case ServiceProvider.Anthropic:
          // Anthropic 主要提供 Claude 模型，显示 Claude 彩色图标
          return <Claude.Color {...iconProps} />;

        case ServiceProvider.ByteDance:
          // 字节跳动主要提供豆包模型，显示豆包彩色图标
          return <Doubao.Color {...iconProps} />;

        case ServiceProvider.Alibaba:
          // 阿里云主要提供 Qwen 模型，显示 Qwen 彩色图标
          return <Qwen.Color {...iconProps} />;

        case ServiceProvider.Moonshot:
          // 月之暗面主要提供 Kimi 模型，显示 Kimi 彩色图标
          return <Kimi.Color {...iconProps} />;

        case ServiceProvider.DeepSeek:
          // DeepSeek 主要提供 DeepSeek 模型，显示 DeepSeek 彩色图标
          return <DeepSeek.Color {...iconProps} />;

        case ServiceProvider.XAI:
          return <Grok {...iconProps} style={MONO_ICON_STYLE} />;

        case ServiceProvider.SiliconFlow:
          // SiliconFlow 是聚合服务，显示 SiliconCloud 彩色图标
          return <SiliconCloud.Color {...iconProps} />;

        default:
          return renderOpenAIAvatar(size);
      }
  }
}

// 使用项目自带 SVG 图标的 Avatar 组件（用于模型管理器）
function ModelAvatar({
  modelName,
  size = 32,
}: {
  modelName?: string;
  size?: number;
}) {
  let LlmIcon = BotIconDefault;
  let useOpenAIAvatar = false;

  if (modelName) {
    const { full: lowerModelName, match: matchedModelName } =
      getModelMatchName(modelName);

    // 嵌入模型的特殊处理
    if (lowerModelName.includes("embedding")) {
      // 豆包嵌入模型
      if (lowerModelName.includes("doubao")) {
        LlmIcon = BotIconDoubao;
      }
      // 阿里云Qwen嵌入模型
      else if (
        lowerModelName.includes("qwen") ||
        lowerModelName.includes("text-embedding-v2")
      ) {
        LlmIcon = BotIconQwen;
      }
      // SiliconFlow平台的嵌入模型
      else if (
        lowerModelName.includes("baai") ||
        lowerModelName.includes("bge")
      ) {
        LlmIcon = BotIconDefault; // 使用默认图标
      }
      // OpenAI嵌入模型
      else if (
        lowerModelName.includes("text-embedding") ||
        lowerModelName.includes("ada")
      ) {
        LlmIcon = BotIconOpenAI;
        useOpenAIAvatar = true;
      }
      // 其他嵌入模型使用默认图标
      else {
        LlmIcon = BotIconDefault;
      }
    }
    // 其他模型的识别逻辑
    else if (
      matchedModelName.startsWith("gpt") ||
      matchedModelName.startsWith("chatgpt") ||
      matchedModelName.startsWith("dall-e") ||
      matchedModelName.startsWith("dalle") ||
      matchedModelName.startsWith("o1") ||
      matchedModelName.startsWith("o3") ||
      matchedModelName.startsWith("o4")
    ) {
      LlmIcon = BotIconOpenAI;
      useOpenAIAvatar = true;
    } else if (matchedModelName.startsWith("gemini")) {
      LlmIcon = BotIconGemini;
    } else if (matchedModelName.startsWith("gemma")) {
      LlmIcon = BotIconGemma;
    } else if (matchedModelName.startsWith("claude")) {
      LlmIcon = BotIconClaude;
    } else if (
      matchedModelName.includes("minimax") ||
      lowerModelName.includes("minimax")
    ) {
      LlmIcon = BotIconMinimax;
    } else if (
      matchedModelName.includes("glm") ||
      matchedModelName.includes("z.ai") ||
      matchedModelName.includes("zai") ||
      lowerModelName.includes("glm")
    ) {
      LlmIcon = BotIconZAI;
    } else if (
      matchedModelName.includes("llama") ||
      lowerModelName.includes("llama")
    ) {
      LlmIcon = BotIconMeta;
    } else if (
      matchedModelName.startsWith("mixtral") ||
      matchedModelName.startsWith("codestral")
    ) {
      LlmIcon = BotIconMistral;
    } else if (
      matchedModelName.includes("deepseek") ||
      lowerModelName.includes("deepseek")
    ) {
      LlmIcon = BotIconDeepseek;
    } else if (
      matchedModelName.startsWith("moonshot") ||
      matchedModelName.startsWith("kimi") ||
      lowerModelName.includes("moonshotai/")
    ) {
      LlmIcon = BotIconMoonshot;
    } else if (
      matchedModelName.startsWith("qwen") ||
      matchedModelName.startsWith("qwq") ||
      matchedModelName.startsWith("qvq")
    ) {
      LlmIcon = BotIconQwen;
    } else if (matchedModelName.startsWith("grok")) {
      LlmIcon = BotIconGrok;
    } else if (
      matchedModelName.startsWith("doubao") ||
      matchedModelName.startsWith("ep-")
    ) {
      LlmIcon = BotIconDoubao;
    }
  }

  if (useOpenAIAvatar) {
    return renderOpenAIAvatar(size);
  }

  return (
    <div
      className="no-dark"
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 0,
        flexShrink: 0,
      }}
    >
      <LlmIcon width={size} height={size} />
    </div>
  );
}

// 为模型管理页面提供更大的图标，支持传入模型名称
export function ModelProviderIcon({
  provider,
  size = 32,
  modelName,
}: {
  provider: ServiceProvider | string; // 支持自定义服务商
  size?: number;
  modelName?: string;
}) {
  // 使用项目自带的 SVG 图标
  return <ModelAvatar modelName={modelName} size={size} />;
}
