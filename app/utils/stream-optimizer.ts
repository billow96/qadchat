import { ChatSession, ChatMessage } from "../store/chat";

// 流式更新优化工具
export class StreamUpdateOptimizer {
  private pendingUpdates = new Map<
    string,
    {
      session: ChatSession;
      messageId: string;
      changes: Partial<ChatMessage>;
      lastUpdate: number;
    }
  >();

  private updateTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 100; // 100ms 批量更新延迟

  constructor(private onBatchUpdate: (updates: Map<string, any>) => void) {}

  // 优化的流式内容更新
  updateStreamingMessage(
    sessionId: string,
    messageId: string,
    changes: Partial<ChatMessage>,
    session: ChatSession,
  ) {
    const key = `${sessionId}-${messageId}`;

    // 缓存更新
    this.pendingUpdates.set(key, {
      session,
      messageId,
      changes,
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
  changes: Partial<ChatMessage>,
): Partial<ChatSession> {
  // 避免深拷贝，只创建必要的浅拷贝
  const newMessages = [...session.messages];
  const targetMessage = { ...newMessages[messageIndex] };
  Object.assign(targetMessage, changes);
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
