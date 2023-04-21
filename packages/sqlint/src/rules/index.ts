import { parseAll, NodeRange, AST, Node, BaseNode } from '@joe-re/sql-parser'
import log4js from 'log4js'
import { Fixer, FixDescription, createFixer } from '../fixer'
import { reservedWordCase } from './reservedWordCase'
import { spaceSurroundingOperators } from './spaceSurroundingOperators'
import { linebreakAfterClauseKeyword } from './linebreakAfterClauseKeyword'
import { columnNewLine } from './columnNewLine'
import { alignColumnToTheFirst } from './alignColumnToTheFirst'
import { whereClauseNewLine } from './whereClauseNewLine'
import { alignWhereClauseToTheFirst } from './alignWhereClauseToTheFirst'
import { requireAsToRenameColumn } from './requireAsToRenameColumn'

const logger = log4js.getLogger()

export type Diagnostic = {
  message: string
  location: NodeRange
  rulename: string
  errorLevel: ErrorLevel
  fix: FixDescription | FixDescription[]
}

export type RuleResult = {
  message: string
  location: NodeRange
  fix?: (fixer: Fixer) => FixDescription | FixDescription[]
}

export type Rule<N extends BaseNode, RC = RuleConfig> = {
  meta: {
    name: string
    type: string
  }
  create: (c: Context<N, RC>) => RuleResult | RuleResult[] | undefined
}

export enum ErrorLevel {
  Off = 0,
  Warn = 1,
  Error = 2,
}

// TODO: Define each rules types
export type Config = {
  rules: { [key: string]: RuleConfig }
}

export type RuleConfig<T = unknown> = {
  level: ErrorLevel
  option?: T
}

type OffsetRange = {
  start: { offset: number }
  end: { offset: number }
}

export type Context<N = Node, C = RuleConfig> = {
  getSQL(
    range?: OffsetRange,
    option?: { before?: number; after?: number }
  ): string
  getAfterSQL(range: OffsetRange): string
  getBeforeSQL(range: OffsetRange): string
  node: N
  config: C
}

let rules: { rule: Rule<Node>; config: RuleConfig; sql: string }[] = []

export function execute(sql: string, config: Config): Diagnostic[] {
  rules = []
  registerRule(reservedWordCase, config, sql)
  registerRule(spaceSurroundingOperators, config, sql)
  registerRule(linebreakAfterClauseKeyword, config, sql)
  registerRule(columnNewLine, config, sql)
  registerRule(alignColumnToTheFirst, config, sql)
  registerRule(whereClauseNewLine, config, sql)
  registerRule(alignWhereClauseToTheFirst, config, sql)
  registerRule(requireAsToRenameColumn, config, sql)

  try {
    const ast = parseAll(sql)
    return ast
      .map((v) => {
        return walk(v)
      })
      .flat()
  } catch (e) {
    logger.debug(e)
    return []
  }
}

function registerRule<N extends Node, RC>(
  rule: Rule<N, RC>,
  config: Config,
  sql: string
) {
  if (
    config.rules[rule.meta.name] &&
    config.rules[rule.meta.name].level >= ErrorLevel.Warn
  ) {
    const _config = {
      level: config.rules[rule.meta.name].level,
      option: config.rules[rule.meta.name].option,
    }
    rules.push({ rule: rule as unknown as Rule<Node>, config: _config, sql })
  }
}

function apply(node: Node): Diagnostic[] {
  let diagnostics: Diagnostic[] = []
  rules.forEach(({ rule, config, sql }) => {
    if (config.level === ErrorLevel.Off) {
      return
    }
    if (node.type === rule.meta.type) {
      let ruleResult = rule.create(createContext(sql, node, config))
      if (!ruleResult) {
        return
      }
      if (!Array.isArray(ruleResult)) {
        ruleResult = [ruleResult]
      }
      const _diagnostics: Diagnostic[] = ruleResult.map((v) => {
        const fix = v.fix ? v.fix(createFixer()) : []
        return {
          location: v.location,
          message: v.message,
          errorLevel: config.level,
          fix: Array.isArray(fix) ? fix : [fix],
          rulename: rule.meta.name,
        }
      })
      diagnostics = diagnostics.concat(_diagnostics).flat()
    }
  })
  return diagnostics.filter((v) => !!v)
}

function walk(node: AST, diagnostics: Diagnostic[] = []) {
  if (!node || typeof node !== 'object' || !node.type) {
    return diagnostics
  }
  diagnostics = diagnostics.concat(apply(node))
  Object.values(node).forEach((v) => {
    diagnostics = walk(v, diagnostics)
  })
  return diagnostics
}

export function createContext(
  sql: string,
  node: Node,
  ruleConfig: RuleConfig
): Context {
  return {
    getSQL: function (range, options) {
      if (!range) {
        return sql
      }
      const start =
        options && options.before
          ? range.start.offset - options.before
          : range.start.offset
      const end =
        options && options.after
          ? range.end.offset + options.after
          : range.end.offset
      return sql.slice(start, end)
    },
    getAfterSQL: function (range) {
      return sql.slice(range.end.offset)
    },
    getBeforeSQL: function (range) {
      return sql.slice(0, range.start.offset)
    },
    node: node,
    config: ruleConfig,
  }
}
