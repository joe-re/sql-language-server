import { Parser, AstReader } from '@joe-re/node-sql-parser'
import * as log4js from 'log4js';
import { Schema, Table, Column } from './database_libs/MysqlClient'
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';

const logger = log4js.getLogger()

type Location = {
  start: { offset: number, line: number, column: number },
  end: { offset: number, line: number, column: number },
}
type ColumnRefNode = {
  type: 'column_ref',
  table: string,
  column: string,
  location: Location
}

type ColumnExpr = { expr: ColumnRefNode, as: string | null } | string
type SelectStatement = {
  type: 'select',
  distinct: null | boolean,
  columns: ColumnExpr[],
  from: FromNode[]
}

type Subquery = {
  type: 'subquery',
  as: 'string' | null,
  subquery: SelectStatement,
  location: Location
}
type IncompleteSubquery = {
  type: 'incomplete_subquery',
  as: 'string' | null,
  text: string,
  location: Location
}
type FromTableNode = {
  type: 'table',
  db: string,
  table: string,
  as: string | null,
  location: Location,
  join?: 'INNER JOIN' | 'LEFT JOIN',
  on?: any
}
type FromClauseParserResult = {
  before: string,
  from: FromNode[],
  after: string
}

type FromNode = FromTableNode | Subquery | IncompleteSubquery

type Pos = { line: number, column: number }

const CLAUSES: CompletionItem[] = [
  { label: 'WHERE', kind: CompletionItemKind.Text },
  { label: 'ORDER BY', kind: CompletionItemKind.Text },
  { label: 'GROUP BY', kind: CompletionItemKind.Text },
  { label: 'LIMIT', kind: CompletionItemKind.Text }
]

function extractExpectedLiterals(expected: { type: string, text: string }[]): CompletionItem[] {
  return expected.filter(v => v.type === 'literal')
    .map(v => v.text)
    .filter((v, i, self) => self.indexOf(v) === i)
    .map(v => ( { label: v }))
}

function getLastToken(sql: string) {
  const match = sql.match(/^(?:.|\s)*[^A-z0-9](.*?)$/)
  if (!match) { return sql }
  return match[1]
}

function getColumnRefByPos(columns: ColumnRefNode[], pos: { line: number, column: number }) {
  return columns.find(v =>
    (v.location.start.line === pos.line + 1 && v.location.start.column <= pos.column) &&
    (v.location.end.line === pos.line + 1 && v.location.end.column >= pos.column)
  )
}

function getFromNodeByPos(fromNodes: FromNode[], pos: { line: number, column: number }) {
  return fromNodes.find(v =>
    (v.location.start.line === pos.line + 1 && v.location.start.column <= pos.column) &&
    (v.location.end.line === pos.line + 1 && v.location.end.column >= pos.column)
  )
}

function toCompletionItemFromTable(table: Table): CompletionItem {
  return {
    label: table.tableName,
    detail: `table ${table.tableName}`,
    kind: CompletionItemKind.Text
  }
}

function toCompletionItemFromColumn(column: Column): CompletionItem {
  return {
    label: column.columnName,
    detail: `column ${column.description}`,
    kind: CompletionItemKind.Text
  }
}

function getCandidatesFromColumnRefNode(columnRefNode: ColumnRefNode, schema: Schema): CompletionItem[] {
  const tableCandidates = schema.filter(v => v.tableName.startsWith(columnRefNode.table)).map(v => toCompletionItemFromTable(v))
  const columnCandidates = Array.prototype.concat.apply([],
    schema.filter(v => tableCandidates.map(v => v.label).includes(v.tableName)).map(v => v.columns)
  ).map((v: Column) => toCompletionItemFromColumn(v))
  return tableCandidates.concat(columnCandidates)
}

function isCursorOnFromClause(sql: string, pos: Pos) {
  try {
    const ast = Parser.parse(sql)
    return !!getFromNodeByPos(ast.from || [], pos)
  } catch (_e) {
    return false
  }
}

function getCandidatedFromIncompleteSubquery(params: {
  sql: string,
  incompleteSubquery: IncompleteSubquery,
  pos: Pos,
  schema: Schema
}): CompletionItem[] {
  let candidates: CompletionItem[] = []
  const { schema, incompleteSubquery, pos } = params
  const parsedFromClause = getFromNodesFromClause(incompleteSubquery.text)
  try {
    Parser.parse(incompleteSubquery.text);
  } catch (e) {
    if (e.name !== 'SyntaxError') {
      throw e
    }
    const fromText = incompleteSubquery.text
    const newPos = parsedFromClause ? {
      line: pos.line - (incompleteSubquery.location.start.line - 1),
      column: pos.column - incompleteSubquery.location.start.column + 1
    } : { line: 0, column: 0 }
    candidates = complete(fromText, newPos, schema).candidates
  }
  return candidates
}

function createTablesFromFromNodes(fromNodes: FromNode[]): Schema {
  return fromNodes.reduce((p: any, c) => {
    if (c.type !== 'subquery') {
      return p
    }
    const columns = c.subquery.columns.map(v => {
      if (typeof v === 'string') { return null }
      return { columnName: v.as || v.expr.column || '', description: 'alias' }
    })
    return p.concat({ database: null, columns, tableName: c.as })
  }, [])
}

function getCandidatesFromError(target: string, schema: Schema, pos: Pos, e: any, fromNodes: FromNode[]): CompletionItem[] {
  let candidates = extractExpectedLiterals(e.expected)
  const candidatesLiterals = candidates.map(v => v.label)
  if (candidatesLiterals.includes("'") || candidatesLiterals.includes('"')) {
    return []
  }
  if (candidatesLiterals.includes('.')) {
    candidates = candidates.concat(schema.map(v => toCompletionItemFromTable(v)))
  }
  const lastChar = target[target.length - 1]
  logger.debug(`lastChar: ${lastChar}`)
  if (lastChar === '.') {
    const removedLastDotTarget = target.slice(0, target.length - 1)
    if (isCursorOnFromClause(removedLastDotTarget, { line: pos.line, column: pos.column - 1})) {
      return []
    }
    const tableName = getLastToken(removedLastDotTarget)
    const subqueryTables = createTablesFromFromNodes(fromNodes)
    const attachedAlias = schema.concat(subqueryTables).map(v => {
      const as = fromNodes.filter((v2: any) => v.tableName === v2.table).map(v => v.as)
      return Object.assign({}, v, { as: as ? as : [] })
    })
    let table = attachedAlias.find(v => v.tableName === tableName || v.as.includes(tableName))
    if (table) {
      candidates = table.columns.map(v => toCompletionItemFromColumn(v))
    }
  }
  return candidates
}

function getFromNodesFromClause(sql: string): FromClauseParserResult | null {
  try {
    return Parser.parseFromClause(sql)
  } catch (_e) {
    // no-op
    return null
  }
}

function getRidOfAfterCursorString(sql: string, pos: Pos) {
  return sql.split('\n').filter((_v, idx) => pos.line >= idx).map((v, idx) => idx === pos.line ? v.slice(0, pos.column) : v).join('\n')
}


export default function complete(sql: string, pos: Pos, schema: Schema = []) {
  logger.debug(`complete: ${sql}, ${JSON.stringify(pos)}`)
  let candidates: CompletionItem[] = []
  let error = null;

  const target = getRidOfAfterCursorString(sql, pos)
  logger.debug(`target: ${target}`)
  try {
    candidates = CLAUSES.concat([])
    const ast = Parser.parse(target);
    const ar = new AstReader(ast)
    logger.debug(`ast: ${JSON.stringify(ar.getAst())}`)
    if (!ar.getAst().distinct) {
      candidates.push({ label: 'DISTINCT', kind: CompletionItemKind.Text })
    }
    if (Array.isArray(ar.getAst().columns)) {
      const selectColumnRefs = ar.getAst().columns.map((v: any) => v.expr).filter((v: any) => !!v)
      const whereColumnRefs = ar.getAst().where || []
      const columnRef = getColumnRefByPos(selectColumnRefs.concat(whereColumnRefs), pos)
      logger.debug(JSON.stringify(columnRef))
      if (columnRef) {
        candidates = candidates.concat(getCandidatesFromColumnRefNode(columnRef, schema))
      }
    }
    if (Array.isArray(ar.getAst().from)) {
      const fromTable = getFromNodeByPos(ar.getAst().from || [], pos)
      if (fromTable && fromTable.type === 'table') {
        candidates = candidates.concat(schema.map(v => toCompletionItemFromTable(v)))
          .concat([{ label: 'INNER JOIN' }, { label: 'LEFT JOIN' }])
        if (fromTable.join && !fromTable.on) {
          candidates.push({ label: 'ON' })
        }
      }
    }
  } catch (e) {
    logger.debug('error')
    logger.debug(e)
    if (e.name !== 'SyntaxError') {
      throw e
    }
    const parsedFromClause = getFromNodesFromClause(sql)
    const fromNodes = parsedFromClause && parsedFromClause.from || []
    const fromNodeOnCursor = getFromNodeByPos(fromNodes || [], pos)
    if (fromNodeOnCursor && fromNodeOnCursor.type === 'incomplete_subquery') {
      candidates = getCandidatedFromIncompleteSubquery({
        sql,
        pos,
        incompleteSubquery: fromNodeOnCursor,
        schema
      })
    } else {
      candidates = getCandidatesFromError(target, schema, pos, e, fromNodes)
    }
    error = { label: e.name, detail: e.message, line: e.line, offset: e.offset }
  }
  const lastToken = getLastToken(target)
  logger.debug(`lastToken: ${lastToken}`)
  candidates = candidates.filter(v => v.label.startsWith(lastToken))
  return { candidates, error }
}
