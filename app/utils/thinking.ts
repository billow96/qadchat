import type { ChatMessageSegment } from "../store/chat";

export function isThinkingTitle(
  title: string | null | undefined,
  thinkingLabel: string,
) {
  return typeof title === "string" && title.startsWith(thinkingLabel);
}

export function getTextContentFromSegments(
  segments?: Pick<ChatMessageSegment, "type" | "content">[],
) {
  if (!segments?.length) return "";

  return segments
    .filter((segment) => segment.type === "text")
    .map((segment) => segment.content)
    .join("");
}
