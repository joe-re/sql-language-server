import { applyFixes, createFixer } from "../src/fixer";

describe("applyFixes", () => {
  it("should replace with new text", () => {
    const result = applyFixes("SELECT * FROM table WHERE a=1", [
      {
        range: { startOffset: 27, endOffset: 27 },
        text: " ",
      },
      {
        range: { startOffset: 28, endOffset: 28 },
        text: " ",
      },
    ]);
    expect(result).toEqual("SELECT * FROM table WHERE a = 1");
  });
});

describe("fixer", () => {
  const message = "message";
  const fixer = createFixer();

  describe("insertText", () => {
    it("should insert specified text before offset", () => {
      const result = fixer.insertText(1, "insert");
      expect(result.text).toEqual("insert");
      expect(result.range).toEqual({ startOffset: 1, endOffset: 1 });
      expect(applyFixes(message, [result])).toEqual("minsertessage");
    });
  });

  describe("replaceText", () => {
    it("should replace message with specified text at specified range", () => {
      const result = fixer.replaceText(1, 2, "replace");
      expect(result.text).toEqual("replace");
      expect(result.range).toEqual({ startOffset: 1, endOffset: 2 });
      expect(applyFixes(message, [result])).toEqual("mreplacessage");
    });
  });
});
