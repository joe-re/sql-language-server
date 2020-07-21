import {
  parse,
  parseFromClause,
  SelectStatement,
  FromTableNode,
  ColumnRefNode,
  IncompleteSubqueryNode,
  FromClauseParserResult,
  DeleteStatement,
  NodeRange
} from '@joe-re/sql-parser'
import log4js from 'log4js'
import { Schema, Table, Column } from './database_libs/AbstractClient'
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-types';

type Pos = { line: number, column: number }

const logger = log4js.getLogger()

const FROM_KEYWORD = { label: 'FROM', kind: CompletionItemKind.Text }

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

function isPosInLocation(location: NodeRange, pos: Pos) {
  return (location.start.line === pos.line + 1 && location.start.column <= pos.column) &&
    (location.end.line === pos.line + 1 && location.end.column >= pos.column)
}

function getFromNodeByPos(fromNodes: FromTableNode[], pos: { line: number, column: number }) {
  return fromNodes.find(v => isPosInLocation(v.location, pos))
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

function getTableAndColumnCondidates(tablePrefix: string, schema: Schema, option?: { withoutTable?: boolean, withoutColumn?: boolean }): CompletionItem[] {
  const tableCandidates = schema.filter(v => v.tableName.startsWith(tablePrefix)).map(v => toCompletionItemFromTable(v))
  const columnCandidates = Array.prototype.concat.apply([],
    schema.filter(v => tableCandidates.map(v => v.label).includes(v.tableName)).map(v => v.columns)
  ).map((v: Column) => toCompletionItemFromColumn(v))
  const candidates: CompletionItem[] = []
  if (!option?.withoutTable) {
    candidates.push(...tableCandidates)
  }
  if (!option?.withoutColumn) {
    candidates.push(...columnCandidates)
  }
  return candidates
}

function isCursorOnFromClause(sql: string, pos: Pos) {
  try {
    const ast = parse(sql) as SelectStatement
    return !!getFromNodeByPos(ast.from?.tables || [], pos)
  } catch (_e) {
    return false
  }
}

function getCandidatedFromIncompleteSubquery(params: {
  sql: string,
  incompleteSubquery: IncompleteSubqueryNode,
  pos: Pos,
  schema: Schema
}): CompletionItem[] {
  let candidates: CompletionItem[] = []
  const { schema, incompleteSubquery, pos } = params
  const parsedFromClause = getFromNodesFromClause(incompleteSubquery.text)
  try {
    parse(incompleteSubquery.text);
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

function createTablesFromFromNodes(fromNodes: FromTableNode[]): Schema {
  return fromNodes.reduce((p: any, c) => {
    if (c.type !== 'subquery') {
      return p
    }
    if (!Array.isArray(c.subquery.columns)) {
      return p
    }
    const columns = c.subquery.columns.map(v => {
      if (typeof v === 'string') { return null }
      return { columnName: v.as || (v.expr.type === 'column_ref' && v.expr.column) || '', description: 'alias' }
    })
    return p.concat({ database: null, columns, tableName: c.as })
  }, [])
}

function getCandidatesFromError(target: string, schema: Schema, pos: Pos, e: any, fromNodes: FromTableNode[]): CompletionItem[] {
  switch(e.message) {
    case 'EXPECTED COLUMN NAME': {
      return getTableAndColumnCondidates('', schema, { withoutTable: true })
    }
  }
  let candidates = extractExpectedLiterals(e.expected || [])
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
    return parseFromClause(sql) as any
  } catch (_e) {
    // no-op
    return null
  }
}

function getRidOfAfterCursorString(sql: string, pos: Pos) {
  return sql.split('\n').filter((_v, idx) => pos.line >= idx).map((v, idx) => idx === pos.line ? v.slice(0, pos.column) : v).join('\n')
}

function completeDeleteStatement (ast: DeleteStatement, pos: Pos, schema: Schema): CompletionItem[] {
  if (isPosInLocation(ast.table.location, pos)) {
    return getTableAndColumnCondidates('', schema, { withoutColumn: true })
  } else if (ast.where && isPosInLocation(ast.where.expression.location, pos)) {
    return getTableAndColumnCondidates('', schema, { withoutTable: true })
  }
  return []
}

function completeSelectStatement(ast: SelectStatement, _pos: Pos, _schema: Schema): CompletionItem[] {
  let candidates: CompletionItem[] = []
  if (Array.isArray(ast.columns)) {
    const first = ast.columns[0]
    const rest = ast.columns.slice(1, ast.columns.length)
    const lastColumn = rest.reduce((p, c) => p.location.end.offset < c.location.end.offset ? c : p ,first)
    if (
      (lastColumn.expr.type === 'column_ref' && FROM_KEYWORD.label.startsWith(lastColumn.expr.column)) ||
      (lastColumn.as && FROM_KEYWORD.label.startsWith(lastColumn.as))
     ) {
      candidates.push(FROM_KEYWORD)
    }
  }
  return candidates
}

export default function complete(sql: string, pos: Pos, schema: Schema = []) {
  logger.debug(`complete: ${sql}, ${JSON.stringify(pos)}`)
  let candidates: CompletionItem[] = []
  let error = null;

  const target = getRidOfAfterCursorString(sql, pos)
  logger.debug(`target: ${target}`)
  try {
    candidates = CLAUSES.concat([])
    const ast = parse(target);
    logger.debug(`ast: ${JSON.stringify(ast)}`)
    if (ast.type === 'delete') {
      candidates = completeDeleteStatement(ast, pos, schema)
    } else {
      if (ast.type === 'select' && !ast.distinct) {
        candidates.push({ label: 'DISTINCT', kind: CompletionItemKind.Text })
      }
      if (ast.type === 'select') {
        candidates = candidates.concat(completeSelectStatement(ast, pos, schema))
      }
      const columns = ast.columns
      if (Array.isArray(columns)) {
        const selectColumnRefs = (columns as any).map((v: any) => v.expr).filter((v: any) => !!v)
        const whereColumnRefs = ast.type === 'select' &&  ast.where || []
        const columnRef = getColumnRefByPos(selectColumnRefs.concat(whereColumnRefs), pos)
        logger.debug(JSON.stringify(columnRef))
        if (columnRef) {
          candidates = candidates.concat(getTableAndColumnCondidates(columnRef.table, schema))
        }
      }

      if (ast.type === 'select' && Array.isArray(ast.from?.tables)) {
        const fromTable = getFromNodeByPos(ast.from?.tables || [], pos)
        if (fromTable && fromTable.type === 'table') {
          candidates = candidates.concat(schema.map(v => toCompletionItemFromTable(v)))
            .concat([{ label: 'INNER JOIN' }, { label: 'LEFT JOIN' }])
          if (fromTable.join && !fromTable.on) {
            candidates.push({ label: 'ON' })
          }
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
    const fromNodes = parsedFromClause?.from?.tables || []
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
  logger.debug(JSON.stringify(candidates))
  candidates = candidates.filter(v => v.label.startsWith(lastToken))
  return { candidates, error }
}
