import { SelectStatement } from '@joe-re/sql-parser'
import { Rule, RuleConfig } from './index'

type Options = { allowMultipleColumnsPerLine: boolean }
const META = {
  name: 'column-new-line',
  type: 'select',
  options: { allowMultipleColumnsPerLine: Boolean },
};

export const columnNewLine: Rule<SelectStatement, RuleConfig<Options>> = {
  meta: META,
  create: (context) => {
    if (Array.isArray(context.node.columns)) {
      let previousLine = 0
      const invalidColumn = context.node.columns.find(v => {
        if (v.location.start.line === previousLine) {
          return true
        }
        previousLine = v.location.start.line
        return false
      })
      if (invalidColumn) {
        return {
          message: 'Columns must go on a new line.',
          location: invalidColumn.location,
          rulename: META.name
        }
      }
    }
  }
}
