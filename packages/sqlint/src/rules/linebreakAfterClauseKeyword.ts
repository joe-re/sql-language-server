import { KeywordNode } from '@joe-re/sql-parser'
import { Rule, RuleConfig } from './index'

const META = {
  name: 'linebreak-after-clause-keyword',
  type: 'keyword'
};

export const linebreakAfterClauseKeyword: Rule<KeywordNode, RuleConfig<{}>> = {
  meta: META,
  create: (context) => {
    const regexp = new RegExp(/\n|\r\n|\r$/)
    const part = context.getSQL(context.node.location, { after: 1})
    const result = regexp.exec(part)
    if (!result) {
      return {
        message: `A linebreak is required after ${context.node.value} keyword`,
        location: context.node.location,
        rulename: META.name,
        errorLevel: context.config.level
      }
    }
  }
}