import { SelectStatement, BinaryExpressionNode } from '@joe-re/sql-parser'
import { Rule, RuleConfig } from './index'

const META = {
  name: 'align-where-clause-to-the-first',
  type: 'select'
};

export const alignWhereClauseToTheFirst: Rule<SelectStatement, RuleConfig> = {
  meta: META,
  create: (context) => {
    if (!context.node.where) {
      return
    }
    const where = context.node.where
    function findInvalidClauses(
      expr: BinaryExpressionNode,
      invalidClauses: BinaryExpressionNode[] = []
    ): BinaryExpressionNode[] {
      if (['AND', 'OR', 'and', 'or'].includes(expr.operator)) {
        if (
          expr.left.location.start.line !== expr.right.location.start.line &&
          where.expression.location.start.column !== expr.right.location.start.column &&
          expr.right.type === 'binary_expr'
        ) {
          invalidClauses.push(expr.right as BinaryExpressionNode)
        }
      }
      if (expr.left.type === 'binary_expr') {
        return findInvalidClauses(expr.left as BinaryExpressionNode, invalidClauses)
      }
      if (expr.right.type === 'binary_expr') {
        return findInvalidClauses(expr.right as BinaryExpressionNode, invalidClauses)
      }
      return invalidClauses
    }

    const invalidClauses = findInvalidClauses(where.expression)
    if (invalidClauses.length === 0) {
      return
    }
    return invalidClauses.map(v => {
      return {
        message: 'Where clauses must align to the first clause',
        location: v.location,
        rulename: META.name,
        errorLevel: context.config.level,
        fix: (fixer) => {
          const spaceNumber = where.expression.location.start.column - v.location.start.column
          if (spaceNumber > 0) {
            return fixer.insertText(v.location.start.offset, ''.padStart(spaceNumber, ' '))
          } else {
            return fixer.replaceText(v.location.start.offset + spaceNumber, v.location.start.offset, '')
          }
        }
      }
    })
  }
}
