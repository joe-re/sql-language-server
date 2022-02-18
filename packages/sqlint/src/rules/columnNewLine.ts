import { SelectStatement } from "@joe-re/sql-parser";
import { Rule, RuleConfig } from "./index";

type Options = { allowMultipleColumnsPerLine: boolean };
const META = {
  name: "column-new-line",
  type: "select",
  options: { allowMultipleColumnsPerLine: Boolean },
};

export const columnNewLine: Rule<SelectStatement, RuleConfig<Options>> = {
  meta: META,
  create: (context) => {
    if (Array.isArray(context.node.columns)) {
      const first = context.node.columns[0];
      const rest = context.node.columns.slice(1, context.node.columns.length);
      let previousLine = first.location.start.line;
      let previousOffset = first.location.end.offset;
      let previousColumn = first.location.start.column;
      const invalidColumns = rest
        .map((v) => {
          const result = {
            column: v,
            previousLine,
            previousOffset,
            previousColumn,
          };
          previousLine = v.location.start.line;
          previousOffset = v.location.end.offset;
          previousColumn = v.location.start.column;
          return result;
        })
        .filter((v) => v.column.location.start.line === v.previousLine);
      if (invalidColumns.length === 0) {
        return;
      }
      return invalidColumns.map((v) => {
        return {
          message: "Columns must go on a new line.",
          location: v.column.location,
          fix: (fixer) => {
            // "," should be at after previousOffset so + 1 to include it
            const pos = v.previousOffset + 1;
            // calculate number of spaces to align calumns position to the first
            const spacesNumber =
              first.location.start.column -
              (v.column.location.start.offset - v.previousOffset);
            return fixer.insertText(pos, "\n" + "".padStart(spacesNumber, " "));
          },
        };
      });
    }
  },
};
