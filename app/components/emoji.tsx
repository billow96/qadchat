import EmojiPicker, {
  Emoji,
  EmojiStyle,
  Theme as EmojiTheme,
} from "emoji-picker-react";

import { ModelType } from "../store";
import { ServiceProvider } from "../constant";
import { ProviderIcon } from "./provider-icon";

export function getEmojiUrl(unified: string, style: EmojiStyle) {
  // Whoever owns this Content Delivery Network (CDN), I am using your CDN to serve emojis
  // Old CDN broken, so I had to switch to this one
  // Author: https://github.com/H0llyW00dzZ
  return `https://fastly.jsdelivr.net/npm/emoji-datasource-apple/img/${style}/64/${unified}.png`;
}

export function AvatarPicker(props: {
  onEmojiClick: (emojiId: string) => void;
}) {
  return (
    <EmojiPicker
      width={"100%"}
      lazyLoadEmojis
      theme={EmojiTheme.AUTO}
      getEmojiUrl={getEmojiUrl}
      onEmojiClick={(e) => {
        props.onEmojiClick(e.unified);
      }}
    />
  );
}

function inferProviderFromModel(model?: string): ServiceProvider {
  const modelName = model?.toLowerCase() || "";
  const matchedModelName = modelName.includes("/")
    ? modelName.split("/").pop() || modelName
    : modelName;

  if (
    matchedModelName.startsWith("gpt") ||
    matchedModelName.startsWith("chatgpt") ||
    matchedModelName.startsWith("dall-e") ||
    matchedModelName.startsWith("dalle") ||
    matchedModelName.startsWith("o1") ||
    matchedModelName.startsWith("o3") ||
    matchedModelName.startsWith("o4") ||
    modelName.includes("text-embedding") ||
    modelName.includes("ada")
  ) {
    return ServiceProvider.OpenAI;
  }
  if (
    matchedModelName.startsWith("gemini") ||
    matchedModelName.startsWith("gemma")
  ) {
    return ServiceProvider.Google;
  }
  if (matchedModelName.startsWith("claude")) {
    return ServiceProvider.Anthropic;
  }
  if (modelName.includes("deepseek")) {
    return ServiceProvider.DeepSeek;
  }
  if (
    matchedModelName.startsWith("moonshot") ||
    matchedModelName.startsWith("kimi") ||
    modelName.includes("moonshotai/")
  ) {
    return ServiceProvider.Moonshot;
  }
  if (
    matchedModelName.startsWith("qwen") ||
    matchedModelName.startsWith("qwq") ||
    matchedModelName.startsWith("qvq")
  ) {
    return ServiceProvider.Alibaba;
  }
  if (matchedModelName.startsWith("grok")) {
    return ServiceProvider.XAI;
  }
  if (
    matchedModelName.startsWith("doubao") ||
    matchedModelName.startsWith("ep-")
  ) {
    return ServiceProvider.ByteDance;
  }
  if (modelName.includes("llama")) {
    return ServiceProvider.SiliconFlow;
  }

  return ServiceProvider.OpenAI;
}

export function Avatar(props: {
  model?: ModelType | string;
  avatar?: string;
  provider?: ServiceProvider | string;
  customProviderType?: string;
  size?: number;
}) {
  const size = props.size ?? 30;
  const iconSize = Math.max(16, size - 8);

  if (props.model || props.provider) {
    return (
      <div
        className="user-avatar no-dark"
        style={{ width: size, minWidth: size, height: size, minHeight: size }}
      >
        <ProviderIcon
          provider={
            props.provider || inferProviderFromModel(String(props.model || ""))
          }
          customProviderType={props.customProviderType}
          modelName={props.model ? String(props.model) : undefined}
          size={iconSize}
        />
      </div>
    );
  }

  return (
    <div
      className="user-avatar"
      style={{ width: size, minWidth: size, height: size, minHeight: size }}
    >
      {props.avatar && <EmojiAvatar avatar={props.avatar} size={size - 12} />}
    </div>
  );
}

export function EmojiAvatar(props: { avatar: string; size?: number }) {
  return (
    <Emoji
      unified={props.avatar}
      size={props.size ?? 18}
      getEmojiUrl={getEmojiUrl}
    />
  );
}
