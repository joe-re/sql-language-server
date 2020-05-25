import { KeywordNode } from '@joe-re/sql-parser'
import { Rule, RuleConfig, Context } from './index'

type Option = 'upper' | 'lower'
const DefaultOption = 'upper'
const META = {
  name: 'reserved-word-case',
  type: 'keyword',
  messages: {
    upper: 'reserved word must be uppercase',
    lower: 'reserved word must be lowercase'
  }
};

export const reservedWordCase: Rule<KeywordNode, RuleConfig<Option>> = {
  meta: META,
  create: (context) => {
    const option = context.config.option || DefaultOption
    if (option === 'upper' && /[a-z]/.test(context.node.value)) {
      return {
        message: META.messages.upper,
        location: context.node.location,
        rulename: META.name
      }
    }
    if (option === 'lower' && /[A-Z]/.test(context.node.value)) {
      return {
        message: META.messages.lower,
        location: context.node.location,
        rulename: META.name
      }
    }
  }
}