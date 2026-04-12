import { useDebouncedCallback } from "use-debounce";
import React, {
  Fragment,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Image from "next/image";

import SendWhiteIcon from "../icons/send-white.svg";
import BrainIcon from "../icons/brain.svg";
import RenameIcon from "../icons/rename.svg";
import EditIcon from "../icons/rename.svg";
import ExportIcon from "../icons/share.svg";
import ReturnIcon from "../icons/return.svg";
import CopyIcon from "../icons/copy.svg";
import SpeakIcon from "../icons/speak.svg";
import SpeakStopIcon from "../icons/speak-stop.svg";
import LoadingIcon from "../icons/three-dots.svg";
import LoadingButtonIcon from "../icons/loading.svg";
import PromptIcon from "../icons/prompt.svg";
import MaxIcon from "../icons/max.svg";
import MinIcon from "../icons/min.svg";
import ResetIcon from "../icons/reload.svg";
import ReloadIcon from "../icons/reload.svg";
import LeftIcon from "../icons/left.svg";
import RightIcon from "../icons/right.svg";
import BreakIcon from "../icons/break.svg";
import DeleteIcon from "../icons/clear.svg";
import PinIcon from "../icons/pin.svg";
import ConfirmIcon from "../icons/confirm.svg";
import CloseIcon from "../icons/close.svg";
import CancelIcon from "../icons/cancel.svg";
import ImageIcon from "../icons/image.svg";

import LightIcon from "../icons/light.svg";
import DarkIcon from "../icons/dark.svg";
import AutoIcon from "../icons/auto.svg";
import BottomIcon from "../icons/bottom.svg";
import StopIcon from "../icons/pause.svg";

import SizeIcon from "../icons/size.svg";
import QualityIcon from "../icons/hd.svg";
import SearchIcon from "../icons/zoom.svg";
import StyleIcon from "../icons/palette.svg";

import ShortcutkeyIcon from "../icons/shortcutkey.svg";
import McpToolIcon from "../icons/tool.svg";
import HeadphoneIcon from "../icons/headphone.svg";
import ConnectionIcon from "../icons/connection.svg";
import MenuIcon from "../icons/menu.svg";
import {
  BOT_HELLO,
  ChatMessage,
  ChatMessageSegment,
  ChatSession,
  createMessage,
  DEFAULT_TOPIC,
  ModelType,
  SubmitKey,
  Theme,
  useAccessStore,
  useAppConfig,
  useChatStore,
} from "../store";
import { normalizeProviderName } from "../client/api";
import {
  getModelContextTokens,
  formatTokenCount,
  getModelCompressThreshold,
} from "../config/model-context-tokens";
import { estimateTokenLength } from "../utils/token";

import {
  autoGrowTextArea,
  createAttachmentTextSegment,
  getMessageAttachments,
  copyToClipboard,
  getMessageImages,
  getMessageTextContent,
  getMessageTextContentWithoutThinking,
  isDalle3,
  isVisionModel,
  safeLocalStorage,
  getModelSizes,
  supportsCustomSize,
  useMobileScreen,
  selectOrCopy,
} from "../utils";
import { getTextContentFromSegments } from "../utils/thinking";

import { compressImage, readFileAsText } from "@/app/utils/chat";

import dynamic from "next/dynamic";
import { Collapse } from "antd";

import { ChatControllerPool } from "../client/controller";
import { DalleQuality, DalleStyle, ModelSize } from "../typing";
import { Prompt, usePromptStore } from "../store/prompt";
import Locale from "../locales";

import { IconButton } from "./button";
import styles from "./chat.module.scss";

import {
  List,
  ListItem,
  Modal,
  Selector,
  ModelSelectorModal,
  MultiModelSelectorModal,
  showConfirm,
  showPrompt,
  showToast,
} from "./ui-lib";
import { useNavigate } from "react-router-dom";
import {
  CHAT_PAGE_SIZE,
  DEFAULT_TTS_ENGINE,
  ModelProvider,
  Path,
  REQUEST_TIMEOUT_MS,
  ServiceProvider,
  UNFINISHED_INPUT,
} from "../constant";
import { Avatar } from "./emoji";
import { ContextPrompts, MaskAvatar, MaskConfig } from "./mask";
import { useMaskStore } from "../store/mask";
import { ChatCommandPrefix, useChatCommand, useCommand } from "../command";
import { useDragSideBar } from "./sidebar";
import { prettyObject } from "../utils/format";
import { ExportMessageModal } from "./exporter";
import { getClientConfig } from "../config/client";
import { useEnabledModels } from "../utils/hooks";
import { ChatAttachment, ClientApi, MultimodalContent } from "../client/api";
import { createTTSPlayer } from "../utils/audio";
import { MsEdgeTTS, OUTPUT_FORMAT } from "../utils/ms_edge_tts";

import { isEmpty } from "lodash-es";
import { getModelProvider } from "../utils/model";
import { RealtimeChat } from "@/app/components/realtime-chat";
import clsx from "clsx";
import { getAvailableClientsCount, getAllTools } from "../mcp/actions";
import { ModelCapabilityIcons } from "./model-capability-icons";
import {
  getModelCapabilitiesWithCustomConfig,
  isWebSearchModel,
} from "../config/model-capabilities";
import { ProviderIcon } from "./provider-icon";
import { Markdown, ThoughtSegmentBlock } from "./markdown";

const localStorage = safeLocalStorage();

const ttsPlayer = createTTSPlayer();

function buildUserMessageContent(
  input: string,
  attachments: ChatAttachment[],
): string | MultimodalContent[] {
  if (attachments.length === 0) {
    return input;
  }

  const content: MultimodalContent[] = [];

  if (input.trim().length > 0) {
    content.push({ type: "text", text: input });
  }

  for (const attachment of attachments) {
    if (attachment.type === "image") {
      content.push({
        type: "image_url",
        image_url: { url: attachment.data },
      });
    } else {
      content.push({
        type: "text",
        text: createAttachmentTextSegment(attachment.name, attachment.data),
      });
    }
  }

  return content;
}

async function buildAttachmentFromFile(file: File): Promise<ChatAttachment> {
  const id = `${file.name}-${file.size}-${file.lastModified}`;
  const mimeType = file.type || "application/octet-stream";

  if (mimeType.startsWith("image/")) {
    const data = await compressImage(file, 1024 * 1024);
    return {
      id,
      type: "image",
      name: file.name,
      mimeType,
      data,
      previewUrl: data,
    };
  }

  const data = await readFileAsText(file);
  return {
    id,
    type: "text",
    name: file.name,
    mimeType,
    data,
  };
}

const MCPAction = ({ onTogglePanel }: { onTogglePanel: () => void }) => {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    const updateCount = async () => {
      const count = await getAvailableClientsCount();
      setCount(count);
    };
    updateCount();
  }, []);

  return (
    <ChatAction
      onClick={onTogglePanel}
      text={`MCP${count ? ` (${count})` : ""}`}
      icon={<McpToolIcon />}
      dataAttribute="data-mcp-button"
    />
  );
};

const MultiModelAction = ({ onToggle }: { onToggle: () => void }) => {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const multiModelMode = session.multiModelMode;
  const isEnabled = multiModelMode?.enabled || false;
  const selectedCount = multiModelMode?.selectedModels?.length || 0;

  return (
    <ChatAction
      onClick={onToggle}
      text={`${
        isEnabled
          ? Locale.Chat.MultiModel.Enabled
          : Locale.Chat.MultiModel.Disabled
      }${
        selectedCount > 0
          ? ` ${Locale.Chat.MultiModel.Count(selectedCount)}`
          : ""
      }`}
      icon={<ConnectionIcon />}
      dataAttribute="data-multi-model-button"
    />
  );
};

interface MCPClient {
  clientId: string;
  tools: any;
}

function ToolResultCard(props: { tool: any; defaultOpen?: boolean }) {
  const { tool, defaultOpen } = props;
  const isRunning = tool.isError !== true && tool.isError !== false;
  const [activeKeys, setActiveKeys] = useState<string[]>(
    defaultOpen ? ["tool"] : [],
  );

  useEffect(() => {
    setActiveKeys(defaultOpen ? ["tool"] : []);
  }, [defaultOpen, tool.id, tool.isError]);

  const statusText = isRunning
    ? Locale.Chat.MCP.Running
    : tool.isError
    ? Locale.Chat.MCP.Failed
    : Locale.Chat.MCP.Done;
  const headerTitle = `${tool.clientId || "mcp"} : ${
    tool.displayName || tool?.function?.name || ""
  }`;
  const argsText =
    tool.argumentsObj && Object.keys(tool.argumentsObj).length > 0
      ? JSON.stringify(tool.argumentsObj, null, 2)
      : Locale.Chat.MCP.EmptyArguments;
  const getReadableResponse = () => {
    const raw = tool.response ?? tool.content ?? tool.errorMsg ?? "";
    if (Array.isArray(raw)) {
      if (raw.length === 1 && raw[0]?.type === "text" && raw[0]?.text) {
        return raw[0].text;
      }
      return JSON.stringify(raw, null, 2);
    }
    if (
      raw &&
      typeof raw === "object" &&
      Array.isArray(raw.content) &&
      raw.content.length === 1 &&
      raw.content[0]?.type === "text" &&
      raw.content[0]?.text
    ) {
      return raw.content[0].text;
    }
    if (typeof raw === "string") {
      return raw;
    }
    try {
      return JSON.stringify(raw, null, 2);
    } catch {
      return String(raw);
    }
  };
  const responseText = getReadableResponse();
  const formatBlock = (value: string) => {
    if (!value) return value;
    try {
      return `\`\`\`json\n${JSON.stringify(
        JSON.parse(value),
        null,
        2,
      )}\n\`\`\``;
    } catch {
      return `\`\`\`\n${value}\n\`\`\``;
    }
  };

  return (
    <div className={styles["chat-tool-card"]}>
      <Collapse
        bordered={false}
        size="small"
        activeKey={activeKeys}
        onChange={(keys) =>
          setActiveKeys(
            Array.isArray(keys)
              ? (keys as string[])
              : keys
              ? [keys as string]
              : [],
          )
        }
        className={styles["chat-tool-collapse"]}
        items={[
          {
            key: "tool",
            label: (
              <div className={styles["chat-tool-header"]}>
                <div className={styles["chat-tool-title"]}>
                  <span>{headerTitle}</span>
                  <span
                    className={clsx(styles["chat-tool-status-icon"], {
                      [styles["success"]]: tool.isError === false,
                      [styles["error"]]: tool.isError === true,
                    })}
                  >
                    {tool.isError === false ? (
                      <ConfirmIcon />
                    ) : tool.isError === true ? (
                      <CloseIcon />
                    ) : (
                      <LoadingButtonIcon />
                    )}
                  </span>
                </div>
                <div className={styles["chat-tool-actions"]}>
                  <span
                    className={clsx(styles["chat-tool-status"], {
                      [styles["success"]]: tool.isError === false,
                      [styles["error"]]: tool.isError === true,
                    })}
                  >
                    {statusText}
                  </span>
                  <button
                    className={styles["chat-tool-copy"]}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      copyToClipboard(responseText || argsText);
                    }}
                    aria-label={Locale.Chat.Actions.Copy}
                    type="button"
                  >
                    <CopyIcon />
                  </button>
                </div>
              </div>
            ),
            children: (
              <div className={styles["chat-tool-body"]}>
                <div className={styles["chat-tool-section"]}>
                  <div className={styles["chat-tool-section-title"]}>
                    {Locale.Chat.MCP.Arguments}
                  </div>
                  <Markdown
                    content={formatBlock(argsText)}
                    loading={false}
                    fontSize={14}
                    fontFamily="inherit"
                    defaultShow={true}
                    status={false}
                  />
                </div>
                <div className={styles["chat-tool-section"]}>
                  <div className={styles["chat-tool-section-title"]}>
                    {Locale.Chat.MCP.Response}
                  </div>
                  <Markdown
                    content={
                      responseText
                        ? formatBlock(responseText)
                        : Locale.Chat.MCP.Running
                    }
                    loading={false}
                    fontSize={14}
                    fontFamily="inherit"
                    defaultShow={true}
                    status={false}
                  />
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function formatMessageMeta(message: ChatMessage, isMobileScreen: boolean) {
  const timeText = message.date || "";
  const statistic = message.statistic;

  if (!statistic) {
    return isMobileScreen ? [timeText] : timeText;
  }

  if (message.role === "assistant") {
    const completionTokens = statistic.completionTokens;
    const totalReplyLatency = statistic.totalReplyLatency;
    const firstReplyLatency = statistic.firstReplyLatency;

    if (
      typeof completionTokens !== "number" ||
      typeof totalReplyLatency !== "number"
    ) {
      return isMobileScreen ? [timeText] : timeText;
    }

    const statParts = [`${completionTokens} Tokens`];
    const isStreamingMessage =
      typeof firstReplyLatency === "number" && firstReplyLatency > 0;

    if (isStreamingMessage) {
      const activeDuration = Math.max(
        totalReplyLatency - firstReplyLatency,
        10,
      );
      const speed = ((completionTokens * 1000) / activeDuration).toFixed(2);
      statParts.push(
        `⚡ ${speed} T/s`,
        `⏱️ FT:${(firstReplyLatency / 1000).toFixed(2)}s | TT:${(
          totalReplyLatency / 1000
        ).toFixed(2)}s`,
      );
    } else {
      const activeDuration = Math.max(totalReplyLatency, 10);
      const speed = ((completionTokens * 1000) / activeDuration).toFixed(2);
      statParts.push(
        `⚡ ${speed} T/s`,
        `⏱️ TT:${(totalReplyLatency / 1000).toFixed(2)}s`,
      );
    }

    return isMobileScreen
      ? [timeText, statParts.join(" ")]
      : `${timeText} - ${statParts.join(" ")}`;
  }

  if (typeof statistic.singlePromptTokens === "number") {
    const statText = `${statistic.singlePromptTokens} Tokens`;
    return isMobileScreen ? [timeText, statText] : `${timeText} - ${statText}`;
  }

  return isMobileScreen ? [timeText] : timeText;
}

function getMessageDisplaySegments(message: ChatMessage): ChatMessageSegment[] {
  if (message.segments?.length) {
    return message.segments;
  }

  const content =
    typeof message.content === "string"
      ? message.content
      : getMessageTextContent(message);
  if (!content) return [];

  return [
    {
      id: `${message.id}-content`,
      type: "text",
      content,
      streaming: !!message.streaming,
    },
  ];
}

function getThoughtSegments(message: ChatMessage): ChatMessageSegment[] {
  return getMessageDisplaySegments(message).filter(
    (segment) => segment.type === "thought",
  );
}

function getToolsForSegment(
  message: ChatMessage,
  segment: ChatMessageSegment,
): NonNullable<ChatMessage["tools"]> {
  if (!segment.toolIds?.length) return [];

  const tools = message.tools ?? [];
  return segment.toolIds
    .map((toolId) => tools.find((tool) => tool.id === toolId))
    .filter(Boolean) as NonNullable<ChatMessage["tools"]>;
}

function getMessageRevealKey(message: ChatMessage) {
  return `${message.id}:${message.date}:${message.content.length}:${
    message.tools?.length ?? 0
  }:${message.segments?.length ?? 0}`;
}

function getRenderableSegments(message: ChatMessage): ChatMessageSegment[] {
  if (!message.versions || message.versions.length < 1) {
    return getMessageDisplaySegments(message);
  }

  const currentIndex = message.currentVersionIndex ?? 0;
  if (currentIndex === message.versions.length) {
    return getMessageDisplaySegments(message);
  }

  return [];
}

function AssistantMessageBody(props: {
  message: ChatMessage & { preview?: boolean };
  isUser: boolean;
  isMobileScreen: boolean;
  fontSize: number;
  fontFamily: string;
  scrollRef: RefObject<HTMLDivElement>;
  defaultShow: boolean;
  onFillInput: () => void;
}) {
  const {
    message,
    isUser,
    isMobileScreen,
    fontSize,
    fontFamily,
    scrollRef,
    defaultShow,
    onFillInput,
  } = props;
  const renderableSegments = getRenderableSegments(message);
  const hasTools = renderableSegments.some(
    (segment) => segment.type === "tool",
  );
  const hasThoughts = renderableSegments.some(
    (segment) =>
      segment.type === "thought" && segment.content.trim().length > 0,
  );
  const hasText = renderableSegments.some(
    (segment) => segment.type === "text" && segment.content.trim().length > 0,
  );
  const hasRenderableContent =
    renderableSegments.length > 0 &&
    renderableSegments.some((segment) => {
      if (segment.type === "tool") {
        return getToolsForSegment(message, segment).length > 0;
      }

      return segment.content.trim().length > 0;
    });
  const revealKey = getMessageRevealKey(message);
  const [revealReady, setRevealReady] = useState(() => {
    return (
      message.streaming ||
      !hasTools ||
      renderableSegments.length === 0 ||
      hasRenderableContent
    );
  });

  useEffect(() => {
    const shouldDelayReveal =
      !message.streaming &&
      hasTools &&
      !hasRenderableContent &&
      (!hasThoughts || !hasText);

    if (!shouldDelayReveal) {
      setRevealReady(true);
      return;
    }

    setRevealReady(false);
    const timer = window.setTimeout(() => {
      setRevealReady(true);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [
    message.streaming,
    hasTools,
    hasRenderableContent,
    hasThoughts,
    hasText,
    renderableSegments.length,
    revealKey,
  ]);

  if (!revealReady) {
    return (
      <div className={styles["chat-message-loading-unified"]}>
        <LoadingIcon />
      </div>
    );
  }

  if (renderableSegments.length > 0) {
    return (
      <>
        {renderableSegments.map((segment, segmentIndex) => {
          if (segment.type === "tool") {
            const toolsForSegment = getToolsForSegment(message, segment);
            if (toolsForSegment.length === 0) return null;

            return (
              <div
                key={`${message.id}-tool-segment-${segment.id}-${segmentIndex}`}
                className={styles["chat-message-tools"]}
              >
                {toolsForSegment.map((tool, toolIndex) => (
                  <ToolResultCard
                    key={tool.id}
                    tool={tool}
                    defaultOpen={
                      tool.isError !== false &&
                      tool.isError !== true &&
                      toolIndex === toolsForSegment.length - 1
                    }
                  />
                ))}
              </div>
            );
          }

          if (segment.type === "thought") {
            return (
              <ThoughtSegmentBlock
                key={`${message.id}-thought-segment-${segment.id}-${segmentIndex}`}
                segment={segment}
                fontSize={fontSize}
                fontFamily={fontFamily}
              />
            );
          }

          return (
            <Markdown
              key={`${message.id}-text-segment-${segment.id}-${segmentIndex}`}
              content={segment.content}
              loading={
                segmentIndex === 0 &&
                (message.preview || message.streaming) &&
                message.content.length === 0 &&
                !isUser
              }
              onDoubleClickCapture={() => {
                if (!isMobileScreen) return;
                onFillInput();
              }}
              fontSize={fontSize}
              fontFamily={fontFamily}
              parentRef={scrollRef}
              defaultShow={defaultShow}
              status={message.streaming}
            />
          );
        })}
      </>
    );
  }

  return (
    <Markdown
      key={message.streaming ? "loading" : "done"}
      content={getMessageDisplayContent(message)}
      loading={
        (message.preview || message.streaming) &&
        message.content.length === 0 &&
        !isUser
      }
      onDoubleClickCapture={() => {
        if (!isMobileScreen) return;
        onFillInput();
      }}
      fontSize={fontSize}
      fontFamily={fontFamily}
      parentRef={scrollRef}
      defaultShow={defaultShow}
      status={message.streaming}
    />
  );
}

function getMessageDisplayContent(message: ChatMessage): string {
  const segments = getMessageDisplaySegments(message);
  const textContent = getTextContentFromSegments(segments);

  if (textContent) {
    return textContent;
  }

  if (segments.length > 0) {
    return "";
  }

  return typeof message.content === "string"
    ? message.content
    : getMessageTextContent(message);
}

function ThinkingPanel(props: { showPanel: boolean; onClose: () => void }) {
  const { showPanel, onClose } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const chatStore = useChatStore();
  const session = chatStore.currentSession();

  // 获取当前模型的能力
  const currentModel = session.mask.modelConfig.model;
  const modelCapabilities = getModelCapabilitiesWithCustomConfig(currentModel);

  // 根据模型类型定义不同的thinking选项
  const getThinkingOptions = () => {
    if (modelCapabilities.thinkingType === "claude") {
      // Claude模型的thinking选项
      return [
        {
          value: -1,
          label: Locale.Chat.Thinking.Dynamic,
          description: Locale.Chat.Thinking.ClaudeDynamicDesc,
        },
        {
          value: 0,
          label: Locale.Chat.Thinking.Off,
          description: Locale.Chat.Thinking.OffDesc,
        },
        {
          value: 5000,
          label: Locale.Chat.Thinking.ClaudeLight,
          description: Locale.Chat.Thinking.ClaudeLightDesc,
        },
        {
          value: 10000,
          label: Locale.Chat.Thinking.ClaudeMedium,
          description: Locale.Chat.Thinking.ClaudeMediumDesc,
        },
        {
          value: 20000,
          label: Locale.Chat.Thinking.ClaudeDeep,
          description: Locale.Chat.Thinking.ClaudeDeepDesc,
        },
        {
          value: 32000,
          label: Locale.Chat.Thinking.ClaudeVeryDeep,
          description: Locale.Chat.Thinking.ClaudeVeryDeepDesc,
        },
      ];
    } else {
      // Gemini模型的thinking选项
      return [
        {
          value: -1,
          label: Locale.Chat.Thinking.Dynamic,
          description: Locale.Chat.Thinking.DynamicDesc,
        },
        {
          value: 0,
          label: Locale.Chat.Thinking.Off,
          description: Locale.Chat.Thinking.OffDesc,
        },
        {
          value: 1024,
          label: Locale.Chat.Thinking.Light,
          description: Locale.Chat.Thinking.LightDesc,
        },
        {
          value: 4096,
          label: Locale.Chat.Thinking.Medium,
          description: Locale.Chat.Thinking.MediumDesc,
        },
        {
          value: 8192,
          label: Locale.Chat.Thinking.Deep,
          description: Locale.Chat.Thinking.DeepDesc,
        },
        {
          value: 16384,
          label: Locale.Chat.Thinking.VeryDeep,
          description: Locale.Chat.Thinking.VeryDeepDesc,
        },
      ];
    }
  };

  const thinkingOptions = getThinkingOptions();

  // 点击外部关闭面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // 检查是否点击了思考按钮或其子元素
      const thinkingButton = document.querySelector("[data-thinking-button]");
      if (thinkingButton && thinkingButton.contains(target)) {
        return; // 如果点击的是思考按钮，不关闭面板
      }

      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    };

    if (showPanel) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPanel, onClose]);

  if (!showPanel) {
    return null;
  }

  return (
    <div ref={panelRef} className={styles["shortcut-panel"]}>
      <div className={styles["shortcut-panel-header"]}>
        <span className={styles["shortcut-panel-title"]}>
          {Locale.Chat.Thinking.Title}
        </span>
        <button className={styles["shortcut-panel-close"]} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className={styles["shortcut-panel-content"]}>
        <div className={styles["thinking-notice"]}>
          {modelCapabilities.thinkingType === "claude"
            ? Locale.Chat.Thinking.ClaudeNotice
            : Locale.Chat.Thinking.GeminiNotice}
        </div>
        <div className={styles["shortcut-key-list"]}>
          {thinkingOptions.map((option, index) => (
            <div
              key={index}
              className={`${styles["shortcut-key-item"]} ${
                session.mask.modelConfig.thinkingBudget === option.value
                  ? styles["thinking-option-selected"]
                  : ""
              }`}
              onClick={() => {
                chatStore.updateTargetSession(session, (session) => {
                  session.mask.modelConfig.thinkingBudget = option.value;
                });
                onClose();
              }}
            >
              <div className={styles["shortcut-key-title"]}>
                <div>{option.label}</div>
                <div style={{ fontSize: "12px", opacity: 0.7 }}>
                  {option.description}
                </div>
              </div>
              {session.mask.modelConfig.thinkingBudget === option.value && (
                <div className={styles["thinking-option-check"]}>✓</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShortcutKeyPanel(props: { showPanel: boolean; onClose: () => void }) {
  const { showPanel, onClose } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  const shortcuts = [
    {
      title: Locale.Chat.ShortcutKey.newChat,
      keys: isMac ? ["⌘", "Shift", "O"] : ["Ctrl", "Shift", "O"],
    },
    { title: Locale.Chat.ShortcutKey.focusInput, keys: ["Shift", "Esc"] },
    {
      title: Locale.Chat.ShortcutKey.copyLastCode,
      keys: isMac ? ["⌘", "Shift", ";"] : ["Ctrl", "Shift", ";"],
    },
    {
      title: Locale.Chat.ShortcutKey.copyLastMessage,
      keys: isMac ? ["⌘", "Shift", "C"] : ["Ctrl", "Shift", "C"],
    },
    {
      title: Locale.Chat.ShortcutKey.showShortcutKey,
      keys: isMac ? ["⌘", "/"] : ["Ctrl", "/"],
    },
    {
      title: Locale.Chat.ShortcutKey.clearContext,
      keys: isMac ? ["⌘", "Shift", "L"] : ["Ctrl", "Shift", "L"],
    },
  ];

  // 点击外部关闭面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // 检查是否点击了快捷键按钮或其子元素
      const shortcutButton = document.querySelector("[data-shortcut-button]");
      if (shortcutButton && shortcutButton.contains(target)) {
        return; // 如果点击的是快捷键按钮，不关闭面板
      }

      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    };

    if (showPanel) {
      // 使用 setTimeout 延迟添加事件监听器，避免立即触发
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showPanel, onClose]);

  if (!showPanel) {
    return null;
  }

  return (
    <div ref={panelRef} className={styles["shortcut-panel"]}>
      <div className={styles["shortcut-panel-header"]}>
        <span className={styles["shortcut-panel-title"]}>
          {Locale.Chat.ShortcutKey.Title}
        </span>
        <button className={styles["shortcut-panel-close"]} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className={styles["shortcut-panel-content"]}>
        <div className={styles["shortcut-key-list"]}>
          {shortcuts.map((shortcut, index) => (
            <div key={index} className={styles["shortcut-key-item"]}>
              <div className={styles["shortcut-key-title"]}>
                {shortcut.title}
              </div>
              <div className={styles["shortcut-key-keys"]}>
                {shortcut.keys.map((key, i) => (
                  <div key={i} className={styles["shortcut-key"]}>
                    <span>{key}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MCPPanel(props: { showPanel: boolean; onClose: () => void }) {
  const { showPanel, onClose } = props;
  const chatStore = useChatStore();
  const [mcpClients, setMcpClients] = useState<MCPClient[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadMcpClients = async () => {
      try {
        setLoading(true);
        const tools = await getAllTools();
        setMcpClients(
          tools.filter(
            (client) => client.tools && client.tools.tools?.length > 0,
          ),
        );
      } catch (error) {
        // Locale.Chat.MCP.ClientFailed
      } finally {
        setLoading(false);
      }
    };

    if (showPanel) {
      loadMcpClients();
    }
  }, [showPanel]);

  // 点击外部关闭面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // 检查是否点击了 MCP 按钮或其子元素
      const mcpButton = document.querySelector("[data-mcp-button]");
      if (mcpButton && mcpButton.contains(target)) {
        return; // 如果点击的是 MCP 按钮，不关闭面板
      }

      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    };

    if (showPanel) {
      // 使用 setTimeout 延迟添加事件监听器，避免立即触发
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showPanel, onClose]);

  const handleToggleClient = (clientId: string, enabled: boolean) => {
    chatStore.updateSessionMcpClient(clientId, enabled);
  };

  if (!showPanel) return null;

  const mcpEnabled = chatStore.getSessionMcpEnabled();

  return (
    <div ref={panelRef} className={styles["mcp-panel"]}>
      <div className={styles["mcp-panel-header"]}>
        <span className={styles["mcp-panel-title"]}>
          {Locale.Chat.MCP.Title}
        </span>
        <button className={styles["mcp-panel-close"]} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className={styles["mcp-panel-content"]}>
        {/* MCP 功能总开关 */}
        <div className={styles["mcp-global-toggle"]}>
          <div className={styles["mcp-global-toggle-info"]}>
            <div className={styles["mcp-global-toggle-title"]}>
              {Locale.Chat.MCP.Enable}
            </div>
            <div className={styles["mcp-global-toggle-desc"]}>
              {Locale.Chat.MCP.EnableDesc}
            </div>
          </div>
          <label className={styles["mcp-client-toggle"]}>
            <input
              type="checkbox"
              checked={mcpEnabled}
              onChange={(e) =>
                chatStore.updateSessionMcpEnabled(e.target.checked)
              }
            />
            <span className={styles["toggle-slider"]}></span>
          </label>
        </div>

        {/* 只有在 MCP 功能启用时才显示工具列表 */}
        {mcpEnabled && (
          <>
            {loading ? (
              <div className={styles["mcp-panel-loading"]}>
                <LoadingIcon />
                <span>{Locale.Chat.MCP.Loading}</span>
              </div>
            ) : mcpClients.length === 0 ? (
              <div className={styles["mcp-panel-empty"]}>
                <span>{Locale.Chat.MCP.NoTools}</span>
              </div>
            ) : (
              <div className={styles["mcp-client-list"]}>
                {mcpClients.map((client) => {
                  const isEnabled = chatStore.getSessionMcpClientStatus(
                    client.clientId,
                  );
                  const toolCount = client.tools?.tools?.length || 0;

                  return (
                    <div
                      key={client.clientId}
                      className={styles["mcp-client-item"]}
                    >
                      <div className={styles["mcp-client-info"]}>
                        <div className={styles["mcp-client-name"]}>
                          {client.clientId}
                        </div>
                        <div className={styles["mcp-client-tools"]}>
                          {Locale.Chat.MCP.ToolsCount(toolCount)}
                        </div>
                      </div>
                      <label className={styles["mcp-client-toggle"]}>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) =>
                            handleToggleClient(
                              client.clientId,
                              e.target.checked,
                            )
                          }
                        />
                        <span className={styles["toggle-slider"]}></span>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MultiModelPanel(props: {
  showPanel: boolean;
  onClose: () => void;
  onOpenSelector: () => void;
}) {
  const { showPanel, onClose, onOpenSelector } = props;
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const panelRef = useRef<HTMLDivElement>(null);

  // 获取当前选中的模型
  const selectedModels = session.multiModelMode?.selectedModels || [];

  // 点击外部关闭面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // 检查是否点击了多模型按钮或其子元素
      const multiModelButton = document.querySelector(
        "[data-multi-model-button]",
      );
      if (multiModelButton && multiModelButton.contains(target)) {
        return; // 如果点击的是多模型按钮，不关闭面板
      }

      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    };

    if (showPanel) {
      // 使用 setTimeout 延迟添加事件监听器，避免立即触发
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showPanel, onClose]);

  if (!showPanel) return null;

  return (
    <div ref={panelRef} className={styles["mcp-panel"]}>
      <div className={styles["mcp-panel-header"]}>
        <span className={styles["mcp-panel-title"]}>
          {Locale.Chat.MultiModel.Title}
        </span>
        <button className={styles["mcp-panel-close"]} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className={styles["mcp-panel-content"]}>
        <div className={styles["multi-model-description"]}>
          {Locale.Chat.MultiModel.Description}
        </div>

        <button
          className={styles["multi-model-select-button"]}
          onClick={onOpenSelector}
        >
          <span className={styles["multi-model-select-icon"]}>🎯</span>
          {Locale.Chat.MultiModel.OpenSelector}{" "}
          {Locale.Chat.MultiModel.AlreadySelected(selectedModels.length)}
        </button>

        <div className={styles["multi-model-tips"]}>
          {Locale.Chat.MultiModel.Tips}
        </div>
      </div>
    </div>
  );
}

export function SessionConfigModel(props: { onClose: () => void }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const maskStore = useMaskStore();
  const navigate = useNavigate();

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Context.Edit}
        onClose={() => props.onClose()}
        actions={[
          <IconButton
            key="reset"
            icon={<ResetIcon />}
            bordered
            text={Locale.Chat.Config.Reset}
            onClick={async () => {
              if (await showConfirm(Locale.Memory.ResetConfirm)) {
                chatStore.updateTargetSession(
                  session,
                  (session) => (session.memoryPrompt = ""),
                );
              }
            }}
          />,
          <IconButton
            key="copy"
            icon={<CopyIcon />}
            bordered
            text={Locale.Chat.Config.SaveAs}
            onClick={() => {
              navigate(Path.Masks);
              setTimeout(() => {
                maskStore.create(session.mask);
              }, 500);
            }}
          />,
        ]}
      >
        <MaskConfig
          mask={session.mask}
          updateMask={(updater) => {
            const mask = { ...session.mask };
            updater(mask);
            chatStore.updateTargetSession(
              session,
              (session) => (session.mask = mask),
            );
          }}
          shouldSyncFromGlobal
          isSessionConfig={true}
          extraListItems={
            session.mask.modelConfig.sendMemory ? (
              <ListItem
                className="copyable"
                title={`${Locale.Memory.Title} (${session.lastSummarizeIndex} of ${session.messages.length})`}
                subTitle={session.memoryPrompt || Locale.Memory.EmptyContent}
              ></ListItem>
            ) : (
              <></>
            )
          }
        ></MaskConfig>
      </Modal>
    </div>
  );
}

function PromptToast(props: {
  showToast?: boolean;
  showModal?: boolean;
  setShowModal: (_: boolean) => void;
}) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const context = session.mask.context;

  return (
    <div className={styles["prompt-toast"]} key="prompt-toast">
      {props.showToast && context.length > 0 && (
        <div
          className={clsx(styles["prompt-toast-inner"], "clickable")}
          role="button"
          onClick={() => props.setShowModal(true)}
        >
          <BrainIcon />
          <span className={styles["prompt-toast-content"]}>
            {Locale.Context.Toast(context.length)}
          </span>
        </div>
      )}
      {props.showModal && (
        <SessionConfigModel onClose={() => props.setShowModal(false)} />
      )}
    </div>
  );
}

function useSubmitHandler() {
  const config = useAppConfig();
  const submitKey = config.submitKey;
  const isComposing = useRef(false);

  useEffect(() => {
    const onCompositionStart = () => {
      isComposing.current = true;
    };
    const onCompositionEnd = () => {
      isComposing.current = false;
    };

    window.addEventListener("compositionstart", onCompositionStart);
    window.addEventListener("compositionend", onCompositionEnd);

    return () => {
      window.removeEventListener("compositionstart", onCompositionStart);
      window.removeEventListener("compositionend", onCompositionEnd);
    };
  }, []);

  const shouldSubmit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Fix Chinese input method "Enter" on Safari
    if (e.keyCode == 229) return false;
    if (e.key !== "Enter") return false;
    if (e.key === "Enter" && (e.nativeEvent.isComposing || isComposing.current))
      return false;
    return (
      (config.submitKey === SubmitKey.AltEnter && e.altKey) ||
      (config.submitKey === SubmitKey.CtrlEnter && e.ctrlKey) ||
      (config.submitKey === SubmitKey.ShiftEnter && e.shiftKey) ||
      (config.submitKey === SubmitKey.MetaEnter && e.metaKey) ||
      (config.submitKey === SubmitKey.Enter &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey)
    );
  };

  return {
    submitKey,
    shouldSubmit,
  };
}

export type RenderPrompt = Pick<Prompt, "title" | "content">;

export function PromptHints(props: {
  prompts: RenderPrompt[];
  onPromptSelect: (prompt: RenderPrompt) => void;
}) {
  const noPrompts = props.prompts.length === 0;
  const [selectIndex, setSelectIndex] = useState(0);
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectIndex(0);
  }, [props.prompts.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (noPrompts || e.metaKey || e.altKey || e.ctrlKey) {
        return;
      }
      // arrow up / down to select prompt
      const changeIndex = (delta: number) => {
        e.stopPropagation();
        e.preventDefault();
        const nextIndex = Math.max(
          0,
          Math.min(props.prompts.length - 1, selectIndex + delta),
        );
        setSelectIndex(nextIndex);
        selectedRef.current?.scrollIntoView({
          block: "center",
        });
      };

      if (e.key === "ArrowUp") {
        changeIndex(1);
      } else if (e.key === "ArrowDown") {
        changeIndex(-1);
      } else if (e.key === "Enter") {
        const selectedPrompt = props.prompts.at(selectIndex);
        if (selectedPrompt) {
          props.onPromptSelect(selectedPrompt);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.prompts.length, selectIndex]);

  if (noPrompts) return null;
  return (
    <div className={styles["prompt-hints"]}>
      {props.prompts.map((prompt, i) => (
        <div
          ref={i === selectIndex ? selectedRef : null}
          className={clsx(styles["prompt-hint"], {
            [styles["prompt-hint-selected"]]: i === selectIndex,
          })}
          key={prompt.title + i.toString()}
          onClick={() => props.onPromptSelect(prompt)}
          onMouseEnter={() => setSelectIndex(i)}
        >
          <div className={styles["hint-title"]}>{prompt.title}</div>
          <div className={styles["hint-content"]}>{prompt.content}</div>
        </div>
      ))}
    </div>
  );
}

function ClearContextDivider() {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();

  return (
    <div
      className={styles["clear-context"]}
      onClick={() =>
        chatStore.updateTargetSession(
          session,
          (session) => (session.clearContextIndex = undefined),
        )
      }
    >
      <div className={styles["clear-context-tips"]}>{Locale.Context.Clear}</div>
      <div className={styles["clear-context-revert-btn"]}>
        {Locale.Context.Revert}
      </div>
    </div>
  );
}

export function ChatAction(props: {
  text: string;
  icon: JSX.Element;
  onClick: () => void;
  dataAttribute?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={styles["chat-action-wrapper"]}>
      <button
        className={clsx(styles["chat-input-action"], "clickable")}
        onClick={props.onClick}
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        {...(props.dataAttribute && { [props.dataAttribute]: true })}
      >
        <div className={styles["icon"]}>{props.icon}</div>
      </button>
      {showTooltip && (
        <div className={styles["chat-action-tooltip"]}>{props.text}</div>
      )}
    </div>
  );
}

// Token计数器组件
export function TokenCounter(props: {
  session: ChatSession;
  currentModel: string;
  userInput?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  // 计算当前对话的Token数量（排除思考内容）
  const calculateUsedTokens = () => {
    const messages = props.session.messages;
    return messages.reduce((total: number, message: ChatMessage) => {
      if (message.isError) return total;
      return (
        total +
        estimateTokenLength(getMessageTextContentWithoutThinking(message))
      );
    }, 0);
  };

  // 获取当前会话的配置
  const modelConfig = props.session.mask.modelConfig;
  const usedTokens = calculateUsedTokens();
  const contextConfig = getModelContextTokens(props.currentModel);
  const maxTokens =
    modelConfig.compressMessageLengthThreshold > 0
      ? modelConfig.compressMessageLengthThreshold
      : contextConfig?.contextTokens;

  // 计算当前上下文数量
  const currentContextCount = props.session.messages.length;
  const maxContextCount = modelConfig.historyMessageCount;

  // 计算预估Token数（包括用户输入）
  const inputTokens = props.userInput
    ? estimateTokenLength(props.userInput)
    : 0;
  const estimatedTokens = usedTokens + inputTokens;

  const displayText = maxTokens
    ? `${formatTokenCount(usedTokens)}/${formatTokenCount(maxTokens)}`
    : `${formatTokenCount(usedTokens)}/?`;

  // 构建详细的tooltip内容
  const tooltipLines = [
    `${Locale.Chat.TokenTooltip.Context}: ${currentContextCount} / ${maxContextCount}`,
    maxTokens
      ? `${
          Locale.Chat.TokenTooltip.CurrentToken
        }: ${usedTokens.toLocaleString()} / ${maxTokens.toLocaleString()}`
      : `${
          Locale.Chat.TokenTooltip.CurrentToken
        }: ${usedTokens.toLocaleString()} / ${
          Locale.Chat.TokenTooltip.Unknown
        }`,
    inputTokens > 0
      ? `${
          Locale.Chat.TokenTooltip.EstimatedToken
        }: ${estimatedTokens.toLocaleString()}`
      : null,
  ].filter(Boolean);

  const tooltipText = tooltipLines.join("\n");

  // 計算進度條數據
  const progressPercentage = maxTokens ? (usedTokens / maxTokens) * 100 : 0;
  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "#ef4444"; // 紅色 - 危險
    if (percentage >= 70) return "#f59e0b"; // 黃色 - 警告
    return "#22c55e"; // 綠色 - 安全
  };

  return (
    <div className={styles["chat-action-wrapper"]}>
      <button
        className={styles["token-counter-button"]}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => e.preventDefault()}
        type="button"
      >
        <span className={styles["token-counter-text"]}>{displayText}</span>
      </button>
      {showTooltip && (
        <div className={styles["token-counter-tooltip"]}>
          {tooltipLines.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
          {maxTokens && (
            <div className={styles["token-progress-container"]}>
              <div className={styles["token-progress-info"]}>
                <span>
                  {Locale.Chat.TokenUsage}: {progressPercentage.toFixed(1)}%
                </span>
              </div>
              <div className={styles["token-progress-bar"]}>
                <div
                  className={styles["token-progress-fill"]}
                  style={{
                    width: `${Math.min(progressPercentage, 100)}%`,
                    backgroundColor: getProgressColor(progressPercentage),
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function useScrollToBottom(
  scrollRef: RefObject<HTMLDivElement>,
  detach: boolean = false,
  messages: ChatMessage[],
) {
  // for auto-scroll
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollDomToBottom = useCallback(() => {
    const dom = scrollRef.current;
    if (dom) {
      requestAnimationFrame(() => {
        setAutoScroll(true);
        dom.scrollTo(0, dom.scrollHeight);
      });
    }
  }, [scrollRef]);

  // auto scroll
  useEffect(() => {
    if (autoScroll && !detach) {
      scrollDomToBottom();
    }
  });

  // auto scroll when messages length changes
  const lastMessagesLength = useRef(messages.length);
  useEffect(() => {
    if (messages.length > lastMessagesLength.current && !detach) {
      scrollDomToBottom();
    }
    lastMessagesLength.current = messages.length;
  }, [messages.length, detach, scrollDomToBottom]);

  return {
    scrollRef,
    autoScroll,
    setAutoScroll,
    scrollDomToBottom,
  };
}

export function ChatActions(props: {
  uploadAttachment: () => void;
  setAttachments: (attachments: ChatAttachment[]) => void;
  setUploading: (uploading: boolean) => void;
  scrollToBottom: () => void;
  showPromptHints: () => void;
  hitBottom: boolean;
  uploading: boolean;
  setShowShortcutKeyModal: React.Dispatch<React.SetStateAction<boolean>>;
  setUserInput: (input: string) => void;
  setShowChatSidePanel: React.Dispatch<React.SetStateAction<boolean>>;
  showMcpPanel: boolean;
  setShowMcpPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showShortcutKeyPanel: boolean;
  setShowShortcutKeyPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showThinkingPanel: boolean;
  setShowThinkingPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showMultiModelPanel: boolean;
  setShowMultiModelPanel: React.Dispatch<React.SetStateAction<boolean>>;
  toggleMultiModelMode: () => void;
  showModelSelector: boolean;
  setShowModelSelector: React.Dispatch<React.SetStateAction<boolean>>;
  userInput: string;
}) {
  const config = useAppConfig();
  const navigate = useNavigate();
  const chatStore = useChatStore();
  const accessStore = useAccessStore();

  const session = chatStore.currentSession();

  // switch themes
  const theme = config.theme;

  function nextTheme() {
    const themes = [Theme.Auto, Theme.Light, Theme.Dark];
    const themeIndex = themes.indexOf(theme);
    const nextIndex = (themeIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    config.update((config) => (config.theme = nextTheme));
  }

  // switch model
  const currentModel = session.mask.modelConfig.model;
  const currentProviderName =
    session.mask.modelConfig?.providerName || ServiceProvider.OpenAI;

  // 使用新的高效hook直接获取启用的模型
  const enabledModels = useEnabledModels();
  const models = useMemo(() => {
    const defaultModel = enabledModels.find((m) => m.isDefault);

    if (defaultModel) {
      const arr = [
        defaultModel,
        ...enabledModels.filter((m) => m !== defaultModel),
      ];
      return arr;
    } else {
      return enabledModels;
    }
  }, [enabledModels]);
  const currentModelName = useMemo(() => {
    const model = models.find(
      (m) =>
        m.name == currentModel &&
        (m?.provider?.providerName == currentProviderName ||
          m?.provider?.id == currentProviderName),
    );
    return model?.displayName ?? "";
  }, [models, currentModel, currentProviderName]);

  // 准备分组模型数据 - 简化版本，因为models已经是启用的模型
  const modelGroups = useMemo(() => {
    // 按提供商分组
    const groupedModels: Record<string, any[]> = {};

    models.forEach((model) => {
      const providerId = model.provider?.id;
      const providerName = model.provider?.providerName;

      if (!providerId || !providerName) {
        return;
      }

      // 检查是否是自定义服务商
      const isCustomProvider = providerId.startsWith("custom_");
      const customProvider = isCustomProvider
        ? accessStore.customProviders.find((p) => p.id === providerId)
        : null;

      const displayName = isCustomProvider
        ? customProvider?.name || providerName
        : providerName;

      if (!groupedModels[displayName]) {
        groupedModels[displayName] = [];
      }

      // 获取模型的Token信息
      const contextConfig = getModelContextTokens(model.name);
      const contextTokensDisplay = contextConfig
        ? formatTokenCount(contextConfig.contextTokens)
        : null;

      groupedModels[displayName].push({
        title: (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>{model.displayName}</span>
            <ModelCapabilityIcons
              capabilities={getModelCapabilitiesWithCustomConfig(model.name)}
              size={14}
              colorful={true}
            />
          </div>
        ),
        subTitle: contextTokensDisplay
          ? Locale.Chat.UI.ContextTooltip.ContextTokens(contextTokensDisplay)
          : undefined,
        searchText: model.displayName,
        value: `${model.name}@${providerId}`,
        icon: <Avatar model={model.name} />,
      });
    });

    const result = Object.entries(groupedModels).map(
      ([providerName, models]) => ({
        groupName: providerName,
        items: models,
      }),
    );

    return result;
  }, [models, accessStore.customProviders]);

  const canUploadAttachment = true;

  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [showQualitySelector, setShowQualitySelector] = useState(false);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const modelSizes = getModelSizes(currentModel);
  const dalle3Qualitys: DalleQuality[] = ["standard", "hd"];
  const dalle3Styles: DalleStyle[] = ["vivid", "natural"];
  const currentSize =
    session.mask.modelConfig?.size ?? ("1024x1024" as ModelSize);
  const currentQuality = session.mask.modelConfig?.quality ?? "standard";
  const currentStyle = session.mask.modelConfig?.style ?? "vivid";

  const isMobileScreen = useMobileScreen();

  const { setAttachments, setUploading } = props;
  useEffect(() => {
    if (!isVisionModel(currentModel)) {
      setUploading(false);
    }
  }, [currentModel, setUploading]);

  // 分离模型可用性检查到单独的 useEffect
  // 使用 ref 来避免依赖 session 对象
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // 使用 useMemo 来稳定化模型可用性检查的结果
  const modelAvailability = useMemo(() => {
    const isUnavailableModel = !models.some((m) => m.name === currentModel);
    const nextModel =
      isUnavailableModel && models.length > 0
        ? models.find((model) => model.isDefault) || models[0]
        : null;
    return { isUnavailableModel, nextModel };
  }, [models, currentModel]);

  // 使用 useCallback 来稳定化更新函数，并添加防抖
  const updateSessionModel = useDebouncedCallback((nextModel: any) => {
    chatStore.updateTargetSession(sessionRef.current, (session) => {
      session.mask.modelConfig.model = nextModel.name;
      session.mask.modelConfig.providerName = nextModel?.provider
        ?.providerName as ServiceProvider;

      // 检查新模型是否支持thinking功能，如果支持且thinkingBudget未设置，则设置默认值
      const modelCapabilities = getModelCapabilitiesWithCustomConfig(
        session.mask.modelConfig.model,
      );
      if (
        modelCapabilities.reasoning &&
        modelCapabilities.thinkingType &&
        session.mask.modelConfig.thinkingBudget === undefined
      ) {
        session.mask.modelConfig.thinkingBudget = -1; // 默认为动态思考
      }

      // 根据新模型自动更新压缩阈值
      const autoThreshold = getModelCompressThreshold(nextModel.name);
      session.mask.modelConfig.compressMessageLengthThreshold = autoThreshold;
    });
    showToast(
      nextModel?.provider?.providerName == "ByteDance"
        ? nextModel.displayName
        : nextModel.name,
    );
  }, 100); // 100ms 防抖

  const leftActions = (
    <>
      {!props.hitBottom && (
        <ChatAction
          onClick={props.scrollToBottom}
          text={Locale.Chat.InputActions.ToBottom}
          icon={<BottomIcon />}
        />
      )}

      {canUploadAttachment && (
        <ChatAction
          onClick={props.uploadAttachment}
          text={Locale.Chat.InputActions.UploadAttachment}
          icon={props.uploading ? <LoadingButtonIcon /> : <ImageIcon />}
        />
      )}
      <ChatAction
        onClick={nextTheme}
        text={Locale.Chat.InputActions.Theme[theme]}
        icon={
          <>
            {theme === Theme.Auto ? (
              <AutoIcon />
            ) : theme === Theme.Light ? (
              <LightIcon />
            ) : theme === Theme.Dark ? (
              <DarkIcon />
            ) : null}
          </>
        }
      />

      <ChatAction
        onClick={props.showPromptHints}
        text={Locale.Chat.InputActions.Prompt}
        icon={<PromptIcon />}
      />

      <ChatAction
        text={Locale.Chat.InputActions.Clear}
        icon={<BreakIcon />}
        onClick={() => {
          chatStore.updateTargetSession(session, (session) => {
            if (session.clearContextIndex === session.messages.length) {
              session.clearContextIndex = undefined;
            } else {
              session.clearContextIndex = session.messages.length;
              session.memoryPrompt = ""; // will clear memory
            }
          });
        }}
      />

      {supportsCustomSize(currentModel) && (
        <ChatAction
          onClick={() => setShowSizeSelector(true)}
          text={currentSize}
          icon={<SizeIcon />}
        />
      )}

      {showSizeSelector && (
        <Selector
          defaultSelectedValue={currentSize}
          items={modelSizes.map((m) => ({
            title: m,
            value: m,
          }))}
          onClose={() => setShowSizeSelector(false)}
          onSelection={(s) => {
            if (s.length === 0) return;
            const size = s[0];
            chatStore.updateTargetSession(session, (session) => {
              session.mask.modelConfig.size = size;
            });
            showToast(size);
          }}
        />
      )}

      {isDalle3(currentModel) && (
        <ChatAction
          onClick={() => setShowQualitySelector(true)}
          text={currentQuality}
          icon={<QualityIcon />}
        />
      )}

      {showQualitySelector && (
        <Selector
          defaultSelectedValue={currentQuality}
          items={dalle3Qualitys.map((m) => ({
            title: m,
            value: m,
          }))}
          onClose={() => setShowQualitySelector(false)}
          onSelection={(q) => {
            if (q.length === 0) return;
            const quality = q[0];
            chatStore.updateTargetSession(session, (session) => {
              session.mask.modelConfig.quality = quality;
            });
            showToast(quality);
          }}
        />
      )}

      {isDalle3(currentModel) && (
        <ChatAction
          onClick={() => setShowStyleSelector(true)}
          text={currentStyle}
          icon={<StyleIcon />}
        />
      )}

      {showStyleSelector && (
        <Selector
          defaultSelectedValue={currentStyle}
          items={dalle3Styles.map((m) => ({
            title: m,
            value: m,
          }))}
          onClose={() => setShowStyleSelector(false)}
          onSelection={(s) => {
            if (s.length === 0) return;
            const style = s[0];
            chatStore.updateTargetSession(session, (session) => {
              session.mask.modelConfig.style = style;
            });
            showToast(style);
          }}
        />
      )}

      {!isMobileScreen && (
        <ChatAction
          onClick={() =>
            props.setShowShortcutKeyPanel(!props.showShortcutKeyPanel)
          }
          text={Locale.Chat.ShortcutKey.Title}
          icon={<ShortcutkeyIcon />}
          dataAttribute="data-shortcut-button"
        />
      )}
      {(() => {
        const currentModel = session.mask.modelConfig.model;
        const modelCapabilities =
          getModelCapabilitiesWithCustomConfig(currentModel);
        return (
          modelCapabilities.reasoning &&
          modelCapabilities.thinkingType && (
            <ChatAction
              onClick={() =>
                props.setShowThinkingPanel(!props.showThinkingPanel)
              }
              text={Locale.Chat.Thinking.Title}
              icon={<BrainIcon />}
              dataAttribute="data-thinking-button"
            />
          )
        );
      })()}
      {(() => {
        const currentModel = session.mask.modelConfig.model;
        // 使用更精确的搜索模型检测
        const supportsSearch = isWebSearchModel(currentModel);

        if (!supportsSearch) return null;

        const searchEnabled = session.searchEnabled ?? false;

        return (
          <ChatAction
            onClick={() => {
              const newSearchEnabled = !searchEnabled;
              chatStore.updateTargetSession(session, (session) => {
                session.searchEnabled = newSearchEnabled;
              });

              // 显示状态切换提醒
              showToast(
                newSearchEnabled
                  ? Locale.Chat.InputActions.SearchEnabledToast
                  : Locale.Chat.InputActions.SearchDisabledToast,
              );
            }}
            text={
              searchEnabled
                ? Locale.Chat.InputActions.SearchOn
                : Locale.Chat.InputActions.SearchOff
            }
            icon={<SearchIcon />}
            dataAttribute="data-search-button"
          />
        );
      })()}
      {!isMobileScreen && (
        <MCPAction
          onTogglePanel={() => props.setShowMcpPanel(!props.showMcpPanel)}
        />
      )}
      {config.enableMultiModel && (
        <MultiModelAction onToggle={() => props.toggleMultiModelMode()} />
      )}
    </>
  );
  const rightActions = (
    <>
      {config.realtimeConfig.enable && (
        <ChatAction
          onClick={() => props.setShowChatSidePanel(true)}
          text={"Realtime Chat"}
          icon={<HeadphoneIcon />}
        />
      )}

      {/* Token计数器和模型选择器 - 固定在右侧 */}
      <div className={styles["model-selector-container"]}>
        <TokenCounter
          session={session}
          currentModel={currentModel}
          userInput={props.userInput}
        />
        <button
          className={styles["model-selector-button"]}
          onClick={() => props.setShowModelSelector(true)}
        >
          {session.multiModelMode?.enabled &&
          session.multiModelMode.selectedModels.length > 1 ? (
            <>
              <div className={styles["model-icon"]}>
                <BrainIcon />
              </div>
              <span className={styles["model-name"]}>
                {session.multiModelMode.selectedModels
                  .map((modelKey) => {
                    const [modelName] = modelKey.split("@");
                    return modelName;
                  })
                  .join(" / ")}
              </span>
            </>
          ) : (
            <>
              <div className={styles["model-icon"]}>
                <ProviderIcon
                  provider={currentProviderName}
                  size={16}
                  modelName={currentModel}
                />
              </div>
              <span className={styles["model-name"]}>{currentModelName}</span>
            </>
          )}
        </button>

        {props.showModelSelector &&
          (!config.enableMultiModel || !session.multiModelMode?.enabled) && (
            <ModelSelectorModal
              defaultSelectedValue={`${currentModel}@${currentProviderName}`}
              groups={modelGroups}
              searchPlaceholder={Locale.Chat.UI.SearchModels}
              onClose={() => props.setShowModelSelector(false)}
              onSelection={(selectedValue) => {
                const [model, providerId] = getModelProvider(selectedValue);
                chatStore.updateTargetSession(session, (session) => {
                  session.mask.modelConfig.model = model as ModelType;
                  // 直接保存 providerId（支持 custom_ 前缀），避免被标准化为内置服务商
                  session.mask.modelConfig.providerName = providerId! as any;
                  session.mask.syncGlobalConfig = false;

                  // 检查新模型是否支持thinking功能，如果支持且thinkingBudget未设置，则设置默认值
                  const modelCapabilities =
                    getModelCapabilitiesWithCustomConfig(
                      session.mask.modelConfig.model,
                    );
                  if (
                    modelCapabilities.reasoning &&
                    modelCapabilities.thinkingType &&
                    session.mask.modelConfig.thinkingBudget === undefined
                  ) {
                    session.mask.modelConfig.thinkingBudget = -1; // 默认为动态思考
                  }

                  // 根据新模型自动更新压缩阈值
                  const autoThreshold = getModelCompressThreshold(model);
                  session.mask.modelConfig.compressMessageLengthThreshold =
                    autoThreshold;
                });

                const selectedModel = models.find(
                  (m) => m.name == model && m?.provider?.id == providerId,
                );

                if (providerId == "ByteDance") {
                  showToast(selectedModel?.displayName ?? "");
                } else {
                  showToast(selectedModel?.displayName || model);
                }
              }}
            />
          )}

        {props.showModelSelector &&
          config.enableMultiModel &&
          session.multiModelMode?.enabled && (
            <MultiModelSelectorModal
              groups={modelGroups}
              defaultSelectedValues={
                session.multiModelMode?.selectedModels || []
              }
              searchPlaceholder={Locale.Chat.UI.SearchModels}
              onClose={() => props.setShowModelSelector(false)}
              onSelection={(selectedValues) => {
                // 确保至少选择了两个模型
                if (selectedValues.length < 2) {
                  showToast(Locale.Chat.MultiModel.MinimumModelsError);
                  return;
                }

                chatStore.updateTargetSession(session, (session) => {
                  if (!session.multiModelMode) {
                    session.multiModelMode = {
                      enabled: true,
                      selectedModels: [],
                      modelMessages: {},
                      modelStats: {},
                      modelMemoryPrompts: {},
                      modelSummarizeIndexes: {},
                    };
                  }

                  session.multiModelMode.selectedModels = selectedValues;
                  session.multiModelMode.enabled = true; // 确保启用多模型模式

                  // 初始化新选中模型的数据结构
                  selectedValues.forEach((modelKey) => {
                    if (!session.multiModelMode!.modelMessages[modelKey]) {
                      session.multiModelMode!.modelMessages[modelKey] = [];
                    }
                    if (!session.multiModelMode!.modelStats[modelKey]) {
                      session.multiModelMode!.modelStats[modelKey] = {
                        tokenCount: 0,
                        wordCount: 0,
                        charCount: 0,
                      };
                    }
                    if (!session.multiModelMode!.modelMemoryPrompts[modelKey]) {
                      session.multiModelMode!.modelMemoryPrompts[modelKey] = "";
                    }
                    if (
                      !session.multiModelMode!.modelSummarizeIndexes[modelKey]
                    ) {
                      session.multiModelMode!.modelSummarizeIndexes[
                        modelKey
                      ] = 0;
                    }
                  });

                  // 清理不再选中的模型数据
                  const currentKeys = Object.keys(
                    session.multiModelMode.modelMessages,
                  );
                  currentKeys.forEach((key) => {
                    if (!selectedValues.includes(key)) {
                      delete session.multiModelMode!.modelMessages[key];
                      delete session.multiModelMode!.modelStats[key];
                      delete session.multiModelMode!.modelMemoryPrompts[key];
                      delete session.multiModelMode!.modelSummarizeIndexes[key];
                    }
                  });
                });

                showToast(
                  Locale.Chat.MultiModel.ModelsSelectedToast(
                    selectedValues.length,
                  ),
                );
              }}
            />
          )}
      </div>
    </>
  );

  useEffect(() => {
    if (modelAvailability.nextModel) {
      updateSessionModel(modelAvailability.nextModel);
    }
  }, [modelAvailability.nextModel, updateSessionModel]);

  return (
    <div className={styles["chat-input-actions"]}>
      {isMobileScreen ? (
        // 移动端
        <>
          {leftActions}
          {rightActions}
        </>
      ) : (
        // PC端
        <>
          {leftActions}
          <div className={styles["chat-input-actions-end"]}>{rightActions}</div>
        </>
      )}
    </div>
  );
}

export function EditMessageModal(props: { onClose: () => void }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const [messages, setMessages] = useState(session.messages.slice());

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Chat.EditMessage.Title}
        onClose={props.onClose}
        actions={[
          <IconButton
            text={Locale.UI.Cancel}
            icon={<CancelIcon />}
            key="cancel"
            onClick={() => {
              props.onClose();
            }}
          />,
          <IconButton
            type="primary"
            text={Locale.UI.Confirm}
            icon={<ConfirmIcon />}
            key="ok"
            onClick={() => {
              chatStore.updateTargetSession(
                session,
                (session) => (session.messages = messages),
              );
              props.onClose();
            }}
          />,
        ]}
      >
        <List>
          <ListItem
            title={Locale.Chat.EditMessage.Topic.Title}
            subTitle={Locale.Chat.EditMessage.Topic.SubTitle}
          >
            <input
              type="text"
              value={session.topic}
              onInput={(e) =>
                chatStore.updateTargetSession(
                  session,
                  (session) => (session.topic = e.currentTarget.value),
                )
              }
            ></input>
          </ListItem>
        </List>
        <ContextPrompts
          context={messages}
          updateContext={(updater) => {
            const newMessages = messages.slice();
            updater(newMessages);
            setMessages(newMessages);
          }}
        />
      </Modal>
    </div>
  );
}

export function DeleteImageButton(props: { deleteImage: () => void }) {
  return (
    <div className={styles["delete-image"]} onClick={props.deleteImage}>
      <DeleteIcon />
    </div>
  );
}

export function ShortcutKeyModal(props: { onClose: () => void }) {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const shortcuts = [
    {
      title: Locale.Chat.ShortcutKey.newChat,
      keys: isMac ? ["⌘", "Shift", "O"] : ["Ctrl", "Shift", "O"],
    },
    { title: Locale.Chat.ShortcutKey.focusInput, keys: ["Shift", "Esc"] },
    {
      title: Locale.Chat.ShortcutKey.copyLastCode,
      keys: isMac ? ["⌘", "Shift", ";"] : ["Ctrl", "Shift", ";"],
    },
    {
      title: Locale.Chat.ShortcutKey.copyLastMessage,
      keys: isMac ? ["⌘", "Shift", "C"] : ["Ctrl", "Shift", "C"],
    },
    {
      title: Locale.Chat.ShortcutKey.showShortcutKey,
      keys: isMac ? ["⌘", "/"] : ["Ctrl", "/"],
    },
    {
      title: Locale.Chat.ShortcutKey.clearContext,
      keys: isMac
        ? ["⌘", "Shift", "backspace"]
        : ["Ctrl", "Shift", "backspace"],
    },
  ];
  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Chat.ShortcutKey.Title}
        onClose={props.onClose}
        actions={[
          <IconButton
            type="primary"
            text={Locale.UI.Confirm}
            icon={<ConfirmIcon />}
            key="ok"
            onClick={() => {
              props.onClose();
            }}
          />,
        ]}
      >
        <div className={styles["shortcut-key-container"]}>
          <div className={styles["shortcut-key-grid"]}>
            {shortcuts.map((shortcut, index) => (
              <div key={index} className={styles["shortcut-key-item"]}>
                <div className={styles["shortcut-key-title"]}>
                  {shortcut.title}
                </div>
                <div className={styles["shortcut-key-keys"]}>
                  {shortcut.keys.map((key, i) => (
                    <div key={i} className={styles["shortcut-key"]}>
                      <span>{key}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ChatInner() {
  type RenderMessage = ChatMessage & { preview?: boolean };

  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const config = useAppConfig();
  const fontSize = config.fontSize;
  const fontFamily = config.fontFamily;
  const [ratio, setRatio] = useState<number>(1); // 預設正方形
  const [showExport, setShowExport] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { submitKey, shouldSubmit } = useSubmitHandler();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolledToBottom = scrollRef?.current
    ? Math.abs(
        scrollRef.current.scrollHeight -
          (scrollRef.current.scrollTop + scrollRef.current.clientHeight),
      ) <= 1
    : false;
  const isAttachWithTop = useMemo(() => {
    const lastMessage = scrollRef.current?.lastElementChild as HTMLElement;
    // if scrolllRef is not ready or no message, return false
    if (!scrollRef?.current || !lastMessage) return false;
    const topDistance =
      lastMessage!.getBoundingClientRect().top -
      scrollRef.current.getBoundingClientRect().top;
    // leave some space for user question
    return topDistance < 100;
  }, []);

  const isTyping = userInput !== "";

  // if user is typing, should auto scroll to bottom
  // if user is not typing, should auto scroll to bottom only if already at bottom
  const { setAutoScroll, scrollDomToBottom } = useScrollToBottom(
    scrollRef,
    (isScrolledToBottom || isAttachWithTop) && !isTyping,
    session.messages,
  );
  const [hitBottom, setHitBottom] = useState(true);
  const isMobileScreen = useMobileScreen();
  const navigate = useNavigate();
  const { isCollapsed, toggleSideBarCollapse } = useDragSideBar();
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // prompt hints
  const promptStore = usePromptStore();
  const [promptHints, setPromptHints] = useState<RenderPrompt[]>([]);
  const onSearch = useDebouncedCallback(
    (text: string) => {
      const matchedPrompts = promptStore.search(text);
      setPromptHints(matchedPrompts);
    },
    100,
    { leading: true, trailing: true },
  );

  // auto grow input
  const [inputRows, setInputRows] = useState(2);
  const measure = useDebouncedCallback(
    () => {
      const rows = inputRef.current ? autoGrowTextArea(inputRef.current) : 1;
      const inputRows = Math.min(
        20,
        Math.max(2 + Number(!isMobileScreen), rows),
      );
      setInputRows(inputRows);
    },
    100,
    {
      leading: true,
      trailing: true,
    },
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(measure, [userInput]);

  // chat commands shortcuts
  const chatCommands = useChatCommand({
    new: () => chatStore.newSession(),
    newm: () => navigate(Path.NewChat),
    prev: () => chatStore.nextSession(-1),
    next: () => chatStore.nextSession(1),
    clear: () =>
      chatStore.updateTargetSession(
        session,
        (session) => (session.clearContextIndex = session.messages.length),
      ),
    fork: () => chatStore.forkSession(),
    del: () => chatStore.deleteSession(chatStore.currentSessionIndex),
  });

  // only search prompts when user input is short
  const SEARCH_TEXT_LIMIT = 30;
  const onInput = (text: string) => {
    setUserInput(text);
    const n = text.trim().length;

    // clear search results
    if (n === 0) {
      setPromptHints([]);
    } else if (text.match(ChatCommandPrefix)) {
      setPromptHints(chatCommands.search(text));
    } else if (!config.disablePromptHint && n < SEARCH_TEXT_LIMIT) {
      // check if need to trigger auto completion
      if (text.startsWith("/")) {
        let searchText = text.slice(1);
        onSearch(searchText);
      }
    }
  };

  const doSubmit = (userInput: string) => {
    if (userInput.trim() === "" && isEmpty(attachments)) return;
    const matchCommand = chatCommands.match(userInput);
    if (matchCommand.matched) {
      setUserInput("");
      setPromptHints([]);
      matchCommand.invoke();
      return;
    }
    setIsLoading(true);
    chatStore
      .onUserInput(userInput, attachments)
      .then(() => setIsLoading(false));
    setAttachments([]);
    chatStore.setLastInput(userInput);
    setUserInput("");
    setPromptHints([]);
    if (!isMobileScreen) inputRef.current?.focus();
    setAutoScroll(true);
  };

  const onPromptSelect = (prompt: RenderPrompt) => {
    setTimeout(() => {
      setPromptHints([]);

      const matchedChatCommand = chatCommands.match(prompt.content);
      if (matchedChatCommand.matched) {
        // if user is selecting a chat command, just trigger it
        matchedChatCommand.invoke();
        setUserInput("");
      } else {
        // or fill the prompt
        setUserInput(prompt.content);
      }
      inputRef.current?.focus();
    }, 30);
  };

  // stop response
  const onUserStop = (messageId: string) => {
    ChatControllerPool.stop(session.id, messageId);
  };

  useEffect(() => {
    chatStore.updateTargetSession(session, (session) => {
      const stopTiming = Date.now() - REQUEST_TIMEOUT_MS;
      session.messages.forEach((m) => {
        // check if should stop all stale messages
        if (m.isError || new Date(m.date).getTime() < stopTiming) {
          if (m.streaming) {
            m.streaming = false;
          }

          if (m.content.length === 0) {
            m.isError = true;
            m.content = prettyObject({
              error: true,
              message: "empty response",
            });
          }
        }
      });

      // auto sync mask config from global config
      if (session.mask.syncGlobalConfig) {
        session.mask.modelConfig = { ...config.modelConfig };
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // check if should send message
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // if ArrowUp and no userInput, fill with last input
    if (
      e.key === "ArrowUp" &&
      userInput.length <= 0 &&
      !(e.metaKey || e.altKey || e.ctrlKey)
    ) {
      setUserInput(chatStore.lastInput ?? "");
      e.preventDefault();
      return;
    }
    if (shouldSubmit(e) && promptHints.length === 0) {
      doSubmit(userInput);
      e.preventDefault();
    }
  };
  const onRightClick = (e: any, message: ChatMessage) => {
    // copy to clipboard
    if (
      selectOrCopy(
        e.currentTarget,
        getMessageTextContentWithoutThinking(message),
      )
    ) {
      if (userInput.length === 0) {
        setUserInput(getMessageTextContentWithoutThinking(message));
      }

      e.preventDefault();
    }
  };

  const deleteMessage = (msgId?: string) => {
    chatStore.updateTargetSession(
      session,
      (session) =>
        (session.messages = session.messages.filter((m) => m.id !== msgId)),
    );
  };

  const onDelete = (msgId: string) => {
    deleteMessage(msgId);
  };

  const onResend = (message: ChatMessage) => {
    // 重构后的重试逻辑：使用专门的重试方法
    const resendingIndex = session.messages.findIndex(
      (m) => m.id === message.id,
    );

    if (resendingIndex < 0 || resendingIndex >= session.messages.length) {
      return;
    }

    let userMessage: ChatMessage | undefined;
    let botMessage: ChatMessage | undefined;

    if (message.role === "assistant") {
      botMessage = message;
      for (let i = resendingIndex; i >= 0; i -= 1) {
        if (session.messages[i].role === "user") {
          userMessage = session.messages[i];
          break;
        }
      }
    } else if (message.role === "user") {
      userMessage = message;
      if (
        resendingIndex + 1 < session.messages.length &&
        session.messages[resendingIndex + 1].role === "assistant"
      ) {
        botMessage = session.messages[resendingIndex + 1];
      }
    }

    if (userMessage === undefined) {
      return;
    }

    // 如果是重试 bot 消息，使用专门的重试方法
    if (botMessage) {
      setIsLoading(true);
      chatStore
        .retryBotMessage(botMessage.id, userMessage)
        .then(() => {
          setIsLoading(false);
        })
        .catch((error) => {
          setIsLoading(false);
        });
      inputRef.current?.focus();
      return;
    }

    // 如果是重试用户消息，使用原有逻辑（删除后续消息并重新发送）
    deleteMessage(userMessage.id);
    setIsLoading(true);
    const textContent = getMessageTextContent(userMessage);
    const messageAttachments = getMessageAttachments(userMessage);
    chatStore
      .onUserInput(textContent, messageAttachments)
      .then(() => setIsLoading(false));
    inputRef.current?.focus();
  };

  // 切换到上一个版本
  const onPreviousVersion = (message: ChatMessage) => {
    chatStore.updateTargetSession(session, (session) => {
      const messageIndex = session.messages.findIndex(
        (m) => m.id === message.id,
      );
      if (messageIndex >= 0) {
        const currentMessage = session.messages[messageIndex];
        if (currentMessage.versions && currentMessage.versions.length >= 1) {
          const currentIndex = currentMessage.currentVersionIndex ?? 0;
          if (currentIndex > 0) {
            currentMessage.currentVersionIndex = currentIndex - 1;
          }
        }
      }
    });
  };

  // 切换到下一个版本
  const onNextVersion = (message: ChatMessage) => {
    chatStore.updateTargetSession(session, (session) => {
      const messageIndex = session.messages.findIndex(
        (m) => m.id === message.id,
      );
      if (messageIndex >= 0) {
        const currentMessage = session.messages[messageIndex];
        if (currentMessage.versions && currentMessage.versions.length >= 1) {
          const currentIndex = currentMessage.currentVersionIndex ?? 0;
          const maxIndex = currentMessage.versions.length;
          if (currentIndex < maxIndex) {
            currentMessage.currentVersionIndex = currentIndex + 1;
          }
        }
      }
    });
  };

  // 获取当前显示的消息内容
  const getCurrentMessageContent = (message: ChatMessage): string => {
    // 若消息没有版本，优先返回字符串；否则从多模态数组里提取文本
    if (!message.versions || message.versions.length < 1) {
      return getMessageDisplayContent(message);
    }

    const currentIndex = message.currentVersionIndex ?? 0;
    if (currentIndex === message.versions.length) {
      // 显示最新版本（当前消息内容）
      return getMessageDisplayContent(message);
    } else if (currentIndex >= 0 && currentIndex < message.versions.length) {
      // 显示历史版本（字符串）
      return message.versions[currentIndex];
    }

    return getMessageDisplayContent(message);
  };

  const renderMessageMeta = (message: ChatMessage, isContext: boolean) => {
    const meta = isContext
      ? (Locale.Chat.IsContext as string)
      : formatMessageMeta(message, isMobileScreen);

    if (Array.isArray(meta)) {
      return (
        <>
          {meta.map((line, index) => (
            <React.Fragment key={`${message.id}-meta-${index}`}>
              {index > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
        </>
      );
    }

    return meta;
  };

  const onPinMessage = (message: ChatMessage) => {
    chatStore.updateTargetSession(session, (session) =>
      session.mask.context.push(message),
    );

    showToast(Locale.Chat.Actions.PinToastContent, {
      text: Locale.Chat.Actions.PinToastAction,
      onClick: () => {
        setShowPromptModal(true);
      },
    });
  };

  const accessStore = useAccessStore();
  const [speechStatus, setSpeechStatus] = useState(false);
  const [speechLoading, setSpeechLoading] = useState(false);

  // 创建专门用于 TTS 的 API 客户端，始终使用 OpenAI TTS 配置
  function createTTSApi(): ClientApi {
    // 始终使用 OpenAI 作为 TTS 提供商，不受当前对话模型影响
    return new ClientApi(ModelProvider.GPT);
  }

  async function openaiSpeech(text: string) {
    if (speechStatus) {
      ttsPlayer.stop();
      setSpeechStatus(false);
    } else {
      const config = useAppConfig.getState();
      setSpeechLoading(true);
      ttsPlayer.init();
      let audioBuffer: ArrayBuffer;
      const { markdownToTxt } = require("markdown-to-txt");
      const textContent = markdownToTxt(text);

      if (config.ttsConfig.engine !== DEFAULT_TTS_ENGINE) {
        const edgeVoiceName = accessStore.edgeVoiceName();
        const tts = new MsEdgeTTS();
        await tts.setMetadata(
          edgeVoiceName,
          OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
        );
        audioBuffer = await tts.toArrayBuffer(textContent);
      } else {
        // 创建专门用于 TTS 的 API 客户端，确保使用 OpenAI TTS 配置
        const ttsApi = createTTSApi();

        audioBuffer = await ttsApi.llm.speech({
          model: config.ttsConfig.model,
          input: textContent,
          voice: config.ttsConfig.voice,
          speed: config.ttsConfig.speed,
        });
      }

      setSpeechStatus(true);
      ttsPlayer
        .play(audioBuffer, () => {
          setSpeechStatus(false);
        })
        .catch((e) => {
          console.error("[OpenAI Speech]", e);
          showToast(prettyObject(e));
          setSpeechStatus(false);
        })
        .finally(() => setSpeechLoading(false));
    }
  }

  const context: RenderMessage[] = useMemo(() => {
    return session.mask.hideContext ? [] : session.mask.context.slice();
  }, [session.mask.context, session.mask.hideContext]);

  if (
    context.length === 0 &&
    session.messages.at(0)?.content !== BOT_HELLO.content
  ) {
    const copiedHello = Object.assign({}, BOT_HELLO);
    // 仅当：未通过访问码认证 且 没有启用任何服务商 时才提示
    const hasAnyProviderEnabled = Object.values(
      accessStore.enabledProviders || {},
    ).some(Boolean);
    if (!accessStore.isAuthorized() && !hasAnyProviderEnabled) {
      copiedHello.content = Locale.Error.Unauthorized;
    }
    context.push(copiedHello);
  }

  // preview messages
  const renderMessages = useMemo(() => {
    const previewContent =
      attachments.length > 0
        ? buildUserMessageContent(userInput, attachments)
        : userInput;

    return context.concat(session.messages as RenderMessage[]).concat(
      (userInput.length > 0 || attachments.length > 0) &&
        config.sendPreviewBubble
        ? [
            {
              ...createMessage({
                role: "user",
                content: previewContent,
              }),
              preview: true,
            },
          ]
        : [],
    );
  }, [
    attachments,
    config.sendPreviewBubble,
    context,
    session.messages,
    userInput,
  ]);

  const [msgRenderIndex, _setMsgRenderIndex] = useState(
    Math.max(0, renderMessages.length - CHAT_PAGE_SIZE),
  );

  function setMsgRenderIndex(newIndex: number) {
    newIndex = Math.min(renderMessages.length - CHAT_PAGE_SIZE, newIndex);
    newIndex = Math.max(0, newIndex);
    _setMsgRenderIndex(newIndex);
  }

  const messages = useMemo(() => {
    const endRenderIndex = Math.min(
      msgRenderIndex + 3 * CHAT_PAGE_SIZE,
      renderMessages.length,
    );
    return renderMessages.slice(msgRenderIndex, endRenderIndex);
  }, [msgRenderIndex, renderMessages]);

  const onChatBodyScroll = (e: HTMLElement) => {
    const bottomHeight = e.scrollTop + e.clientHeight;
    const edgeThreshold = e.clientHeight;

    const isTouchTopEdge = e.scrollTop <= edgeThreshold;
    const isTouchBottomEdge = bottomHeight >= e.scrollHeight - edgeThreshold;
    const isHitBottom =
      bottomHeight >= e.scrollHeight - (isMobileScreen ? 4 : 10);

    const prevPageMsgIndex = msgRenderIndex - CHAT_PAGE_SIZE;
    const nextPageMsgIndex = msgRenderIndex + CHAT_PAGE_SIZE;

    if (isTouchTopEdge && !isTouchBottomEdge) {
      setMsgRenderIndex(prevPageMsgIndex);
    } else if (isTouchBottomEdge) {
      setMsgRenderIndex(nextPageMsgIndex);
    }

    setHitBottom(isHitBottom);
    setAutoScroll(isHitBottom);
  };

  function scrollToBottom() {
    setMsgRenderIndex(renderMessages.length - CHAT_PAGE_SIZE);
    scrollDomToBottom();
  }

  // clear context index = context length + index in messages
  const clearContextIndex =
    (session.clearContextIndex ?? -1) >= 0
      ? session.clearContextIndex! + context.length - msgRenderIndex
      : -1;

  const [showPromptModal, setShowPromptModal] = useState(false);

  const clientConfig = useMemo(() => getClientConfig(), []);

  const autoFocus = !isMobileScreen; // wont auto focus on mobile screen
  const showMaxIcon = !isMobileScreen && !clientConfig?.isApp;

  useCommand({
    fill: setUserInput,
    submit: (text) => {
      doSubmit(text);
    },
    code: (text) => {
      if (accessStore.disableFastLink) return;
      console.log("[Command] got code from url: ", text);
      showConfirm(Locale.URLCommand.Code + `code = ${text}`).then((res) => {
        if (res) {
          accessStore.update((access) => (access.accessCode = text));
        }
      });
    },
    settings: (text) => {
      if (accessStore.disableFastLink) return;

      try {
        const payload = JSON.parse(text) as {
          key?: string;
          url?: string;
        };

        console.log("[Command] got settings from url: ", payload);

        if (payload.key || payload.url) {
          showConfirm(
            Locale.URLCommand.Settings +
              `\n${JSON.stringify(payload, null, 4)}`,
          ).then((res) => {
            if (!res) return;
            if (payload.key) {
              accessStore.update(
                (access) => (access.openaiApiKey = payload.key!),
              );
            }
            if (payload.url) {
              accessStore.update((access) => (access.openaiUrl = payload.url!));
            }
            accessStore.update((access) => (access.useCustomConfig = true));
          });
        }
      } catch {
        console.error("[Command] failed to get settings from url: ", text);
      }
    },
  });

  // edit / insert message modal
  const [isEditingMessage, setIsEditingMessage] = useState(false);

  // remember unfinished input
  useEffect(() => {
    // try to load from local storage
    const key = UNFINISHED_INPUT(session.id);
    const mayBeUnfinishedInput = localStorage.getItem(key);
    if (mayBeUnfinishedInput && userInput.length === 0) {
      setUserInput(mayBeUnfinishedInput);
      localStorage.removeItem(key);
    }

    const dom = inputRef.current;
    return () => {
      localStorage.setItem(key, dom?.value ?? "");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = (event.clipboardData || window.clipboardData).items;
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          event.preventDefault();
          const file = item.getAsFile();
          if (file) {
            setUploading(true);
            try {
              const nextAttachment = await buildAttachmentFromFile(file);
              setAttachments((prev) => [...prev, nextAttachment]);
            } finally {
              setUploading(false);
            }
          }
        }
      }
    },
    [],
  );

  async function uploadAttachment() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept =
      "image/png,image/jpeg,image/webp,image/heic,image/heif,text/plain,text/markdown,.md,.txt,.json,.csv,.log,.yaml,.yml,.xml";
    fileInput.multiple = true;
    fileInput.onchange = async (event: any) => {
      const files = Array.from(event.target.files || []) as File[];
      if (files.length === 0) return;

      setUploading(true);
      try {
        const nextAttachments = await Promise.all(
          files.map((file) => buildAttachmentFromFile(file)),
        );
        setAttachments((prev) => [...prev, ...nextAttachments]);
      } finally {
        setUploading(false);
      }
    };
    fileInput.click();
  }

  // 快捷键 shortcut keys
  const [showShortcutKeyModal, setShowShortcutKeyModal] = useState(false);
  const [showShortcutKeyPanel, setShowShortcutKeyPanel] = useState(false);

  // 思考深度面板
  const [showThinkingPanel, setShowThinkingPanel] = useState(false);

  // MCP 面板
  const [showMcpPanel, setShowMcpPanel] = useState(false);

  // 多模型面板
  const [showMultiModelPanel, setShowMultiModelPanel] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);

  // 切换多模型模式
  const toggleMultiModelMode = () => {
    if (!config.enableMultiModel) {
      return;
    }

    chatStore.updateTargetSession(session, (session) => {
      if (!session.multiModelMode) {
        session.multiModelMode = {
          enabled: false,
          selectedModels: [],
          modelMessages: {},
          modelStats: {},
          modelMemoryPrompts: {},
          modelSummarizeIndexes: {},
        };
      }

      const wasEnabled = session.multiModelMode.enabled;
      session.multiModelMode.enabled = !wasEnabled;

      // 如果关闭多模型模式，清空选中的模型
      if (wasEnabled) {
        session.multiModelMode.selectedModels = [];
        session.multiModelMode.modelMessages = {};
        session.multiModelMode.modelStats = {};
        session.multiModelMode.modelMemoryPrompts = {};
        session.multiModelMode.modelSummarizeIndexes = {};
      }
    });

    // 显示提示消息
    if (session.multiModelMode?.enabled) {
      showToast(Locale.Chat.MultiModel.EnableToast);
    } else {
      showToast(Locale.Chat.MultiModel.DisableToast);
    }
  };

  useEffect(() => {
    if (!config.enableMultiModel) {
      chatStore.updateTargetSession(session, (session) => {
        if (!session.multiModelMode) {
          return;
        }
        session.multiModelMode.enabled = false;
        session.multiModelMode.selectedModels = [];
        session.multiModelMode.modelMessages = {};
        session.multiModelMode.modelStats = {};
        session.multiModelMode.modelMemoryPrompts = {};
        session.multiModelMode.modelSummarizeIndexes = {};
      });
      setShowMultiModelPanel(false);
      setShowModelSelector(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.enableMultiModel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 打开新聊天 command + shift + o
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "o"
      ) {
        event.preventDefault();
        setTimeout(() => {
          chatStore.newSession();
          navigate(Path.Chat);
        }, 10);
      }
      // 聚焦聊天输入 shift + esc
      else if (event.shiftKey && event.key.toLowerCase() === "escape") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      // 复制最后一个代码块 command + shift + ;
      else if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.code === "Semicolon"
      ) {
        event.preventDefault();
        const copyCodeButton =
          document.querySelectorAll<HTMLElement>(".copy-code-button");
        if (copyCodeButton.length > 0) {
          copyCodeButton[copyCodeButton.length - 1].click();
        }
      }
      // 复制最后一个回复 command + shift + c
      else if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "c"
      ) {
        event.preventDefault();
        const lastNonUserMessage = messages
          .filter((message) => message.role !== "user")
          .pop();
        if (lastNonUserMessage) {
          const lastMessageContent =
            getMessageTextContentWithoutThinking(lastNonUserMessage);
          copyToClipboard(lastMessageContent);
        }
      }
      // 展示快捷键 command + /
      else if ((event.metaKey || event.ctrlKey) && event.key === "/") {
        event.preventDefault();
        setShowShortcutKeyPanel(!showShortcutKeyPanel);
      }
      // 清除上下文 command + shift + backspace
      else if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "backspace"
      ) {
        event.preventDefault();
        chatStore.updateTargetSession(session, (session) => {
          if (session.clearContextIndex === session.messages.length) {
            session.clearContextIndex = undefined;
          } else {
            session.clearContextIndex = session.messages.length;
            session.memoryPrompt = ""; // will clear memory
          }
        });
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [messages, chatStore, navigate, session, showShortcutKeyPanel]);

  const [showChatSidePanel, setShowChatSidePanel] = useState(false);

  return (
    <>
      <div className={styles.chat} key={session.id}>
        <div className="window-header" data-tauri-drag-region>
          {isMobileScreen && (
            <div className="window-actions">
              <div className={"window-action-button"}>
                <IconButton
                  icon={<ReturnIcon />}
                  bordered
                  title={Locale.Chat.Actions.ChatList}
                  onClick={() => navigate(Path.Home)}
                />
              </div>
            </div>
          )}

          <div
            className={clsx("window-header-title", styles["chat-body-title"])}
            style={{ display: "flex", alignItems: "center", gap: "10px" }}
          >
            {!isMobileScreen && (
              <div className="window-action-button">
                <IconButton
                  icon={<MenuIcon />}
                  bordered
                  title={Locale.Chat.UI.SidebarToggle}
                  onClick={toggleSideBarCollapse}
                />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div
                className={clsx(
                  "window-header-main-title",
                  styles["chat-body-main-title"],
                )}
                onClickCapture={() => setIsEditingMessage(true)}
              >
                {!session.topic ? DEFAULT_TOPIC : session.topic}
              </div>
              <div className="window-header-sub-title">
                <span>{Locale.Chat.SubTitle(session.messages.length)}</span>
                <span className={styles["chat-assistant-name"]}>
                  {session.mask.name}
                </span>
              </div>
            </div>
          </div>
          <div className="window-actions">
            <div className="window-action-button">
              <IconButton
                icon={<ReloadIcon />}
                bordered
                title={Locale.Chat.Actions.RefreshTitle}
                onClick={() => {
                  showToast(Locale.Chat.Actions.RefreshToast);
                  chatStore.summarizeSession(true, session);
                }}
              />
            </div>
            {!isMobileScreen && (
              <div className="window-action-button">
                <IconButton
                  icon={<RenameIcon />}
                  bordered
                  title={Locale.Chat.EditMessage.Title}
                  aria={Locale.Chat.EditMessage.Title}
                  onClick={() => setIsEditingMessage(true)}
                />
              </div>
            )}
            <div className="window-action-button">
              <IconButton
                icon={<ExportIcon />}
                bordered
                title={Locale.Chat.Actions.Export}
                onClick={() => {
                  setShowExport(true);
                }}
              />
            </div>
            {showMaxIcon && (
              <div className="window-action-button">
                <IconButton
                  icon={config.tightBorder ? <MinIcon /> : <MaxIcon />}
                  bordered
                  title={Locale.Chat.Actions.FullScreen}
                  aria={Locale.Chat.Actions.FullScreen}
                  onClick={() => {
                    config.update(
                      (config) => (config.tightBorder = !config.tightBorder),
                    );
                  }}
                />
              </div>
            )}
          </div>

          <PromptToast
            showToast={!hitBottom}
            showModal={showPromptModal}
            setShowModal={setShowPromptModal}
          />
        </div>
        <div className={styles["chat-main"]}>
          <div className={styles["chat-body-container"]}>
            <div
              className={styles["chat-body"]}
              ref={scrollRef}
              onScroll={(e) => onChatBodyScroll(e.currentTarget)}
              onMouseDown={() => inputRef.current?.blur()}
              onTouchStart={() => {
                inputRef.current?.blur();
                setAutoScroll(false);
              }}
            >
              {messages
                // TODO
                // .filter((m) => !m.isMcpResponse)
                .map((message, i) => {
                  const isUser = message.role === "user";
                  const isContext = i < context.length;
                  const showActions =
                    i > 0 &&
                    !(message.preview || message.content.length === 0) &&
                    !isContext;
                  const showTyping = message.preview || message.streaming;

                  const shouldShowClearContextDivider =
                    i === clearContextIndex - 1;

                  return (
                    <Fragment key={message.id}>
                      <div
                        className={
                          isUser
                            ? styles["chat-message-user"]
                            : styles["chat-message"]
                        }
                      >
                        <div className={styles["chat-message-container"]}>
                          <div className={styles["chat-message-header"]}>
                            <div className={styles["chat-message-avatar"]}>
                              <div className={styles["chat-message-edit"]}>
                                <IconButton
                                  icon={<EditIcon />}
                                  aria={Locale.Chat.Actions.Edit}
                                  onClick={async () => {
                                    const newMessage = await showPrompt(
                                      Locale.Chat.Actions.Edit,
                                      getMessageTextContent(message),
                                      10,
                                    );
                                    let newContent:
                                      | string
                                      | MultimodalContent[] = newMessage;
                                    const messageAttachments =
                                      getMessageAttachments(message);
                                    if (messageAttachments.length > 0) {
                                      newContent = buildUserMessageContent(
                                        newMessage,
                                        messageAttachments,
                                      );
                                    }
                                    chatStore.updateTargetSession(
                                      session,
                                      (session) => {
                                        const m = session.mask.context
                                          .concat(session.messages)
                                          .find((m) => m.id === message.id);
                                        if (m) {
                                          m.content = newContent;
                                        }
                                      },
                                    );
                                  }}
                                ></IconButton>
                              </div>
                              {isUser ? (
                                <Avatar avatar={config.avatar} />
                              ) : (
                                <>
                                  {["system"].includes(message.role) ? (
                                    <Avatar avatar="2699-fe0f" />
                                  ) : (
                                    <Avatar
                                      model={
                                        message.model ||
                                        session.mask.modelConfig.model
                                      }
                                    />
                                  )}
                                </>
                              )}
                            </div>
                            {!isUser && (
                              <div className={styles["chat-model-name"]}>
                                {message.isMultiModel && message.modelKey ? (
                                  <>
                                    {message.model}
                                    <span
                                      className={styles["chat-model-provider"]}
                                    >
                                      @{message.modelKey.split("@")[1]}
                                    </span>
                                  </>
                                ) : (
                                  message.model
                                )}
                              </div>
                            )}
                            {showActions && (
                              <div className={styles["chat-message-actions"]}>
                                <div className={styles["chat-input-actions"]}>
                                  {message.streaming ? (
                                    <ChatAction
                                      text={Locale.Chat.Actions.Stop}
                                      icon={<StopIcon />}
                                      onClick={() =>
                                        onUserStop(message.id ?? i)
                                      }
                                    />
                                  ) : (
                                    <>
                                      <ChatAction
                                        text={Locale.Chat.Actions.Retry}
                                        icon={<ResetIcon />}
                                        onClick={() => onResend(message)}
                                      />

                                      {/* 版本切换按钮 - 只对 assistant 消息显示 */}
                                      {(() => {
                                        const shouldShowVersionControls =
                                          message.role === "assistant" &&
                                          message.versions &&
                                          message.versions.length >= 1;

                                        return (
                                          shouldShowVersionControls && (
                                            <>
                                              {(message.currentVersionIndex ??
                                                0) > 0 && (
                                                <ChatAction
                                                  text={
                                                    Locale.Chat.Actions
                                                      .PreviousVersion
                                                  }
                                                  icon={<LeftIcon />}
                                                  onClick={() =>
                                                    onPreviousVersion(message)
                                                  }
                                                />
                                              )}

                                              {(message.currentVersionIndex ??
                                                0) <
                                                (message.versions?.length ??
                                                  0) && (
                                                <ChatAction
                                                  text={
                                                    Locale.Chat.Actions
                                                      .NextVersion
                                                  }
                                                  icon={<RightIcon />}
                                                  onClick={() =>
                                                    onNextVersion(message)
                                                  }
                                                />
                                              )}
                                            </>
                                          )
                                        );
                                      })()}

                                      <ChatAction
                                        text={Locale.Chat.Actions.Delete}
                                        icon={<DeleteIcon />}
                                        onClick={() =>
                                          onDelete(message.id ?? i)
                                        }
                                      />

                                      <ChatAction
                                        text={Locale.Chat.Actions.Pin}
                                        icon={<PinIcon />}
                                        onClick={() => onPinMessage(message)}
                                      />
                                      <ChatAction
                                        text={Locale.Chat.Actions.Copy}
                                        icon={<CopyIcon />}
                                        onClick={() =>
                                          copyToClipboard(
                                            getMessageTextContentWithoutThinking(
                                              message,
                                            ),
                                          )
                                        }
                                      />
                                      {config.ttsConfig.enable && (
                                        <ChatAction
                                          text={
                                            speechStatus
                                              ? Locale.Chat.Actions.StopSpeech
                                              : Locale.Chat.Actions.Speech
                                          }
                                          icon={
                                            speechStatus ? (
                                              <SpeakStopIcon />
                                            ) : (
                                              <SpeakIcon />
                                            )
                                          }
                                          onClick={() =>
                                            openaiSpeech(
                                              getMessageTextContent(message),
                                            )
                                          }
                                        />
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          {(message.tools?.length ?? 0) === 0 && showTyping && (
                            <div className={styles["chat-message-status"]}>
                              {Locale.Chat.Typing}
                            </div>
                          )}
                          <div className={styles["chat-message-item"]}>
                            <div className={styles["chat-message-body"]}>
                              <AssistantMessageBody
                                message={message}
                                isUser={isUser}
                                isMobileScreen={isMobileScreen}
                                fontSize={fontSize}
                                fontFamily={fontFamily}
                                scrollRef={scrollRef}
                                defaultShow={i >= messages.length - 6}
                                onFillInput={() =>
                                  setUserInput(getMessageTextContent(message))
                                }
                              />
                              {getMessageImages(message).length == 1 && (
                                <div
                                  className={
                                    styles["chat-message-item-image-container"]
                                  }
                                  style={{ aspectRatio: ratio }}
                                >
                                  <Image
                                    className={
                                      styles["chat-message-item-image"]
                                    }
                                    src={getMessageImages(message)[0]}
                                    alt=""
                                    fill
                                    unoptimized
                                    onLoadingComplete={(img) => {
                                      setRatio(
                                        img.naturalWidth / img.naturalHeight,
                                      );
                                    }}
                                  />
                                </div>
                              )}
                              {getMessageImages(message).length > 1 && (
                                <div
                                  className={styles["chat-message-item-images"]}
                                  style={
                                    {
                                      "--image-count":
                                        getMessageImages(message).length,
                                    } as React.CSSProperties
                                  }
                                >
                                  {getMessageImages(message).map(
                                    (image, index) => {
                                      return (
                                        <div
                                          className={
                                            styles[
                                              "chat-message-item-image-multi-container"
                                            ]
                                          }
                                          key={index}
                                        >
                                          <Image
                                            className={
                                              styles[
                                                "chat-message-item-image-multi"
                                              ]
                                            }
                                            src={image}
                                            alt=""
                                            fill
                                            unoptimized
                                          />
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          {message?.audio_url && (
                            <div className={styles["chat-message-audio"]}>
                              <audio src={message.audio_url} controls />
                            </div>
                          )}

                          <div className={styles["chat-message-action-date"]}>
                            {/* 版本指示器 - 只对有版本的 assistant 消息显示 */}
                            {message.role === "assistant" &&
                              message.versions &&
                              message.versions.length >= 1 && (
                                <span
                                  className={styles["chat-message-version"]}
                                >
                                  {(message.currentVersionIndex ?? 0) + 1}/
                                  {(message.versions?.length ?? 0) + 1}
                                </span>
                              )}
                            {renderMessageMeta(message, isContext)}
                          </div>
                        </div>
                      </div>
                      {shouldShowClearContextDivider && <ClearContextDivider />}
                    </Fragment>
                  );
                })}
            </div>
            <div className={styles["chat-input-panel"]}>
              <PromptHints
                prompts={promptHints}
                onPromptSelect={onPromptSelect}
              />

              <MCPPanel
                showPanel={showMcpPanel}
                onClose={() => setShowMcpPanel(false)}
              />

              <ShortcutKeyPanel
                showPanel={showShortcutKeyPanel}
                onClose={() => setShowShortcutKeyPanel(false)}
              />

              <ThinkingPanel
                showPanel={showThinkingPanel}
                onClose={() => setShowThinkingPanel(false)}
              />

              <MultiModelPanel
                showPanel={config.enableMultiModel && showMultiModelPanel}
                onClose={() => setShowMultiModelPanel(false)}
                onOpenSelector={() => {
                  setShowMultiModelPanel(false);
                  setShowModelSelector(true);
                }}
              />

              <ChatActions
                uploadAttachment={uploadAttachment}
                setAttachments={setAttachments}
                setUploading={setUploading}
                scrollToBottom={scrollToBottom}
                hitBottom={hitBottom}
                uploading={uploading}
                showPromptHints={() => {
                  // Click again to close
                  if (promptHints.length > 0) {
                    setPromptHints([]);
                    return;
                  }

                  inputRef.current?.focus();
                  setUserInput("/");
                  onSearch("");
                }}
                setShowShortcutKeyModal={setShowShortcutKeyModal}
                setUserInput={setUserInput}
                setShowChatSidePanel={setShowChatSidePanel}
                showMcpPanel={showMcpPanel}
                setShowMcpPanel={setShowMcpPanel}
                showShortcutKeyPanel={showShortcutKeyPanel}
                setShowShortcutKeyPanel={setShowShortcutKeyPanel}
                showThinkingPanel={showThinkingPanel}
                setShowThinkingPanel={setShowThinkingPanel}
                showMultiModelPanel={showMultiModelPanel}
                setShowMultiModelPanel={setShowMultiModelPanel}
                toggleMultiModelMode={toggleMultiModelMode}
                showModelSelector={showModelSelector}
                setShowModelSelector={setShowModelSelector}
                userInput={userInput}
              />
              <label
                className={clsx(styles["chat-input-panel-inner"], {
                  [styles["chat-input-panel-inner-attach"]]:
                    attachments.length !== 0,
                })}
                htmlFor="chat-input"
              >
                <textarea
                  id="chat-input"
                  ref={inputRef}
                  className={styles["chat-input"]}
                  placeholder={Locale.Chat.Input(submitKey)}
                  onInput={(e) => onInput(e.currentTarget.value)}
                  value={userInput}
                  onKeyDown={onInputKeyDown}
                  onFocus={scrollToBottom}
                  onClick={scrollToBottom}
                  onPaste={handlePaste}
                  rows={inputRows}
                  autoFocus={autoFocus}
                  style={{
                    fontSize: config.fontSize,
                    fontFamily: config.fontFamily,
                  }}
                />
                {attachments.length !== 0 && (
                  <div className={styles["attach-images"]}>
                    {attachments.map((attachment, index) => {
                      const isImage = attachment.type === "image";

                      return (
                        <div
                          key={attachment.id}
                          className={clsx(styles["attach-item"], {
                            [styles["attach-image"]]: isImage,
                            [styles["attach-file"]]: !isImage,
                          })}
                          style={
                            isImage && attachment.previewUrl
                              ? {
                                  backgroundImage: `url("${attachment.previewUrl}")`,
                                }
                              : undefined
                          }
                        >
                          {!isImage && (
                            <div className={styles["attach-file-content"]}>
                              <div className={styles["attach-file-name"]}>
                                {attachment.name}
                              </div>
                              <div className={styles["attach-file-type"]}>
                                {attachment.mimeType}
                              </div>
                            </div>
                          )}
                          <div className={styles["attach-image-mask"]}>
                            <DeleteImageButton
                              deleteImage={() => {
                                setAttachments(
                                  attachments.filter((_, i) => i !== index),
                                );
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <IconButton
                  icon={<SendWhiteIcon />}
                  text={Locale.Chat.Send}
                  className={styles["chat-input-send"]}
                  type="primary"
                  onClick={() => doSubmit(userInput)}
                />
              </label>
            </div>
          </div>
          <div
            className={clsx(styles["chat-side-panel"], {
              [styles["mobile"]]: isMobileScreen,
              [styles["chat-side-panel-show"]]: showChatSidePanel,
            })}
          >
            {showChatSidePanel && (
              <RealtimeChat
                onClose={() => {
                  setShowChatSidePanel(false);
                }}
                onStartVoice={async () => {
                  console.log("start voice");
                }}
              />
            )}
          </div>
        </div>
      </div>
      {showExport && (
        <ExportMessageModal onClose={() => setShowExport(false)} />
      )}

      {isEditingMessage && (
        <EditMessageModal
          onClose={() => {
            setIsEditingMessage(false);
          }}
        />
      )}

      {showShortcutKeyModal && (
        <ShortcutKeyModal onClose={() => setShowShortcutKeyModal(false)} />
      )}
    </>
  );
}

export function Chat() {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  return <ChatInner key={session.id} />;
}
