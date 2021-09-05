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
import { Schema, Table, Column, DbFunction } from './database_libs/AbstractClient'
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-types';

type Pos = { line: number, column: number }

const logger = log4js.getLogger()

const KEYWORD_ICON = CompletionItemKind.Event
const COLUMN_ICON = CompletionItemKind.Interface
const TABLE_ICON = CompletionItemKind.Field
const FUNCTION_ICON = CompletionItemKind.Property
const ALIAS_ICON = CompletionItemKind.Variable

function keyword(name: string): CompletionItem {
  return { label: name, kind: KEYWORD_ICON, detail: 'keyword' }
}

const FROM_KEYWORD = keyword('FROM')
const AS_KEYWORD = keyword('AS')
const DISTINCT_KEYWORD = keyword('DISTINCT')
const INNERJOIN_KEYWORD = keyword('INNER JOIN')
const LEFTJOIN_KEYWORD = keyword('LEFT JOIN')
const ON_KEYWORD = keyword('ON')

const CLAUSES: CompletionItem[] = [
  keyword('SELECT'),
  keyword('WHERE'),
  keyword('ORDER BY'),
  keyword('GROUP BY'),
  keyword('LIMIT'),
  keyword('--'),
  keyword('/*'),
  keyword('(')
]

const UNDESIRED_LITERAL = [
  '+',
  '-',
  '*',
  '$',
  ':',
  'COUNT',
  'AVG',
  'SUM',
  '`',
  '"',
  "'",
]

// Check if parser expects us to terminate a single quote value or double quoted column name
// SELECT TABLE1.COLUMN1 FROM TABLE1 WHERE TABLE1.COLUMN1 = "hoge.
// We don't offer the ', the ", the ` as suggestions
function extractExpectedLiterals(expected: { type: string, text: string }[]): CompletionItem[] {
  const literals = expected.filter(v => v.type === 'literal').map(v => v.text)
  const uniqueLiterals = [...new Set(literals)];
  return uniqueLiterals
    .filter(v => !UNDESIRED_LITERAL.includes(v))
    .map(v => v == 'ORDER' ? 'ORDER BY' : v)
    .map(v => v == 'GROUP' ? 'GROUP BY' : v)
    .flatMap(v => [keyword(v.toLocaleLowerCase()), keyword(v),])
}

// Gets the last token from the given string considering that tokens can contain dots.
export function getLastToken(sql: string) {
  const match = sql.match(/^(?:.|\s)*[^A-z0-9\.:'](.*?)$/)
  if (match) {
    let prevToken = '';
    let currentToken = match[1];
    while (currentToken != prevToken) {
      prevToken = currentToken;
      currentToken = prevToken.replace(/\[.*?\]/, '');
    }
    return currentToken;
  }
  return sql;
}

function getColumnRefByPos(columns: ColumnRefNode[], pos: Pos) {
  return columns.find(v =>
    (v.location.start.line === pos.line + 1 && v.location.start.column <= pos.column) &&
    (v.location.end.line === pos.line + 1 && v.location.end.column >= pos.column)
  )
}

function isPosInLocation(location: NodeRange, pos: Pos) {
  return (location.start.line === pos.line + 1 && location.start.column <= pos.column) &&
    (location.end.line === pos.line + 1 && location.end.column >= pos.column)
}

function getFromNodeByPos(fromNodes: FromTableNode[], pos: Pos) {
  return fromNodes.find(v => isPosInLocation(v.location, pos))
}

function toCompletionItemFromTableName(tableName: string): CompletionItem {
  return {
    label: tableName,
    detail: `table ${tableName}`,
    kind: TABLE_ICON,
  };
}

function getSelectTableCondidates(tablePrefix: string, tables: Table[]): CompletionItem[] {
  return tables
    .filter(table => table.tableName.startsWith(tablePrefix))
    .map(table => toCompletionItemFromTableName(table.tableName))
}

function getTableCandidates(partialName: string, tables: Table[]): CompletionItem[] {
  return tables.flatMap(table => {
    const names = [table.tableName];
    if (table.database) names.push(table.database + '.' + table.tableName)
    if (table.catalog) names.push(table.catalog + '.' + table.database + '.' + table.tableName)
    return names;
  })
  .map(name => toCompletionItemMatchingLastToken(partialName, name))
}

function getColumnCondidates(tablePrefix: string, tables: Table[]): CompletionItem[] {
  const tableCandidates: string[] = tables
    .filter(table => table.tableName.startsWith(tablePrefix))
    .map(table => table.tableName)
  const columns: Column[] = tables
    .filter(table => tableCandidates.includes(table.tableName))
    .flatMap(table => table.columns)
  return columns.map(c => toCompletionItemFromColumn('', tablePrefix, c))
}

function getCandidatedFromIncompleteSubquery(incompleteSubquery: IncompleteSubqueryNode, pos: Pos, schema: Schema): CompletionItem[] {
  let candidates: CompletionItem[] = []
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

function createTablesFromFromNodes(fromNodes: FromTableNode[]): Table[] {
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

function getCandidatesFromError(lastToken: string, schema: Schema, _pos: Pos, e: any, fromNodes: FromTableNode[]): CompletionItem[] {
  switch (e.message) {
    case 'EXPECTED COLUMN NAME': {
      return getColumnCondidates('', schema.tables)
    }
  }
  let candidates = extractExpectedLiterals(e.expected || [])

  const subqueryTables = createTablesFromFromNodes(fromNodes)
  const schemaAndSubqueries = schema.tables.concat(subqueryTables)
  const partialName = lastToken
  candidates = candidates.concat(
    getColumnCandidatesByTableScope(lastToken, schemaAndSubqueries, partialName),
    getColumnCandidatesByAliasScope(lastToken, fromNodes, schemaAndSubqueries, partialName),
    getFunctionCondidates(partialName, schema.functions),
    getColumnCandidates(fromNodes, schemaAndSubqueries, partialName),
    getTableCandidates(partialName, schemaAndSubqueries)
  )
  if (logger.isDebugEnabled()) logger.debug(`candidates for error returns: ${JSON.stringify(candidates)}`)
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

function completeDeleteStatement(ast: DeleteStatement, pos: Pos, tables: Table[]): CompletionItem[] {
  if (isPosInLocation(ast.table.location, pos)) {
    return getTableCandidates('', tables)
  }
  else if (ast.where && isPosInLocation(ast.where.expression.location, pos)) {
    return getColumnCondidates('', tables)
  }
  return []
}

function completeSelectStatement(ast: SelectStatement, _pos: Pos, _tables: Table[]): CompletionItem[] {
  let candidates: CompletionItem[] = []
  if (Array.isArray(ast.columns)) {
    const first = ast.columns[0]
    const rest = ast.columns.slice(1, ast.columns.length)
    const lastColumn = rest.reduce((p, c) => p.location.end.offset < c.location.end.offset ? c : p, first)
    if (
      (lastColumn.expr.type === 'column_ref' && FROM_KEYWORD.label.startsWith(lastColumn.expr.column)) ||
      (lastColumn.as && FROM_KEYWORD.label.startsWith(lastColumn.as))
    ) {
      candidates.push(FROM_KEYWORD)
    }
    if (
      (lastColumn.as && AS_KEYWORD.label.startsWith(lastColumn.as))
    ) {
      candidates.push(AS_KEYWORD)
    }
  }
  return candidates
}

export function complete(sql: string, pos: Pos, schema: Schema = { tables: [], functions: [] }) {
  if (logger.isDebugEnabled()) logger.debug(`complete: ${sql}, ${JSON.stringify(pos)}`)
  let candidates: CompletionItem[] = []
  let error = null;

  const target = getRidOfAfterCursorString(sql, pos)
  logger.debug(`target: ${target}`)
  const lastToken = getLastToken(target)
  try {
    const ast = parse(target);
    candidates = getCandidatesForParsedQuery(lastToken, sql, ast, schema, pos)
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
      // Incomplete sub query 'SELECT sub FROM (SELECT e. FROM employees e) sub'
      candidates = getCandidatedFromIncompleteSubquery(fromNodeOnCursor, pos, schema)
    } else {
      candidates = getCandidatesFromError(lastToken, schema, pos, e, fromNodes)
    }
    error = { label: e.name, detail: e.message, line: e.line, offset: e.offset }
  }

  candidates = filterCandidatesUsingLastToken(lastToken, candidates, pos)
  return { candidates, error }
}

function filterCandidatesUsingLastToken(lastToken: string, candidates: CompletionItem[], _pos: Pos): CompletionItem[] {
  logger.debug(`filter based on lastToken: ${lastToken}`)
  if (logger.isDebugEnabled()) logger.debug(`candidates are: ${JSON.stringify(candidates)}`)
  return candidates
    .filter(v => {
      return v.label.startsWith(lastToken) || v.data?.matchesLastToken
    })
}

function getCandidatesForParsedQuery(lastToken: string, sql: string, ast: any, schema: Schema, pos: Pos): CompletionItem[] {
  if (logger.isDebugEnabled()) logger.debug(`getting candidates for parse query ast: ${JSON.stringify(ast)}`)
  if (ast.type === 'delete') {
    return completeDeleteStatement(ast, pos, schema.tables)
  }
  else {
    let candidates = CLAUSES
    if (ast.type === 'select') {
      candidates = candidates.concat(completeSelectStatement(ast, pos, schema.tables))
      if (!ast.distinct) {
        candidates.push(DISTINCT_KEYWORD)
      }
    }
    const columnRef = getColumnAtPosition(ast, pos)
    if (!columnRef) {
      candidates = candidates.concat(getJoinCondidates(ast, schema, pos))
    }
    else {
      const parsedFromClause = getFromNodesFromClause(sql)
      const fromNodes = parsedFromClause?.from?.tables || []
      const subqueryTables = createTablesFromFromNodes(fromNodes)
      const schemaAndSubqueries = schema.tables.concat(subqueryTables)

      if (columnRef.table) {
        // We know what table/alias this column belongs to
        const partialColumnName = columnRef.column
        const tableOrAlias = columnRef.table
        let scopedPartialColumnName = tableOrAlias + '.' + partialColumnName
        // Find the corresponding table and suggest it's columns
        candidates = candidates.concat(
          getColumnCandidatesByTableScope(lastToken, schemaAndSubqueries, scopedPartialColumnName),
          getColumnCandidatesByAliasScope(lastToken, fromNodes, schemaAndSubqueries, scopedPartialColumnName))
      }
      else {
        // Column is not scoped to a table/alias yet
        const partialName = columnRef.column
        // Could be an alias, a talbe or a function
        candidates = candidates.concat(
          getColumnCandidates(fromNodes, schemaAndSubqueries, partialName),
          getSelectTableCondidates(partialName, schema.tables),
          getFunctionCondidates(partialName, schema.functions))
      }
    }
    if (logger.isDebugEnabled()) logger.debug(`parse query returns: ${JSON.stringify(candidates)}`)
    return candidates
  }
}
function makeLastToken(fromTable: any): string {
  const parts = []
  if (fromTable.catalog) parts.push(fromTable.catalog)
  if (fromTable.db) parts.push(fromTable.db)
  if (fromTable.table) parts.push(fromTable.table)
  return parts.join('.')
}

function toCompletionItemMatchingLastToken (lastToken: string, tableName: string): CompletionItem {
  if (lastToken.indexOf('.') > 0) {
    const matchesLastToken = tableName.startsWith(lastToken);
    const remainingNamePart = tableName.substr(lastToken.lastIndexOf('.') + 1)
    return {
      label: remainingNamePart,
      filterText: '.' + remainingNamePart,
      insertText: '.' + remainingNamePart,
      detail: `table ${remainingNamePart}`,
      kind: TABLE_ICON,
      data: { matchesLastToken: matchesLastToken },
    }
  }
  else {
    return {
      label: tableName,
      detail: `table ${tableName}`,
      kind: TABLE_ICON,
    }
  }
}


function getJoinCondidates(ast: any, schema: Schema, pos: Pos): CompletionItem[] {
  // from clause: complete 'ON' keyword on 'INNER JOIN'
  if (ast.type === 'select' && Array.isArray(ast.from?.tables)) {
    const fromTable = getFromNodeByPos(ast.from?.tables || [], pos)
    if (fromTable && fromTable.type === 'table') {
      const lastToken = makeLastToken(fromTable)
      const candidates = getTableCandidates(lastToken, schema.tables)
      candidates.push(INNERJOIN_KEYWORD, LEFTJOIN_KEYWORD)
      // = candidates.concat([{ label: 'INNER JOIN' }, { label: 'LEFT JOIN' }])
      if (fromTable.join && !fromTable.on) {
        candidates.push(ON_KEYWORD)
      }
      return candidates
    }
  }
  return []
}

function getColumnAtPosition(ast: any, pos: Pos): ColumnRefNode | undefined {
  const columns = ast.columns
  if (Array.isArray(columns)) {
    // columns in select clause
    const columnRefs = (columns as any).map((col: any) => col.expr).filter((expr: any) => !!expr)
    if (ast.type === 'select' && ast.where?.expression) {
      // columns in where clause  
      columnRefs.push(ast.where.expression)
    }
    // column at position
    const columnRef = getColumnRefByPos(columnRefs, pos)
    if (logger.isDebugEnabled()) logger.debug(JSON.stringify(columnRef))
    return columnRef
  }
  return undefined
}

function toCompletionItemFromFunction(f: DbFunction): CompletionItem {
  return {
    label: f.name,
    detail: 'function',
    kind: FUNCTION_ICON,
    documentation: f.description
  }
}

function toCompletionItemFromAlias(alias: string): CompletionItem {
  return {
    label: alias,
    detail: 'alias',
    kind: ALIAS_ICON,
  }
}

function toCompletionItemFromColumn(lastToken: string, alias: string, column: Column): CompletionItem {
  let columnName = column.columnName
  if (alias) {
    const scopedColumnName = `${alias}.${columnName}`
    const matchesLastToken = scopedColumnName.startsWith(lastToken);
    const remainingColumnName = scopedColumnName.substr(lastToken.lastIndexOf('.') + 1)
    return {
      label: remainingColumnName,
      filterText: '.' + remainingColumnName,
      insertText: '.' + remainingColumnName,
      detail: `column ${column.description}`,
      kind: COLUMN_ICON,
      data: { matchesLastToken: matchesLastToken },
    }
  }
  else {
    return {
      label: columnName,
      detail: `column ${column.description}`,
      kind: COLUMN_ICON,
    }
  }
}
function getFunctionCondidates(prefix: string, functions: DbFunction[]): CompletionItem[] {
  if (!prefix) {
    // Nothing was typed, return all lowercase functions
    return functions.map(v => toCompletionItemFromFunction(v))
  }
  else {
    // If user typed the start of the function
    const lower = prefix.toLowerCase()
    const isTypedUpper = (prefix != lower)
    return functions
      // Search using lowercase prefix
      .filter(v => v.name.startsWith(lower))
      // If typed string is in upper case, then return upper case suggestions
      .map(v => {
        if (isTypedUpper) v.name = v.name.toUpperCase()
        return v
      })
      .map(v => toCompletionItemFromFunction(v))
  }

}

function getColumnCandidatesByTableScope(lastToken: string, tables: Table[], scopedPartialColumName: string): CompletionItem[] {
  return tables
    .filter(table => scopedPartialColumName.startsWith(table.tableName + '.'))
    .flatMap(table =>
      table.columns.map(col => {
        return { column: col, tableName: table.tableName }
      })
    )
    .map(colInfo => toCompletionItemFromColumn(lastToken, colInfo.tableName, colInfo.column))
}

function getColumnCandidatesByAliasScope(lastToken: string, fromNodes: FromTableNode[], tables: Table[], scopedPartialColumName: string): CompletionItem[] {
  return tables.flatMap(table => {
    return fromNodes.filter((fromNode: any) =>
      tableMatch(fromNode, table) &&
      fromNode.as &&
      scopedPartialColumName.startsWith(fromNode.as + '.')
    )
      .flatMap(fromNode =>
        table.columns.map(col => {
          return { column: col, alias: fromNode.as }
        })
      )
      .map(colInfo => toCompletionItemFromColumn(lastToken, colInfo.alias || '', colInfo.column))
  })
}

function tableMatch(fromNode: any, table: Table) {
  if (fromNode.table != table.tableName) {
    return false;
  }

  if (fromNode.db && fromNode.db != table.database) {
    return false;
  }

  if (fromNode.catalog && fromNode.catalog != table.catalog) {
    return false;
  }

  return true;
}

function getColumnCandidates(fromNodes: FromTableNode[], tables: Table[], partialName: string): CompletionItem[] {
  return tables.flatMap(table => {
    return fromNodes.filter((fromNode: any) =>
      fromNode.as &&
      fromNode.as.startsWith(partialName) &&
      tableMatch(fromNode, table)
    )
      .map(fromNode => toCompletionItemFromAlias(fromNode.as || ''))
  })
}
