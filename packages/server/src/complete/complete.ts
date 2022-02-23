import {
  parse,
  parseFromClause,
  SelectStatement,
  FromTableNode,
  IncompleteSubqueryNode,
  FromClauseParserResult,
  DeleteStatement,
  ParseError,
  ExpectedLiteralNode,
  AST,
} from '@joe-re/sql-parser'
import log4js from 'log4js'
import { CompletionItem } from 'vscode-languageserver-types'
import { Schema, Table } from '../database_libs/AbstractClient'
import { getRidOfAfterPosString } from './StringUtils'
import { getLastToken } from './utils/getLastToken'
import {
  isPosInLocation,
  createTablesFromFromNodes,
  findColumnAtPosition,
  getAllNestedFromNodes,
  getNearestFromTableFromPos,
} from './AstUtils'
import { createBasicKeywordCandidates } from './candidates/createBasicKeywordCandidates'
import { createTableCandidates } from './candidates/createTableCandidates'
import { createJoinCondidates } from './candidates/createJoinCandidates'
import {
  createCandidatesForColumnsOfAnyTable,
  createCandidatesForScopedColumns,
} from './candidates/createColumnCandidates'
import { createAliasCandidates } from './candidates/createAliasCandidates'
import { createSelectAllColumnsCandidates } from './candidates/createSelectAllColumnsCandidates'
import { createFunctionCandidates } from './candidates/createFunctionCandidates'
import { createKeywordCandidatesFromExpectedLiterals } from './candidates/createKeywordCandidatesFromExpectedLiterals'
import { createJoinTablesCandidates } from './candidates/createJoinTableCndidates'
import { ICONS, toCompletionItemForKeyword } from './CompletionItemUtils'

export type Pos = { line: number; column: number }

const logger = log4js.getLogger()

function getFromNodesFromClause(sql: string): FromClauseParserResult | null {
  try {
    return parseFromClause(sql)
  } catch (_e) {
    // no-op
    return null
  }
}

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

    try {
      const ast = parse(target)
      this.addCandidatesForParsedStatement(ast)
    } catch (_e: unknown) {
      logger.debug('error')
      logger.debug(_e)
      if (!(_e instanceof Error)) {
        throw _e
      }
      if (_e.name !== 'SyntaxError') {
        throw _e
      }
      const e = _e as ParseError
      const parsedFromClause = getFromNodesFromClause(this.sql)
      if (parsedFromClause) {
        const fromNodes = getAllNestedFromNodes(
          parsedFromClause?.from?.tables || []
        )
        const fromNodeOnCursor = getNearestFromTableFromPos(fromNodes, this.pos)
        if (
          fromNodeOnCursor &&
          fromNodeOnCursor.type === 'incomplete_subquery'
        ) {
          // Incomplete sub query 'SELECT sub FROM (SELECT e. FROM employees e) sub'
          this.addCandidatesForIncompleteSubquery(fromNodeOnCursor)
        } else {
          this.addCandidatesForSelectQuery(e, fromNodes)
          const expectedLiteralNodes =
            e.expected?.filter(
              (v): v is ExpectedLiteralNode => v.type === 'literal'
            ) || []
          this.addCandidatesForJoins(expectedLiteralNodes, fromNodes)
        }
      } else if (e.message === 'EXPECTED COLUMN NAME') {
        this.addCandidatesForInsert()
      } else {
        this.addCandidatesForError(e)
      }
      this.error = {
        label: e.name,
        detail: e.message,
        line: e.location.start.line,
        offset: e.location.start.offset,
      }
    }
    return this.candidates
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

  addCandidatesForIncompleteSubquery(
    incompleteSubquery: IncompleteSubqueryNode
  ) {
    const parsedFromClause = getFromNodesFromClause(incompleteSubquery.text)
    try {
      parse(incompleteSubquery.text)
    } catch (e: unknown) {
      if (!(e instanceof Error)) {
        throw e
      }
      if (e.name !== 'SyntaxError') {
        throw e
      }
      const fromText = incompleteSubquery.text
      const newPos = parsedFromClause
        ? {
            line: this.pos.line - (incompleteSubquery.location.start.line - 1),
            column:
              this.pos.column - incompleteSubquery.location.start.column + 1,
          }
        : { line: 0, column: 0 }
      const completer = new Completer(
        this.schema,
        fromText,
        newPos,
        this.jupyterLabMode
      )
      completer.complete().forEach((item) => this.addCandidate(item))
    }
  }

  /**
   * INSERT INTO TABLE1 (C
   */
  addCandidatesForInsert() {
    this.addCandidatesForColumnsOfAnyTable(this.schema.tables)
  }

  addCandidatesForError(e: ParseError) {
    const expectedLiteralNodes =
      e.expected?.filter(
        (v): v is ExpectedLiteralNode => v.type === 'literal'
      ) || []
    this.addCandidatesForExpectedLiterals(expectedLiteralNodes)
    this.addCandidatesForFunctions()
    this.addCandidatesForTables(this.schema.tables, false)
  }

  addCandidatesForSelectQuery(e: ParseError, fromNodes: FromTableNode[]) {
    const subqueryTables = createTablesFromFromNodes(fromNodes)
    const schemaAndSubqueries = this.schema.tables.concat(subqueryTables)
    this.addCandidatesForSelectStar(fromNodes, schemaAndSubqueries)
    const expectedLiteralNodes =
      e.expected?.filter(
        (v): v is ExpectedLiteralNode => v.type === 'literal'
      ) || []
    this.addCandidatesForExpectedLiterals(expectedLiteralNodes)
    this.addCandidatesForFunctions()
    this.addCandidatesForScopedColumns(fromNodes, schemaAndSubqueries)
    this.addCandidatesForAliases(fromNodes)
    this.addCandidatesForTables(schemaAndSubqueries, true)
    if (logger.isDebugEnabled())
      logger.debug(
        `candidates for error returns: ${JSON.stringify(this.candidates)}`
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

  addCandidatesForParsedDeleteStatement(ast: DeleteStatement) {
    if (isPosInLocation(ast.table.location, this.pos)) {
      this.addCandidatesForTables(this.schema.tables, false)
    } else if (
      ast.where &&
      isPosInLocation(ast.where.expression.location, this.pos)
    ) {
      const expr = ast.where.expression
      if (expr.type === 'column_ref') {
        this.addCandidatesForColumnsOfAnyTable(this.schema.tables)
      }
    }
  }

  addCandidatesForParsedSelectQuery(ast: SelectStatement) {
    this.addCandidatesForBasicKeyword()
    if (Array.isArray(ast.columns)) {
      this.addCandidate(toCompletionItemForKeyword('FROM'))
      this.addCandidate(toCompletionItemForKeyword('AS'))
    }
    if (!ast.distinct) {
      this.addCandidate(toCompletionItemForKeyword('DISTINCT'))
    }
    const columnRef = findColumnAtPosition(ast, this.pos)
    if (!columnRef) {
      this.addJoinCondidates(ast)
    } else {
      const parsedFromClause = getFromNodesFromClause(this.sql)
      const fromNodes = parsedFromClause?.from?.tables || []
      const subqueryTables = createTablesFromFromNodes(fromNodes)
      const schemaAndSubqueries = this.schema.tables.concat(subqueryTables)
      if (columnRef.table) {
        // We know what table/alias this column belongs to
        // Find the corresponding table and suggest it's columns
        this.addCandidatesForScopedColumns(fromNodes, schemaAndSubqueries)
      } else {
        // Column is not scoped to a table/alias yet
        // Could be an alias, a talbe or a function
        this.addCandidatesForAliases(fromNodes)
        this.addCandidatesForTables(schemaAndSubqueries, true)
        this.addCandidatesForFunctions()
      }
    }
    if (logger.isDebugEnabled())
      logger.debug(`parse query returns: ${JSON.stringify(this.candidates)}`)
  }

  addCandidatesForParsedStatement(ast: AST) {
    if (logger.isDebugEnabled())
      logger.debug(
        `getting candidates for parse query ast: ${JSON.stringify(ast)}`
      )
    if (!ast.type) {
      this.addCandidatesForBasicKeyword()
    } else if (ast.type === 'delete') {
      this.addCandidatesForParsedDeleteStatement(ast)
    } else if (ast.type === 'select') {
      this.addCandidatesForParsedSelectQuery(ast)
    } else {
      console.log(`AST type not supported yet: ${ast.type}`)
    }
  }

  addJoinCondidates(ast: SelectStatement) {
    createJoinCondidates(
      ast,
      this.schema.tables,
      this.pos,
      this.lastToken
    ).forEach((v) => {
      this.addCandidate(v)
    })
  }

  addCandidatesForFunctions() {
    console.time('addCandidatesForFunctions')
    createFunctionCandidates(this.schema.functions, this.lastToken).forEach(
      (v) => {
        this.addCandidate(v)
      }
    )
    console.timeEnd('addCandidatesForFunctions')
  }

  addCandidatesForSelectStar(fromNodes: FromTableNode[], tables: Table[]) {
    console.time('addCandidatesForSelectStar')
    createSelectAllColumnsCandidates(fromNodes, tables, this.lastToken).forEach(
      (v) => {
        this.addCandidate(v)
      }
    )
    console.timeEnd('addCandidatesForSelectStar')
  }

  addCandidatesForScopedColumns(fromNodes: FromTableNode[], tables: Table[]) {
    console.time('addCandidatesForScopedColumns')
    createCandidatesForScopedColumns(fromNodes, tables, this.lastToken).forEach(
      (v) => {
        this.addCandidate(v)
      }
    )
    console.timeEnd('addCandidatesForScopedColumns')
  }

  addCandidatesForAliases(fromNodes: FromTableNode[]) {
    createAliasCandidates(fromNodes, this.lastToken).forEach((v) => {
      this.addCandidate(v)
    })
  }
}

export function complete(
  sql: string,
  pos: Pos,
  schema: Schema = { tables: [], functions: [] },
  jupyterLabMode = false
) {
  console.time('complete')
  if (logger.isDebugEnabled())
    logger.debug(`complete: ${sql}, ${JSON.stringify(pos)}`)
  const completer = new Completer(schema, sql, pos, jupyterLabMode)
  const candidates = completer.complete()
  console.timeEnd('complete')
  return { candidates: candidates, error: completer.error }
}
