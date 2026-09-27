import {
  getCompletionContext,
  CompletionContext,
  ExpectedLiteralNode,
  FromTableNode,
} from '@joe-re/sql-parser'
import log4js from 'log4js'
import { CompletionItem } from 'vscode-languageserver-types'
import { Schema, Table } from '../database_libs/AbstractClient'
import { getRidOfAfterPosString } from './StringUtils'
import { getLastToken } from './utils/getLastToken'
import {
  createTablesFromFromNodes,
  getAllNestedFromNodes,
  isTableMatch,
} from './AstUtils'
import { createBasicKeywordCandidates } from './candidates/createBasicKeywordCandidates'
import { createTableCandidates } from './candidates/createTableCandidates'
import {
  createCandidatesForColumnsOfAnyTable,
  createCandidatesForScopedColumns,
} from './candidates/createColumnCandidates'
import { createAliasCandidates } from './candidates/createAliasCandidates'
import { createSelectAllColumnsCandidates } from './candidates/createSelectAllColumnsCandidates'
import { createFunctionCandidates } from './candidates/createFunctionCandidates'
import { createKeywordCandidatesFromExpectedLiterals } from './candidates/createKeywordCandidatesFromExpectedLiterals'
import { createJoinTablesCandidates } from './candidates/createJoinTableCndidates'
import { ICONS } from './CompletionItemUtils'

export type Pos = { line: number; column: number }

const logger = log4js.getLogger()

/** Keywords that start an expression; not offered while a name is typed */
const EXPRESSION_KEYWORDS = new Set([
  'TRUE',
  'FALSE',
  'NULL',
  'CAST',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'SELECT',
  'WITH',
  'NOT',
])

type CompletionError = {
  label: string
  detail: string
  line: number
  offset: number
}

class Completer {
  lastToken = ''
  candidates: CompletionItem[] = []
  schema: Schema
  error: CompletionError | null = null
  sql: string
  pos: Pos
  isSpaceTriggerCharacter = false
  isDotTriggerCharacter = false
  jupyterLabMode: boolean

  constructor(schema: Schema, sql: string, pos: Pos, jupyterLabMode: boolean) {
    this.schema = schema
    this.sql = sql
    this.pos = pos
    this.jupyterLabMode = jupyterLabMode
  }

  complete() {
    const target = getRidOfAfterPosString(this.sql, this.pos)
    logger.debug(`target: ${target}`)
    this.lastToken = getLastToken(target)
    const idx = this.lastToken.lastIndexOf('.')
    this.isSpaceTriggerCharacter = this.lastToken === ''
    this.isDotTriggerCharacter =
      !this.isSpaceTriggerCharacter && idx == this.lastToken.length - 1

    const context = getCompletionContext(this.sql, target.length)
    if (logger.isDebugEnabled()) {
      logger.debug(`completion context: ${JSON.stringify(context)}`)
    }
    if (context.inCommentOrString) return this.candidates
    if (target === '') {
      // An empty document
      this.addCandidatesForBasicKeyword()
      return this.candidates
    }
    this.addCandidatesForContext(context)
    return this.candidates
  }

  addCandidatesForContext(context: CompletionContext) {
    const fromNodes = getAllNestedFromNodes(context.tables)
    const tables = this.schema.tables.concat(
      createTablesFromCtes(context.ctes),
      createTablesFromFromNodes(fromNodes)
    )
    const isSelect = context.statementType === 'select'
    const keywords = ['--', '/*', ...context.keywords]
      .filter(
        // A statement separator is never worth completing
        (v) => v !== ';'
      )
      .filter(
        // While a name is typed, literals such as TRUE or CAST are noise
        (v) =>
          !(
            context.word &&
            context.expects.column &&
            !['IS', 'NOT'].includes(context.previousToken) &&
            EXPRESSION_KEYWORDS.has(v)
          )
      )
    const expected: ExpectedLiteralNode[] = keywords.map((text) => ({
      type: 'literal',
      text,
      ignoreCase: true,
    }))

    if (context.expects.column || this.lastToken.toUpperCase() === 'SELECT') {
      this.addCandidatesForSelectStar(fromNodes, tables)
    }
    this.addCandidatesForExpectedLiterals(expected)
    if (context.expects.column) {
      this.addCandidatesForFunctions()
      if (context.qualifier.length > 0) {
        this.addCandidatesForScopedColumns(fromNodes, tables)
      } else if (!isSelect && fromNodes.length > 0) {
        // UPDATE / DELETE / INSERT: columns of the target table
        this.addCandidatesForColumnsOfAnyTable(scopeTables(fromNodes, tables))
      }
      if (context.qualifier.length === 0) {
        this.addCandidatesForAliases(fromNodes)
      }
    }
    if (context.expects.columnName) {
      const scoped = scopeTables(fromNodes, tables)
      this.addCandidatesForColumnsOfAnyTable(
        scoped.length > 0 ? scoped : this.schema.tables
      )
    }
    if (context.expects.table || context.expects.column) {
      this.addCandidatesForTables(tables, isSelect)
    }
    if (isSelect) {
      this.addCandidatesForJoins(expected, fromNodes)
    }
    if (logger.isDebugEnabled()) {
      logger.debug(`candidates: ${JSON.stringify(this.candidates)}`)
    }
  }

  addCandidatesForBasicKeyword() {
    createBasicKeywordCandidates().forEach((v) => {
      this.addCandidate(v)
    })
  }

  addCandidatesForExpectedLiterals(expected: ExpectedLiteralNode[]) {
    createKeywordCandidatesFromExpectedLiterals(expected).forEach((v) => {
      this.addCandidate(v)
    })
  }

  addCandidate(item: CompletionItem) {
    // A keyword completion can be occured anyplace and need to suppress them.
    if (
      item.kind &&
      item.kind === ICONS.KEYWORD &&
      !item.label.startsWith(this.lastToken)
    ) {
      return
    }
    // JupyterLab requires the dot or space character preceeding the <tab> key pressed
    // If the dot or space character are not added to the label then searching
    // in the list of suggestion does not work.
    // Here we fix this issue by adding the dot or space character
    // to the filterText and insertText.
    // TODO: report this issue to JupyterLab-LSP project.
    if (this.jupyterLabMode) {
      const text = item.insertText || item.label
      if (this.isSpaceTriggerCharacter) {
        item.insertText = ' ' + text
        item.filterText = ' ' + text
      } else if (this.isDotTriggerCharacter) {
        item.insertText = '.' + text
        item.filterText = '.' + text
      }
    }
    this.candidates.push(item)
  }

  addCandidatesForTables(tables: Table[], onFromClause: boolean) {
    createTableCandidates(tables, this.lastToken, onFromClause).forEach(
      (item) => {
        this.addCandidate(item)
      }
    )
  }

  addCandidatesForColumnsOfAnyTable(tables: Table[]) {
    createCandidatesForColumnsOfAnyTable(tables, this.lastToken).forEach(
      (item) => {
        this.addCandidate(item)
      }
    )
  }

  addCandidatesForJoins(
    expected: ExpectedLiteralNode[],
    fromNodes: FromTableNode[]
  ) {
    createJoinTablesCandidates(
      this.schema.tables,
      expected,
      fromNodes,
      this.lastToken
    ).forEach((v) => {
      this.addCandidate(v)
    })
  }

  addCandidatesForFunctions() {
    createFunctionCandidates(this.schema.functions, this.lastToken).forEach(
      (v) => {
        this.addCandidate(v)
      }
    )
  }

  addCandidatesForSelectStar(fromNodes: FromTableNode[], tables: Table[]) {
    createSelectAllColumnsCandidates(fromNodes, tables, this.lastToken).forEach(
      (v) => {
        this.addCandidate(v)
      }
    )
  }

  addCandidatesForScopedColumns(fromNodes: FromTableNode[], tables: Table[]) {
    createCandidatesForScopedColumns(fromNodes, tables, this.lastToken).forEach(
      (v) => {
        this.addCandidate(v)
      }
    )
  }

  addCandidatesForAliases(fromNodes: FromTableNode[]) {
    createAliasCandidates(fromNodes, this.lastToken).forEach((v) => {
      this.addCandidate(v)
    })
  }
}

/** Tables of the schema that the given FROM / target nodes refer to */
function scopeTables(fromNodes: FromTableNode[], tables: Table[]): Table[] {
  return tables.filter((table) =>
    fromNodes.some((node) => isTableMatch(node, table))
  )
}

function createTablesFromCtes(ctes: CompletionContext['ctes']): Table[] {
  return ctes.map((cte) => ({
    catalog: null,
    database: null,
    tableName: cte.name,
    columns: cte.columns.map((columnName) => ({
      columnName,
      description: `${cte.name}.${columnName}`,
    })),
  }))
}

export function complete(
  sql: string,
  pos: Pos,
  schema: Schema = { tables: [], functions: [] },
  jupyterLabMode = false
) {
  if (logger.isDebugEnabled())
    logger.debug(`complete: ${sql}, ${JSON.stringify(pos)}`)
  const completer = new Completer(schema, sql, pos, jupyterLabMode)
  const candidates = completer.complete()
  return { candidates: candidates, error: completer.error }
}
