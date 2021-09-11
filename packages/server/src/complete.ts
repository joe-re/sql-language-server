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

export const KEYWORD_ICON = CompletionItemKind.Event
export const COLUMN_ICON = CompletionItemKind.Interface
export const TABLE_ICON = CompletionItemKind.Field
export const FUNCTION_ICON = CompletionItemKind.Property
export const ALIAS_ICON = CompletionItemKind.Variable

const FROM_KEYWORD = toCompletionItemForKeyword('FROM')
const AS_KEYWORD = toCompletionItemForKeyword('AS')
const DISTINCT_KEYWORD = toCompletionItemForKeyword('DISTINCT')
const INNERJOIN_KEYWORD = toCompletionItemForKeyword('INNER JOIN')
const LEFTJOIN_KEYWORD = toCompletionItemForKeyword('LEFT JOIN')
const ON_KEYWORD = toCompletionItemForKeyword('ON')

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

export class Identifier {
  lastToken: string
  identifier: string
  detail: string
  kind: CompletionItemKind
  constructor(lastToken: string, identifier: string, detail: string, kind: CompletionItemKind) {
    this.lastToken = lastToken
    this.identifier = identifier
    this.detail = detail
    this.kind = kind
  }

  matchesLastToken(): boolean {
    if (this.identifier.startsWith(this.lastToken)) {
      // prevent suggesting the lastToken itself, there is nothing to complete in that case
      if (this.identifier !== this.lastToken) {
        return true;
      }
    }
    return false;
  }

  toCompletionItem(): CompletionItem {
    const kindName = this.kind == TABLE_ICON ? 'table' : 'column'
    const idx = this.lastToken.lastIndexOf('.')
    const namePart = this.identifier.substr(idx + 1)
    const dot = idx > 0 ? '.' : ''
    return {
      label: namePart,
      filterText: dot + namePart,
      insertText: dot + namePart,
      detail: `${kindName} ${this.detail}`,
      kind: this.kind,
    }
  }
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


function toCompletionItemForKeyword(name: string): CompletionItem {
  return {
    label: name,
    kind: KEYWORD_ICON,
    detail: 'keyword',
  }
}

function toCompletionItemForFunction(f: DbFunction): CompletionItem {
  return {
    label: f.name,
    detail: 'function',
    kind: FUNCTION_ICON,
    documentation: f.description,
  }
}

function toCompletionItemForAlias(alias: string): CompletionItem {
  return {
    label: alias,
    detail: 'alias',
    kind: ALIAS_ICON,
  }
}

function getFromNodesFromClause(sql: string): FromClauseParserResult | null {
  try {
    return parseFromClause(sql) as any
  } catch (_e) {
    // no-op
    return null
  }
}

class Completer {
  lastToken: string;
  candidates: CompletionItem[]
  schema: Schema
  error: any
  sql: string
  pos: Pos
  constructor(schema: Schema, sql: string, pos: Pos) {
    this.lastToken = ''
    this.schema = schema
    this.candidates = []
    this.error = ''
    this.sql = sql
    this.pos = pos
  }

  complete() {
    const target = this.getRidOfAfterCursorString()
    logger.debug(`target: ${target}`)
    this.lastToken = getLastToken(target)
    try {
      const ast = parse(target);
      this.addCandidatesForParsedStatement(ast)
    } catch (e) {
      logger.debug('error')
      logger.debug(e)
      if (e.name !== 'SyntaxError') {
        throw e
      }
      const parsedFromClause = getFromNodesFromClause(this.sql)
      if (parsedFromClause) {
        const fromNodes = this.getAllNestedFromNodes(parsedFromClause?.from?.tables || [])
        const fromNodeOnCursor = this.getFromNodeByPos(fromNodes)
        if (fromNodeOnCursor && fromNodeOnCursor.type === 'incomplete_subquery') {
          // Incomplete sub query 'SELECT sub FROM (SELECT e. FROM employees e) sub'
          this.addCandidatesForIncompleteSubquery(fromNodeOnCursor)
        }
        else {
          this.addCandidatesForSelectQuery(e, fromNodes)
        }
      }
      else if (e.message === 'EXPECTED COLUMN NAME') {
        this.addCandidatesForInsert()
      }
      else {
        this.addCandidatesForError(e)
      }
      this.error = { label: e.name, detail: e.message, line: e.line, offset: e.offset }
    }
    return this.candidates
  }

  addCandidatesforKeywords(keywords: string[]) {
    keywords.map(v => v == 'ORDER' ? 'ORDER BY' : v)
      .map(v => v == 'GROUP' ? 'GROUP BY' : v)
      .flatMap(v => [v.toLocaleLowerCase(), v])
      .filter(v => v.startsWith(this.lastToken))
      .map(v => toCompletionItemForKeyword(v))
      .forEach(item => this.addCandidate(item))
  }

  addCandidatesForBasicKeyword() {
    this.addCandidatesforKeywords(CLAUSES)
  }

  // Check if parser expects us to terminate a single quote value or double quoted column name
  // SELECT TABLE1.COLUMN1 FROM TABLE1 WHERE TABLE1.COLUMN1 = "hoge.
  // We don't offer the ', the ", the ` as suggestions
  addCandidatesForExpectedLiterals(expected: { type: string, text: string }[]) {
    const literals = expected.filter(v => v.type === 'literal').map(v => v.text)
    const uniqueLiterals = [...new Set(literals)];
    const keywords = uniqueLiterals
      .filter(v => !UNDESIRED_LITERAL.includes(v))
      .map(v => v == 'ORDER' ? 'ORDER BY' : v)
      .map(v => v == 'GROUP' ? 'GROUP BY' : v)
    this.addCandidatesforKeywords(keywords)
  }

  getColumnRefByPos(columns: ColumnRefNode[]) {
    return columns.find(v =>
      (v.location.start.line === this.pos.line + 1 && v.location.start.column <= this.pos.column) &&
      (v.location.end.line === this.pos.line + 1 && v.location.end.column >= this.pos.column)
    )
  }

  isPosInLocation(location: NodeRange) {
    return (location.start.line === this.pos.line + 1 && location.start.column <= this.pos.column) &&
      (location.end.line === this.pos.line + 1 && location.end.column >= this.pos.column)
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
  getFromNodeByPos(fromNodes: FromTableNode[]) {
    return fromNodes
      .reverse()
      .filter(tableNode => this.isPosInLocation(tableNode.location))
      .shift()
  }

  /**
   * Given a table returns all possible ways to refer to it.
   * That is by table name only, using the database scope,
   * using the catalog and database scopes.
   * @param table 
   * @returns 
   */
  allTableNameCombinations(table: Table): string[] {
    const names = [table.tableName];
    if (table.database) names.push(table.database + '.' + table.tableName)
    if (table.catalog) names.push(table.catalog + '.' + table.database + '.' + table.tableName)
    return names;
  }

  addCandidatesForTables(tables: Table[]) {
    tables
      .flatMap(table => this.allTableNameCombinations(table))
      .map(aTableNameVariant => {
        return new Identifier(
          this.lastToken,
          aTableNameVariant,
          '',
          TABLE_ICON
        )
      })
      .filter(item => item.matchesLastToken())
      .map(item => item.toCompletionItem())
      .forEach(item => this.addCandidate(item))
  }

  addCandidatesForColumnsOfAnyTable(tables: Table[]) {
    tables
      .flatMap(table => table.columns)
      .map(column => {
        return new Identifier(
          this.lastToken,
          column.columnName,
          column.description,
          COLUMN_ICON
        )
      })
      .filter(item => item.matchesLastToken())
      .map(item => item.toCompletionItem())
      .forEach(item => this.addCandidate(item))
  }

  addCandidate(item: CompletionItem) {
    this.candidates.push(item)
  }

  addCandidateIfStartsWithLastToken(item: CompletionItem) {
    if (item.label.startsWith(this.lastToken)) {
      this.candidates.push(item)
    }
  }

  addCandidatesForIncompleteSubquery(incompleteSubquery: IncompleteSubqueryNode) {
    const parsedFromClause = getFromNodesFromClause(incompleteSubquery.text)
    try {
      parse(incompleteSubquery.text);
    } catch (e) {
      if (e.name !== 'SyntaxError') {
        throw e
      }
      const fromText = incompleteSubquery.text
      const newPos = parsedFromClause ? {
        line: this.pos.line - (incompleteSubquery.location.start.line - 1),
        column: this.pos.column - incompleteSubquery.location.start.column + 1
      } : { line: 0, column: 0 }
      const completer = new Completer(this.schema, fromText, newPos)
      completer.complete().forEach(item => this.addCandidate(item))
    }
  }

  createTablesFromFromNodes(fromNodes: FromTableNode[]): Table[] {
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
  addCandidatesForInsert() {
    this.addCandidatesForColumnsOfAnyTable(this.schema.tables)
  }

  addCandidatesForError(e: any) {
    this.addCandidatesForExpectedLiterals(e.expected || [])
    this.addCandidatesForFunctions()
    this.addCandidatesForTables(this.schema.tables)
  }

  addCandidatesForSelectQuery(e: any, fromNodes: FromTableNode[]) {
    this.addCandidatesForExpectedLiterals(e.expected || [])
    const subqueryTables = this.createTablesFromFromNodes(fromNodes)
    const schemaAndSubqueries = this.schema.tables.concat(subqueryTables)
    this.addCandidatesForFunctions()
    this.addCandidatesForScopedColumns(fromNodes, schemaAndSubqueries)
    this.addCandidatesForAliases(fromNodes)
    this.addCandidatesForTables(schemaAndSubqueries)
    if (logger.isDebugEnabled()) logger.debug(`candidates for error returns: ${JSON.stringify(this.candidates)}`)
  }

  getRidOfAfterCursorString() {
    return this.sql.split('\n').filter((_v, idx) => this.pos.line >= idx).map((v, idx) => idx === this.pos.line ? v.slice(0, this.pos.column) : v).join('\n')
  }

  addCandidatesForParsedDeleteStatement(ast: DeleteStatement) {
    if (this.isPosInLocation(ast.table.location)) {
      this.addCandidatesForTables(this.schema.tables)
    }
    else if (ast.where && this.isPosInLocation(ast.where.expression.location)) {
      const expr = ast.where.expression
      if (expr.type === 'column_ref') {
        this.addCandidatesForColumnsOfAnyTable(this.schema.tables)
      }
    }
  }

  completeSelectStatement(ast: SelectStatement) {
    if (Array.isArray(ast.columns)) {
      this.addCandidateIfStartsWithLastToken(FROM_KEYWORD)
      this.addCandidateIfStartsWithLastToken(AS_KEYWORD)
    }
  }

  /**
   * Recursively pull out the FROM nodes (including sub-queries)
   * @param tableNodes
   * @returns 
   */
  getAllNestedFromNodes(tableNodes: FromTableNode[]): FromTableNode[] {
    return tableNodes.flatMap(tableNode => {
      let result = [tableNode]
      if (tableNode.type == 'subquery') {
        const subTableNodes = tableNode.subquery.from?.tables || []
        result = result.concat(this.getAllNestedFromNodes(subTableNodes))
      }
      return result
    })
  }

  addCandidatesForParsedSelectQuery(ast: any) {
    this.addCandidatesForBasicKeyword()
    this.completeSelectStatement(ast)
    if (!ast.distinct) {
      this.addCandidateIfStartsWithLastToken(DISTINCT_KEYWORD)
    }
    const columnRef = this.findColumnAtPosition(ast)
    if (!columnRef) {
      this.addJoinCondidates(ast)
    }
    else {
      const parsedFromClause = getFromNodesFromClause(this.sql)
      const fromNodes = parsedFromClause?.from?.tables || []
      const subqueryTables = this.createTablesFromFromNodes(fromNodes)
      const schemaAndSubqueries = this.schema.tables.concat(subqueryTables)
      if (columnRef.table) {
        // We know what table/alias this column belongs to
        // Find the corresponding table and suggest it's columns
        this.addCandidatesForScopedColumns(fromNodes, schemaAndSubqueries)
      }
      else {
        // Column is not scoped to a table/alias yet
        // Could be an alias, a talbe or a function
        this.addCandidatesForAliases(fromNodes)
        this.addCandidatesForTables(schemaAndSubqueries)
        this.addCandidatesForFunctions()
      }
    }
    if (logger.isDebugEnabled()) logger.debug(`parse query returns: ${JSON.stringify(this.candidates)}`)
  }

  addCandidatesForParsedStatement(ast: any) {
    if (logger.isDebugEnabled()) logger.debug(`getting candidates for parse query ast: ${JSON.stringify(ast)}`)
    if (!ast.type) {
      this.addCandidatesForBasicKeyword()
    }
    else if (ast.type === 'delete') {
      this.addCandidatesForParsedDeleteStatement(ast)
    }
    else if (ast.type === 'select') {
      this.addCandidatesForParsedSelectQuery(ast)
    }
    else {
      console.log(`AST type not supported yet: ${ast.type}`)
    }
  }

  addJoinCondidates(ast: any) {
    // from clause: complete 'ON' keyword on 'INNER JOIN'
    if (ast.type === 'select' && Array.isArray(ast.from?.tables)) {
      const fromTable = this.getFromNodeByPos(ast.from?.tables || [])
      if (fromTable && fromTable.type === 'table') {
        this.addCandidatesForTables(this.schema.tables)
        this.addCandidateIfStartsWithLastToken(INNERJOIN_KEYWORD)
        this.addCandidateIfStartsWithLastToken(LEFTJOIN_KEYWORD)
        if (fromTable.join && !fromTable.on) {
          this.addCandidateIfStartsWithLastToken(ON_KEYWORD)
        }
      }
    }
  }

  findColumnAtPosition(ast: any): ColumnRefNode | undefined {
    const columns = ast.columns
    if (Array.isArray(columns)) {
      // columns in select clause
      const columnRefs = (columns as any).map((col: any) => col.expr).filter((expr: any) => !!expr)
      if (ast.type === 'select' && ast.where?.expression) {
        // columns in where clause  
        columnRefs.push(ast.where.expression)
      }
      // column at position
      const columnRef = this.getColumnRefByPos(columnRefs)
      if (logger.isDebugEnabled()) logger.debug(JSON.stringify(columnRef))
      return columnRef
    }
    return undefined
  }

  addCandidatesForFunctions() {
    console.time('addCandidatesForFunctions')
    if (!this.lastToken) {
      // Nothing was typed, return all lowercase functions
      this.schema.functions
        .map(func => toCompletionItemForFunction(func))
        .forEach(item => this.addCandidate(item))
    }
    else {
      // If user typed the start of the function
      const lower = this.lastToken.toLowerCase()
      const isTypedUpper = (this.lastToken != lower)
      this.schema.functions
        // Search using lowercase prefix
        .filter(v => v.name.startsWith(lower))
        // If typed string is in upper case, then return upper case suggestions
        .map(v => {
          if (isTypedUpper) v.name = v.name.toUpperCase()
          return v
        })
        .map(v => toCompletionItemForFunction(v))
        .forEach(item => this.addCandidate(item))
    }
    console.timeEnd('addCandidatesForFunctions')
  }

  makeColumnName(alias: string, columnName: string) {
    return alias ? alias + '.' + columnName : columnName;
  }

  addCandidatesForScopedColumns(fromNodes: FromTableNode[], tables: Table[]) {
    console.time('addCandidatesForScopedColumns')
    tables.flatMap(table => {
      return fromNodes.filter((fromNode: any) => this.tableMatch(fromNode, table))
        .map((fromNode: any) => fromNode.as || fromNode.table)
        .filter(alias => this.lastToken.startsWith(alias + '.'))
        .flatMap(alias =>
          table.columns.map(col => {
            return new Identifier(
              this.lastToken,
              this.makeColumnName(alias, col.columnName),
              col.description,
              COLUMN_ICON
            )
          })
        )
    })
      .filter(item => item.matchesLastToken())
      .map(item => item.toCompletionItem())
      .forEach(item => this.addCandidate(item))
    console.timeEnd('addCandidatesForScopedColumns')
  }

  /**
   * Test if the given table matches the fromNode.
   * @param fromNode 
   * @param table 
   * @returns 
   */
  tableMatch(fromNode: any, table: Table) {
    // Assume table matches from node and disprove
    let matchingTable = true
    if (fromNode.type == 'subquery') {
      // If we have an alias it should match the subquery table name
      if (fromNode.as && fromNode.as != table.tableName) {
        matchingTable = false;
      }
    }
    // Regular tables
    // If we have a from node with a table name
    // and it does not match the table, we know it's not a match 
    else {
      if (fromNode.table && fromNode.table != table.tableName) {
        matchingTable = false;
      }
      else if (fromNode.db && fromNode.db != table.database) {
        matchingTable = false;
      }
      else if (fromNode.catalog && fromNode.catalog != table.catalog) {
        matchingTable = false;
      }
    }
    return matchingTable;
  }

  addCandidatesForAliases(fromNodes: FromTableNode[]) {
    fromNodes
      .map((fromNode: any) => fromNode.as)
      .filter(aliasName => aliasName && aliasName.startsWith(this.lastToken))
      .map(aliasName => toCompletionItemForAlias(aliasName))
      .forEach(item => this.addCandidate(item))
  }
}


export function complete(sql: string, pos: Pos, schema: Schema = { tables: [], functions: [] }) {
  console.time('complete')
  if (logger.isDebugEnabled()) logger.debug(`complete: ${sql}, ${JSON.stringify(pos)}`)
  const completer = new Completer(schema, sql, pos)
  const candidates = completer.complete()
  console.timeEnd('complete')
  return { candidates: candidates, error: completer.error }
}
