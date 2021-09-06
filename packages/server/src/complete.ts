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
import { Schema, Table, DbFunction } from './database_libs/AbstractClient'
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-types';

type Pos = { line: number, column: number }

const logger = log4js.getLogger()

const KEYWORD_ICON = CompletionItemKind.Event
const COLUMN_ICON = CompletionItemKind.Interface
const TABLE_ICON = CompletionItemKind.Field
const FUNCTION_ICON = CompletionItemKind.Property
const ALIAS_ICON = CompletionItemKind.Variable





function keyword(name: string): CompletionItem {
  return {
    label: name,
    kind: KEYWORD_ICON,
    detail: 'keyword',
    data: { matchesLastToken: false },
  }
}

function matchedKeyword(name: string): CompletionItem {
  return {
    label: name,
    kind: KEYWORD_ICON,
    detail: 'keyword',
    data: { matchesLastToken: true },
  }
}


const FROM_KEYWORD = keyword('FROM')
const AS_KEYWORD = keyword('AS')
const DISTINCT_KEYWORD = keyword('DISTINCT')
const INNERJOIN_KEYWORD = keyword('INNER JOIN')
const LEFTJOIN_KEYWORD = keyword('LEFT JOIN')
const ON_KEYWORD = keyword('ON')

const CLAUSES: string[] = [
  'SELECT',
  'WHERE',
  'ORDER BY',
  'GROUP BY',
  'LIMIT',
  '--',
  '/*',
  '('
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

function getCandidatesforKeywords(lastToken: string, keywords: string[]) {
  return keywords.map(v => v == 'ORDER' ? 'ORDER BY' : v)
    .map(v => v == 'GROUP' ? 'GROUP BY' : v)
    .flatMap(v => [v.toLocaleLowerCase(), v])
    .filter(v => v.startsWith(lastToken))
    .map(v => matchedKeyword(v))
}

function getBasicKeywordCandidates(lastToken: string) {
  return getCandidatesforKeywords(lastToken, CLAUSES)
}
// Check if parser expects us to terminate a single quote value or double quoted column name
// SELECT TABLE1.COLUMN1 FROM TABLE1 WHERE TABLE1.COLUMN1 = "hoge.
// We don't offer the ', the ", the ` as suggestions
function extractExpectedLiterals(lastToken: string, expected: { type: string, text: string }[]): CompletionItem[] {
  const literals = expected.filter(v => v.type === 'literal').map(v => v.text)
  const uniqueLiterals = [...new Set(literals)];
  const keywords = uniqueLiterals
    .filter(v => !UNDESIRED_LITERAL.includes(v))
    .map(v => v == 'ORDER' ? 'ORDER BY' : v)
    .map(v => v == 'GROUP' ? 'GROUP BY' : v)
  return getCandidatesforKeywords(lastToken, keywords)
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

/**
 * Finds the most deeply nested FROM node that have a range encompasing the position.
 * In cases such as SELECT * FROM T1 JOIN (SELECT * FROM (SELECT * FROM T2 <pos>))
 * We will get a list of nodes like this
 * SELECT * FROM T1
 * (SELECT * FROM 
 *    (SELECT * FROM T2))
 * The idea is to reverse the list so that the most nested queries come first. Then
 * apply a filter to keep only the FROM nodes which encompass the position and take
 * the first one from that resulting list.
 * @param fromNodes 
 * @param pos 
 * @returns 
 */
function getFromNodeByPos(fromNodes: FromTableNode[], pos: Pos) {
  return fromNodes
    .reverse()
    .filter(tableNode => isPosInLocation(tableNode.location, pos))
    .shift()
}

// function getSelectTableCondidates(lastToken: string, tables: Table[]): CompletionItem[] {
//   return tables
//     .map(table => {
//       return {
//         lastToken: lastToken,
//         identifier: table.tableName,
//         detail: `table ${table.tableName}`,
//         kind: TABLE_ICON
//       };
//     })
//     .map(item => toCompletionItemIdentifierStartsWith(item))
// }

/**
 * Given a table returns all possible ways to refer to it.
 * That is by table name only, using the database scope,
 * using the catalog and database scopes.
 * @param table 
 * @returns 
 */
function allTableNameCombinations(table: Table): string[] {
  const names = [table.tableName];
  if (table.database) names.push(table.database + '.' + table.tableName)
  if (table.catalog) names.push(table.catalog + '.' + table.database + '.' + table.tableName)
  return names;
}

function getTableCandidates(lastToken: string, tables: Table[]): CompletionItem[] {
  return tables
    .flatMap(table => allTableNameCombinations(table))
    .map(aTableNameVariant => {
      return {
        lastToken: lastToken,
        identifier: aTableNameVariant,
        detail: '',
        kind: TABLE_ICON
      }
    })
    .map(item => toCompletionItemIdentifierStartsWith(item))
}

function getColumnCondidatesFromAnyTable(lastToken: string, tables: Table[]): CompletionItem[] {
  return tables
    .flatMap(table => table.columns)
    .map(column => {
      return {
        lastToken: lastToken,
        identifier: column.columnName,
        detail: column.description,
        kind: COLUMN_ICON
      }
    })
    .map(item => toCompletionItemIdentifierStartsWith(item))
}

function getCandidatesForIncompleteSubquery(incompleteSubquery: IncompleteSubqueryNode, pos: Pos, schema: Schema): CompletionItem[] {
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

/**
 * INSERT INTO TABLE1 (C
 */
function getCandidatesForInsert(lastToken: string, schema: Schema): CompletionItem[] {
  return getColumnCondidatesFromAnyTable(lastToken, schema.tables)
}

function getCandidatesForError(lastToken: string, schema: Schema, e: any): CompletionItem[] {
  let candidates = extractExpectedLiterals(lastToken, e.expected || [])
  candidates = candidates.concat(
    getFunctionCondidates(lastToken, schema.functions),
    getTableCandidates(lastToken, schema.tables)
  )
  return candidates
}

function getCandidatesForQuery(lastToken: string, schema: Schema, _pos: Pos, e: any, fromNodes: FromTableNode[]): CompletionItem[] {
  let candidates = extractExpectedLiterals(lastToken, e.expected || [])
  const subqueryTables = createTablesFromFromNodes(fromNodes)
  const schemaAndSubqueries = schema.tables.concat(subqueryTables)
  candidates = candidates.concat(
    getScopedColumnCandidates(lastToken, fromNodes, schemaAndSubqueries),
    getFunctionCondidates(lastToken, schema.functions),
    getAliasCandidates(lastToken, fromNodes),
    getTableCandidates(lastToken, schemaAndSubqueries)
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

function completeDeleteStatement(lastToken: string, ast: DeleteStatement, pos: Pos, tables: Table[]): CompletionItem[] {
  if (isPosInLocation(ast.table.location, pos)) {
    const lastToken = makeLastToken(ast.table)
    return getTableCandidates(lastToken, tables)
  }
  else if (ast.where && isPosInLocation(ast.where.expression.location, pos)) {
    const expr = ast.where.expression
    if (expr.type === 'column_ref') {
      lastToken = makeColumnName(expr.table, expr.column)
      return getColumnCondidatesFromAnyTable(lastToken, tables)
    }
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

/**
 * Recursively pull out the FROM nodes (including sub-queries)
 * @param tableNodes
 * @returns 
 */
function getAllNestedFromNodes(tableNodes: FromTableNode[]): FromTableNode[] {
  return tableNodes.flatMap(tableNode => {
    let result = [tableNode]
    if (tableNode.type == 'subquery') {
      const subTableNodes = tableNode.subquery.from?.tables || []
      result = result.concat(getAllNestedFromNodes(subTableNodes))
    }
    return result
  })
}

let lastToken = ''
let candidates: CompletionItem[] = []

export function complete(sql: string, pos: Pos, schema: Schema = { tables: [], functions: [] }) {
  if (logger.isDebugEnabled()) logger.debug(`complete: ${sql}, ${JSON.stringify(pos)}`)
  candidates = []
  let error = null;

  const target = getRidOfAfterCursorString(sql, pos)
  logger.debug(`target: ${target}`)
  lastToken = getLastToken(target)
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
    if (parsedFromClause) {
      const fromNodes = getAllNestedFromNodes(parsedFromClause?.from?.tables || [])
      const fromNodeOnCursor = getFromNodeByPos(fromNodes, pos)
      if (fromNodeOnCursor && fromNodeOnCursor.type === 'incomplete_subquery') {
        // Incomplete sub query 'SELECT sub FROM (SELECT e. FROM employees e) sub'
        candidates = getCandidatesForIncompleteSubquery(fromNodeOnCursor, pos, schema)
      } else {
        candidates = getCandidatesForQuery(lastToken, schema, pos, e, fromNodes)
      }
    }
    else if (e.message === 'EXPECTED COLUMN NAME') {
      candidates = getCandidatesForInsert(lastToken, schema)
    }
    else {
      candidates = getCandidatesForError(lastToken, schema, e)
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
  if (!ast.type) {
    return getBasicKeywordCandidates(lastToken)
  }
  if (ast.type === 'delete') {
    return completeDeleteStatement('', ast, pos, schema.tables)
  }
  else if (ast.type === 'select') {
    let candidates = getBasicKeywordCandidates(lastToken)
    candidates = candidates.concat(completeSelectStatement(ast, pos, schema.tables))
    if (!ast.distinct) {
      candidates.push(DISTINCT_KEYWORD)
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
        // Strip out any subscripts t.abc[0].xyz
        const lastToken2 = getLastToken(' ' + tableOrAlias + '.' + partialColumnName)
        // Find the corresponding table and suggest it's columns
        candidates = candidates.concat(
          getScopedColumnCandidates(lastToken2, fromNodes, schemaAndSubqueries))
      }
      else {
        // Column is not scoped to a table/alias yet
        const lastToken2 = columnRef.column
        // Could be an alias, a talbe or a function
        candidates = candidates.concat(
          getAliasCandidates(lastToken2, fromNodes),
          getTableCandidates(lastToken2, schemaAndSubqueries),

          //getSelectTableCondidates(partialName, schema.tables),
          getFunctionCondidates(lastToken2, schema.functions))
      }
    }
    if (logger.isDebugEnabled()) logger.debug(`parse query returns: ${JSON.stringify(candidates)}`)
    return candidates
  }
  else {
    console.log(`AST type not supported yet: ${ast.type}`)
    return []
  }
}
function makeLastToken(fromTable: any): string {
  const parts = []
  if (fromTable.catalog) parts.push(fromTable.catalog)
  if (fromTable.db) parts.push(fromTable.db)
  if (fromTable.table) parts.push(fromTable.table)
  return parts.join('.')
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
    documentation: f.description,
    data: { matchesLastToken: true },
  }
}

function toCompletionItemForAlias(alias: string): CompletionItem {
  return {
    label: alias,
    detail: 'alias',
    kind: ALIAS_ICON,
    data: { matchesLastToken: true },
  }
}

type Identifier = {
  lastToken: string,
  identifier: string,
  detail: string,
  kind: CompletionItemKind
}

function toCompletionItemIdentifierStartsWith(item: Identifier): CompletionItem {
  const kindName = item.kind == TABLE_ICON ? 'table' : 'column'
  const matchesLastToken = item.identifier.startsWith(item.lastToken);
  if (item.lastToken.indexOf('.') > 0) {
    const remainingNamePart = item.identifier.substr(item.lastToken.lastIndexOf('.') + 1)
    return {
      label: remainingNamePart,
      filterText: '.' + remainingNamePart,
      insertText: '.' + remainingNamePart,
      detail: `${kindName} ${item.detail}`,
      kind: item.kind,
      data: { matchesLastToken: matchesLastToken },
    }
  }
  else {
    return {
      label: item.identifier,
      detail: `${kindName} ${item.identifier}`,
      kind: item.kind,
      data: { matchesLastToken: matchesLastToken },
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

function makeColumnName(alias: string, columnName: string) {
  if (alias) {
    return alias + '.' + columnName;
  }
  return columnName;
}

function getScopedColumnCandidates(lastToken: string, fromNodes: FromTableNode[], tables: Table[]): CompletionItem[] {
  return tables.flatMap(table => {
    return fromNodes.filter((fromNode: any) => tableMatch(fromNode, table))
      .map((fromNode: any) => fromNode.as || fromNode.table)
      .filter(alias => lastToken.startsWith(alias + '.')
      )
      .flatMap(alias =>
        table.columns.map(col => {
          return {
            lastToken: lastToken,
            identifier: makeColumnName(alias, col.columnName),
            detail: col.description,
            kind: COLUMN_ICON
          }
        })
      )
      .map(item => toCompletionItemIdentifierStartsWith(item))
  })
}

function tableMatch(fromNode: any, table: Table) {
  if (fromNode.type == 'subquery' &&
    fromNode.as &&
    fromNode.as != table.tableName) {
    return false;
  }
  else if (fromNode.table && fromNode.table != table.tableName) {
    return false;
  }
  else if (fromNode.db && fromNode.db != table.database) {
    return false;
  }
  else if (fromNode.catalog && fromNode.catalog != table.catalog) {
    return false;
  }
  return true;
}

function getAliasCandidates(lastToken: string, fromNodes: FromTableNode[]): CompletionItem[] {
  return fromNodes
    .map((fromNode: any) => fromNode.as)
    .filter(aliasName => aliasName && aliasName.startsWith(lastToken))
    .map(aliasName => toCompletionItemForAlias(aliasName))
}
