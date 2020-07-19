import { SelectStatement } from '@joe-re/sql-parser'
import { Rule, RuleConfig } from './index'

const META = {
  name: 'require-as-to-rename-columns',
  type: 'select'
}

export const requireAsToRenameColumns: Rule<SelectStatement, RuleConfig> = {
  meta: META,
  create: (context) => {
    if (!Array.isArray(context.node.columns)) {
      return
    }
    const invalidColumns = context.node.columns.filter(v => v.as).filter(v => {
      console.log(v)
      console.log(context.getAfterSQL(v.expr.location))
      console.log(!context.getAfterSQL(v.expr.location).trim().match(/^(AS|as)\s/))
      return !context.getAfterSQL(v.expr.location).trim().match(/^(AS|as)\s/)
    })
    return invalidColumns.map(v => {
      return {
        message: 'Require AS keyword to rename a column',
        location: v.location
      }
    })
  }
}