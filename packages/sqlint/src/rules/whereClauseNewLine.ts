import { SelectStatement, BinaryExpressionNode } from '@joe-re/sql-parser'
import { Rule, RuleConfig } from './index'

type Options = { allowMultipleColumnsPerLine: boolean }
const META = {
  name: 'where-clause-new-line',
  type: 'select'
};

export const whereClauseNewLine: Rule<SelectStatement, RuleConfig<Options>> = {
  meta: META,
  create: (context) => {
    if (!context.node.where) {
      return
    }
    function findInvalidClause(expr: BinaryExpressionNode): BinaryExpressionNode | null {
      if (expr.left.location.start.line === expr.right.location.start.line && expr.left.type === 'binary_expr') {
        return expr.left as BinaryExpressionNode
      }
      if (expr.right.type === 'binary_expr') {
        return findInvalidClause(expr.right as BinaryExpressionNode)
      }
      return null
    }

    const invalidClause = findInvalidClause(context.node.where.expression)
    if (invalidClause) {
      return {
        message: 'Multiple where clause must go on a new line.',
        location: invalidClause.location,
        rulename: META.name,
        errorLevel: context.config.level
      }
    }
  }
}
