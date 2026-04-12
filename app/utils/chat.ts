import {
  CACHE_URL_PREFIX,
  UPLOAD_URL,
  REQUEST_TIMEOUT_MS,
} from "@/app/constant";
import { estimateTokenLength } from "@/app/utils/token";
import type { MultimodalContent, RequestMessage } from "@/app/client/api";
import Locale from "@/app/locales";
import {
  EventStreamContentType,
  fetchEventSource,
} from "@fortaine/fetch-event-source";
import { prettyObject } from "./format";
import { fetch as tauriFetch } from "./stream";
import { getMessageTextContentWithoutThinkingFromContent } from "../utils";
import type { ChatMessageSegment, ChatMessageTool } from "../store";

export type OpenAICompatibleRequestMessage = RequestMessage & {
  role: "developer" | "system" | "user" | "assistant" | "tool";
  tool_calls?: ChatMessageTool[];
  tool_call_id?: string;
  name?: string;
};

function appendToolCallChunk(runTools: ChatMessageTool[], chunkTools: any[]) {
  for (const partialTool of chunkTools || []) {
    const toolIndex =
      typeof partialTool?.index === "number"
        ? partialTool.index
        : runTools.length > 0
        ? runTools.length - 1
        : 0;

    if (!runTools[toolIndex]) {
      runTools[toolIndex] = {
        id: partialTool?.id || `tool_${toolIndex}`,
        index: toolIndex,
        type: partialTool?.type,
        function: {
          name: partialTool?.function?.name || "",
          arguments: partialTool?.function?.arguments || "",
        },
      };
      continue;
    }

    const current = runTools[toolIndex];
    if (partialTool?.id) {
      current.id = partialTool.id;
    }
    if (typeof partialTool?.type === "string") {
      current.type = partialTool.type;
    }
    current.index = toolIndex;
    current.function = current.function || { name: "", arguments: "" };
    if (typeof partialTool?.function?.name === "string") {
      current.function.name += partialTool.function.name;
    }
    if (typeof partialTool?.function?.arguments === "string") {
      current.function.arguments =
        (current.function.arguments || "") + partialTool.function.arguments;
    }
  }
}

export function collectOpenAIStyleToolCalls(
  runTools: ChatMessageTool[],
  chunkTools?: ChatMessageTool[],
) {
  if (!chunkTools?.length) return;
  appendToolCallChunk(runTools, chunkTools);
}

function formatToolResponseContent(response: any): string {
  const raw =
    response?.content ?? response?.data ?? response?.statusText ?? response;

  if (
    Array.isArray(raw) &&
    raw.length === 1 &&
    raw[0]?.type === "text" &&
    typeof raw[0]?.text === "string"
  ) {
    try {
      return JSON.stringify(JSON.parse(raw[0].text), null, 2);
    } catch {
      return raw[0].text;
    }
  }

  if (typeof raw === "string") {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}

function hasToolCallsFinishReason(text: string) {
  try {
    const json = JSON.parse(text);
    const openAIChoices = Array.isArray(json?.choices) ? json.choices : [];
    if (
      openAIChoices.some(
        (choice: any) => choice?.finish_reason === "tool_calls",
      )
    ) {
      return true;
    }

    const qwenChoices = Array.isArray(json?.output?.choices)
      ? json.output.choices
      : [];
    if (
      qwenChoices.some((choice: any) => choice?.finish_reason === "tool_calls")
    ) {
      return true;
    }
  } catch {}

  return false;
}

export function expandMessagesWithToolHistory(messages: any[]) {
  const expanded: any[] = [];

  for (const message of messages) {
    const tools = Array.isArray(message?.tools) ? message.tools : [];
    const hasToolHistory = message?.role === "assistant" && tools.length > 0;

    if (!hasToolHistory) {
      // 对于非工具调用的助手消息，也要移除思考内容
      if (
        message?.role === "assistant" &&
        typeof message?.content === "string"
      ) {
        expanded.push({
          ...message,
          content: getMessageTextContentWithoutThinkingFromContent(
            message.content,
          ),
        });
      } else {
        expanded.push(message);
      }
      continue;
    }

    // 工具调用的助手消息，content 应为空（不发送思考内容给模型）
    expanded.push({
      role: "assistant",
      content: "",
      tool_calls: tools.map((tool: ChatMessageTool, index: number) => ({
        id: tool.id,
        index,
        type: tool.type || "function",
        function: {
          name: tool?.function?.name || "",
          arguments:
            tool?.function?.arguments ||
            JSON.stringify(tool.argumentsObj || {}),
        },
      })),
    });

    for (const tool of tools) {
      const toolContent =
        tool.content ??
        (tool.response
          ? formatToolResponseContent(tool.response)
          : undefined) ??
        tool.errorMsg;
      if (!toolContent) continue;

      expanded.push({
        role: "tool",
        content: toolContent,
        tool_call_id: tool.id,
        name: tool?.function?.name,
      });
    }

    // 最终助手回复内容（移除思考标签后）
    const rawContent =
      typeof message.content === "string" ? message.content : "";
    const cleanContent =
      getMessageTextContentWithoutThinkingFromContent(rawContent);
    if (cleanContent.trim().length > 0) {
      expanded.push({
        role: "assistant",
        content: cleanContent,
      });
    }
  }

  return expanded;
}

export function toOpenAICompatibleMessage(
  message: Partial<OpenAICompatibleRequestMessage>,
  options?: {
    stripThinkingForAssistant?: boolean;
  },
): OpenAICompatibleRequestMessage {
  const stripThinkingForAssistant = !!options?.stripThinkingForAssistant;
  const baseContent =
    message?.role === "assistant" && stripThinkingForAssistant
      ? typeof message?.content === "string"
        ? getMessageTextContentWithoutThinkingFromContent(message.content)
        : message.content
      : message?.content;

  const normalizedMessage: OpenAICompatibleRequestMessage = {
    role: (message?.role || "user") as OpenAICompatibleRequestMessage["role"],
    content: baseContent ?? "",
  };

  if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
    normalizedMessage.tool_calls = message.tool_calls.map(
      (tool: ChatMessageTool, index: number) => ({
        id: tool?.id,
        index:
          typeof tool?.index === "number"
            ? tool.index
            : typeof index === "number"
            ? index
            : 0,
        type: tool?.type || "function",
        function: {
          name: tool?.function?.name || "",
          arguments: tool?.function?.arguments || "",
        },
      }),
    );
  }

  if (typeof message?.tool_call_id === "string" && message.tool_call_id) {
    normalizedMessage.tool_call_id = message.tool_call_id;
  }

  if (typeof message?.name === "string" && message.name) {
    normalizedMessage.name = message.name;
  }

  return normalizedMessage;
}

export function compressImage(file: Blob, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent: any) => {
      const image = new Image();
      image.onload = () => {
        let canvas = document.createElement("canvas");
        let ctx = canvas.getContext("2d");
        let width = image.width;
        let height = image.height;
        let quality = 0.9;
        let dataUrl;

        do {
          canvas.width = width;
          canvas.height = height;
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
          ctx?.drawImage(image, 0, 0, width, height);
          dataUrl = canvas.toDataURL("image/jpeg", quality);

          if (dataUrl.length < maxSize) break;

          if (quality > 0.5) {
            // Prioritize quality reduction
            quality -= 0.1;
          } else {
            // Then reduce the size
            width *= 0.9;
            height *= 0.9;
          }
        } while (dataUrl.length > maxSize);

        resolve(dataUrl);
      };
      image.onerror = reject;
      image.src = readerEvent.target.result;
    };
    reader.onerror = reject;

    if (file.type.includes("heic")) {
      try {
        const heic2any = require("heic2any");
        heic2any({ blob: file, toType: "image/jpeg" })
          .then((blob: Blob) => {
            reader.readAsDataURL(blob);
          })
          .catch((e: any) => {
            reject(e);
          });
      } catch (e) {
        reject(e);
      }
    }

    reader.readAsDataURL(file);
  });
}

export async function preProcessImageContentBase(
  content: RequestMessage["content"],
  transformImageUrl: (url: string) => Promise<{ [key: string]: any }>,
) {
  if (typeof content === "string") {
    return content;
  }
  const result = [];
  for (const part of content) {
    if (part?.type == "image_url" && part?.image_url?.url) {
      try {
        const url = await cacheImageToBase64Image(part?.image_url?.url);
        result.push(await transformImageUrl(url));
      } catch (error) {
        console.error("Error processing image URL:", error);
      }
    } else {
      result.push({ ...part });
    }
  }
  return result;
}

export async function preProcessImageContent(
  content: RequestMessage["content"],
) {
  return preProcessImageContentBase(content, async (url) => ({
    type: "image_url",
    image_url: { url },
  })) as Promise<MultimodalContent[] | string>;
}

export async function preProcessImageContentForAlibabaDashScope(
  content: RequestMessage["content"],
) {
  return preProcessImageContentBase(content, async (url) => ({
    image: url,
  }));
}

const imageCaches: Record<string, string> = {};
export function cacheImageToBase64Image(imageUrl: string) {
  if (imageUrl.includes(CACHE_URL_PREFIX)) {
    if (!imageCaches[imageUrl]) {
      const reader = new FileReader();
      return fetch(imageUrl, {
        method: "GET",
        mode: "cors",
        credentials: "include",
      })
        .then((res) => res.blob())
        .then(
          async (blob) =>
            (imageCaches[imageUrl] = await compressImage(blob, 256 * 1024)),
        ); // compressImage
    }
    return Promise.resolve(imageCaches[imageUrl]);
  }
  return Promise.resolve(imageUrl);
}

export function base64Image2Blob(base64Data: string, contentType: string) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

export function uploadImage(file: Blob): Promise<string> {
  if (!window._SW_ENABLED) {
    // if serviceWorker register error, using compressImage
    return compressImage(file, 256 * 1024);
  }
  const body = new FormData();
  body.append("file", file);
  return fetch(UPLOAD_URL, {
    method: "post",
    body,
    mode: "cors",
    credentials: "include",
  })
    .then((res) => res.json())
    .then((res) => {
      // console.log("res", res);
      if (res?.code == 0 && res?.data) {
        return res?.data;
      }
      throw Error(`upload Error: ${res?.msg}`);
    });
}

export function removeImage(imageUrl: string) {
  return fetch(imageUrl, {
    method: "DELETE",
    mode: "cors",
    credentials: "include",
  });
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function stream(
  chatPath: string,
  requestPayload: any,
  headers: any,
  tools: any[],
  funcs: Record<string, Function>,
  controller: AbortController,
  parseSSE: (text: string, runTools: any[]) => string | undefined,
  processToolMessage: (
    requestPayload: any,
    toolCallMessage: any,
    toolCallResult: any[],
  ) => void,
  options: any,
) {
  let responseText = "";
  let displayText = "";
  let remainText = "";
  let finished = false;
  let running = false;
  let runTools: any[] = [];
  let responseRes: Response;

  // animate response to make it looks smooth
  function animateResponseText() {
    if (finished || controller.signal.aborted) {
      responseText += remainText;
      if (responseText?.length === 0) {
        options.onError?.(new Error("empty response from server"));
      }
      return;
    }

    if (remainText.length > 0) {
      const fetchCount = Math.max(1, Math.round(remainText.length / 60));
      const fetchText = remainText.slice(0, fetchCount);
      responseText += fetchText;
      remainText = remainText.slice(fetchCount);
      options.onUpdate?.(responseText, fetchText);
    }

    requestAnimationFrame(animateResponseText);
  }

  // start animaion
  animateResponseText();

  const finish = () => {
    if (!finished) {
      if (!running && runTools.length > 0) {
        const toolCallMessage = {
          role: "assistant",
          content: responseText + remainText,
          tool_calls: [...runTools],
        };
        options?.onToolCallMessage?.(toolCallMessage);
        running = true;
        responseText = "";
        remainText = "";
        runTools.splice(0, runTools.length); // empty runTools
        return Promise.all(
          toolCallMessage.tool_calls.map((tool) => {
            options?.onBeforeTool?.(tool);
            return Promise.resolve(
              // @ts-ignore
              funcs[tool.function.name](
                // @ts-ignore
                tool?.function?.arguments
                  ? JSON.parse(tool?.function?.arguments)
                  : {},
              ),
            )
              .then((res) => {
                const response =
                  typeof res === "string"
                    ? { content: res, data: res, status: 200 }
                    : res;
                const content = formatToolResponseContent(response);
                if ((response?.status ?? 200) >= 300) {
                  return Promise.reject(content);
                }
                return { content, response };
              })
              .then(({ content, response }) => {
                options?.onAfterTool?.({
                  ...tool,
                  content,
                  response,
                  isError: false,
                });
                return { content, response };
              })
              .catch((e) => {
                options?.onAfterTool?.({
                  ...tool,
                  isError: true,
                  errorMsg: e.toString(),
                });
                return e.toString();
              })
              .then((result) =>
                typeof result === "string"
                  ? {
                      name: tool.function.name,
                      role: "tool",
                      content: result,
                      tool_call_id: tool.id,
                    }
                  : {
                      name: tool.function.name,
                      role: "tool",
                      content: result.content,
                      tool_call_id: tool.id,
                      response: result.response,
                    },
              );
          }),
        ).then((toolCallResult) => {
          processToolMessage(requestPayload, toolCallMessage, toolCallResult);
          setTimeout(() => {
            // call again
            console.debug("[ChatAPI] restart");
            running = false;
            chatApi(chatPath, headers, requestPayload, tools); // call fetchEventSource
          }, 60);
        });
        return;
      }
      if (running) {
        return;
      }
      console.debug("[ChatAPI] end");
      finished = true;
      options.onFinish(responseText + remainText, responseRes); // 将res传递给onFinish
    }
  };

  controller.signal.onabort = finish;

  function chatApi(
    chatPath: string,
    headers: any,
    requestPayload: any,
    tools: any,
  ) {
    const chatPayload = {
      method: "POST",
      body: JSON.stringify({
        ...requestPayload,
        tools: tools && tools.length ? tools : undefined,
      }),
      signal: controller.signal,
      headers,
    };
    const requestTimeoutId = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );
    fetchEventSource(chatPath, {
      fetch: tauriFetch as any,
      ...chatPayload,
      async onopen(res) {
        clearTimeout(requestTimeoutId);
        const contentType = res.headers.get("content-type");

        responseRes = res;

        if (contentType?.startsWith("text/plain")) {
          responseText = await res.clone().text();
          return finish();
        }

        if (
          !res.ok ||
          !res.headers
            .get("content-type")
            ?.startsWith(EventStreamContentType) ||
          res.status !== 200
        ) {
          const responseTexts = [responseText];
          let extraInfo = await res.clone().text();
          try {
            const resJson = await res.clone().json();
            extraInfo = prettyObject(resJson);
          } catch {}

          if (res.status === 401) {
            responseTexts.push(Locale.Error.Unauthorized);
          }

          if (extraInfo) {
            responseTexts.push(extraInfo);
          }

          responseText = responseTexts.join("\n\n");

          return finish();
        }
      },
      onmessage(msg) {
        if (msg.data === "[DONE]" || finished) {
          return finish();
        }
        const text = msg.data;
        // Skip empty messages
        if (!text || text.trim().length === 0) {
          return;
        }
        try {
          const chunk = parseSSE(text, runTools);
          if (chunk) {
            remainText += chunk;
          }
          if (hasToolCallsFinishReason(text)) {
            finish();
          }
        } catch (e) {
          console.error("[Request] parse error", text, msg, e);
        }
      },
      onclose() {
        finish();
      },
      onerror(e) {
        options?.onError?.(e);
        throw e;
      },
      openWhenHidden: true,
    });
  }
  console.debug("[ChatAPI] start");
  chatApi(chatPath, headers, requestPayload, tools); // call fetchEventSource
}

export function streamWithThink(
  chatPath: string,
  requestPayload: any,
  headers: any,
  tools: any[],
  funcs: Record<string, Function>,
  controller: AbortController,
  parseSSE: (
    text: string,
    runTools: any[],
  ) => {
    isThinking: boolean;
    content: string | undefined;
  },
  processToolMessage: (
    requestPayload: any,
    toolCallMessage: any,
    toolCallResult: any[],
  ) => void,
  options: any,
  modelHasReasoningCapability: boolean = false, // 新增参数：模型是否具有推理能力
) {
  let responseText = "";
  let displayText = "";
  let remainText = "";
  let finished = false;
  let running = false;
  let runTools: any[] = [];
  let responseRes: Response;
  let isInThinkingMode = false;
  let lastIsThinking = false;
  let lastIsThinkingTagged = false; //between <think> and </think> tags
  const startRequestTime = Date.now();
  let firstReplyLatency = 0;
  let totalThinkingLatency = 0;
  let totalReplyLatency = 0;
  let completionTokens = 0;

  const canRenderThinking = (chunkIsThinking: boolean) =>
    modelHasReasoningCapability || chunkIsThinking || lastIsThinkingTagged;

  const syncDisplayText = () => {
    displayText = responseText + remainText;
  };

  // animate response to make it looks smooth
  function animateResponseText() {
    if (finished || controller.signal.aborted) {
      responseText += remainText;
      syncDisplayText();
      if (responseText?.length === 0) {
        options.onError?.(new Error("empty response from server"));
      }
      return;
    }

    if (remainText.length > 0) {
      const fetchCount = Math.max(1, Math.round(remainText.length / 60));
      const fetchText = remainText.slice(0, fetchCount);
      responseText += fetchText;
      remainText = remainText.slice(fetchCount);
      syncDisplayText();
      options.onUpdate?.(displayText, fetchText);
    }

    requestAnimationFrame(animateResponseText);
  }

  // start animaion
  animateResponseText();

  const finish = () => {
    if (!finished) {
      if (!running && runTools.length > 0) {
        // 如果工具调用时还在思考模式，先关闭思考标签
        if (isInThinkingMode) {
          remainText += "\n</think>";
          isInThinkingMode = false;
        }
        // 确保所有剩余文本都合并到 responseText
        responseText += remainText;
        remainText = "";
        syncDisplayText();

        const toolCallMessage = {
          role: "assistant",
          content: displayText,
          tool_calls: [...runTools],
        };
        options?.onToolCallMessage?.(toolCallMessage);
        running = true;
        responseText = "";
        displayText = "";
        remainText = "";
        // 重置思考状态，为下一轮流式响应做准备
        isInThinkingMode = false;
        lastIsThinking = false;
        lastIsThinkingTagged = false;
        runTools.splice(0, runTools.length); // empty runTools
        return Promise.all(
          toolCallMessage.tool_calls.map((tool) => {
            options?.onBeforeTool?.(tool);
            return Promise.resolve(
              // @ts-ignore
              funcs[tool.function.name](
                // @ts-ignore
                tool?.function?.arguments
                  ? JSON.parse(tool?.function?.arguments)
                  : {},
              ),
            )
              .then((res) => {
                const response =
                  typeof res === "string"
                    ? { content: res, data: res, status: 200 }
                    : res;
                const content = formatToolResponseContent(response);
                if ((response?.status ?? 200) >= 300) {
                  return Promise.reject(content);
                }
                return { content, response };
              })
              .then(({ content, response }) => {
                options?.onAfterTool?.({
                  ...tool,
                  content,
                  response,
                  isError: false,
                });
                return { content, response };
              })
              .catch((e) => {
                options?.onAfterTool?.({
                  ...tool,
                  isError: true,
                  errorMsg: e.toString(),
                });
                return e.toString();
              })
              .then((result) =>
                typeof result === "string"
                  ? {
                      name: tool.function.name,
                      role: "tool",
                      content: result,
                      tool_call_id: tool.id,
                    }
                  : {
                      name: tool.function.name,
                      role: "tool",
                      content: result.content,
                      tool_call_id: tool.id,
                      response: result.response,
                    },
              );
          }),
        ).then((toolCallResult) => {
          processToolMessage(requestPayload, toolCallMessage, toolCallResult);
          setTimeout(() => {
            // call again

            running = false;
            chatApi(chatPath, headers, requestPayload, tools); // call fetchEventSource
          }, 60);
        });
        return;
      }
      if (running) {
        return;
      }

      // 如果流结束时还在思考模式，添加结束标签
      if (isInThinkingMode) {
        remainText += "\n</think>";
      }

      if (!totalReplyLatency) {
        totalReplyLatency = Date.now() - startRequestTime;
      }
      if (isInThinkingMode && !totalThinkingLatency) {
        totalThinkingLatency = Math.max(
          0,
          totalReplyLatency - firstReplyLatency,
        );
      }

      const finalContent = responseText + remainText;
      syncDisplayText();
      if (!completionTokens && finalContent) {
        completionTokens = Math.round(estimateTokenLength(finalContent));
      }

      finished = true;
      options.onFinish(
        {
          content: finalContent,
          displayContent: displayText,
          is_stream_request: true,
          usage: {
            completion_tokens: completionTokens || undefined,
            first_content_latency: firstReplyLatency || undefined,
            thinking_time: totalThinkingLatency || undefined,
            total_latency: totalReplyLatency || undefined,
          },
        },
        responseRes,
      );
    }
  };

  controller.signal.onabort = finish;

  function chatApi(
    chatPath: string,
    headers: any,
    requestPayload: any,
    tools: any,
  ) {
    const chatPayload = {
      method: "POST",
      body: JSON.stringify({
        ...requestPayload,
        tools: tools && tools.length ? tools : undefined,
      }),
      signal: controller.signal,
      headers,
    };
    const requestTimeoutId = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );
    fetchEventSource(chatPath, {
      fetch: tauriFetch as any,
      ...chatPayload,
      async onopen(res) {
        clearTimeout(requestTimeoutId);
        const contentType = res.headers.get("content-type");

        responseRes = res;

        if (contentType?.startsWith("text/plain")) {
          responseText = await res.clone().text();
          return finish();
        }

        if (
          !res.ok ||
          !res.headers
            .get("content-type")
            ?.startsWith(EventStreamContentType) ||
          res.status !== 200
        ) {
          const responseTexts = [responseText];
          let extraInfo = await res.clone().text();
          try {
            const resJson = await res.clone().json();
            extraInfo = prettyObject(resJson);
          } catch {}

          if (res.status === 401) {
            responseTexts.push(Locale.Error.Unauthorized);
          }

          if (extraInfo) {
            responseTexts.push(extraInfo);
          }

          responseText = responseTexts.join("\n\n");

          return finish();
        }
      },
      onmessage(msg) {
        if (msg.data === "[DONE]" || finished) {
          return finish();
        }
        const text = msg.data;
        // Skip empty messages
        if (!text || text.trim().length === 0) {
          return;
        }
        try {
          const chunk = parseSSE(text, runTools);
          if (!firstReplyLatency) {
            firstReplyLatency = Date.now() - startRequestTime;
          }
          try {
            const usageJson = JSON.parse(text);
            const usage = usageJson?.usage;
            if (usage) {
              completionTokens =
                (typeof usage?.total_tokens === "number" &&
                typeof usage?.prompt_tokens === "number"
                  ? usage.total_tokens - usage.prompt_tokens
                  : usage?.completion_tokens) ?? completionTokens;
            }
          } catch {}
          if (hasToolCallsFinishReason(text)) {
            finish();
          }
          // Skip if content is empty
          if (!chunk?.content || chunk.content.length === 0) {
            return;
          }

          // deal with <think> and </think> tags start
          // 只有当模型具有推理能力时才处理思考内容
          if (canRenderThinking(chunk.isThinking) && !chunk.isThinking) {
            if (chunk.content.startsWith("<think>")) {
              chunk.isThinking = true;
              chunk.content = chunk.content.slice(7).trim();
              lastIsThinkingTagged = true;
            } else if (chunk.content.endsWith("</think>")) {
              chunk.isThinking = false;
              chunk.content = chunk.content.slice(0, -8).trim();
              lastIsThinkingTagged = false;
            } else if (lastIsThinkingTagged) {
              chunk.isThinking = true;
            }
          }
          // deal with <think> and </think> tags end

          // Check if thinking mode changed
          const isThinkingChanged = lastIsThinking !== chunk.isThinking;
          lastIsThinking = chunk.isThinking;

          if (canRenderThinking(chunk.isThinking) && chunk.isThinking) {
            // If in thinking mode and the upstream has exposed reasoning chunks
            if (!isInThinkingMode || isThinkingChanged) {
              // If this is a new thinking block or mode changed, add opening tag
              isInThinkingMode = true;
              if (remainText.length > 0) {
                remainText += "\n";
              }
              remainText += "<think>\n" + chunk.content;
            } else {
              // Continue adding thinking content
              remainText += chunk.content;
            }
            totalThinkingLatency = Date.now() - startRequestTime;
          } else {
            // If in normal mode, append plain content and close any open think block
            if (isInThinkingMode || isThinkingChanged) {
              // If switching from thinking mode to normal mode, add closing tag
              isInThinkingMode = false;
              remainText += "\n</think>\n\n" + chunk.content;
            } else {
              remainText += chunk.content;
            }
          }
          syncDisplayText();
        } catch (e) {
          console.error("[Request] parse error", text, msg, e);
          // Don't throw error for parse failures, just log them
        }
      },
      onclose() {
        finish();
      },
      onerror(e) {
        options?.onError?.(e);
        throw e;
      },
      openWhenHidden: true,
    });
  }
  console.debug("[ChatAPI] start");
  chatApi(chatPath, headers, requestPayload, tools); // call fetchEventSource
}
