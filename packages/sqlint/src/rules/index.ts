import { reservedWordCase } from './reservedWordCase'
import { spaceSurroundingOperators } from './spaceSurroundingOperators'
import { linebreakAfterClauseKeyword } from './linebreakAfterClauseKeyword'
import { columnNewLine } from './columnNewLine'
import { alignColumnToTheFirst } from './alignColumnToTheFirst'
import { whereClauseNewLine } from './whereClauseNewLine'
import { parse, NodeRange } from '@joe-re/sql-parser'

export type Diagnostic = {
  message: string,
  location: NodeRange,
  rulename: string
}

export type Rule<NodeType = any, RuleConfig = any> = {
  meta: {
    name: string,
    type: string
  },
  create: (c: Context<NodeType, RuleConfig>) => Diagnostic | undefined
}

export enum ErrorLevel {
  Off = 0,
  Warn = 1,
  Error = 2
}

export type Config = {
  rules: { [key: string]: RuleConfig<any> }
}

export type RuleConfig<T = void> = {
  level: ErrorLevel,
  option?: T
}

export type Context<NODE = any, CONFIG = any> = {
  getSQL(range?: NodeRange, option?: { before?: number, after?: number }): string
  node: NODE
  config: CONFIG
}

let rules:{ rule: Rule, config: any, sql: string }[] = []

export function execute(sql: string, config: Config): Diagnostic[] {
  rules = []
  registerRule(reservedWordCase, config, sql)
  registerRule(spaceSurroundingOperators, config, sql)
  registerRule(linebreakAfterClauseKeyword, config, sql)
  registerRule(columnNewLine, config, sql)
  registerRule(alignColumnToTheFirst, config, sql)
  registerRule(whereClauseNewLine, config, sql)
  const ast = parse(sql)
  return walk(ast)
}

function registerRule(rule: Rule, config: Config, sql: string) {
  if (config.rules[rule.meta.name] && config.rules[rule.meta.name].level >= ErrorLevel.Warn) {
    const _config = {
      level: config.rules[rule.meta.name].level,
      option: config.rules[rule.meta.name].option
    }
    rules.push({ rule, config: _config, sql })
  }
}

function apply(node: any) {
  let diagnostics: any[] = []
  rules.forEach(({ rule, config, sql }) => {
    if (node.type === rule.meta.type) {
      diagnostics = diagnostics.concat(rule.create(createContext(sql, node, config)))
    }
  })
  return diagnostics.filter(v => !!v)
}

function walk(node: any, diagnostics: any[] = []) {
  if (!node || typeof node !== 'object' || !node.type) {
    return diagnostics
  }
  diagnostics = diagnostics.concat(apply(node))
  Object.values(node).forEach((v) => {
    diagnostics = walk(v, diagnostics)
  })
  return diagnostics
}

function createContext(sql: string, node: any, config: any): Context {
  return {
    getSQL: function(range, options) {
      if (!range) {
        return sql
      }
      const start = options && options.before ? range.start.offset - options.before : range.start.offset
      const end = options && options.after ? range.end.offset + options.after : range.end.offset
      return sql.slice(start, end)
    },
    node: node,
    config: config
  }
}
