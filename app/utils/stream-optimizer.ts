import { ChatSession, ChatMessage } from "../store/chat";
import { getLatestMessageTrace, recordStreamTraceStage } from "./stream-trace";

type StreamingMessageChanges = Partial<ChatMessage> & {
  _trace?: {
    traceId: string;
    seq: number;
    model?: string;
    source?: string;
    sessionId?: string;
    contentLength: number;
    chunkLength: number;
    remainLength: number;
  };
};

// 流式更新优化工具
export class StreamUpdateOptimizer {
  private pendingUpdates = new Map<
    string,
    {
      session: ChatSession;
      messageId: string;
      changes: StreamingMessageChanges;
      lastUpdate: number;
    }
  >();

  private updateTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 33; // 更接近逐帧的批量窗口，提升流式显示连贯性

  constructor(private onBatchUpdate: (updates: Map<string, any>) => void) {}

  // 优化的流式内容更新
  updateStreamingMessage(
    sessionId: string,
    messageId: string,
    changes: StreamingMessageChanges,
    session: ChatSession,
  ) {
    const traceMeta = getLatestMessageTrace(messageId);
    if (traceMeta) {
      recordStreamTraceStage("optimizer_enqueue", {
        traceId: traceMeta.traceId,
        sessionId: traceMeta.sessionId,
        messageId,
        seq: traceMeta.seq,
        model: traceMeta.model,
        source: traceMeta.source,
        contentLength: traceMeta.contentLength,
        chunkLength: traceMeta.chunkLength,
        remainLength: traceMeta.remainLength,
      });
    }

    const key = `${sessionId}-${messageId}`;
    const previous = this.pendingUpdates.get(key);

    // 合并同一消息在一个批次窗口内的多次更新，避免后到的工具事件覆盖掉更早的 streaming/content 状态
    this.pendingUpdates.set(key, {
      session,
      messageId,
      changes: {
        ...(previous?.changes ?? {}),
        ...changes,
      },
      lastUpdate: Date.now(),
    });

    // 使用固定窗口批量刷新，避免高频 token 持续到达时界面一直不更新
    if (!this.updateTimer) {
      this.updateTimer = setTimeout(() => {
        this.flushUpdates();
      }, this.BATCH_DELAY);
    }
  }

  // 立即刷新更新（在流结束时调用）
  flushUpdates() {
    if (this.pendingUpdates.size === 0) return;

    for (const [, update] of this.pendingUpdates) {
      const traceMeta = getLatestMessageTrace(update.messageId);
      if (!traceMeta) continue;
      recordStreamTraceStage("optimizer_flush", {
        traceId: traceMeta.traceId,
        sessionId: traceMeta.sessionId,
        messageId: update.messageId,
        seq: traceMeta.seq,
        model: traceMeta.model,
        source: traceMeta.source,
        contentLength: traceMeta.contentLength,
        chunkLength: traceMeta.chunkLength,
        remainLength: traceMeta.remainLength,
      });
    }

    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }

    this.onBatchUpdate(new Map(this.pendingUpdates));
    this.pendingUpdates.clear();
  }

  // 清理资源
  destroy() {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    this.pendingUpdates.clear();
  }
}

// 轻量级消息更新工具
export function createLightweightMessageUpdate(
  session: ChatSession,
  messageIndex: number,
  changes: StreamingMessageChanges,
): Partial<ChatSession> {
  // 避免深拷贝，只创建必要的浅拷贝
  const newMessages = [...session.messages];
  const targetMessage = { ...newMessages[messageIndex] };
  const { _trace, ...safeChanges } = changes as Partial<ChatMessage> & {
    _trace?: unknown;
  };
  Object.assign(targetMessage, safeChanges);
  newMessages[messageIndex] = targetMessage;

  return {
    messages: newMessages,
    lastUpdate: Date.now(),
  };
}

// 优化的状态合并工具
export function mergeSessionUpdates(
  baseSession: ChatSession,
  ...updates: Partial<ChatSession>[]
): ChatSession {
  let result = baseSession;

  for (const update of updates) {
    result = { ...result, ...update };
  }

  return result;
}
