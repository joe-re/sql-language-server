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
    function findInvalidClauses(
      expr: BinaryExpressionNode,
      invalidClauses: BinaryExpressionNode[] = []
    ): BinaryExpressionNode[] {
      if (expr.left.location.start.line === expr.right.location.start.line && expr.left.type === 'binary_expr') {
        invalidClauses.push(expr.left as BinaryExpressionNode)
      }
      if (expr.right.type === 'binary_expr') {
        return findInvalidClauses(expr.right as BinaryExpressionNode, invalidClauses)
      }
      return invalidClauses
    }

    const invalidClauses = findInvalidClauses(context.node.where.expression)
    if (invalidClauses.length === 0) {
      return
    }
    return invalidClauses.map(v => ({
      message: 'Multiple where clause must go on a new line.',
      location: v.location,
      rulename: META.name,
      errorLevel: context.config.level,
      fix: (fixer) => {
        const afterSpaces = context.getAfterSQL(v.location).match(/^\s+/)
        console.log('--- afterSql ---')
        console.log(context.getAfterSQL(v.location))
        const afterSpaceNumber = afterSpaces ? afterSpaces[0].length : 0
        console.log('--- afterSpaceNumber ---')
        console.log(afterSpaceNumber)
        const needSpaces = v.location.start.column - afterSpaceNumber
        return [
          fixer.replaceText(v.location.end.offset, v.location.end.offset + 1, '\n'),
          fixer.insertText(v.location.end.offset + 1, ''.padStart(needSpaces, ' '))
        ]
      }
    }))
  }
}
