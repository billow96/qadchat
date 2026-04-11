import {
  expandMessagesWithToolHistory,
  toOpenAICompatibleMessage,
} from "./chat";

describe("tool history expansion", () => {
  it("keeps assistant tool calls, original tool ids and strips thinking from content", () => {
    const toolId = "toolu_01L3SfnsBxqCuA5cDaLqyfBM";
    const messages = [
      {
        role: "assistant",
        content: "<武汉实时天气",
        toolCallContent: "正在查询：武汉天气，请稍候...",
        tools: [
          {
            id: toolId,
            type: "function",
            function: {
              name: "mcp__lifeService__lifeServiceGetWeather",
              arguments: '{"city_name":"武汉"}',
            },
            content: '{"success":true,"city":"武汉"}',
          },
        ],
      },
    ];

    const expanded = expandMessagesWithToolHistory(messages);

    // 工具调用消息 + 工具结果 + 最终助手回复
    expect(expanded).toHaveLength(3);
    expect(expanded[0]).toEqual({
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: toolId,
          index: 0,
          type: "function",
          function: {
            name: "mcp__lifeService__lifeServiceGetWeather",
            arguments: '{"city_name":"武汉"}',
          },
        },
      ],
    });
    expect(expanded[1]).toEqual({
      role: "tool",
      content: '{"success":true,"city":"武汉"}',
      tool_call_id: toolId,
      name: "mcp__lifeService__lifeServiceGetWeather",
    });
    // 最终助手回复不包含思考内容
    expect(expanded[2]).toEqual({
      role: "assistant",
      content: "<武汉实时天气",
    });
  });

  it("strips thinking content from tool call messages and final assistant reply", () => {
    const toolId = "toolu_01L3SfnsBxqCuA5cDaLqyfBM";
    const messages = [
      {
        role: "assistant",
        content:
          "<think>\n第一段思考\n</think>\n\n<think>\n第二段思考\n</think>\n\n最终答案",
        segments: [
          {
            id: "seg-1",
            type: "thought",
            content: "第一段思考",
            durationMs: 12000,
          },
          {
            id: "seg-2",
            type: "thought",
            content: "第二段思考",
            durationMs: 9000,
          },
          {
            id: "seg-3",
            type: "text",
            content: "最终答案",
          },
        ],
        tools: [
          {
            id: toolId,
            type: "function",
            function: {
              name: "mcp__lifeService__lifeServiceGetWeather",
              arguments: '{"city_name":"武汉"}',
            },
            content: '{"success":true,"city":"武汉"}',
          },
        ],
      },
    ];

    const expanded = expandMessagesWithToolHistory(messages);

    // 工具调用消息的 content 应为空（不发送思考内容给模型）
    expect(expanded[0]).toEqual({
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: toolId,
          index: 0,
          type: "function",
          function: {
            name: "mcp__lifeService__lifeServiceGetWeather",
            arguments: '{"city_name":"武汉"}',
          },
        },
      ],
    });
    // 最终助手回复只包含纯文本，不包含思考
    expect(expanded[2]).toEqual({
      role: "assistant",
      content: "最终答案",
    });
  });

  it("strips thinking from non-tool assistant messages", () => {
    const messages = [
      {
        role: "assistant",
        content: "<think>\n思考内容\n</think>\n\n回复内容",
      },
    ];

    const expanded = expandMessagesWithToolHistory(messages);

    expect(expanded).toHaveLength(1);
    expect(expanded[0].content).toBe("回复内容");
  });
});

describe("openai compatible message conversion", () => {
  it("preserves tool metadata fields for openai-style providers", () => {
    const toolId = "toolu_01QYMrXMcr3K7B6SqgtDgc7Z";
    const normalized = toOpenAICompatibleMessage({
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: toolId,
          type: "function",
          function: {
            name: "mcp__lifeService__lifeServiceGetWeather",
            arguments: '{"city_name":"上海"}',
          },
        },
      ],
    });

    expect(normalized).toEqual({
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: toolId,
          index: 0,
          type: "function",
          function: {
            name: "mcp__lifeService__lifeServiceGetWeather",
            arguments: '{"city_name":"上海"}',
          },
        },
      ],
    });
  });
});
