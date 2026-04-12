// nanoid 是纯 ESM 包，在 Jest 环境下需要 mock
jest.mock("nanoid", () => {
  let counter = 0;
  return { nanoid: () => `test-id-${++counter}` };
});

import {
  contentStartsWithThink,
  splitMessageContentIntoSegments,
  isCurrentRoundStable,
  updateMessageSegmentsFromStream,
} from "../utils/segment-parser";
import type { ChatMessageSegment } from "./chat";

// ─── contentStartsWithThink ────────────────────────────────────────────────

describe("contentStartsWithThink", () => {
  it("detects <think> at the very beginning", () => {
    expect(contentStartsWithThink("<think>\nreasoning")).toBe(true);
  });

  it("detects <think> with leading whitespace", () => {
    expect(contentStartsWithThink("  <think>\nreasoning")).toBe(true);
    expect(contentStartsWithThink("\n<think>\nreasoning")).toBe(true);
    expect(contentStartsWithThink("\t\n <think>\nreasoning")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(contentStartsWithThink("Hello world")).toBe(false);
  });

  it("returns false when <think> is NOT at head", () => {
    expect(contentStartsWithThink("Some text <think>")).toBe(false);
  });

  it("returns false for empty content", () => {
    expect(contentStartsWithThink("")).toBe(false);
  });

  it("returns false for whitespace-only content", () => {
    expect(contentStartsWithThink("   \n\t  ")).toBe(false);
  });

  it("returns false for partial <think tag", () => {
    expect(contentStartsWithThink("<thin")).toBe(false);
    expect(contentStartsWithThink("<think")).toBe(false);
    expect(contentStartsWithThink("<Think>")).toBe(false);
  });
});

// ─── splitMessageContentIntoSegments ───────────────────────────────────────

describe("splitMessageContentIntoSegments", () => {
  it("returns empty array for empty content", () => {
    expect(splitMessageContentIntoSegments("")).toEqual([]);
  });

  it("returns single text segment for plain text (fast path)", () => {
    const segments = splitMessageContentIntoSegments("Hello world");
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("text");
    expect(segments[0].content).toBe("Hello world");
  });

  it("parses unclosed <think> (streaming thinking)", () => {
    const content = "<think>\nstill thinking...";
    const segments = splitMessageContentIntoSegments(content);
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("thought");
    expect(segments[0].content).toBe("\nstill thinking...");
    expect(segments[0].streaming).toBe(true);
  });

  it("parses closed <think> with trailing text", () => {
    const content = "<think>\nreasoning\n</think>\n\nHere is the answer";
    const segments = splitMessageContentIntoSegments(content);
    expect(segments).toHaveLength(2);
    expect(segments[0].type).toBe("thought");
    expect(segments[0].content).toBe("\nreasoning\n");
    expect(segments[0].streaming).toBe(false);
    expect(segments[1].type).toBe("text");
    expect(segments[1].content).toBe("\n\nHere is the answer");
  });

  it("breaks after first <think> match (single think per round)", () => {
    // Even if the content somehow had two <think> blocks, we only parse the first one
    const content =
      "<think>\nfirst\n</think>\nsome text<think>\nsecond\n</think>";
    const segments = splitMessageContentIntoSegments(content);
    expect(segments).toHaveLength(2);
    expect(segments[0].type).toBe("thought");
    expect(segments[0].content).toBe("\nfirst\n");
    // Everything after the first </think> is treated as text (including the second <think>)
    expect(segments[1].type).toBe("text");
    expect(segments[1].content).toContain("some text<think>");
  });

  it("returns plain text when <think> is not at head", () => {
    const content = "Some text before <think>\nthinking\n</think>";
    const segments = splitMessageContentIntoSegments(content);
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("text");
    expect(segments[0].content).toBe(content);
  });
});

// ─── isCurrentRoundStable ──────────────────────────────────────────────────

describe("isCurrentRoundStable", () => {
  it("returns false for empty/undefined segments", () => {
    expect(isCurrentRoundStable(undefined)).toBe(false);
    expect(isCurrentRoundStable([])).toBe(false);
  });

  it("returns true for a single text segment", () => {
    const segments: ChatMessageSegment[] = [
      { id: "1", type: "text", content: "hello", streaming: false },
    ];
    expect(isCurrentRoundStable(segments)).toBe(true);
  });

  it("returns false when thought is still streaming", () => {
    const segments: ChatMessageSegment[] = [
      { id: "1", type: "thought", content: "thinking...", streaming: true },
    ];
    expect(isCurrentRoundStable(segments)).toBe(false);
  });

  it("returns true when thought is done and text follows", () => {
    const segments: ChatMessageSegment[] = [
      {
        id: "1",
        type: "thought",
        content: "done thinking",
        streaming: false,
        durationMs: 3000,
      },
      { id: "2", type: "text", content: "the answer", streaming: false },
    ];
    expect(isCurrentRoundStable(segments)).toBe(true);
  });

  it("returns false when last segment is thought (not text)", () => {
    const segments: ChatMessageSegment[] = [
      {
        id: "1",
        type: "thought",
        content: "done",
        streaming: false,
        durationMs: 1000,
      },
    ];
    expect(isCurrentRoundStable(segments)).toBe(false);
  });
});

// ─── updateMessageSegmentsFromStream ───────────────────────────────────────

describe("updateMessageSegmentsFromStream", () => {
  it("creates segments from scratch when currentSegments is undefined", () => {
    const result = updateMessageSegmentsFromStream(undefined, "Hello world");
    expect(result).toHaveLength(1);
    expect(result![0].type).toBe("text");
    expect(result![0].content).toBe("Hello world");
  });

  it("fast-path: updates only text content when no think tags", () => {
    // First call: establish initial segments
    const initial = updateMessageSegmentsFromStream(undefined, "Hello");
    expect(initial).toHaveLength(1);
    const initialId = initial![0].id;

    // Second call: more text arrived
    const updated = updateMessageSegmentsFromStream(initial, "Hello world");
    expect(updated).toHaveLength(1);
    expect(updated![0].type).toBe("text");
    expect(updated![0].content).toBe("Hello world");
    // Should preserve segment ID (React key stability)
    expect(updated![0].id).toBe(initialId);
  });

  it("fast-path: updates text after closed think block", () => {
    // Round starts with thinking, then transitions to text
    const thinking = updateMessageSegmentsFromStream(
      undefined,
      "<think>\nreasoning",
    );
    expect(thinking).toHaveLength(1);
    expect(thinking![0].type).toBe("thought");
    expect(thinking![0].streaming).toBe(true);

    // Think closes, text begins
    const thinkDone = updateMessageSegmentsFromStream(
      thinking,
      "<think>\nreasoning\n</think>\n\nAnswer part 1",
    );
    expect(thinkDone).toHaveLength(2);
    expect(thinkDone![0].type).toBe("thought");
    expect(thinkDone![0].streaming).toBe(false);
    expect(thinkDone![1].type).toBe("text");
    expect(thinkDone![1].content).toBe("\n\nAnswer part 1");

    // More text arrives — should hit fast path (no re-parse)
    const moreText = updateMessageSegmentsFromStream(
      thinkDone,
      "<think>\nreasoning\n</think>\n\nAnswer part 1, part 2",
    );
    expect(moreText).toHaveLength(2);
    expect(moreText![0].type).toBe("thought");
    expect(moreText![0].content).toBe("\nreasoning\n"); // unchanged
    expect(moreText![1].type).toBe("text");
    expect(moreText![1].content).toBe("\n\nAnswer part 1, part 2");
    // Thought segment ID should be preserved
    expect(moreText![0].id).toBe(thinkDone![0].id);
    // Text segment ID should be preserved
    expect(moreText![1].id).toBe(thinkDone![1].id);
  });

  it("preserves previous tool-round prefix segments", () => {
    // Simulate: round 1 had [thought, text, tool], now round 2 streaming
    const round1Segments: ChatMessageSegment[] = [
      {
        id: "r1-thought",
        type: "thought",
        content: "round 1 thinking",
        streaming: false,
        durationMs: 2000,
      },
      {
        id: "r1-text",
        type: "text",
        content: "round 1 answer",
        streaming: false,
      },
      {
        id: "r1-tool",
        type: "tool",
        content: "",
        streaming: false,
        toolIds: ["tool-1"],
      },
    ];

    // Round 2: new text arriving (no think)
    const result = updateMessageSegmentsFromStream(
      round1Segments,
      "Round 2 answer",
    );
    expect(result).toHaveLength(4); // 3 prefix + 1 new text
    // Prefix preserved
    expect(result![0].id).toBe("r1-thought");
    expect(result![1].id).toBe("r1-text");
    expect(result![2].id).toBe("r1-tool");
    // New round's text
    expect(result![3].type).toBe("text");
    expect(result![3].content).toBe("Round 2 answer");
  });

  it("multi-round tool chain: preserves all rounds correctly", () => {
    // Simulate: round 1 done, round 2 done, now round 3 streaming
    const segments: ChatMessageSegment[] = [
      {
        id: "r1-thought",
        type: "thought",
        content: "r1 think",
        streaming: false,
      },
      { id: "r1-text", type: "text", content: "r1 text", streaming: false },
      {
        id: "r1-tool",
        type: "tool",
        content: "",
        streaming: false,
        toolIds: ["t1"],
      },
      {
        id: "r2-thought",
        type: "thought",
        content: "r2 think",
        streaming: false,
      },
      { id: "r2-text", type: "text", content: "r2 text", streaming: false },
      {
        id: "r2-tool",
        type: "tool",
        content: "",
        streaming: false,
        toolIds: ["t2"],
      },
    ];

    // Round 3: thinking in progress
    const r3thinking = updateMessageSegmentsFromStream(
      segments,
      "<think>\nr3 reasoning",
    );
    // 6 prefix + 1 thought
    expect(r3thinking).toHaveLength(7);
    expect(r3thinking![6].type).toBe("thought");
    expect(r3thinking![6].streaming).toBe(true);

    // Round 3: think done, text flowing
    const r3text = updateMessageSegmentsFromStream(
      r3thinking,
      "<think>\nr3 reasoning\n</think>\n\nFinal answer growing...",
    );
    expect(r3text).toHaveLength(8); // 6 prefix + thought + text
    expect(r3text![6].type).toBe("thought");
    expect(r3text![6].streaming).toBe(false);
    expect(r3text![7].type).toBe("text");
    expect(r3text![7].content).toBe("\n\nFinal answer growing...");

    // Round 3: more text — should hit fast path
    const r3more = updateMessageSegmentsFromStream(
      r3text,
      "<think>\nr3 reasoning\n</think>\n\nFinal answer growing... with more content",
    );
    expect(r3more).toHaveLength(8);
    expect(r3more![7].content).toBe(
      "\n\nFinal answer growing... with more content",
    );
    // IDs preserved
    expect(r3more![7].id).toBe(r3text![7].id);
  });

  it("returns cloned segments for empty content", () => {
    const segments: ChatMessageSegment[] = [
      { id: "1", type: "text", content: "hello", streaming: false },
    ];
    const result = updateMessageSegmentsFromStream(segments, "");
    expect(result).toHaveLength(1);
    expect(result![0].content).toBe("hello");
    // Should be a clone, not same reference
    expect(result![0]).not.toBe(segments[0]);
  });
});
