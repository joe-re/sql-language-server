import { BinaryExpressionNode } from '@joe-re/sql-parser'
import { Rule, RuleConfig } from './index'

type Option = 'always' | 'never'
const DefaultOption = 'always'
const META = {
  name: 'space-surrounding-operators',
  type: 'binary_expr',
  options: [ ['always', 'never'] ],
  messages: {
    always: 'space surrounding always',
    never: 'space surrounding never'
  }
}

export const spaceSurroundingOperators: Rule<BinaryExpressionNode, RuleConfig<Option>> = {
  meta: META,
  create: (context) => {
    if (!['+', '-', '*', '/', '>', '>=', '<', '<=', '!=', '<>', '='].includes(context.node.operator)) {
      return
    }
    const option = context.config.option || DefaultOption
    if (option === 'always') {
      const regexp = new RegExp(` ${context.node.operator} $`)
      const part = context.getSQL(context.node.left.location, { after: context.node.operator.length + 2})
      const result = regexp.exec(part)
      if (!result) {
        const start = {
          line: context.node.left.location.end.line,
          offset: context.node.left.location.end.offset,
          column: context.node.left.location.end.column
        }
        const end = {
          line: context.node.left.location.end.line,
          offset: context.node.left.location.end.offset + 2 + context.node.operator.length,
          column: context.node.left.location.end.column + 2 + context.node.operator.length
        }
        return {
          message: META.messages.always,
          location: { start, end },
          rulename: META.name,
          errorLevel: context.config.level
        }
      }
    } else if (option === 'never') {
      const regexp = new RegExp(`[^\s]${context.node.operator}[^\s]$`)
      const part = context.getSQL(context.node.left.location, { after: context.node.operator.length + 1})
      const result = regexp.exec(part)
      if (!result) {
        const start = {
          line: context.node.left.location.end.line,
          offset: context.node.left.location.end.offset,
          column: context.node.left.location.end.column
        }
        const end = {
          line: context.node.left.location.end.line,
          offset: context.node.left.location.end.offset + 1 + context.node.operator.length,
          column: context.node.left.location.end.column + 1 + context.node.operator.length
        }
        return {
          message: META.messages.never,
          location: { start, end },
          rulename: META.name,
          errorLevel: context.config.level
        }
      }
    }
  }
}
