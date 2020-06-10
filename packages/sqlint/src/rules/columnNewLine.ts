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
      let previousLine = -1
      let previousOffset = -1
      let previousColumn = -1
      const invalidColumns = context.node.columns.map(v => {
        const result = { column: v, previousLine, previousOffset, previousColumn }
        previousLine = v.location.start.line
        previousOffset = v.location.end.offset
        previousColumn = v.location.start.column
        return result
      }).filter(v => v.column.location.start.line === v.previousLine)
      if (invalidColumns.length === 0) {
        return
      }
      return invalidColumns.map((v) => {
        return {
          message: 'Columns must go on a new line.',
          location: v.column.location,
          rulename: META.name,
          errorLevel: context.config.level,
          fix: (fixer) => {
            // ","" should be at after previousOffset so + 1 to include it
            const pos = v.previousOffset + 1
            return fixer.insertText(pos, '\n')
          }
        }
      })
    }
  }
}
