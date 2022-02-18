import { SelectStatement, BinaryExpressionNode } from "@joe-re/sql-parser";
import { Rule, RuleConfig } from "./index";

type Options = { allowMultipleColumnsPerLine: boolean };
const META = {
  name: "where-clause-new-line",
  type: "select",
};

export const whereClauseNewLine: Rule<SelectStatement, RuleConfig<Options>> = {
  meta: META,
  create: (context) => {
    if (!context.node.where) {
      return;
    }
    function findInvalidClauses(
      expr: BinaryExpressionNode,
      invalidClauses: BinaryExpressionNode[] = []
    ): BinaryExpressionNode[] {
      if (["AND", "OR", "and", "or"].includes(expr.operator)) {
        if (expr.left.location.start.line === expr.right.location.start.line) {
          invalidClauses.push(expr);
        }
      }
      if (expr.left.type === "binary_expr") {
        return findInvalidClauses(
          expr.left as BinaryExpressionNode,
          invalidClauses
        );
      }
      if (expr.right.type === "binary_expr") {
        return findInvalidClauses(
          expr.right as BinaryExpressionNode,
          invalidClauses
        );
      }
      return invalidClauses;
    }

    const invalidClauses =
      context.node.where.expression.type === "binary_expr"
        ? findInvalidClauses(context.node.where.expression)
        : [];
    if (invalidClauses.length === 0) {
      return;
    }

    return invalidClauses.map((v) => ({
      message: "Multiple where clause must go on a new line.",
      location: v.location,
      fix: (fixer) => {
        const afterSpaces = context.getSQL(v.location).match(/\s+$/);
        const afterSpaceNumber = afterSpaces ? afterSpaces[0].length : 0;
        const needSpaces = Math.max(
          v.location.start.column - afterSpaceNumber - 1,
          0
        );
        return [
          fixer.replaceText(
            v.right.location.start.offset - 1,
            v.right.location.start.offset,
            "\n"
          ),
          fixer.insertText(
            v.right.location.start.offset,
            "".padStart(needSpaces, " ")
          ),
        ];
      },
    }));
  },
};
