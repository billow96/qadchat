import { getTextContentFromSegments, isThinkingTitle } from "./thinking";

describe("thinking utilities", () => {
  it("matches streaming thinking titles with duration suffix", () => {
    expect(
      isThinkingTitle("正在思考中...（用时 12 秒）", "正在思考中..."),
    ).toBe(true);
    expect(isThinkingTitle("思考过程（用时 12 秒）", "正在思考中...")).toBe(
      false,
    );
  });

  it("returns empty text when segments only contain thought blocks", () => {
    expect(
      getTextContentFromSegments([
        {
          type: "thought",
          content: "Here is a thinking process",
        },
      ]),
    ).toBe("");
  });

  it("joins all text segments in order", () => {
    expect(
      getTextContentFromSegments([
        {
          type: "thought",
          content: "思考",
        },
        {
          type: "text",
          content: "第一段答案",
        },
        {
          type: "text",
          content: "\n第二段答案",
        },
      ]),
    ).toBe("第一段答案\n第二段答案");
  });
});
