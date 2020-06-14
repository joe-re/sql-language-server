import { SelectStatement } from '@joe-re/sql-parser'
import { Rule, RuleConfig } from './index'

const META = {
  name: 'align-column-to-the-first',
  type: 'select'
};

export const alignColumnToTheFirst: Rule<SelectStatement, RuleConfig> = {
  meta: META,
  create: (context) => {
    if (Array.isArray(context.node.columns) && context.node.columns.length > 1) {
      const first = context.node.columns[0]
      const rest = context.node.columns.slice(1, context.node.columns.length)
      const invalidColumns = rest.filter(v => {
        if (v.location.start.line === first.location.start.line) {
          return false
        }
        return first.location.start.column !== v.location.start.column
      })
      if (invalidColumns.length > 0) {
        return invalidColumns.map(v => {
          return {
            message: 'Columns must align to the first column.',
            location: v.location,
            fix: (fixer) => {
              const spaceNumber = first.location.start.column - v.location.start.column
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
  }
}
