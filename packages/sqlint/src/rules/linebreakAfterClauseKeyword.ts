import { KeywordNode } from '@joe-re/sql-parser'
import { Rule, RuleConfig } from './index'

const META = {
  name: 'linebreak-after-clause-keyword',
  type: 'keyword'
};

export const linebreakAfterClauseKeyword: Rule<KeywordNode, RuleConfig<{}>> = {
  meta: META,
  create: (context) => {
    if (![
      'select', 'SELECT',
      'from', 'FROM',
      'where', 'WHERE',
      'update', 'UPDATE',
      'delete', 'DELETE',
    ].includes(context.node.value)) {
      return
    }
    const regexp = new RegExp(/\n|\r\n|\r$/)
    const part = context.getSQL(context.node.location, { after: 1 })
    const result = regexp.exec(part)
    if (!result) {
      return {
        message: `A linebreak is required after ${context.node.value} keyword`,
        location: context.node.location,
        rulename: META.name,
        errorLevel: context.config.level,
        fix: (fixer) => {
          const fixes = [fixer.insertText(context.node.location.end.offset, '\n')]
          const before = context.getBeforeSQL(context.node.location)
          if (!before.match(/\w+\s[\n|\r\n|\r]\s+$/)) {
            fixes.push(fixer.insertText(context.node.location.start.offset, '\n'))
          }
          return fixes
        }
      }
    }
  }
}