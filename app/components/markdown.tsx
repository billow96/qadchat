import ReactMarkdown from "react-markdown";
import "katex/dist/katex.min.css";
import RemarkMath from "remark-math";
import RemarkBreaks from "remark-breaks";
import RehypeKatex from "rehype-katex";
import RemarkGfm from "remark-gfm";
import RehypeHighlight from "rehype-highlight";
import RehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { useRef, useState, RefObject, useEffect, useMemo } from "react";
import { copyToClipboard, useWindowSize } from "../utils";
import mermaid from "mermaid";
import Locale from "../locales";
import LoadingIcon from "../icons/three-dots.svg";
import ReloadButtonIcon from "../icons/reload.svg";
import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { showImageModal, FullScreen } from "./ui-lib";
import {
  ArtifactsShareButton,
  HTMLPreview,
  HTMLPreviewHander,
} from "./artifacts";
import { useChatStore } from "../store";
import { IconButton } from "./button";
import { Collapse } from "antd";
import CopyIcon from "../icons/copy.svg";

import { useAppConfig } from "../store/config";
import clsx from "clsx";
import styles from "./markdown.module.scss";
import type { ChatMessageSegment } from "../store";
import { isThinkingTitle } from "../utils/thinking";

// 配置安全策略，允许 thinkcollapse 标签，防止html注入造成页面崩溃
const sanitizeOptions = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [
      ...(defaultSchema.attributes?.div || []),
      ["className", "math", "math-display"],
    ],
    img: [
      ...(defaultSchema.attributes?.img || []),
      ["src", ["http:", "https:", "data"]],
    ],
    math: [["xmlns", "http://www.w3.org/1998/Math/MathML"], "display"],
    annotation: ["encoding"],
    span: ["className", "style"],
    svg: [
      ["xmlns", "http://www.w3.org/2000/svg"],
      "width",
      "height",
      "viewBox",
      "preserveAspectRatio",
    ],
    path: ["d"],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "thinkcollapse",
    "math",
    "semantics",
    "annotation",
    "mrow",
    "mi",
    "mo",
    "mfrac",
    "mn",
    "msup",
    "msub",
    "svg",
    "path",
  ],
};

interface ThinkCollapseProps {
  title: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
  fontSize?: number;
  collapseId?: string;
}

function formatThinkingDurationLabel(durationMs: number) {
  return Locale.NewChat.ThinkFormat(durationMs);
}

function buildThinkCollapseTitle(segment: ChatMessageSegment, now: number) {
  const content = segment.content.trim();
  if (!content) {
    return Locale.NewChat.NoThink;
  }

  if (segment.streaming) {
    const duration = Math.max(0, now - (segment.startedAt ?? now));
    return `${Locale.NewChat.Thinking}${formatThinkingDurationLabel(duration)}`;
  }

  return `${Locale.NewChat.Think}${formatThinkingDurationLabel(
    segment.durationMs ?? 0,
  )}`;
}

const ThinkCollapse = ({
  title,
  children,
  className,
  fontSize,
  collapseId,
}: ThinkCollapseProps) => {
  const isSSR = typeof window === "undefined";
  const isThinking = isThinkingTitle(title as string, Locale.NewChat.Thinking);
  // 如果是 Thinking 状态，默认展开，否则折叠
  const defaultActive = isThinking ? ["1"] : [];
  // 如果是 NoThink 状态，禁用
  const disabled = title === Locale.NewChat.NoThink;
  const hasManualToggleRef = useRef(false);
  const [activeKeys, setActiveKeys] = useState<string[]>(() => {
    if (collapseId && typeof window !== "undefined") {
      const cached = sessionStorage.getItem(`think-collapse:${collapseId}`);
      if (cached === "open") return ["1"];
      if (cached === "closed") return [];
    }
    return defaultActive;
  });

  useEffect(() => {
    if (!collapseId || typeof window === "undefined") return;
    sessionStorage.setItem(
      `think-collapse:${collapseId}`,
      activeKeys.length ? "open" : "closed",
    );
  }, [activeKeys, collapseId]);

  useEffect(() => {
    if (disabled || hasManualToggleRef.current) return;

    if (isThinking) {
      setActiveKeys(["1"]);
      return;
    }

    setActiveKeys([]);
  }, [disabled, isThinking, collapseId]);

  const toggleCollapse = () => {
    if (!disabled) {
      hasManualToggleRef.current = true;
      setActiveKeys(activeKeys.length ? [] : ["1"]);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleCollapse();
  };

  const handleCopyContent = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 获取children的文本内容
    const getTextContent = (node: React.ReactNode): string => {
      if (typeof node === "string") return node;
      if (typeof node === "number") return String(node);
      if (React.isValidElement(node)) {
        if (node.props.children) {
          return getTextContent(node.props.children);
        }
      }
      if (Array.isArray(node)) {
        return node.map(getTextContent).join("");
      }
      return "";
    };

    const textContent = getTextContent(children);
    copyToClipboard(textContent);
  };

  // 在 SSR 环境下回退为简化渲染，避免第三方 UI 组件导致的无效元素错误
  if (isSSR) {
    return (
      <div
        className={`${styles["think-collapse"]} ${
          disabled ? styles.disabled : ""
        } ${className || ""}`}
      >
        <div className={styles["think-collapse-header"]}>
          <span>{title}</span>
        </div>
        {!disabled && <div>{children}</div>}
      </div>
    );
  }

  return (
    <div
      onContextMenu={handleRightClick}
      onDoubleClick={handleDoubleClick}
      className={`${styles["think-collapse"]} ${
        disabled ? styles.disabled : ""
      } ${className || ""}`}
    >
      <Collapse
        className={`${disabled ? "disabled" : ""}`}
        size="small"
        activeKey={activeKeys}
        onChange={(keys) => {
          if (disabled) return;
          hasManualToggleRef.current = true;
          setActiveKeys(keys as string[]);
        }}
        bordered={false}
        items={[
          {
            key: "1",
            label: (
              <div className={styles["think-collapse-header"]}>
                <span>{title}</span>
                {!disabled && (
                  <button
                    className={styles["copy-think-button"]}
                    onClick={handleCopyContent}
                    title={Locale.Chat.Actions.Copy}
                    aria-label={Locale.Chat.Actions.Copy}
                    type="button"
                  >
                    <CopyIcon />
                  </button>
                )}
              </div>
            ),
            children: children,
          },
        ]}
      ></Collapse>
    </div>
  );
};

export function Mermaid(props: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (props.code && ref.current) {
      mermaid
        .run({
          nodes: [ref.current],
          suppressErrors: true,
        })
        .catch((e) => {
          setHasError(true);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.code]);

  function viewSvgInNewWindow() {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const text = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([text], { type: "image/svg+xml" });
    showImageModal(URL.createObjectURL(blob));
  }

  if (hasError) {
    return null;
  }

  return (
    <div
      className={clsx("no-dark", "mermaid")}
      style={{
        cursor: "pointer",
        overflow: "auto",
      }}
      ref={ref}
      onClick={() => viewSvgInNewWindow()}
    >
      {props.code}
    </div>
  );
}

export function PreCode(props: { children: any }) {
  const ref = useRef<HTMLPreElement>(null);
  const previewRef = useRef<HTMLPreviewHander>(null);
  const [mermaidCode, setMermaidCode] = useState("");
  const [htmlCode, setHtmlCode] = useState("");
  const { height } = useWindowSize();
  const chatStore = useChatStore();
  const session = chatStore.currentSession();

  const renderArtifacts = useDebouncedCallback(() => {
    if (!ref.current) return;
    const mermaidDom = ref.current.querySelector("code.language-mermaid");
    if (mermaidDom) {
      setMermaidCode((mermaidDom as HTMLElement).innerText);
    }
    const htmlDom = ref.current.querySelector("code.language-html");
    const refText = ref.current.querySelector("code")?.innerText;
    if (htmlDom) {
      setHtmlCode((htmlDom as HTMLElement).innerText);
    } else if (
      refText?.startsWith("<!DOCTYPE") ||
      refText?.startsWith("<svg") ||
      refText?.startsWith("<?xml")
    ) {
      setHtmlCode(refText);
    }
  }, 600);

  const config = useAppConfig();
  const enableArtifacts =
    session.mask?.enableArtifacts !== false && config.enableArtifacts;

  //Wrap the paragraph for plain-text
  useEffect(() => {
    if (ref.current) {
      const codeElements = ref.current.querySelectorAll(
        "code",
      ) as NodeListOf<HTMLElement>;
      const wrapLanguages = [
        "",
        "md",
        "markdown",
        "text",
        "txt",
        "plaintext",
        "tex",
        "latex",
      ];
      codeElements.forEach((codeElement) => {
        let languageClass = codeElement.className.match(/language-(\w+)/);
        let name = languageClass ? languageClass[1] : "";
        if (wrapLanguages.includes(name)) {
          codeElement.style.whiteSpace = "pre-wrap";
        }
      });
      setTimeout(renderArtifacts, 1);
    }
  }, [renderArtifacts]);

  return (
    <>
      <pre ref={ref}>
        <span
          className="copy-code-button"
          onClick={() => {
            if (ref.current) {
              copyToClipboard(
                ref.current.querySelector("code")?.innerText ?? "",
              );
            }
          }}
        ></span>
        {props.children}
      </pre>
      {mermaidCode.length > 0 && (
        <Mermaid code={mermaidCode} key={mermaidCode} />
      )}
      {htmlCode.length > 0 && enableArtifacts && (
        <FullScreen className="no-dark html" right={70}>
          <ArtifactsShareButton
            style={{ position: "absolute", right: 20, top: 10 }}
            getCode={() => htmlCode}
          />
          <IconButton
            style={{ position: "absolute", right: 120, top: 10 }}
            bordered
            icon={<ReloadButtonIcon />}
            shadow
            onClick={() => previewRef.current?.reload()}
          />
          <HTMLPreview
            ref={previewRef}
            code={htmlCode}
            autoHeight={!document.fullscreenElement}
            height={!document.fullscreenElement ? 600 : height}
          />
        </FullScreen>
      )}
    </>
  );
}

function CustomCode(props: { children: any; className?: string }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const config = useAppConfig();
  const enableCodeFold =
    session.mask?.enableCodeFold !== false && config.enableCodeFold;

  const ref = useRef<HTMLPreElement>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [showToggle, setShowToggle] = useState(false);

  useEffect(() => {
    if (ref.current) {
      const codeHeight = ref.current.scrollHeight;
      setShowToggle(codeHeight > 400);
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [props.children]);

  const toggleCollapsed = () => {
    setCollapsed((collapsed) => !collapsed);
  };
  const renderShowMoreButton = () => {
    if (showToggle && enableCodeFold && collapsed) {
      return (
        <div
          className={clsx("show-hide-button", {
            collapsed,
            expanded: !collapsed,
          })}
        >
          <button onClick={toggleCollapsed}>{Locale.NewChat.More}</button>
        </div>
      );
    }
    return null;
  };
  return (
    <>
      <code
        className={clsx(props?.className)}
        ref={ref}
        style={{
          maxHeight: enableCodeFold && collapsed ? "400px" : "none",
          overflowY: "hidden",
        }}
      >
        {props.children}
      </code>

      {renderShowMoreButton()}
    </>
  );
}

function escapeBrackets(text: string) {
  const pattern =
    /(```[\s\S]*?```|`.*?`)|\\\[([\s\S]*?[^\\])\\\]|\\\((.*?)\\\)/g;
  return text.replace(
    pattern,
    (match, codeBlock, squareBracket, roundBracket) => {
      if (codeBlock) {
        return codeBlock;
      } else if (squareBracket) {
        return `$$${squareBracket}$$`;
      } else if (roundBracket) {
        return `$${roundBracket}$`;
      }
      return match;
    },
  );
}

function tryWrapHtmlCode(text: string) {
  // try add wrap html code (fixed: html codeblock include 2 newline)
  // ignore embed codeblock
  if (text.includes("```")) {
    return text;
  }
  return text
    .replace(
      /([`]*?)(\w*?)([\n\r]*?)(<!DOCTYPE html>)/g,
      (match, quoteStart, lang, newLine, doctype) => {
        return !quoteStart ? "\n```html\n" + doctype : match;
      },
    )
    .replace(
      /(<\/body>)([\r\n\s]*?)(<\/html>)([\n\r]*)([`]*)([\n\r]*?)/g,
      (match, bodyEnd, space, htmlEnd, newLine, quoteEnd) => {
        return !quoteEnd ? bodyEnd + space + htmlEnd + "\n```\n" : match;
      },
    );
}

function formatThinkText(text: string): {
  thinkText: string;
  remainText: string;
} {
  const normalized = text.trimStart();

  if (!normalized.includes("<think>") && !normalized.includes("</think>")) {
    return { thinkText: "", remainText: text };
  }

  const startIndex = normalized.indexOf("<think>");
  if (startIndex >= 0 && !normalized.includes("</think>")) {
    const prefix = normalized.slice(0, startIndex).trim();
    const thinkContent = normalized.slice(startIndex + "<think>".length);
    const thinkText = `<thinkcollapse title="${Locale.NewChat.Thinking}">\n${thinkContent}\n\n</thinkcollapse>\n`;
    const remainText = prefix ? `${prefix}\n\n` : "";
    return { thinkText, remainText };
  }

  const pattern = /<think>([\s\S]*?)<\/think>/;
  const match = normalized.match(pattern);
  if (match) {
    const fullMatch = match[0];
    const thinkContent = match[1];
    const prefix = normalized.slice(0, match.index ?? 0).trim();
    const suffix = normalized
      .slice((match.index ?? 0) + fullMatch.length)
      .trimStart();
    const thinkText =
      thinkContent.trim() === ""
        ? `<thinkcollapse title="${Locale.NewChat.NoThink}">\n\n</thinkcollapse>\n`
        : `<thinkcollapse title="${Locale.NewChat.Think}">\n${thinkContent}\n\n</thinkcollapse>\n`;

    const remainParts = [prefix, suffix].filter(Boolean);
    return {
      thinkText,
      remainText: remainParts.join("\n\n"),
    };
  }

  return { thinkText: "", remainText: text };
}

function MarkdownContentInner(props: {
  content: string;
  thinkingSegments?: ChatMessageSegment[];
  fontSize?: number;
  status?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  const hasStreamingThought = !!props.thinkingSegments?.some(
    (segment) => segment.type === "thought" && segment.streaming,
  );

  useEffect(() => {
    if (!hasStreamingThought) return;

    setNow(Date.now());
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [hasStreamingThought]);

  // 预处理base64图片，将长base64 URL替换为占位符
  const { processedContent, imageMap } = useMemo(() => {
    const originalContent = tryWrapHtmlCode(escapeBrackets(props.content));
    let content = originalContent;

    if (props.thinkingSegments?.length) {
      const thinkText = props.thinkingSegments
        .map((segment) => {
          const title = buildThinkCollapseTitle(segment, now);
          const body = segment.content.trim();
          return `<thinkcollapse title="${title}">\n${body}\n\n</thinkcollapse>\n`;
        })
        .join("\n");
      content = thinkText + originalContent;
    } else {
      const { thinkText, remainText } = formatThinkText(originalContent);
      content = thinkText + remainText;
    }

    const imageMap = new Map<string, string>();
    let imageCounter = 0;

    // 匹配 ![alt](data:image/...;base64,...) 格式的长base64图片
    content = content.replace(
      /!\[([^\]]*)\]\(data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)\)/g,
      (match, alt, format, base64Data) => {
        // 只处理长度超过1000字符的base64数据
        if (base64Data.length > 1000) {
          imageCounter++;
          const placeholder = `BASE64_IMAGE_${imageCounter}`;
          const fullDataUrl = `data:image/${format};base64,${base64Data}`;
          imageMap.set(placeholder, fullDataUrl);
          return `![${alt || "image"}](${placeholder})`;
        }
        return match; // 短的base64保持原样
      },
    );

    return { processedContent: content, imageMap };
  }, [now, props.content, props.thinkingSegments]);

  const isStreaming = !!props.status;
  const remarkPlugins = useMemo(
    () => [RemarkMath, RemarkGfm, RemarkBreaks],
    [],
  );
  const rehypePlugins = useMemo(
    () => [
      RehypeRaw,
      RehypeKatex as any,
      [rehypeSanitize, sanitizeOptions],
      [
        RehypeHighlight,
        {
          detect: false,
          ignoreMissing: true,
        },
      ],
    ],
    [],
  );

  const components = useMemo(() => {
    if (isStreaming) {
      return {
        // 流式阶段走轻量渲染，避免复杂代码块/预览逻辑拖慢逐字更新。
        pre: (preProps: any) => <pre {...preProps} />,
        code: ({ className, children, ...rest }: any) => (
          <code className={className} {...rest}>
            {children}
          </code>
        ),
        p: (pProps: any) => <p {...pProps} dir="auto" />,
        img: (imgProps: any) => {
          const { src, alt, ...otherProps } = imgProps;
          const actualSrc = src && imageMap.has(src) ? imageMap.get(src) : src;

          if (actualSrc) {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                {...otherProps}
                src={actualSrc}
                alt={alt || "image"}
                style={{
                  maxWidth: "100%",
                  height: "auto",
                  borderRadius: "8px",
                }}
              />
            );
          }

          return <span>{alt || "[Image]"}</span>;
        },
        a: (aProps: any) => {
          const href = aProps.href || "";
          const isInternal = /^\/#/i.test(href);
          const target = isInternal ? "_self" : aProps.target ?? "_blank";
          return <a {...aProps} target={target} />;
        },
        thinkcollapse: ({
          title,
          children,
        }: {
          title: string;
          children: React.ReactNode;
        }) => (
          <ThinkCollapse title={title} fontSize={props.fontSize}>
            {children}
          </ThinkCollapse>
        ),
      } as const;
    }

    return {
      pre: PreCode,
      code: CustomCode,
      p: (pProps: any) => <p {...pProps} dir="auto" />,
      img: (imgProps: any) => {
        const { src, alt, ...otherProps } = imgProps;

        let actualSrc = src;
        if (src && imageMap.has(src)) {
          actualSrc = imageMap.get(src);
        }

        if (actualSrc) {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              {...otherProps}
              src={actualSrc}
              alt={alt || "image"}
              style={{
                maxWidth: "100%",
                height: "auto",
                borderRadius: "8px",
                cursor: "pointer",
              }}
              onClick={() => showImageModal(actualSrc)}
            />
          );
        }
        return <span>{alt || "[Image]"}</span>;
      },
      thinkcollapse: ({
        title,
        children,
      }: {
        title: string;
        children: React.ReactNode;
      }) => (
        <ThinkCollapse title={title} fontSize={props.fontSize}>
          {children}
        </ThinkCollapse>
      ),
      a: (aProps: any) => {
        const href = aProps.href || "";
        if (/\.(aac|mp3|opus|wav)$/.test(href)) {
          return (
            <figure>
              <audio controls src={href}></audio>
            </figure>
          );
        }
        if (/\.(3gp|3g2|webm|ogv|mpeg|mp4|avi)$/.test(href)) {
          return (
            <video controls width="99.9%">
              <source src={href} />
            </video>
          );
        }
        const isInternal = /^\/#/i.test(href);
        const target = isInternal ? "_self" : aProps.target ?? "_blank";
        return <a {...aProps} target={target} />;
      },
    } as const;
  }, [imageMap, isStreaming, props.fontSize]);

  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins as any}
      rehypePlugins={rehypePlugins as any}
      components={components as any}
    >
      {processedContent}
    </ReactMarkdown>
  );
}

export const MarkdownContent = React.memo(MarkdownContentInner);

export function ThoughtSegmentBlock(props: {
  segment: ChatMessageSegment;
  fontSize?: number;
  fontFamily?: string;
}) {
  const { segment } = props;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!segment.streaming) return;

    setNow(Date.now());
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [segment.id, segment.streaming]);

  const title = buildThinkCollapseTitle(segment, now);

  return (
    <div
      className={styles["thought-segment"]}
      style={{
        fontSize: `${props.fontSize ?? 14}px`,
        fontFamily: props.fontFamily || "inherit",
      }}
      dir="auto"
    >
      <ThinkCollapse
        title={title}
        fontSize={props.fontSize}
        collapseId={segment.id}
      >
        <div
          className="markdown-body"
          style={{
            fontSize: `${props.fontSize ?? 14}px`,
            fontFamily: props.fontFamily || "inherit",
          }}
          dir="auto"
        >
          <MarkdownContent
            content={segment.content}
            fontSize={props.fontSize}
            status={segment.streaming}
          />
        </div>
      </ThinkCollapse>
    </div>
  );
}

export function Markdown(
  props: {
    content: string;
    loading?: boolean;
    fontSize?: number;
    fontFamily?: string;
    parentRef?: RefObject<HTMLDivElement>;
    defaultShow?: boolean;
    thinkingSegments?: ChatMessageSegment[];
    status?: boolean;
  } & React.DOMAttributes<HTMLDivElement>,
) {
  const mdRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="markdown-body"
      style={{
        fontSize: `${props.fontSize ?? 14}px`,
        fontFamily: props.fontFamily || "inherit",
      }}
      ref={mdRef}
      onContextMenu={props.onContextMenu}
      onDoubleClickCapture={props.onDoubleClickCapture}
      dir="auto"
    >
      {props.loading ? (
        <LoadingIcon />
      ) : (
        <MarkdownContent
          content={props.content}
          thinkingSegments={props.thinkingSegments}
          fontSize={props.fontSize}
          status={props.status}
        />
      )}
    </div>
  );
}
