/**
 * 消息 segment 解析与流式更新优化工具。
 *
 * 从 store/chat.ts 中提取为独立模块，以便：
 * 1. 可被 Jest 单独测试（无 UI 依赖链）
 * 2. 职责清晰——纯数据解析逻辑与 store 状态管理分离
 */
import { nanoid } from "nanoid";
import type { ChatMessageSegment, ChatMessageSegmentType } from "../store/chat";

// ─── 基础工具 ──────────────────────────────────────────────────────────────

export function createMessageSegment(
  type: ChatMessageSegmentType,
  content = "",
  extra?: Partial<ChatMessageSegment>,
): ChatMessageSegment {
  return {
    id: nanoid(),
    type,
    content,
    startedAt: Date.now(),
    ...extra,
  };
}

export function cloneMessageSegments(
  segments?: ChatMessageSegment[],
): ChatMessageSegment[] | undefined {
  if (!segments?.length) return undefined;
  return segments.map((segment) => ({ ...segment }));
}

// ─── 核心解析 ──────────────────────────────────────────────────────────────

/**
 * 检测内容是否以 <think> 标签开头（允许前导空白）。
 * 按照思考模型的惯例，<think> 只出现在回复（每轮）的最开头；
 * 如果开头没有，后续文本中也不会出现，可以直接跳过正则扫描。
 */
export function contentStartsWithThink(content: string): boolean {
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    if (ch === 32 || ch === 9 || ch === 10 || ch === 13) continue;
    return content.startsWith("<think>", i);
  }
  return false;
}

export function splitMessageContentIntoSegments(
  content: string,
): ChatMessageSegment[] {
  if (!content) return [];

  // 快速路径：开头没有 <think> 标签，整段内容作为纯文本返回，无需正则扫描
  if (!contentStartsWithThink(content)) {
    return [createMessageSegment("text", content, { streaming: false })];
  }

  const segments: ChatMessageSegment[] = [];
  const pattern = /<think>([\s\S]*?)(?:<\/think>|$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const thinkContent = match[1] ?? "";
    const matchIndex = match.index;
    const before = content.slice(lastIndex, matchIndex);
    if (before) {
      segments.push(createMessageSegment("text", before, { streaming: false }));
    }

    const hasClosingTag = fullMatch.endsWith("</think>");
    segments.push(
      createMessageSegment("thought", thinkContent, {
        streaming: !hasClosingTag,
      }),
    );

    lastIndex = matchIndex + fullMatch.length;

    // <think> 只出现在开头，匹配到第一组后剩余内容一定是纯文本，
    // 不需要继续正则扫描
    break;
  }

  const remain = content.slice(lastIndex);
  if (remain) {
    segments.push(createMessageSegment("text", remain, { streaming: false }));
  }

  if (segments.length === 0 && content) {
    segments.push(createMessageSegment("text", content, { streaming: false }));
  }

  return segments;
}

// ─── segment 结构操作 ──────────────────────────────────────────────────────

export function splitSegmentsByLastTool(
  currentSegments: ChatMessageSegment[] | undefined,
) {
  const segments = currentSegments ?? [];
  let lastToolIndex = -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].type === "tool") {
      lastToolIndex = i;
      break;
    }
  }

  return {
    prefix:
      lastToolIndex >= 0
        ? segments.slice(0, lastToolIndex + 1)
        : ([] as ChatMessageSegment[]),
    currentRound:
      lastToolIndex >= 0 ? segments.slice(lastToolIndex + 1) : segments,
  };
}

export function rebuildRoundSegments(
  previousRoundSegments: ChatMessageSegment[] | undefined,
  content: string,
  reasoningLatency?: number,
  finalized: boolean = false,
) {
  const nextSegments = splitMessageContentIntoSegments(content);
  const previousTexts = (previousRoundSegments ?? []).filter(
    (segment) => segment.type === "text",
  );
  const previousThoughts = (previousRoundSegments ?? []).filter(
    (segment) => segment.type === "thought",
  );
  let textIndex = 0;
  let thoughtIndex = 0;

  return nextSegments.map((segment) => {
    if (segment.type !== "thought") {
      const previousText = previousTexts[textIndex++];
      return {
        ...segment,
        id: previousText?.id ?? segment.id,
        streaming: finalized ? false : segment.streaming,
      };
    }

    const previousThought = previousThoughts[thoughtIndex++];
    const frozenDuration =
      previousThought?.durationMs ??
      (previousThought?.startedAt
        ? Math.max(0, Date.now() - previousThought.startedAt)
        : reasoningLatency);

    return {
      ...segment,
      id: previousThought?.id ?? segment.id,
      startedAt: previousThought?.startedAt ?? segment.startedAt,
      streaming: finalized ? false : segment.streaming,
      durationMs: segment.streaming ? reasoningLatency : frozenDuration,
    };
  });
}

export function appendToolRoundSegments(
  currentSegments: ChatMessageSegment[] | undefined,
  content: string,
  toolIds: string[],
  reasoningLatency?: number,
) {
  const { prefix, currentRound } = splitSegmentsByLastTool(currentSegments);
  const finalizedRound = rebuildRoundSegments(
    currentRound,
    content,
    reasoningLatency,
    true,
  );

  return [
    ...prefix,
    ...finalizedRound,
    createMessageSegment("tool", "", {
      streaming: false,
      toolIds,
    }),
  ];
}

// ─── 流式更新优化 ──────────────────────────────────────────────────────────

/**
 * 判断当前轮次的 segment 结构是否已经稳定：
 * - 没有任何 thought segment 处于 streaming 状态
 *   （即 <think> 已闭合或根本没有 <think>）
 * - 最后一个 segment 是 text 类型（正文在持续增长）
 *
 * 当结构稳定时，只需更新最后一个 text segment 的 content，
 * 无需重新做正则解析和数组重建。
 */
export function isCurrentRoundStable(
  currentRound: ChatMessageSegment[] | undefined,
): boolean {
  if (!currentRound?.length) return false;

  const last = currentRound[currentRound.length - 1];
  if (last.type !== "text") return false;

  for (const seg of currentRound) {
    if (seg.type === "thought" && seg.streaming) return false;
  }

  return true;
}

export function updateMessageSegmentsFromStream(
  currentSegments: ChatMessageSegment[] | undefined,
  content: string,
  reasoningLatency?: number,
): ChatMessageSegment[] | undefined {
  if (!content) return cloneMessageSegments(currentSegments);
  const { prefix, currentRound } = splitSegmentsByLastTool(currentSegments);

  // 快速路径：segment 结构已稳定（<think> 已闭合或无 <think>），
  // 只需更新最后一个 text segment 的 content，跳过正则解析和数组重建。
  if (isCurrentRoundStable(currentRound)) {
    const hasThought = currentRound.some((s) => s.type === "thought");
    let newTextContent: string;

    if (!hasThought) {
      // 无 <think> 标签，整段 content 就是 text 内容
      newTextContent = content;
    } else {
      // 有已闭合的 <think>，用 indexOf 定位 </think> 标签尾部，
      // 取其后的全部内容作为 text。这是一次 O(k) 的查找（k 为 think 段长度），
      // 而非对整个 content 做正则扫描。
      const closeTag = "</think>";
      const closeIdx = content.indexOf(closeTag);
      if (closeIdx >= 0) {
        newTextContent = content.slice(closeIdx + closeTag.length);
      } else {
        // 防御性回退：找不到 </think>（理论上不应发生，因为 isCurrentRoundStable
        // 已确认没有 streaming 的 thought），走常规路径
        const rebuiltRound = rebuildRoundSegments(
          currentRound,
          content,
          reasoningLatency,
          false,
        );
        return [...prefix, ...rebuiltRound];
      }
    }

    const lastSeg = currentRound[currentRound.length - 1];
    const updatedLast = { ...lastSeg, content: newTextContent };
    const updatedRound = [...currentRound.slice(0, -1), updatedLast];
    return prefix.length > 0 ? [...prefix, ...updatedRound] : updatedRound;
  }

  // 常规路径：结构尚未稳定（thinking 进行中或首次解析），需要完整解析
  const rebuiltRound = rebuildRoundSegments(
    currentRound,
    content,
    reasoningLatency,
    false,
  );

  return [...prefix, ...rebuiltRound];
}

// ─── 序列化 ────────────────────────────────────────────────────────────────

export function serializeSegmentsToMessageContent(
  segments?: ChatMessageSegment[],
): string {
  if (!segments?.length) return "";

  return segments
    .map((segment) =>
      segment.type === "thought"
        ? `<think>\n${segment.content}${segment.streaming ? "" : "\n</think>"}`
        : segment.type === "text"
        ? segment.content
        : "",
    )
    .join("");
}

export function buildMessageSegmentsFromContent(
  content: string,
  reasoningLatency?: number,
): ChatMessageSegment[] | undefined {
  const segments = splitMessageContentIntoSegments(content);
  if (!segments.length) return undefined;

  return segments.map((segment) =>
    segment.type === "thought"
      ? {
          ...segment,
          streaming: false,
          durationMs: segment.durationMs ?? reasoningLatency,
        }
      : {
          ...segment,
          streaming: false,
        },
  );
}

export function finalizeMessageSegments(
  segments: ChatMessageSegment[] | undefined,
  reasoningLatency?: number,
): ChatMessageSegment[] | undefined {
  const nextSegments = cloneMessageSegments(segments);
  if (!nextSegments?.length) return nextSegments;

  return nextSegments.map((segment) => {
    if (segment.type !== "thought") {
      return { ...segment, streaming: false };
    }
    return {
      ...segment,
      streaming: false,
      durationMs: segment.durationMs ?? reasoningLatency,
    };
  });
}
