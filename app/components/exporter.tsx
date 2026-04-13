/* eslint-disable @next/next/no-img-element */
import {
  ChatMessage,
  ChatMessageSegment,
  ChatMessageTool,
  useAppConfig,
  useChatStore,
} from "../store";
import Locale from "../locales";
import styles from "./exporter.module.scss";
import Image from "next/image";
import {
  List,
  ListItem,
  Modal,
  Select,
  showImageModal,
  showModal,
  showToast,
} from "./ui-lib";
import { IconButton } from "./button";
import {
  copyToClipboard,
  downloadAs,
  getMessageImages,
  getMessageTextContentWithoutThinkingFromContent,
  useMobileScreen,
} from "../utils";

import CopyIcon from "../icons/copy.svg";
import LoadingIcon from "../icons/three-dots.svg";
import LoadingButtonIcon from "../icons/loading.svg";
import ChatGptIcon from "../icons/chatgpt.png";
import ShareIcon from "../icons/share.svg";
import ConfirmIcon from "../icons/confirm.svg";
import CloseIcon from "../icons/close.svg";

import DownloadIcon from "../icons/download.svg";
import { Collapse } from "antd";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { MessageSelector, useMessageSelector } from "./message-selector";
import { Avatar } from "./emoji";
import dynamic from "next/dynamic";
import NextImage from "next/image";

import { toBlob, toPng } from "html-to-image";

import { prettyObject } from "../utils/format";
import { EXPORT_MESSAGE_CLASS_NAME } from "../constant";
import { getClientConfig } from "../config/client";
import { type ClientApi, getClientApi } from "../client/api";
import {
  getMessageTextContent,
  getMessageTextContentWithoutThinking,
} from "../utils";
import { getMaskEffectiveModel } from "../utils/model-resolver";
import clsx from "clsx";
import chatStyles from "./chat.module.scss";
import markdownStyles from "./markdown.module.scss";
import { getMcpDisplayName } from "../mcp/display";

const Markdown = dynamic(async () => (await import("./markdown")).Markdown, {
  loading: () => <LoadingIcon />,
});
const ThoughtSegmentBlock = dynamic(
  async () => (await import("./markdown")).ThoughtSegmentBlock,
  {
    loading: () => <LoadingIcon />,
  },
);

export function ExportMessageModal(props: { onClose: () => void }) {
  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Export.Title}
        onClose={props.onClose}
        footer={
          <div
            style={{
              width: "100%",
              textAlign: "center",
              fontSize: 14,
              opacity: 0.5,
            }}
          >
            {Locale.Exporter.Description.Title}
          </div>
        }
      >
        <div style={{ minHeight: "40vh" }}>
          <MessageExporter />
        </div>
      </Modal>
    </div>
  );
}

function useSteps(
  steps: Array<{
    name: string;
    value: string;
  }>,
) {
  const stepCount = steps.length;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const nextStep = () =>
    setCurrentStepIndex((currentStepIndex + 1) % stepCount);
  const prevStep = () =>
    setCurrentStepIndex((currentStepIndex - 1 + stepCount) % stepCount);

  return {
    currentStepIndex,
    setCurrentStepIndex,
    nextStep,
    prevStep,
    currentStep: steps[currentStepIndex],
  };
}

function Steps<
  T extends {
    name: string;
    value: string;
  }[],
>(props: { steps: T; onStepChange?: (index: number) => void; index: number }) {
  const steps = props.steps;
  const stepCount = steps.length;

  return (
    <div className={styles["steps"]}>
      <div className={styles["steps-progress"]}>
        <div
          className={styles["steps-progress-inner"]}
          style={{
            width: `${((props.index + 1) / stepCount) * 100}%`,
          }}
        ></div>
      </div>
      <div className={styles["steps-inner"]}>
        {steps.map((step, i) => {
          return (
            <div
              key={i}
              className={clsx("clickable", styles["step"], {
                [styles["step-finished"]]: i <= props.index,
                [styles["step-current"]]: i === props.index,
              })}
              onClick={() => {
                props.onStepChange?.(i);
              }}
              role="button"
            >
              <span className={styles["step-index"]}>{i + 1}</span>
              <span className={styles["step-name"]}>{step.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MessageExporter() {
  const steps = [
    {
      name: Locale.Export.Steps.Select,
      value: "select",
    },
    {
      name: Locale.Export.Steps.Preview,
      value: "preview",
    },
  ];
  const { currentStep, setCurrentStepIndex, currentStepIndex } =
    useSteps(steps);
  const formats = ["text", "image", "json"] as const;
  type ExportFormat = (typeof formats)[number];

  const [exportConfig, setExportConfig] = useState({
    format: "image" as ExportFormat,
    includeContext: true,
    showHeader: true,
    showDetailedToken: true,
  });

  function updateExportConfig(updater: (config: typeof exportConfig) => void) {
    const config = { ...exportConfig };
    updater(config);
    setExportConfig(config);
  }

  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const { selection, updateSelection } = useMessageSelector();
  const selectedMessages = useMemo(() => {
    const ret: ChatMessage[] = [];
    if (exportConfig.includeContext) {
      ret.push(...session.mask.context);
    }
    ret.push(...session.messages.filter((m) => selection.has(m.id)));
    return ret;
  }, [
    exportConfig.includeContext,
    session.messages,
    session.mask.context,
    selection,
  ]);
  function preview() {
    if (exportConfig.format === "text") {
      return (
        <MarkdownPreviewer messages={selectedMessages} topic={session.topic} />
      );
    } else if (exportConfig.format === "json") {
      return (
        <JsonPreviewer messages={selectedMessages} topic={session.topic} />
      );
    } else {
      return (
        <ImagePreviewer
          messages={selectedMessages}
          topic={session.topic}
          showHeader={exportConfig.showHeader}
          showDetailedToken={exportConfig.showDetailedToken}
        />
      );
    }
  }
  return (
    <>
      <Steps
        steps={steps}
        index={currentStepIndex}
        onStepChange={setCurrentStepIndex}
      />
      <div
        className={styles["message-exporter-body"]}
        style={currentStep.value !== "select" ? { display: "none" } : {}}
      >
        <List>
          <ListItem
            title={Locale.Export.Format.Title}
            subTitle={Locale.Export.Format.SubTitle}
          >
            <Select
              value={exportConfig.format}
              onChange={(e) =>
                updateExportConfig(
                  (config) =>
                    (config.format = e.currentTarget.value as ExportFormat),
                )
              }
            >
              {formats.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </ListItem>
          <ListItem
            title={Locale.Export.IncludeContext.Title}
            subTitle={Locale.Export.IncludeContext.SubTitle}
          >
            <input
              type="checkbox"
              checked={exportConfig.includeContext}
              onChange={(e) => {
                updateExportConfig(
                  (config) => (config.includeContext = e.currentTarget.checked),
                );
              }}
            ></input>
          </ListItem>
          <ListItem
            title={Locale.Export.ShowHeader.Title}
            subTitle={Locale.Export.ShowHeader.SubTitle}
          >
            <input
              type="checkbox"
              checked={exportConfig.showHeader}
              onChange={(e) => {
                updateExportConfig(
                  (config) => (config.showHeader = e.currentTarget.checked),
                );
              }}
            ></input>
          </ListItem>
          <ListItem
            title={Locale.Export.ShowDetailedToken.Title}
            subTitle={Locale.Export.ShowDetailedToken.SubTitle}
          >
            <input
              type="checkbox"
              checked={exportConfig.showDetailedToken}
              onChange={(e) => {
                updateExportConfig(
                  (config) =>
                    (config.showDetailedToken = e.currentTarget.checked),
                );
              }}
            ></input>
          </ListItem>
        </List>
        <MessageSelector
          selection={selection}
          updateSelection={updateSelection}
          defaultSelectAll
        />
      </div>
      {currentStep.value === "preview" && (
        <div className={styles["message-exporter-body"]}>{preview()}</div>
      )}
    </>
  );
}

function formatMessageMetaForExport(
  message: ChatMessage,
  showDetailedToken: boolean,
) {
  const timeText = message.date || "";
  const statistic = message.statistic;

  if (!statistic) {
    return timeText;
  }

  if (message.role === "assistant") {
    if (!showDetailedToken) {
      return timeText;
    }

    const completionTokens = statistic.completionTokens;
    const totalReplyLatency = statistic.totalReplyLatency;
    const firstReplyLatency = statistic.firstReplyLatency;

    if (
      typeof completionTokens !== "number" ||
      typeof totalReplyLatency !== "number"
    ) {
      return timeText;
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

    return timeText
      ? `${timeText} - ${statParts.join(" ")}`
      : statParts.join(" ");
  }

  if (showDetailedToken && typeof statistic.singlePromptTokens === "number") {
    const statText = `${statistic.singlePromptTokens} Tokens`;
    return timeText ? `${timeText} - ${statText}` : statText;
  }

  return timeText;
}

function getMessageDisplaySegmentsForExport(
  message: ChatMessage,
): ChatMessageSegment[] {
  if (
    message.versions &&
    message.versions.length > 0 &&
    (message.currentVersionIndex ?? 0) < message.versions.length
  ) {
    return [
      {
        id: `${message.id}-history-version`,
        type: "text",
        content: message.versions[message.currentVersionIndex ?? 0] ?? "",
      },
    ];
  }

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

function getToolsForSegmentForExport(
  message: ChatMessage,
  segment: ChatMessageSegment,
): NonNullable<ChatMessage["tools"]> {
  if (!segment.toolIds?.length) return [];

  const tools = message.tools ?? [];
  return segment.toolIds
    .map((toolId) => tools.find((tool) => tool.id === toolId))
    .filter(Boolean) as NonNullable<ChatMessage["tools"]>;
}

function getReadableToolResponse(tool: ChatMessageTool) {
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
    Array.isArray((raw as any).content) &&
    (raw as any).content.length === 1 &&
    (raw as any).content[0]?.type === "text" &&
    (raw as any).content[0]?.text
  ) {
    return (raw as any).content[0].text;
  }
  if (typeof raw === "string") {
    return raw;
  }
  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}

function formatToolBlock(value: string) {
  if (!value) return value;
  try {
    return `\`\`\`json\n${JSON.stringify(JSON.parse(value), null, 2)}\n\`\`\``;
  } catch {
    return `\`\`\`\n${value}\n\`\`\``;
  }
}

function ExportToolResultCard(props: { tool: ChatMessageTool }) {
  const { tool } = props;
  const statusText =
    tool.isError !== true && tool.isError !== false
      ? Locale.Chat.MCP.Running
      : tool.isError
      ? Locale.Chat.MCP.Failed
      : Locale.Chat.MCP.Done;
  const headerTitle = `${getMcpDisplayName(tool.clientId)} : ${
    tool.displayName || tool?.function?.name || ""
  }`;
  const argsText =
    tool.argumentsObj && Object.keys(tool.argumentsObj).length > 0
      ? JSON.stringify(tool.argumentsObj, null, 2)
      : Locale.Chat.MCP.EmptyArguments;
  const responseText = getReadableToolResponse(tool);

  return (
    <div className={chatStyles["chat-tool-card"]}>
      <Collapse
        bordered={false}
        size="small"
        defaultActiveKey={[]}
        className={chatStyles["chat-tool-collapse"]}
        items={[
          {
            key: "tool",
            label: (
              <div className={chatStyles["chat-tool-header"]}>
                <div className={chatStyles["chat-tool-title"]}>
                  <span>{headerTitle}</span>
                  <span
                    className={clsx(chatStyles["chat-tool-status-icon"], {
                      [chatStyles["success"]]: tool.isError === false,
                      [chatStyles["error"]]: tool.isError === true,
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
                <div className={chatStyles["chat-tool-actions"]}>
                  <span
                    className={clsx(chatStyles["chat-tool-status"], {
                      [chatStyles["success"]]: tool.isError === false,
                      [chatStyles["error"]]: tool.isError === true,
                    })}
                  >
                    {statusText}
                  </span>
                </div>
              </div>
            ),
            children: (
              <div className={chatStyles["chat-tool-body"]}>
                <div className={chatStyles["chat-tool-section"]}>
                  <div className={chatStyles["chat-tool-section-title"]}>
                    {Locale.Chat.MCP.Arguments}
                  </div>
                  <Markdown
                    content={formatToolBlock(argsText)}
                    loading={false}
                    fontSize={14}
                    fontFamily="inherit"
                    defaultShow
                    status={false}
                  />
                </div>
                <div className={chatStyles["chat-tool-section"]}>
                  <div className={chatStyles["chat-tool-section-title"]}>
                    {Locale.Chat.MCP.Response}
                  </div>
                  <Markdown
                    content={
                      responseText
                        ? formatToolBlock(responseText)
                        : Locale.Chat.MCP.Running
                    }
                    loading={false}
                    fontSize={14}
                    fontFamily="inherit"
                    defaultShow
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

function ExportMessageBody(props: {
  message: ChatMessage;
  fontSize: number;
  fontFamily: string;
}) {
  const segments = getMessageDisplaySegmentsForExport(props.message);

  if (segments.length === 0) {
    return (
      <Markdown
        content={
          props.message.role === "user"
            ? getMessageTextContent(props.message)
            : getMessageTextContentWithoutThinking(props.message)
        }
        fontSize={props.fontSize}
        fontFamily={props.fontFamily}
        defaultShow
        status={false}
      />
    );
  }

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === "tool") {
          const tools = getToolsForSegmentForExport(props.message, segment);
          if (tools.length === 0) return null;

          return (
            <div
              key={`${props.message.id}-tool-${segment.id}-${index}`}
              className={chatStyles["chat-message-tools"]}
            >
              {tools.map((tool) => (
                <ExportToolResultCard key={tool.id} tool={tool} />
              ))}
            </div>
          );
        }

        if (segment.type === "thought") {
          return (
            <div
              key={`${props.message.id}-thought-${segment.id}-${index}`}
              className={markdownStyles["thought-segment"]}
            >
              <ThoughtSegmentBlock
                segment={{ ...segment, streaming: false }}
                fontSize={props.fontSize}
                fontFamily={props.fontFamily}
              />
            </div>
          );
        }

        return (
          <Markdown
            key={`${props.message.id}-text-${segment.id}-${index}`}
            content={segment.content}
            fontSize={props.fontSize}
            fontFamily={props.fontFamily}
            defaultShow
            status={false}
          />
        );
      })}
    </>
  );
}

function ExportMessageImages(props: { message: ChatMessage }) {
  const images = getMessageImages(props.message);

  if (images.length === 0) {
    return null;
  }

  if (images.length === 1) {
    return (
      <div className={chatStyles["chat-message-item-image-container"]}>
        <Image
          src={images[0]}
          alt="message"
          className={chatStyles["chat-message-item-image"]}
          fill
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className={chatStyles["chat-message-item-images"]}
      style={
        {
          "--image-count": images.length,
        } as React.CSSProperties
      }
    >
      {images.map((image, index) => (
        <div
          key={`${props.message.id}-image-${index}`}
          className={styles["message-image-multi-container"]}
        >
          <Image
            className={chatStyles["chat-message-item-image-multi"]}
            src={image}
            alt=""
            fill
            unoptimized
          />
        </div>
      ))}
    </div>
  );
}

function ExportMessageRow(props: {
  message: ChatMessage;
  userAvatar: string;
  fallbackModel: string;
  fontSize: number;
  fontFamily: string;
  showDetailedToken: boolean;
  isContext?: boolean;
}) {
  const { message } = props;
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const displayModel =
    message.model ||
    (message.isMultiModel && message.modelKey
      ? message.modelKey.split("@")[0]
      : props.fallbackModel);
  const provider =
    message.isMultiModel && message.modelKey
      ? message.modelKey.split("@")[1]
      : undefined;

  return (
    <div
      className={clsx(chatStyles["chat-message"], {
        [chatStyles["chat-message-user"]]: isUser,
      })}
    >
      <div className={chatStyles["chat-message-container"]}>
        <div className={chatStyles["chat-message-header"]}>
          <div className={chatStyles["chat-message-avatar"]}>
            {isUser ? (
              <Avatar avatar={props.userAvatar} />
            ) : isSystem ? (
              <Avatar avatar="2699-fe0f" />
            ) : (
              <Avatar model={displayModel} provider={provider} size={30} />
            )}
          </div>
          {!isUser && !isSystem && (
            <div className={chatStyles["chat-model-name"]}>
              {message.isMultiModel && message.modelKey ? (
                <>
                  {displayModel}
                  <span className={chatStyles["chat-model-provider"]}>
                    @{provider}
                  </span>
                </>
              ) : (
                displayModel
              )}
            </div>
          )}
        </div>

        <div className={chatStyles["chat-message-item"]}>
          <div className={chatStyles["chat-message-body"]}>
            <ExportMessageBody
              message={message}
              fontSize={props.fontSize}
              fontFamily={props.fontFamily}
            />
            <ExportMessageImages message={message} />
          </div>
        </div>

        <div className={chatStyles["chat-message-action-date"]}>
          {props.isContext
            ? (Locale.Chat.IsContext as string)
            : formatMessageMetaForExport(message, props.showDetailedToken)}
        </div>
      </div>
    </div>
  );
}

export function RenderExport(props: {
  messages: ChatMessage[];
  onRender: (messages: ChatMessage[]) => void;
}) {
  const domRef = useRef<HTMLDivElement>(null);
  const config = useAppConfig();

  useEffect(() => {
    if (!domRef.current) return;
    const dom = domRef.current;
    const messages = Array.from(
      dom.getElementsByClassName(EXPORT_MESSAGE_CLASS_NAME),
    );

    if (messages.length !== props.messages.length) {
      return;
    }

    const renderMsgs = messages.map((v, i) => {
      const [role, _] = v.id.split(":");
      return {
        id: i.toString(),
        role: role as any,
        content: role === "user" ? v.textContent ?? "" : v.innerHTML,
        date: "",
      };
    });

    props.onRender(renderMsgs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={domRef}>
      {props.messages.map((m, i) => (
        <div
          key={i}
          id={`${m.role}:${i}`}
          className={EXPORT_MESSAGE_CLASS_NAME}
        >
          <ExportMessageBody
            message={m}
            fontSize={config.fontSize}
            fontFamily={config.fontFamily}
          />
          <ExportMessageImages message={m} />
        </div>
      ))}
    </div>
  );
}

export function PreviewActions(props: {
  download: () => void;
  copy: () => void;
  showCopy?: boolean;
  messages?: ChatMessage[];
}) {
  const [loading, setLoading] = useState(false);
  const [shouldExport, setShouldExport] = useState(false);
  const config = useAppConfig();
  const onRenderMsgs = (msgs: ChatMessage[]) => {
    setShouldExport(false);

    const api: ClientApi = getClientApi(config.modelConfig.providerName);

    api
      .share(msgs)
      .then((res) => {
        if (!res) return;
        showModal({
          title: Locale.Export.Share,
          children: [
            <input
              type="text"
              value={res}
              key="input"
              style={{
                width: "100%",
                maxWidth: "unset",
              }}
              readOnly
              onClick={(e) => e.currentTarget.select()}
            ></input>,
          ],
          actions: [
            <IconButton
              icon={<CopyIcon />}
              text={Locale.Chat.Actions.Copy}
              key="copy"
              onClick={() => copyToClipboard(res)}
            />,
          ],
        });
        setTimeout(() => {
          window.open(res, "_blank");
        }, 800);
      })
      .catch((e) => {
        console.error("[Share]", e);
        showToast(prettyObject(e));
      })
      .finally(() => setLoading(false));
  };

  const share = async () => {
    if (props.messages?.length) {
      setLoading(true);
      setShouldExport(true);
    }
  };

  return (
    <>
      <div className={styles["preview-actions"]}>
        {props.showCopy && (
          <IconButton
            text={Locale.Export.Copy}
            bordered
            shadow
            icon={<CopyIcon />}
            onClick={props.copy}
          ></IconButton>
        )}
        <IconButton
          text={Locale.Export.Download}
          bordered
          shadow
          icon={<DownloadIcon />}
          onClick={props.download}
        ></IconButton>
        <IconButton
          text={Locale.Export.Share}
          bordered
          shadow
          icon={loading ? <LoadingIcon /> : <ShareIcon />}
          onClick={share}
        ></IconButton>
      </div>
      <div
        style={{
          position: "fixed",
          right: "200vw",
          pointerEvents: "none",
        }}
      >
        {shouldExport && (
          <RenderExport
            messages={props.messages ?? []}
            onRender={onRenderMsgs}
          />
        )}
      </div>
    </>
  );
}

export function ImagePreviewer(props: {
  messages: ChatMessage[];
  topic: string;
  showHeader: boolean;
  showDetailedToken: boolean;
}) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const mask = session.mask;
  const config = useAppConfig();

  const previewRef = useRef<HTMLDivElement>(null);

  const copy = () => {
    showToast(Locale.Export.Image.Toast);
    const dom = previewRef.current;
    if (!dom) return;
    toBlob(dom).then((blob) => {
      if (!blob) return;
      try {
        navigator.clipboard
          .write([
            new ClipboardItem({
              "image/png": blob,
            }),
          ])
          .then(() => {
            showToast(Locale.Copy.Success);
            refreshPreview();
          });
      } catch (e) {
        console.error("[Copy Image] ", e);
        showToast(Locale.Copy.Failed);
      }
    });
  };

  const isMobile = useMobileScreen();

  const download = async () => {
    showToast(Locale.Export.Image.Toast);
    const dom = previewRef.current;
    if (!dom) return;

    const isApp = getClientConfig()?.isApp;

    try {
      const blob = await toPng(dom);
      if (!blob) return;

      if (isMobile || (isApp && window.__TAURI__)) {
        if (isApp && window.__TAURI__) {
          const result = await window.__TAURI__.dialog.save({
            defaultPath: `${props.topic}.png`,
            filters: [
              {
                name: "PNG Files",
                extensions: ["png"],
              },
              {
                name: "All Files",
                extensions: ["*"],
              },
            ],
          });

          if (result !== null) {
            const response = await fetch(blob);
            const buffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(buffer);
            await window.__TAURI__.fs.writeBinaryFile(result, uint8Array);
            showToast(Locale.Download.Success);
          } else {
            showToast(Locale.Download.Failed);
          }
        } else {
          showImageModal(blob);
        }
      } else {
        const link = document.createElement("a");
        link.download = `${props.topic}.png`;
        link.href = blob;
        link.click();
        refreshPreview();
      }
    } catch (error) {
      showToast(Locale.Download.Failed);
    }
  };

  const refreshPreview = () => {
    const dom = previewRef.current;
    if (dom) {
      dom.innerHTML = dom.innerHTML; // Refresh the content of the preview by resetting its HTML for fix a bug glitching
    }
  };

  return (
    <div className={styles["image-previewer"]}>
      <PreviewActions
        copy={copy}
        download={download}
        showCopy={!isMobile}
        messages={props.messages}
      />
      <div
        className={clsx(styles["preview-body"], styles["default-theme"])}
        ref={previewRef}
      >
        {props.showHeader && (
          <div className={styles["chat-info"]}>
            <div className={clsx(styles["logo"], "no-dark")}>
              <NextImage
                src={ChatGptIcon.src}
                alt="logo"
                width={50}
                height={50}
              />
            </div>

            <div>
              <div className={styles["main-title"]}>QADChat</div>
              <div className={styles["sub-title"]}>
                github.com/MoonWeSif/qadchat
              </div>
              <div className={styles["icons"]}>
                <Avatar avatar={config.avatar} />
                <span className={styles["icon-space"]}>&</span>
                <Avatar model={getMaskEffectiveModel(session.mask)} />
              </div>
            </div>
            <div>
              <div className={styles["chat-info-item"]}>
                {Locale.Exporter.Model}: {getMaskEffectiveModel(mask)}
              </div>
              <div className={styles["chat-info-item"]}>
                {Locale.Exporter.Messages}: {props.messages.length}
              </div>
              <div className={styles["chat-info-item"]}>
                {Locale.Exporter.Topic}: {session.topic}
              </div>
              <div className={styles["chat-info-item"]}>
                {Locale.Exporter.Time}:{" "}
                {props.messages.at(-1)?.date || new Date().toLocaleString()}
              </div>
            </div>
          </div>
        )}
        {props.messages.map((m, i) => {
          const isContext = session.mask.context.some((ctx) => ctx.id === m.id);

          return (
            <ExportMessageRow
              key={i}
              message={m}
              userAvatar={config.avatar}
              fallbackModel={getMaskEffectiveModel(session.mask)}
              fontSize={config.fontSize}
              fontFamily={config.fontFamily}
              showDetailedToken={props.showDetailedToken}
              isContext={isContext}
            />
          );
        })}
      </div>
    </div>
  );
}

export function MarkdownPreviewer(props: {
  messages: ChatMessage[];
  topic: string;
}) {
  const mdText =
    `# ${props.topic}\n\n` +
    props.messages
      .map((m) => {
        return m.role === "user"
          ? `## ${Locale.Export.MessageFromYou}:\n${getMessageTextContent(m)}`
          : `## ${
              Locale.Export.MessageFromChatGPT
            }:\n${getMessageTextContentWithoutThinkingFromContent(
              getMessageTextContent(m),
            ).trim()}`;
      })
      .join("\n\n");

  const copy = () => {
    copyToClipboard(mdText);
  };
  const download = () => {
    downloadAs(mdText, `${props.topic}.md`);
  };
  return (
    <>
      <PreviewActions
        copy={copy}
        download={download}
        showCopy={true}
        messages={props.messages}
      />
      <div className="markdown-body">
        <pre className={styles["export-content"]}>{mdText}</pre>
      </div>
    </>
  );
}

export function JsonPreviewer(props: {
  messages: ChatMessage[];
  topic: string;
}) {
  const msgs = {
    messages: [
      {
        role: "system",
        content: `${Locale.FineTuned.Sysmessage} ${props.topic}`,
      },
      ...props.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ],
  };
  const mdText = "```json\n" + JSON.stringify(msgs, null, 2) + "\n```";
  const minifiedJson = JSON.stringify(msgs);

  const copy = () => {
    copyToClipboard(minifiedJson);
  };
  const download = () => {
    downloadAs(JSON.stringify(msgs), `${props.topic}.json`);
  };

  return (
    <>
      <PreviewActions
        copy={copy}
        download={download}
        showCopy={false}
        messages={props.messages}
      />
      <div className="markdown-body" onClick={copy}>
        <Markdown content={mdText} />
      </div>
    </>
  );
}
