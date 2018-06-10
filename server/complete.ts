import { Parser, AstReader } from '@joe-re/node-sql-parser'
import * as log4js from 'log4js';

const logger = log4js.getLogger()

type Location = {
  start: { offset: number, line: number, column: number },
  end: { offset: number, line: number, column: number },
}
type Table = { table: string, columns: string[] }
type ColumnRefNode = {
  type: 'column_ref',
  table: string,
  column: string,
  location: Location
}
type Subquery = {
  type: 'subquery',
  as: 'string' | null,
  subquery: any,
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

const CLAUSES = ['WHERE', 'ORDER BY', 'GROUP BY', 'LIMIT']

function extractExpectedLiterals(expected: { type: string, text: string }[]): string[] {
  return expected.filter(v => v.type === 'literal')
    .map(v => v.text)
    .filter((v, i, self) => self.indexOf(v) === i)
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

function getCandidatesFromColumnRefNode(columnRefNode: ColumnRefNode, tables: Table[]) {
  const tableCandidates = tables.map(v => v.table).filter(v => v.startsWith(columnRefNode.table))
  const columnCandidates = Array.prototype.concat.apply([], tables.filter(v => tableCandidates.includes(v.table)).map(v => v.columns))
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
  tables: Table[]
}): string[] {
  let candidates: string[] = []
  const { tables, incompleteSubquery, pos } = params
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
    candidates = complete(fromText, newPos, tables).candidates
  }
  return candidates
}

function getCandidatesFromError(target: string, tables: Table[], pos: Pos, e: any, fromNodes: FromNode[]) {
  let candidates = extractExpectedLiterals(e.expected)
  if (candidates.includes("'") || candidates.includes('"')) {
    return []
  }
  if (candidates.includes('.')) {
    candidates = candidates.concat(tables.map(v => v.table))
  }
  const lastChar = target[target.length - 1]
  logger.debug(`lastChar: ${lastChar}`)
  if (lastChar === '.') {
    const removedLastDotTarget = target.slice(0, target.length - 1)
    if (isCursorOnFromClause(removedLastDotTarget, { line: pos.line, column: pos.column - 1})) {
      return []
    }
    const tableName = getLastToken(removedLastDotTarget)
    const attachedAlias = tables.map(v => {
      const as = fromNodes.filter((v2: any) => v.table === v2.table).map(v => v.as)
      return Object.assign({}, v, { as: as ? as : [] })
    })
    let table = attachedAlias.find(v => v.table === tableName || v.as.includes(tableName))
    if (table) {
      candidates = table.columns
    }
  }
  return candidates
}

function getFromNodesFromClause(sql: string):FromClauseParserResult {
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


export default function complete(sql: string, pos: Pos, tables: Table[] = []) {
  logger.debug(`complete: ${sql}, ${JSON.stringify(pos)}`)
  let candidates: string[] = []
  let error = null;

  const target = getRidOfAfterCursorString(sql, pos)
  logger.debug(`target: ${target}`)
  try {
    candidates = [].concat(CLAUSES)
    const ast = Parser.parse(target);
    const ar = new AstReader(ast)
    logger.debug(`ast: ${JSON.stringify(ar.getAst())}`)
    if (!ar.getAst().distinct) {
      candidates.push('DISTINCT')
    }
    if (Array.isArray(ar.getAst().columns)) {
      const selectColumnRefs = ar.getAst().columns.map((v: any) => v.expr).filter((v: any) => !!v)
      const whereColumnRefs = ar.getAst().where || []
      const columnRef = getColumnRefByPos(selectColumnRefs.concat(whereColumnRefs), pos)
      logger.debug(JSON.stringify(columnRef))
      if (columnRef) {
        candidates = candidates.concat(getCandidatesFromColumnRefNode(columnRef, tables))
      }
    }
    if (Array.isArray(ar.getAst().from)) {
      const fromTable = getFromNodeByPos(ar.getAst().from || [], pos)
      if (fromTable && fromTable.type === 'table') {
        candidates = candidates.concat(tables.map(v => v.table))
          .concat(['INNER JOIN', 'LEFT JOIN'])
        if (fromTable.join && !fromTable.on) {
          candidates.push('ON')
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
        tables
      })
    } else {
      candidates = getCandidatesFromError(target, tables, pos, e, fromNodes)
    }
    error = { label: e.name, detail: e.message, line: e.line, offset: e.offset }
  }
  const lastToken = getLastToken(target)
  logger.debug(`lastToken: ${lastToken}`)
  candidates = candidates.filter(v => v.startsWith(lastToken))
  return { candidates, error }
}
