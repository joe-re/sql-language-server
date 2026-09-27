import type * as A from './ast'
import { isTrivia, LineMap, Token, tokenize } from './lexer'

/** Internal signal for a syntax error; converted to SqlSyntaxError by callers */
export class ParseFailure extends Error {
  constructor(readonly kind: 'syntax' | 'expected_column_name' = 'syntax') {
    super('parse failure')
  }
}

// Words that cannot be used as a bare alias or a bare column reference
const RESERVED = new Set(
  (
    'ALL AND AS ASC BETWEEN BY CASE CROSS DELETE DESC DISTINCT ELSE END EXCEPT ' +
    'EXISTS FROM FULL GROUP HAVING IN INNER INSERT INTERSECT INTO IS JOIN LEFT ' +
    'LIKE LIMIT NATURAL NOT NULL OFFSET ON OR ORDER OUTER RETURNING RIGHT SELECT ' +
    'SET THEN UNION UPDATE USING VALUES WHEN WHERE WINDOW WITH'
  ).split(' ')
)

const AGGREGATE_FUNCTIONS = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'])
const SPECIAL_SYSTEM_FUNCTIONS = new Set([
  'CURRENT_TIMESTAMP',
  'CURRENT_DATE',
  'CURRENT_TIME',
  'CURRENT_USER',
  'LOCALTIME',
  'LOCALTIMESTAMP',
])

// Expectations reported for keyword completion. They mirror the candidates
// that sql-language-server offered with the previous parser.
const EXPR_START = [
  '"',
  '$',
  "'",
  '(',
  '`',
  'AVG',
  'CAST',
  'COUNT',
  'FALSE',
  'MAX',
  'MIN',
  'NULL',
  'SELECT',
  'SUM',
  'TRUE',
  'WITH',
]
const IDENT_START = ['"', '`']
/** Expected at the start of an expression outside of the select column list */
const EXPR_PREFIX = ['NOT', '!']
const AFTER_OPERAND = [
  '!=',
  '<=',
  '<>',
  '>',
  '>=',
  'AND',
  'BETWEEN',
  'CONTAINS',
  'IN',
  'IS',
  'LIKE',
  'NOT',
  'OR',
]
const COMPARISON_OPERATORS = new Set([
  '=',
  '==',
  '!=',
  '<>',
  '<',
  '<=',
  '>',
  '>=',
  'LIKE',
  'ILIKE',
  'IN',
  'NOT IN',
  'IS',
  'IS NOT',
  'BETWEEN',
  'CONTAINS',
])
/** After `a < b`, another predicate operator cannot follow directly */
const AFTER_COMPARISON = AFTER_OPERAND.filter(
  (v) => !['BETWEEN', 'CONTAINS', 'IN', 'IS', 'LIKE', 'NOT'].includes(v)
)
const STATEMENT_START = [
  'WITH',
  'SELECT',
  '(',
  'UPDATE',
  'INSERT',
  'REPLACE',
  'DELETE',
  'DROP TABLE',
  'DROP VIEW',
  'CREATE TABLE',
  'ALTER',
  'CREATE',
  'DROP',
  '$',
]

type ExprOptions = {
  /** Report comparison / logical operators as expected after an operand */
  reportOperators?: boolean
  /** Report NOT / ! as expected at the start */
  reportPrefix?: boolean
  /** The expression is the right operand of a comparison */
  afterComparison?: boolean
  /** Report `(` (function call) as expected after a single word */
  reportCall?: boolean
}

export type ParserOptions = {
  /**
   * Mode of parseFromClause(): subqueries in FROM that fail to parse become
   * `incomplete_subquery` nodes and unterminated quotes are tolerated
   */
  recoverFromSubquery?: boolean
}

export class Parser {
  readonly sql: string
  readonly allTokens: Token[]
  /** Tokens without whitespace / comments */
  readonly tokens: Token[]
  private readonly lines: LineMap
  private readonly options: ParserOptions
  i = 0
  /** Index of the furthest token at which something was expected */
  furthest = -1
  expected = new Set<string>()
  /** Token index of a column name that is being typed (see EXPECTED COLUMN NAME) */
  columnNameAt: number | null = null
  /** Locate EXPECTED COLUMN NAME at the end of the name (INSERT column list) */
  columnNameAtEnd = false
  /** Set when the error should be reported without expectations */
  emptyExpectedAt: number | null = null
  /** Depth of subqueries in FROM being parsed */
  private fromSubqueryDepth = 0

  constructor(sql: string, options: ParserOptions = {}) {
    this.sql = sql
    this.allTokens = tokenize(sql, {
      lenientQuotes: options.recoverFromSubquery,
    })
    this.tokens = this.allTokens.filter((t) => !isTrivia(t))
    this.lines = new LineMap(sql)
    this.options = options
  }

  // ---------------------------------------------------------------------------
  // Token helpers

  peek(offset = 0): Token {
    return this.tokens[Math.min(this.i + offset, this.tokens.length - 1)]
  }

  get atEnd() {
    return this.peek().kind === 'eof'
  }

  private record(labels: string[], index = this.i) {
    if (index > this.furthest) {
      this.furthest = index
      this.expected = new Set(labels)
    } else if (index === this.furthest) {
      labels.forEach((l) => this.expected.add(l))
    }
  }

  /** Records `labels` as expected at the current position */
  expect(...labels: string[]) {
    this.record(labels)
  }

  fail(): never {
    throw new ParseFailure()
  }

  isKeyword(token: Token, word: string) {
    return token.kind === 'word' && token.text.toUpperCase() === word
  }

  /** Checks a (multi word) keyword without consuming it */
  peekKeyword(words: string, offset = 0) {
    return words
      .split(' ')
      .every((w, n) => this.isKeyword(this.peek(offset + n), w))
  }

  /**
   * Consumes a (multi word) keyword when present. `label` is reported as
   * expected unless it is null.
   */
  acceptKeyword(
    words: string,
    label: string | null = words
  ): A.KeywordNode | null {
    if (label !== null) this.expect(label)
    if (!this.peekKeyword(words)) {
      // e.g. `GROUP |` expects `BY`
      const list = words.split(' ')
      let matched = 0
      while (
        matched < list.length &&
        this.isKeyword(this.peek(matched), list[matched])
      )
        matched++
      if (matched > 0 && label !== null)
        this.record([list[matched]], this.i + matched)
      return null
    }
    const start = this.i
    this.i += words.split(' ').length
    return this.keyword(start, this.i - 1)
  }

  requireKeyword(words: string, label: string | null = words) {
    return this.acceptKeyword(words, label) ?? this.fail()
  }

  /** Consumes the first of the given keywords that is present */
  acceptOneOf(list: string[], report = true): A.KeywordNode | null {
    if (report) this.expect(...list)
    for (const words of list) {
      const k = this.acceptKeyword(words, null)
      if (k) return k
    }
    return null
  }

  isPunct(token: Token, text: string) {
    return (
      (token.kind === 'punct' || token.kind === 'operator') &&
      token.text === text
    )
  }

  acceptPunct(text: string, report = true): Token | null {
    if (report) this.expect(text)
    if (!this.isPunct(this.peek(), text)) return null
    return this.tokens[this.i++]
  }

  requirePunct(text: string, report = true): Token {
    return this.acceptPunct(text, report) ?? this.fail()
  }

  // ---------------------------------------------------------------------------
  // Location helpers

  position(offset: number): A.NodePosition {
    return this.lines.position(offset)
  }

  range(start: number, end: number): A.NodeRange {
    return { start: this.position(start), end: this.position(end) }
  }

  /** Location spanning tokens [from, to] (token indexes, inclusive) */
  loc(from: number, to = this.i - 1): A.NodeRange {
    const end = Math.max(from, to)
    return this.range(this.tokens[from].start, this.tokens[end].end)
  }

  keyword(from: number, to: number): A.KeywordNode {
    const location = this.loc(from, to)
    return {
      type: 'keyword',
      value: this.sql.slice(location.start.offset, location.end.offset),
      location,
    }
  }

  /** Adds `location` (spanning from token `start` to here) when missing */
  located<T extends object>(
    start: number,
    node: T
  ): T & { location: A.NodeRange } {
    if (!('location' in node)) {
      ;(node as { location?: A.NodeRange }).location = this.loc(start)
    }
    return node as T & { location: A.NodeRange }
  }

  /** Source text of tokens [from, to] */
  text(from: number, to = this.i - 1) {
    return this.sql.slice(this.tokens[from].start, this.tokens[to].end)
  }

  // ---------------------------------------------------------------------------
  // Identifiers

  /** A word that can be an identifier in this position */
  private isIdentifierToken(token: Token, allowReserved: boolean) {
    if (token.kind === 'quoted_ident') return !token.unterminated
    if (token.kind !== 'word') return false
    return allowReserved || !RESERVED.has(token.text.toUpperCase())
  }

  /** Consumes one identifier part and returns its raw text */
  acceptIdentifierPart(allowReserved = false): Token | null {
    this.expect(...IDENT_START)
    const token = this.peek()
    if (token.kind === 'quoted_ident' && token.unterminated) {
      this.unterminated(token)
    }
    if (!this.isIdentifierToken(token, allowReserved)) return null
    this.i++
    return token
  }

  requireIdentifierPart(allowReserved = false) {
    return this.acceptIdentifierPart(allowReserved) ?? this.fail()
  }

  /** An identifier with quotes removed */
  requireName(allowReserved = false) {
    return unquote(this.requireIdentifierPart(allowReserved).text)
  }

  /** `a`, `a.b`, `a.b.c` with quotes removed */
  requireQualifiedName(allowReserved = false, reportDot = false): string[] {
    const parts = [this.requireName(allowReserved)]
    while (this.acceptPunct('.', reportDot)) {
      parts.push(this.requireName(true))
    }
    return parts
  }

  /** An unterminated quoted token: only its closing quote is expected */
  private unterminated(token: Token): never {
    const index = this.tokens.indexOf(token)
    this.furthest = Number.MAX_SAFE_INTEGER
    const quote = token.text[0]
    this.expected = new Set(
      quote === '`'
        ? ['`']
        : [
            quote,
            ...['"', "'", '/', '\\', 'b', 'f', 'n', 'r', 't', 'u'].map(
              (c) => '\\' + c
            ),
          ]
    )
    this.unterminatedAt = index
    this.fail()
  }

  /** Set when the error is inside an unterminated quoted token */
  unterminatedAt: number | null = null

  // ---------------------------------------------------------------------------
  // Statements

  /** Parses statements separated by `;` until the end of input */
  parseStatements(): A.AST[] {
    const statements: A.AST[] = []
    for (;;) {
      while (this.acceptPunct(';', false));
      if (this.atEnd) break
      statements.push(this.parseStatement())
      this.expect(';')
      if (this.atEnd) break
      if (!this.acceptPunct(';', false)) this.fail()
    }
    return statements
  }

  parseStatement(): A.AST {
    const start = this.i
    return this.located(start, this.parseStatementBody())
  }

  private parseStatementBody(): A.AST {
    this.expect(...STATEMENT_START)
    const token = this.peek()
    const word = token.kind === 'word' ? token.text.toUpperCase() : ''
    if (word === 'WITH') {
      const withClause = this.parseWith()
      return this.parseStatementAfterWith(withClause)
    }
    if (word === 'SELECT' || this.isPunct(token, '('))
      return this.parseQuery(null)
    if (word === 'INSERT' || word === 'REPLACE') return this.parseInsert(null)
    if (word === 'UPDATE') return this.parseUpdate(null)
    if (word === 'DELETE') return this.parseDelete(null)
    if (word === 'CREATE') return this.parseCreate()
    if (word === 'ALTER') return this.parseAlterTable()
    if (word === 'DROP') return this.parseDrop()
    this.fail()
  }

  private parseStatementAfterWith(withClause: A.WithClause): A.AST {
    const start = this.i
    return this.located(start, this.parseStatementAfterWithBody(withClause))
  }

  private parseStatementAfterWithBody(withClause: A.WithClause): A.AST {
    this.expect('SELECT', 'UPDATE', 'INSERT', 'REPLACE', 'DELETE')
    if (this.peekKeyword('INSERT') || this.peekKeyword('REPLACE')) {
      return this.parseInsert(withClause)
    }
    if (this.peekKeyword('UPDATE')) return this.parseUpdate(withClause)
    if (this.peekKeyword('DELETE')) return this.parseDelete(withClause)
    return this.parseQuery(withClause)
  }

  parseWith(): A.WithClause {
    const withStart = this.i
    const keyword = this.requireKeyword('WITH')
    const recursive = this.acceptKeyword('RECURSIVE')
    const cteList: A.CteNode[] = []
    do {
      const cteStart = this.i
      const name = this.requireName()
      const args: string[] = []
      if (this.acceptPunct('(')) {
        do {
          args.push(this.requireName())
        } while (this.acceptPunct(','))
        this.requirePunct(')')
      }
      this.requireKeyword('AS')
      this.requirePunct('(')
      const query = this.parseStatementInParens()
      this.requirePunct(')')
      cteList.push({
        type: 'cte',
        name,
        arguments: args,
        query,
        location: this.loc(cteStart),
      })
    } while (this.acceptPunct(','))
    return {
      type: 'with',
      keyword,
      recursive,
      cteList,
      location: this.loc(withStart),
    }
  }

  /** A statement inside parentheses, e.g. a CTE body */
  private parseStatementInParens(): A.AST {
    const start = this.i
    return this.located(start, this.parseStatementInParensBody())
  }

  private parseStatementInParensBody(): A.AST {
    // DML is accepted in a CTE, but only queries are offered
    this.expect('SELECT', 'WITH')
    if (this.peekKeyword('WITH')) {
      return this.parseStatementAfterWith(this.parseWith())
    }
    if (this.peekKeyword('INSERT') || this.peekKeyword('REPLACE')) {
      return this.parseInsert(null)
    }
    if (this.peekKeyword('UPDATE')) return this.parseUpdate(null)
    if (this.peekKeyword('DELETE')) return this.parseDelete(null)
    return this.parseQuery(null)
  }

  // ---------------------------------------------------------------------------
  // SELECT

  /** SELECT with set operations (UNION / INTERSECT / EXCEPT) */
  parseQuery(withClause: A.WithClause | null): A.SelectStatement {
    const first = this.parseQueryTerm(withClause)
    let current = first
    for (;;) {
      this.expect('UNION')
      const op =
        this.acceptKeyword('UNION ALL', null) ??
        this.acceptKeyword('UNION', null) ??
        this.acceptKeyword('INTERSECT', null) ??
        this.acceptKeyword('EXCEPT', null)
      if (!op) break
      const next = this.parseQueryTerm(null)
      current.set_op = op
      current._next = next
      current = next
    }
    return first
  }

  /** A SELECT, or a query in parentheses */
  private parseQueryTerm(withClause: A.WithClause | null): A.SelectStatement {
    if (this.acceptPunct('(')) {
      const query = this.parseQuery(
        this.peekKeyword('WITH') ? this.parseWith() : null
      )
      this.requirePunct(')')
      query.paren = true
      return query
    }
    return this.parseSelect(withClause)
  }

  parseSelect(withClause: A.WithClause | null): A.SelectStatement {
    const start = this.i
    const keyword = this.requireKeyword('SELECT')
    const distinct = this.acceptOneOf(['DISTINCT', 'ALL'])
    const columns = this.parseSelectColumns()
    const from = this.parseFrom()
    const where = this.parseWhere()
    const groupby = this.parseGroupBy()
    const orderby = this.parseOrderBy()
    const limit = this.parseLimit()
    return {
      type: 'select',
      keyword,
      with: withClause,
      distinct,
      columns,
      from,
      where,
      groupby,
      orderby,
      limit,
      location: this.loc(start),
    }
  }

  private parseSelectColumns(): A.ColumnListItemNode[] | A.StarNode {
    this.expect('*')
    if (this.acceptPunct('*', false)) {
      return { type: 'star', value: '*', location: this.loc(this.i - 1) }
    }
    const columns: A.ColumnListItemNode[] = []
    do {
      columns.push(this.parseColumnListItem())
    } while (this.acceptPunct(','))
    return columns
  }

  private parseColumnListItem(): A.ColumnListItemNode {
    const start = this.i
    const expr = this.parseExpression(0, {
      reportOperators: false,
      reportPrefix: false,
    })
    const alias = this.parseAlias()
    const location = this.loc(start)
    if (alias === null) {
      // Compatibility: without an alias the item includes trailing whitespace
      location.end = this.position(this.peek().start)
    }
    return { type: 'column_list_item', expr, as: alias, location }
  }

  /** `[AS] alias` */
  parseAlias(): string | null {
    if (this.acceptKeyword('AS')) return this.requireName(true)
    const part = this.acceptIdentifierPart()
    return part ? unquote(part.text) : null
  }

  private parseFrom(): A.FromClause | null {
    const start = this.i
    const keyword = this.acceptKeyword('FROM')
    if (!keyword) return null
    const tables = this.parseTableList()
    return { type: 'from', keyword, tables, location: this.loc(start) }
  }

  /** Table references separated by commas and joins */
  parseTableList(): A.FromTableNode[] {
    const tables: A.FromTableNode[] = [this.parseTableReference()]
    for (;;) {
      if (this.acceptPunct(',')) {
        tables.push(this.parseTableReference())
        continue
      }
      if (this.joinConditionBroken) break
      const join = this.acceptJoin()
      if (!join) break
      const table = this.parseTableReference()
      table.join = join
      if (table.type !== 'incomplete_subquery') {
        table.on = null
        if (this.acceptKeyword('ON')) {
          table.on = this.parseJoinCondition()
        } else if (this.acceptKeyword('USING', null)) {
          const listStart = this.i
          this.requirePunct('(')
          const columns: A.ColumnRefNode[] = []
          do {
            const s = this.i
            const name = this.requireName()
            columns.push({
              type: 'column_ref',
              table: '',
              column: name,
              location: this.loc(s),
            })
          } while (this.acceptPunct(','))
          this.requirePunct(')')
          table.on = {
            type: 'expr_list',
            value: columns,
            location: this.loc(listStart),
          }
        }
      }
      tables.push(table)
    }
    return tables
  }

  /** The ON condition; in parseFromClause mode a broken condition is skipped */
  private parseJoinCondition(): A.ExpressionNode | null {
    if (!this.options.recoverFromSubquery) return this.parseExpression()
    const saved = {
      i: this.i,
      furthest: this.furthest,
      expected: this.expected,
    }
    try {
      return this.parseExpression()
    } catch (e) {
      if (!(e instanceof ParseFailure)) throw e
      Object.assign(this, saved)
      this.emptyExpectedAt = null
      this.unterminatedAt = null
      this.joinConditionBroken = true
      return null
    }
  }

  /** Set in parseFromClause mode when an ON condition could not be parsed */
  joinConditionBroken = false

  /** Returns the normalized join type, e.g. `LEFT JOIN` */
  private acceptJoin(): string | null {
    this.expect('INNER', 'JOIN', 'LEFT')
    const variants: [string, string][] = [
      ['JOIN', 'INNER JOIN'],
      ['INNER JOIN', 'INNER JOIN'],
      ['LEFT OUTER JOIN', 'LEFT JOIN'],
      ['LEFT JOIN', 'LEFT JOIN'],
      ['RIGHT OUTER JOIN', 'RIGHT JOIN'],
      ['RIGHT JOIN', 'RIGHT JOIN'],
      ['FULL OUTER JOIN', 'FULL JOIN'],
      ['FULL JOIN', 'FULL JOIN'],
      ['CROSS JOIN', 'CROSS JOIN'],
      ['NATURAL JOIN', 'NATURAL JOIN'],
    ]
    for (const [words, normalized] of variants) {
      if (this.acceptKeyword(words, null)) return normalized
    }
    return null
  }

  parseTableReference(): A.FromTableNode {
    const start = this.i
    // Compatibility: the previous parser offered WITH / SELECT here
    this.expect('WITH', 'SELECT', '(')
    if (this.isPunct(this.peek(), '(')) {
      return this.parseSubqueryReference(start)
    }
    this.expect('$')
    const parts = [this.requireName()]
    for (;;) {
      this.expect('.')
      if (!this.isPunct(this.peek(), '.')) break
      const dot = this.i
      this.i++
      this.expect('$')
      const part = this.acceptIdentifierPart(true)
      if (!part) {
        if (this.options.recoverFromSubquery) {
          this.i = dot
          break
        }
        this.fail()
      }
      parts.push(unquote(part.text))
    }
    const [catalog, db, table] = ['', '', ...parts].slice(-3)
    const as = this.parseAlias()
    return { type: 'table', catalog, db, table, as, location: this.loc(start) }
  }

  private parseSubqueryReference(start: number): A.FromTableNode {
    if (!this.options.recoverFromSubquery) {
      this.requirePunct('(')
      this.fromSubqueryDepth++
      const subquery = this.parseQuery(
        this.peekKeyword('WITH') ? this.parseWith() : null
      )
      this.fromSubqueryDepth--
      this.requirePunct(')')
      const as = this.parseAlias()
      return { type: 'subquery', subquery, as, location: this.loc(start) }
    }
    // Find the matching parenthesis first so that a broken subquery can be
    // skipped as a whole
    const close = this.findClosingParen(start)
    const saved = {
      i: this.i,
      furthest: this.furthest,
      expected: this.expected,
    }
    const depth = this.fromSubqueryDepth
    try {
      this.requirePunct('(')
      this.fromSubqueryDepth++
      const subquery = this.parseQuery(
        this.peekKeyword('WITH') ? this.parseWith() : null
      )
      this.fromSubqueryDepth--
      this.requirePunct(')')
      const as = this.parseAlias()
      return { type: 'subquery', subquery, as, location: this.loc(start) }
    } catch (e) {
      if (!(e instanceof ParseFailure)) throw e
      this.fromSubqueryDepth = depth
      Object.assign(this, saved)
      this.emptyExpectedAt = null
      this.columnNameAt = null
      this.unterminatedAt = null
      this.i = close === null ? this.tokens.length - 1 : close + 1
      const text =
        close === null
          ? this.sql.slice(this.tokens[start].start)
          : this.text(start, close)
      const as = close === null ? null : this.parseAlias()
      return {
        type: 'incomplete_subquery',
        text,
        as,
        location:
          close === null
            ? this.range(this.tokens[start].start, this.sql.length)
            : this.loc(start),
      }
    }
  }

  /** Index of the `)` matching the `(` at `open`, or null */
  findClosingParen(open: number): number | null {
    let depth = 0
    for (let n = open; n < this.tokens.length; n++) {
      const t = this.tokens[n]
      if (this.isPunct(t, '(')) depth++
      else if (this.isPunct(t, ')')) {
        depth--
        if (depth === 0) return n
      }
    }
    return null
  }

  private parseWhere(): A.WhereClause | null {
    const start = this.i
    const keyword = this.acceptKeyword('WHERE')
    if (!keyword) return null
    const expression = this.parseExpression()
    return { type: 'where', keyword, expression, location: this.loc(start) }
  }

  private parseGroupBy(): A.ExpressionNode[] | null {
    if (!this.acceptKeyword('GROUP BY', 'GROUP')) return null
    const item = () =>
      this.parseExpression(0, { reportOperators: false, reportCall: false })
    const list = [item()]
    while (this.acceptPunct(',')) list.push(item())
    if (this.acceptKeyword('HAVING', null)) {
      // HAVING is kept on the last group by expression list for now
      list.push(this.parseExpression())
    }
    return list
  }

  private parseOrderBy(): A.OrderByItemNode[] | null {
    if (!this.acceptKeyword('ORDER BY', 'ORDER')) return null
    const items: A.OrderByItemNode[] = []
    do {
      const start = this.i
      const expr = this.parseExpression(0, { reportOperators: false })
      const order = this.acceptOneOf(['ASC', 'DESC'], false)
      if (!this.acceptKeyword('NULLS FIRST', null)) {
        this.acceptKeyword('NULLS LAST', null)
      }
      items.push({
        type: 'order_by_item',
        expr,
        order,
        location: this.loc(start),
      })
    } while (this.acceptPunct(',', false))
    return items
  }

  private parseLimit(): A.LimitClause | null {
    const start = this.i
    const keyword = this.acceptKeyword('LIMIT')
    if (!keyword) return null
    let value = this.parseExpression()
    let offset: A.ExpressionNode | null = null
    if (this.acceptPunct(',', false)) {
      // MySQL: LIMIT offset, count
      offset = value
      value = this.parseExpression()
    } else if (this.acceptKeyword('OFFSET', null)) {
      offset = this.parseExpression()
    }
    return { type: 'limit', keyword, value, offset, location: this.loc(start) }
  }

  // ---------------------------------------------------------------------------
  // Expressions (Pratt parser)

  /** Binding power of the infix operator at the current position */
  private infixPower(): { op: string; words: number; power: number } | null {
    const t = this.peek()
    if (t.kind === 'operator') {
      const powers: Record<string, number> = {
        '=': 4,
        '==': 4,
        '!=': 4,
        '<>': 4,
        '<': 4,
        '<=': 4,
        '>': 4,
        '>=': 4,
        '||': 5,
        '+': 6,
        '-': 6,
        '*': 7,
        '/': 7,
        '%': 7,
        '->': 8,
        '->>': 8,
      }
      const power = powers[t.text]
      return power === undefined ? null : { op: t.text, words: 1, power }
    }
    if (t.kind !== 'word') return null
    const multi: [string, number][] = [
      ['IS NOT', 4],
      ['NOT IN', 4],
      ['NOT LIKE', 4],
      ['NOT ILIKE', 4],
      ['NOT BETWEEN', 4],
    ]
    for (const [words, power] of multi) {
      if (this.peekKeyword(words)) {
        return { op: words, words: 2, power }
      }
    }
    const single: Record<string, number> = {
      OR: 1,
      AND: 2,
      IS: 4,
      IN: 4,
      LIKE: 4,
      ILIKE: 4,
      BETWEEN: 4,
      CONTAINS: 4,
      REGEXP: 4,
    }
    const power = single[t.text.toUpperCase()]
    return power === undefined
      ? null
      : { op: t.text.toUpperCase(), words: 1, power }
  }

  parseExpression(minPower = 0, options: ExprOptions = {}): A.ExpressionNode {
    const reportOperators = options.reportOperators ?? true
    const start = this.i
    let left = this.parsePrefix(options.reportPrefix ?? true)
    const singleWord =
      this.i === start + 1 &&
      this.tokens[start].kind === 'word' &&
      left.type === 'column_ref'
    for (;;) {
      if (reportOperators) {
        const afterComparison =
          options.afterComparison ||
          (left.type === 'binary_expr' &&
            COMPARISON_OPERATORS.has(left.operator.toUpperCase()))
        this.expect(...(afterComparison ? AFTER_COMPARISON : AFTER_OPERAND))
      }
      if (singleWord && this.i === start + 1) {
        this.expect(...((options.reportCall ?? true) ? ['(', '.'] : ['.']))
      }
      // postfix cast: expr::type
      if (this.isPunct(this.peek(), '::')) {
        this.i++
        this.parseDataTypeText()
        continue
      }
      const infix = this.infixPower()
      if (!infix || infix.power <= minPower) break
      const opStart = this.i
      this.i += infix.words
      const operator =
        infix.words === 1 && this.tokens[opStart].kind === 'operator'
          ? infix.op
          : this.text(opStart, this.i - 1)
      const upper = infix.op
      let right: A.ExpressionNode
      if (upper === 'IN' || upper === 'NOT IN') {
        right = this.parseInList()
      } else if (upper === 'BETWEEN' || upper === 'NOT BETWEEN') {
        const lowStart = this.i
        const low = this.parseExpression(infix.power, options)
        this.requireKeyword('AND')
        const high = this.parseExpression(infix.power, options)
        right = {
          type: 'expr_list',
          value: [low, high],
          location: this.loc(lowStart),
        }
      } else {
        const comparison = COMPARISON_OPERATORS.has(upper)
        right = this.parseExpression(infix.power, {
          ...options,
          afterComparison: comparison,
          reportPrefix: comparison ? false : options.reportPrefix,
        })
      }
      left = {
        type: 'binary_expr',
        operator,
        left,
        right,
        location: this.loc(start),
      }
    }
    return left
  }

  private parseInList(): A.ExprListNode {
    const start = this.i
    this.requirePunct('(')
    const value: A.ExpressionNode[] = []
    if (this.peekKeyword('SELECT') || this.peekKeyword('WITH')) {
      value.push(
        this.parseQuery(this.peekKeyword('WITH') ? this.parseWith() : null)
      )
    } else if (!this.isPunct(this.peek(), ')')) {
      do {
        value.push(this.parseExpression())
      } while (this.acceptPunct(','))
    }
    this.requirePunct(')')
    return { type: 'expr_list', value, location: this.loc(start) }
  }

  private parsePrefix(reportPrefix = true): A.ExpressionNode {
    const start = this.i
    if (reportPrefix) this.expect(...EXPR_PREFIX)
    const t = this.peek()
    if (this.acceptKeyword('NOT', null)) {
      const expr = this.parseExpression(3)
      return {
        type: 'unary_expr',
        operator: t.text,
        expr,
        location: this.loc(start),
      }
    }
    if (this.isPunct(t, '-') || this.isPunct(t, '+') || this.isPunct(t, '~')) {
      this.i++
      const expr = this.parseExpression(8)
      return {
        type: 'unary_expr',
        operator: t.text,
        expr,
        location: this.loc(start),
      }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): A.ExpressionNode {
    this.expect(...EXPR_START)
    const start = this.i
    const t = this.peek()
    switch (t.kind) {
      case 'number':
        this.i++
        return {
          type: 'number',
          value: Number(t.text),
          location: this.loc(start),
        }
      case 'string':
        if (t.unterminated) this.unterminated(t)
        this.i++
        return {
          type: 'string',
          value: unescapeString(t.text),
          location: this.loc(start),
        }
      case 'pg_promise_var': {
        if (t.unterminated) this.fail()
        this.i++
        const [name, ...members] = t.text.slice(2, -1).trim().split('.')
        return {
          type: 'var_pg_promise',
          name,
          members,
          location: this.loc(start),
        }
      }
      case 'param':
        this.i++
        return { type: 'param', value: t.text, location: this.loc(start) }
      case 'punct':
        if (t.text === '(') return this.parseParenthesized()
        break
      case 'quoted_ident':
        if (t.unterminated) this.unterminated(t)
        if (t.text[0] === '"' && !this.isPunct(this.peek(1), '.')) {
          // MySQL treats "text" as a string literal
          this.i++
          return {
            type: 'string',
            value: unquote(t.text),
            location: this.loc(start),
          }
        }
        return this.parseColumnRef()
      case 'word':
        return this.parseWordExpression()
    }
    this.fail()
  }

  private parseParenthesized(): A.ExpressionNode {
    const open = this.i
    this.requirePunct('(', false)
    if (this.peekKeyword('SELECT') || this.peekKeyword('WITH')) {
      const query = this.parseQuery(
        this.peekKeyword('WITH') ? this.parseWith() : null
      )
      this.requirePunct(')')
      query.paren = true
      return query
    }
    const first = this.parseExpression()
    if (this.acceptPunct(')')) return first
    const value = [first]
    while (this.acceptPunct(',', false)) value.push(this.parseExpression())
    this.requirePunct(')')
    return { type: 'expr_list', value, location: this.loc(open) }
  }

  private parseWordExpression(): A.ExpressionNode {
    const start = this.i
    const t = this.peek()
    const upper = t.text.toUpperCase()
    const followedByParen = this.isPunct(this.peek(1), '(')

    if (upper === 'TRUE' || upper === 'FALSE') {
      this.i++
      return {
        type: 'bool',
        value: upper === 'TRUE',
        location: this.loc(start),
      }
    }
    if (upper === 'NULL') {
      this.i++
      return { type: 'null', value: null, location: this.loc(start) }
    }
    if (upper === 'CASE') return this.parseCase()
    if (upper === 'CAST' && followedByParen) return this.parseCast()
    if (upper === 'EXISTS' && followedByParen) {
      this.i++
      const argsStart = this.i
      const expr = this.parseParenthesized()
      const args: A.ExprListNode = {
        type: 'expr_list',
        value: [expr],
        location: this.loc(argsStart),
      }
      return { type: 'function', name: t.text, args, location: this.loc(start) }
    }
    if (SPECIAL_SYSTEM_FUNCTIONS.has(upper) && !followedByParen) {
      this.i++
      return {
        type: 'special_system_function',
        name: t.text,
        location: this.loc(start),
      }
    }
    if (followedByParen && !RESERVED.has(upper)) {
      return this.parseFunctionCall()
    }
    return this.parseColumnRef()
  }

  private parseFunctionCall(): A.ExpressionNode {
    const start = this.i
    const name = this.tokens[this.i++].text
    const argsStart = this.i
    this.requirePunct('(', false)
    if (AGGREGATE_FUNCTIONS.has(name.toUpperCase())) {
      const distinct = this.acceptKeyword('DISTINCT', null)
      let expr: A.ExpressionNode | A.StarNode
      if (this.acceptPunct('*', false)) {
        expr = { type: 'star', value: '*', location: this.loc(this.i - 1) }
      } else {
        expr = this.parseExpression()
      }
      this.requirePunct(')')
      return {
        type: 'aggr_func',
        name: name.toUpperCase(),
        args: { expr, distinct },
        location: this.loc(start),
      }
    }
    const value: A.ExpressionNode[] = []
    if (!this.acceptPunct(')', false)) {
      do {
        if (this.acceptPunct('*', false))
          value.push({
            type: 'star',
            value: '*',
            location: this.loc(this.i - 1),
          })
        else value.push(this.parseExpression())
      } while (this.acceptPunct(','))
      this.requirePunct(')')
    }
    const args: A.ExprListNode = {
      type: 'expr_list',
      value,
      location: this.loc(argsStart),
    }
    return { type: 'function', name, args, location: this.loc(start) }
  }

  private parseCast(): A.CastFunctionNode {
    const start = this.i
    const keyword = this.requireKeyword('CAST', null)
    this.requirePunct('(', false)
    const expr = this.parseExpression()
    this.requireKeyword('AS')
    const datatype = this.parseDataTypeText()
    this.requirePunct(')')
    return {
      type: 'cast_function',
      keyword,
      datatype,
      expr,
      location: this.loc(start),
    }
  }

  /** A data type such as `int`, `varchar(255)` or `double precision`, as text */
  parseDataTypeText(): string {
    const start = this.i
    this.requireIdentifierPart(true)
    while (this.peekKeyword('PRECISION') || this.peekKeyword('VARYING'))
      this.i++
    if (this.acceptPunct('(', false)) {
      while (!this.atEnd && !this.isPunct(this.peek(), ')')) this.i++
      this.requirePunct(')')
    }
    while (this.acceptPunct('[', false)) this.requirePunct(']')
    return this.text(start)
  }

  private parseCase(): A.CaseExpressionNode {
    const start = this.i
    const keyword = this.requireKeyword('CASE', null)
    const expr = this.peekKeyword('WHEN') ? null : this.parseExpression()
    const whens: A.CaseExpressionNode['whens'] = []
    while (this.acceptKeyword('WHEN')) {
      const when = this.parseExpression()
      this.requireKeyword('THEN')
      whens.push({ when, then: this.parseExpression() })
    }
    const elseExpr = this.acceptKeyword('ELSE') ? this.parseExpression() : null
    this.requireKeyword('END')
    return {
      type: 'case',
      keyword,
      expr,
      whens,
      else: elseExpr,
      location: this.loc(start),
    }
  }

  /**
   * `col`, `t.col`, `db.t.col`, `t.col[0]`, `t."col"`, `t.*`.
   * `table` is the first part (quotes removed) and `column` is the rest as
   * written, except that double quotes are removed.
   */
  parseColumnRef(): A.ColumnRefNode {
    const start = this.i
    const parts: string[] = []
    const first = this.requireIdentifierPart()
    parts.push(first.text + this.parseSubscripts())
    while (this.acceptPunct('.', false)) {
      if (this.acceptPunct('*', false)) {
        parts.push('*')
        break
      }
      const next = this.peek()
      // Compatibility with the previous parser: these report no expectations
      if (parts.length >= 2 && next.kind === 'eof')
        this.failWithoutExpectations(next.start)
      if (next.kind === 'word' && RESERVED.has(next.text.toUpperCase())) {
        this.failWithoutExpectations(next.end)
      }
      if (this.fromSubqueryDepth > 0) this.expect(')')
      const part = this.requireIdentifierPart(true)
      parts.push(part.text + this.parseSubscripts())
    }
    const location = this.loc(start)
    if (parts.length === 1) {
      return {
        type: 'column_ref',
        table: '',
        column: stripDoubleQuotes(parts[0]),
        location,
      }
    }
    return {
      type: 'column_ref',
      table: unquote(parts[0]),
      column: parts.slice(1).map(stripDoubleQuotes).join('.'),
      location,
    }
  }

  private failWithoutExpectations(offset: number): never {
    this.emptyExpectedAt = offset
    this.fail()
  }

  /** `[0]`, `['key']` right after an identifier, as text */
  private parseSubscripts(): string {
    let text = ''
    while (
      this.isPunct(this.peek(), '[') &&
      this.peek().start === this.tokens[this.i - 1].end
    ) {
      const open = this.i
      this.i++
      while (!this.atEnd && !this.isPunct(this.peek(), ']')) this.i++
      this.requirePunct(']', false)
      text += this.text(open)
    }
    return text
  }

  // ---------------------------------------------------------------------------
  // INSERT / UPDATE / DELETE

  parseInsert(withClause: A.WithClause | null): A.InsertStatement {
    const start = this.i
    this.expect('INSERT', 'REPLACE')
    if (!this.acceptKeyword('INSERT', null))
      this.requireKeyword('REPLACE', null)
    this.acceptOneOf(['IGNORE'], false)
    this.requireKeyword('INTO')
    const parts = this.requireQualifiedName(false, true)
    const table = parts[parts.length - 1]
    const db = parts.length > 1 ? parts[parts.length - 2] : ''
    const columns: string[] = []
    this.expect('(', 'SET')
    let hasColumnList = false
    if (this.acceptPunct('(', false)) {
      hasColumnList = true
      do {
        columns.push(this.requireColumnName(true))
      } while (this.acceptPunct(','))
      this.requirePunct(')')
    }
    const valuesStart = this.i
    if (this.acceptKeyword('SET', null)) {
      const values: A.ExpressionNode[] = []
      do {
        columns.push(this.requireColumnName())
        this.requirePunct('=')
        values.push(this.parseExpression())
      } while (this.acceptPunct(','))
      return {
        type: 'insert',
        with: withClause,
        db,
        table,
        columns,
        values: { type: 'values', values, location: this.loc(valuesStart) },
        location: this.loc(start),
      }
    }
    if (
      this.peekKeyword('SELECT') ||
      this.peekKeyword('WITH') ||
      this.isPunct(this.peek(), '(')
    ) {
      const select = this.parseQuery(
        this.peekKeyword('WITH') ? this.parseWith() : null
      )
      return {
        type: 'insert',
        with: withClause,
        db,
        table,
        columns,
        values: null,
        select,
        location: this.loc(start),
      }
    }
    if (this.requireKeyword('VALUES', hasColumnList ? 'VALUES' : null)) {
      const rows: A.ExpressionNode[][] = []
      do {
        this.requirePunct('(')
        const row: A.ExpressionNode[] = []
        if (!this.isPunct(this.peek(), ')')) {
          do {
            row.push(this.parseExpression())
          } while (this.acceptPunct(','))
        }
        this.requirePunct(')')
        rows.push(row)
      } while (this.acceptPunct(','))
      const values: A.ValuesClause = {
        type: 'values',
        values: rows[0],
        location: this.loc(valuesStart),
      }
      if (rows.length > 1) values.more_rows = rows.slice(1)
      return {
        type: 'insert',
        with: withClause,
        db,
        table,
        columns,
        values,
        location: this.loc(start),
      }
    }
    this.fail()
  }

  /** A column name; reports EXPECTED COLUMN NAME when it is the last token */
  private requireColumnName(locateAtEnd = false): string {
    const index = this.i
    if (this.atEnd && index > 0 && this.isPunct(this.tokens[index - 1], ',')) {
      this.columnNameAt = index
      this.columnNameAtEnd = false
      throw new ParseFailure('expected_column_name')
    }
    const name = this.requireName(true)
    if (this.atEnd) {
      this.columnNameAt = index
      this.columnNameAtEnd = locateAtEnd
      throw new ParseFailure('expected_column_name')
    }
    return name
  }

  parseUpdate(withClause: A.WithClause | null): A.UpdateStatement {
    const statementStart = this.i
    this.requireKeyword('UPDATE', null)
    const parts = this.requireQualifiedName()
    const table = parts[parts.length - 1]
    const db = parts.length > 1 ? parts[parts.length - 2] : ''
    this.acceptAliasBeforeSet()
    this.expect(',', '.')
    const join: A.FromTableNode[] = []
    for (;;) {
      const type = this.acceptJoin()
      if (!type) break
      const t = this.parseTableReference()
      t.join = type
      t.on = null
      this.expect(',')
      if (this.acceptKeyword('ON')) t.on = this.parseExpression()
      join.push(t)
    }
    this.requireKeyword('SET')
    const set: A.SetItemNode[] = []
    do {
      const columnIndex = this.i
      const column = this.requireSetColumn()
      this.requirePunct('=')
      if (this.atEnd) {
        // Compatibility: the previous parser offered columns here
        this.columnNameAt = columnIndex
        throw new ParseFailure('expected_column_name')
      }
      set.push({ column, value: this.parseExpression() })
    } while (this.acceptPunct(','))
    const where = this.parseWhere()
    return join.length > 0
      ? {
          type: 'update',
          with: withClause,
          db,
          table,
          join,
          set,
          where,
          location: this.loc(statementStart),
        }
      : {
          type: 'update',
          with: withClause,
          db,
          table,
          set,
          where,
          location: this.loc(statementStart),
        }
  }

  private acceptAliasBeforeSet() {
    if (this.acceptKeyword('AS', null)) {
      this.requireName(true)
      return
    }
    const t = this.peek()
    const next = this.peek(1)
    const followedByClause =
      next.kind === 'word' &&
      ['SET', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'CROSS', 'FULL'].includes(
        next.text.toUpperCase()
      )
    if (
      t.kind === 'word' &&
      !RESERVED.has(t.text.toUpperCase()) &&
      followedByClause
    )
      this.i++
  }

  /** `col` or `t.col` in UPDATE ... SET */
  private requireSetColumn(): string {
    const index = this.i
    const parts = this.requireQualifiedName(true)
    if (this.atEnd) {
      this.columnNameAt = index
      throw new ParseFailure('expected_column_name')
    }
    return parts.join('.')
  }

  parseDelete(withClause: A.WithClause | null): A.DeleteStatement {
    const statementStart = this.i
    this.requireKeyword('DELETE', null)
    this.requireKeyword('FROM')
    const start = this.i
    const parts = this.requireQualifiedName()
    const table: A.DmlTableNode = {
      type: 'table',
      db: parts.length > 1 ? parts[parts.length - 2] : '',
      table: parts[parts.length - 1],
      location: this.loc(start),
    }
    // Only `AS alias`: a bare word is more likely WHERE being typed
    if (this.acceptKeyword('AS', null)) this.requireName(true)
    const where = this.parseWhere()
    return {
      type: 'delete',
      with: withClause,
      table,
      where,
      location: this.loc(statementStart),
    }
  }

  // ---------------------------------------------------------------------------
  // DDL

  private parseCreate(): A.AST {
    const start = this.i
    this.expect('CREATE', 'CREATE TABLE')
    if (
      this.peekKeyword('CREATE TABLE') ||
      this.peekKeyword('CREATE TEMPORARY TABLE')
    ) {
      return this.parseCreateTable()
    }
    const create = this.requireKeyword('CREATE', null)
    this.expect('INDEX', 'UNIQUE', 'TYPE', 'TABLE')
    if (this.peekKeyword('INDEX') || this.peekKeyword('UNIQUE INDEX')) {
      return this.parseCreateIndex(create, start)
    }
    if (this.peekKeyword('TYPE')) return this.parseCreateType(create, start)
    this.fail()
  }

  private parseCreateTable(): A.CreateTableStatement {
    const start = this.i
    const keyword =
      this.acceptKeyword('CREATE TABLE', 'CREATE TABLE') ??
      this.requireKeyword('CREATE TEMPORARY TABLE', null)
    const ifNotExists = this.acceptKeyword('IF NOT EXISTS')
    this.requireQualifiedName()
    const columnDefinitions: A.CreateTableStatement['column_definitions'] = []
    let select: A.SelectStatement | null = null
    if (this.acceptKeyword('AS')) {
      select = this.parseQuery(
        this.peekKeyword('WITH') ? this.parseWith() : null
      )
    } else {
      this.requirePunct('(')
      do {
        columnDefinitions.push(this.parseColumnDefinition())
      } while (this.acceptPunct(','))
      this.requirePunct(')')
      while (!this.atEnd && !this.isPunct(this.peek(), ';')) this.i++ // table options
    }
    return {
      type: 'create_table',
      keyword,
      if_not_exists: ifNotExists,
      column_definitions: columnDefinitions,
      select,
      location: this.loc(start),
    }
  }

  private parseColumnDefinition():
    A.FieldNode | A.ForeignKeyNode | A.PrimaryKeyNode {
    const start = this.i
    if (this.acceptKeyword('CONSTRAINT', null)) this.requireName()
    this.expect('FOREIGN KEY', 'PRIMARY KEY')
    const foreign = this.acceptKeyword('FOREIGN KEY', null)
    if (foreign) {
      const columns = this.parseNameList()
      const references = this.requireKeyword('REFERENCES')
      const referencesTable = this.requireQualifiedName().join('.')
      const referencesColumns = this.isPunct(this.peek(), '(')
        ? this.parseNameList()
        : []
      const on = this.parseForeignKeyOn()
      return {
        type: 'foreign_key',
        foreign_keyword: foreign,
        columns,
        references_keyword: references,
        references_table: referencesTable,
        references_columns: referencesColumns,
        on,
        location: this.loc(start),
      }
    }
    const primary = this.acceptKeyword('PRIMARY KEY', null)
    if (primary) {
      const columns = this.parseNameList()
      return {
        type: 'primary_key',
        keyword: primary,
        columns,
        location: this.loc(start),
      }
    }
    return this.parseField(start, false)
  }

  private parseForeignKeyOn(): A.ForeignKeyOnNode | null {
    const start = this.i
    const onKeyword = this.acceptKeyword('ON')
    if (!onKeyword) return null
    const trigger = this.acceptOneOf(['DELETE', 'UPDATE']) ?? this.fail()
    const action =
      this.acceptOneOf([
        'CASCADE',
        'SET NULL',
        'SET DEFAULT',
        'RESTRICT',
        'NO ACTION',
      ]) ?? this.fail()
    return {
      type: 'foreign_key_on',
      on_keyword: onKeyword,
      trigger,
      action,
      location: this.loc(start),
    }
  }

  private parseNameList(): string[] {
    this.requirePunct('(')
    const names: string[] = []
    do {
      names.push(this.requireName(true))
    } while (this.acceptPunct(','))
    this.requirePunct(')')
    return names
  }

  /** `name data_type constraints...` */
  private parseField(start = this.i, reportColumnName: boolean): A.FieldNode {
    const nameIndex = this.i
    const name = this.requireName(true)
    if (reportColumnName && this.atEnd) {
      this.columnNameAt = nameIndex
      throw new ParseFailure('expected_column_name')
    }
    const dataType = this.parseFieldDataType()
    const constraints: A.FieldConstraint[] = []
    for (;;) {
      this.expect(
        'NOT NULL',
        'PRIMARY KEY',
        'UNIQUE',
        'AUTO_INCREMENT',
        'GENERATED',
        'DEFAULT'
      )
      const s = this.i
      const simple: [string, A.FieldConstraintNode['type']][] = [
        ['NOT NULL', 'constraint_not_null'],
        ['UNIQUE KEY', 'constraint_unique'],
        ['UNIQUE', 'constraint_unique'],
        ['PRIMARY KEY', 'constraint_primary_key'],
        ['AUTO_INCREMENT', 'constraint_auto_increment'],
        ['AUTOINCREMENT', 'constraint_auto_increment'],
      ]
      const found = simple.find(([words]) => this.peekKeyword(words))
      if (found) {
        const keyword = this.requireKeyword(found[0], null)
        constraints.push({ type: found[1], keyword, location: this.loc(s) })
        continue
      }
      const defaultKeyword = this.acceptKeyword('DEFAULT', null)
      if (defaultKeyword) {
        this.expect(...SPECIAL_SYSTEM_FUNCTIONS)
        const value = this.parseExpression(3)
        constraints.push({
          type: 'constraint_default',
          keyword: defaultKeyword,
          value,
          location: this.loc(s),
        })
        continue
      }
      if (this.acceptKeyword('NULL', null)) continue
      if (this.acceptKeyword('GENERATED', null)) {
        // GENERATED ALWAYS AS (expr) [STORED | VIRTUAL] / GENERATED ... AS IDENTITY
        while (
          !this.atEnd &&
          !this.isPunct(this.peek(), ',') &&
          !this.isPunct(this.peek(), ')')
        ) {
          if (this.isPunct(this.peek(), '(')) {
            const close = this.findClosingParen(this.i)
            if (close === null) this.fail()
            this.i = close + 1
          } else this.i++
        }
        continue
      }
      if (this.acceptKeyword('COMMENT', null)) {
        this.parsePrimary()
        continue
      }
      if (this.acceptKeyword('REFERENCES', null)) {
        this.requireQualifiedName()
        if (this.isPunct(this.peek(), '(')) this.parseNameList()
        this.parseForeignKeyOn()
        continue
      }
      break
    }
    return {
      type: 'field',
      name,
      data_type: dataType,
      constraints,
      location: this.loc(start),
    }
  }

  private parseFieldDataType(): A.FieldDataTypeNode {
    const start = this.i
    const name = this.requireIdentifierPart(true).text
    const args: string[] = []
    if (this.acceptPunct('(')) {
      do {
        const t = this.peek()
        if (t.kind !== 'number' && t.kind !== 'word' && t.kind !== 'string')
          this.fail()
        this.i++
        args.push(t.text)
      } while (this.acceptPunct(','))
      this.requirePunct(')')
    }
    this.acceptKeyword('UNSIGNED', null)
    return { type: 'field_data_type', name, args, location: this.loc(start) }
  }

  private parseCreateIndex(
    create: A.KeywordNode,
    start: number
  ): A.CreateIndexStatement {
    this.acceptKeyword('UNIQUE', null)
    const indexKeyword = this.requireKeyword('INDEX')
    const ifNotExistsKeyword = this.acceptKeyword('IF NOT EXISTS')
    const name = this.requireName()
    const onKeyword = this.requireKeyword('ON')
    const table = this.requireQualifiedName().join('.')
    const columns = this.parseNameList()
    return {
      type: 'create_index',
      create_keyword: create,
      index_keyword: indexKeyword,
      if_not_exists_keyword: ifNotExistsKeyword,
      if_not_exists: ifNotExistsKeyword !== null,
      name,
      on_keyword: onKeyword,
      table,
      columns,
      location: this.loc(start),
    }
  }

  private parseCreateType(
    create: A.KeywordNode,
    start: number
  ): A.CreateTypeStatement {
    const typeKeyword = this.requireKeyword('TYPE')
    const name = this.requireQualifiedName().join('.')
    const asKeyword = this.acceptKeyword('AS')
    if (!asKeyword) {
      const values = this.isPunct(this.peek(), '(')
        ? this.parseAssignValues()
        : []
      return {
        type: 'create_type',
        type_variant: 'base_type',
        create_keyword: create,
        type_keyword: typeKeyword,
        name,
        values,
        location: this.loc(start),
      }
    }
    const enumKeyword = this.acceptKeyword('ENUM')
    if (enumKeyword) {
      this.requirePunct('(')
      const values: A.LiteralStringNode[] = []
      if (!this.isPunct(this.peek(), ')')) {
        do {
          const s = this.i
          const t = this.peek()
          if (t.kind !== 'string') this.fail()
          this.i++
          values.push({
            type: 'string',
            value: unescapeString(t.text),
            location: this.loc(s),
          })
        } while (this.acceptPunct(','))
      }
      this.requirePunct(')')
      return {
        type: 'create_type',
        type_variant: 'enum_type',
        create_keyword: create,
        type_keyword: typeKeyword,
        name,
        as_keyword: asKeyword,
        enum_keyword: enumKeyword,
        values,
        location: this.loc(start),
      }
    }
    const rangeKeyword = this.acceptKeyword('RANGE')
    if (rangeKeyword) {
      const values = this.parseAssignValues()
      return {
        type: 'create_type',
        type_variant: 'range_type',
        create_keyword: create,
        type_keyword: typeKeyword,
        name,
        as_keyword: asKeyword,
        range_keyword: rangeKeyword,
        values,
        location: this.loc(start),
      }
    }
    this.requirePunct('(')
    const fields: A.CreateTypeCompositeFieldNode[] = []
    do {
      const s = this.i
      const fieldName = this.requireName(true)
      const dataType = this.parseFieldDataType()
      fields.push({
        type: 'composite_type_field',
        name: fieldName,
        data_type: dataType,
        location: this.loc(s),
      })
    } while (this.acceptPunct(','))
    this.requirePunct(')')
    return {
      type: 'create_type',
      type_variant: 'composite_type',
      create_keyword: create,
      type_keyword: typeKeyword,
      name,
      as_keyword: asKeyword,
      fields,
      location: this.loc(start),
    }
  }

  /** `(name = value, flag, ...)` */
  private parseAssignValues(): A.AssignValueExpressionNode[] {
    this.requirePunct('(')
    const values: A.AssignValueExpressionNode[] = []
    do {
      const s = this.i
      const name = this.requireName(true)
      let value: string | number | boolean = true
      if (this.acceptPunct('=')) {
        this.expect(...IDENT_START)
        const t = this.peek()
        this.i++
        if (t.kind === 'number') value = Number(t.text)
        else if (t.kind === 'string') value = unescapeString(t.text)
        else if (t.kind === 'word' || t.kind === 'quoted_ident')
          value = unquote(t.text)
        else this.fail()
        while (this.acceptPunct('.', false))
          value = `${value}.${this.requireName(true)}`
      }
      values.push({
        type: 'assign_value_expr',
        name,
        value,
        location: this.loc(s),
      })
    } while (this.acceptPunct(','))
    this.requirePunct(')')
    return values
  }

  private parseAlterTable(): A.AlterTableStatement {
    const statementStart = this.i
    const keyword = this.requireKeyword('ALTER TABLE', 'ALTER')
    const table = this.requireQualifiedName().join('.')
    this.expect('ADD', 'ALTER', 'DROP COLUMN', 'MODIFY')
    const start = this.i
    const drop = this.acceptKeyword('DROP COLUMN', 'DROP COLUMN')
    if (drop) {
      if (this.atEnd) {
        this.columnNameAt = this.i
        throw new ParseFailure('expected_column_name')
      }
      const s = this.i
      const value = this.requireName(true)
      const column: A.ColumnNode = {
        type: 'column',
        value,
        location: this.loc(s),
      }
      return {
        type: 'alter_table',
        keyword,
        table,
        command: {
          type: 'alter_table_drop_column',
          keyword: drop,
          column,
          location: this.loc(start),
        },
        location: this.loc(statementStart),
      }
    }
    const add =
      this.acceptKeyword('ADD COLUMN', null) ?? this.acceptKeyword('ADD', null)
    if (add) {
      const field = this.parseField(this.i, false)
      return {
        type: 'alter_table',
        keyword,
        table,
        command: {
          type: 'alter_table_add_column',
          keyword: add,
          field,
          location: this.loc(start),
        },
        location: this.loc(statementStart),
      }
    }
    const modify =
      this.acceptKeyword('MODIFY COLUMN', null) ??
      this.acceptKeyword('MODIFY', null) ??
      this.acceptKeyword('ALTER COLUMN', 'ALTER')
    if (modify) {
      if (this.atEnd) {
        this.columnNameAt = this.i
        throw new ParseFailure('expected_column_name')
      }
      const field = this.parseField(this.i, true)
      return {
        type: 'alter_table',
        keyword,
        table,
        command: {
          type: 'alter_table_modify_column',
          keyword: modify,
          field,
          location: this.loc(start),
        },
        location: this.loc(statementStart),
      }
    }
    this.fail()
  }

  private parseDrop(): A.AST {
    const statementStart = this.i
    this.expect('DROP', 'DROP TABLE', 'DROP VIEW')
    if (this.peekKeyword('DROP TABLE')) {
      const keyword = this.requireKeyword('DROP TABLE', null)
      const ifExists = this.acceptKeyword('IF EXISTS')
      const start = this.i
      const parts = this.requireQualifiedName()
      const table: A.DmlTableNode = {
        type: 'table',
        db: parts.length > 1 ? parts[parts.length - 2] : '',
        table: parts[parts.length - 1],
        location: this.loc(start),
      }
      return {
        type: 'drop_table',
        keyword,
        if_exists: ifExists,
        table,
        location: this.loc(statementStart),
      }
    }
    if (this.peekKeyword('DROP VIEW')) {
      const keyword = this.requireKeyword('DROP VIEW', null)
      const ifExists = this.acceptKeyword('IF EXISTS')
      const views: A.DropViewStatement['views'] = []
      do {
        const viewStart = this.i
        const value = this.requireQualifiedName().join('.')
        views.push({ type: 'view', value, location: this.loc(viewStart) })
      } while (this.acceptPunct(','))
      const dependencyAction = this.acceptOneOf(['CASCADE', 'RESTRICT'])
      return {
        type: 'drop_view',
        keyword,
        if_exists: ifExists,
        views,
        dependency_action: dependencyAction,
        location: this.loc(statementStart),
      }
    }
    const start = this.i
    const dropKeyword = this.requireKeyword('DROP', null)
    const typeKeyword = this.requireKeyword('TYPE')
    const ifExists = this.acceptKeyword('IF EXISTS')
    const names: string[] = []
    do {
      names.push(this.requireQualifiedName().join('.'))
    } while (this.acceptPunct(','))
    const dependencyAction = this.acceptOneOf(['CASCADE', 'RESTRICT'])
    return {
      type: 'drop_type',
      drop_keyword: dropKeyword,
      type_keyword: typeKeyword,
      names,
      if_exists: ifExists,
      dependency_action: dependencyAction,
      location: this.loc(start),
    }
  }
}

/** Removes surrounding quotes ("x" or `x`) */
export function unquote(text: string) {
  const q = text[0]
  if (
    (q === '"' || q === '`') &&
    text.length >= 2 &&
    text[text.length - 1] === q
  ) {
    return text
      .slice(1, -1)
      .split(q + q)
      .join(q)
  }
  return text
}

/** Removes double quotes only; backticks are kept as written */
function stripDoubleQuotes(text: string) {
  return text[0] === '"' ? unquote(text) : text
}

function unescapeString(text: string) {
  const body = text.slice(1, -1)
  return body.replace(/''|\\(.)/g, (m, c: string | undefined) => {
    if (m === "''") return "'"
    const map: Record<string, string> = {
      n: '\n',
      r: '\r',
      t: '\t',
      b: '\b',
      f: '\f',
      '0': '\0',
    }
    return map[c!] ?? c!
  })
}
