import { SelectStatement } from '@joe-re/sql-parser'
import { Rule, RuleConfig, Context } from './index'

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
      const invalidColumn = rest.find(v => {
        if (first.location.start.column === v.location.start.column) {
          return false
        }
        return first.location.start.column !== v.location.start.column
      })
      if (invalidColumn) {
        return {
          message: 'Columns must align to the first column.',
          location: invalidColumn.location,
          rulename: META.name
        }
      }
    }
  }
}
