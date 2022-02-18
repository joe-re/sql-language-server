import { SelectStatement } from '@joe-re/sql-parser'
import { Rule, RuleConfig } from './index'

const META = {
  name: 'require-as-to-rename-column',
  type: 'select',
}

export const requireAsToRenameColumn: Rule<SelectStatement, RuleConfig> = {
  meta: META,
  create: (context) => {
    if (!Array.isArray(context.node.columns)) {
      return
    }
    const invalidColumns = context.node.columns
      .filter((v) => v.as)
      .filter((v) => {
        return !context
          .getAfterSQL(v.expr.location)
          .trim()
          .match(/^(AS|as)\s/)
      })
    return invalidColumns.map((v) => {
      return {
        message: 'Require AS keyword to rename a column',
        location: v.location,
        fix: (fixer) => {
          return fixer.insertText(v.expr.location.end.offset, ' AS')
        },
      }
    })
  },
}
