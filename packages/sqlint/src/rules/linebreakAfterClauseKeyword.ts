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
        fix: (fixer) => {
          const fixes = [fixer.replaceText(
            context.node.location.end.offset,
            context.node.location.end.offset + 1,
            '\n'
          )]
          const before = context.getBeforeSQL(context.node.location)
          let beforeSpaceDiff = 0
          if (before.match(/[^\n\r\n\r]\s+$/)) {
            fixes.push(fixer.replaceText(
              context.node.location.start.offset - 1,
              context.node.location.start.offset,
              '\n'
            ))
            beforeSpaceDiff = -1 // one space is replaced with \r
          }
          const beforeSpaces = before.match(/\s+$/)
          const afterSpaces = context.getAfterSQL(context.node.location).match(/^\s+/)
          const beforeSpaceNumber = beforeSpaces ? beforeSpaces[0].length + beforeSpaceDiff : 0
          const afterSpaceNumber = afterSpaces ? afterSpaces[0].length - 1 : 0
          const indentNumber = 2
          const needSpaces =  beforeSpaceNumber + indentNumber - afterSpaceNumber
          if (needSpaces > 0) {
            fixes.push(fixer.insertText(context.node.location.end.offset + 1, ''.padStart(needSpaces, ' ')))
          }
          return fixes
        }
      }
    }
  }
}