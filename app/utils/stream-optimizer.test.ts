import type { ChatSession, ChatMessage } from "../store/chat";
import { StreamUpdateOptimizer } from "./stream-optimizer";

function createMockSession(): ChatSession {
  return {
    id: "session-1",
    topic: "test",
    memoryPrompt: "",
    messages: [],
    stat: {
      tokenCount: 0,
      wordCount: 0,
      charCount: 0,
    },
    lastUpdate: Date.now(),
    lastSummarizeIndex: 0,
    mask: {
      id: "mask-1",
      avatar: "1f916",
      name: "Test Mask",
      context: [],
      syncGlobalConfig: true,
      modelConfig: {
        model: "gpt-4o-mini",
        providerName: "OpenAI",
      },
      lang: "cn",
      builtin: false,
      createdAt: 0,
    } as ChatSession["mask"],
    mcpEnabledClients: {},
    multiModelMode: {
      enabled: false,
      selectedModels: [],
      modelMessages: {},
      modelStats: {},
      modelMemoryPrompts: {},
      modelSummarizeIndexes: {},
    },
  };
}

describe("StreamUpdateOptimizer", () => {
  it("merges pending updates for the same message in one batch", () => {
    const onBatchUpdate = jest.fn();
    const optimizer = new StreamUpdateOptimizer(onBatchUpdate);
    const session = createMockSession();
    const tools: ChatMessage["tools"] = [
      {
        id: "tool-1",
        function: {
          name: "demo_tool",
          arguments: "{}",
        },
      },
    ];

    optimizer.updateStreamingMessage(
      session.id,
      "message-1",
      {
        content: "<think>\nfirst chunk",
        streaming: true,
      },
      session,
    );
    optimizer.updateStreamingMessage(
      session.id,
      "message-1",
      {
        tools,
      },
      session,
    );
    optimizer.flushUpdates();

    expect(onBatchUpdate).toHaveBeenCalledTimes(1);

    const updates = onBatchUpdate.mock.calls[0][0] as Map<
      string,
      {
        messageId: string;
        changes: Partial<ChatMessage>;
      }
    >;
    const merged = updates.get(`${session.id}-message-1`);

    expect(merged?.messageId).toBe("message-1");
    expect(merged?.changes).toMatchObject({
      content: "<think>\nfirst chunk",
      streaming: true,
      tools,
    });
  });
});
