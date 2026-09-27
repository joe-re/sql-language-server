import type * as A from './ast'
import { isTrivia, Token, tokenize } from './lexer'
import { isRole, ParseFailure, Parser, ROLE, unquote } from './parser'

export type CompletionContext = {
  /** Cursor offset */
  offset: number
  /** The word being typed right before the cursor ('' when there is none) */
  word: string
  /** Offset where `word` starts */
  wordStart: number
  /** Qualifier written before the word, e.g. ['t'] for `t.co|` */
  qualifier: string[]
  /** Keywords and punctuation that may appear at the cursor, in order */
  keywords: string[]
  /** Kinds of names that may appear at the cursor */
  expects: {
    table: boolean
    /** An expression: columns, functions, aliases, ... */
    column: boolean
    /** Only a column name (e.g. INSERT column list, UPDATE SET, DROP COLUMN) */
    columnName: boolean
    alias: boolean
    /** A new name, e.g. a column being defined */
    newName: boolean
  }
  /** The significant token before the word, upper cased (e.g. IS) */
  previousToken: string
  /** The cursor is inside a comment or a string */
  inCommentOrString: boolean
  /** The SQL before the cursor has a syntax error, so the context is a guess */
  errorBeforeCursor: boolean
  /** Type of the statement at the cursor (select, insert, ...), if known */
  statementType: string | null
  /** Tables visible at the cursor: FROM / JOIN of the innermost query, or the target table */
  tables: A.FromTableNode[]
  /** Common table expressions of the statement */
  ctes: { name: string; columns: string[] }[]
}

const isName = (t: Token | undefined) =>
  !!t && (t.kind === 'word' || (t.kind === 'quoted_ident' && !t.unterminated))
const isPunct = (t: Token | undefined, text: string) =>
  !!t && (t.kind === 'punct' || t.kind === 'operator') && t.text === text
/** `t.` followed by this token without spaces: a part of a qualified name */
const isQualifiedPart = (tokens: Token[], token: Token) => {
  const prev = tokens[tokens.indexOf(token) - 1]
  return isPunct(prev, '.') && prev.end === token.start
}
const upper = (t: Token | undefined) =>
  t?.kind === 'word' ? t.text.toUpperCase() : ''

/**
 * Describes what can be completed at `offset`. Unlike parse(), it does not
 * need the SQL to be valid: it parses the statement up to the cursor and
 * reports what the parser tried at the cursor.
 */
export function getCompletionContext(
  sql: string,
  offset: number
): CompletionContext {
  const all = tokenize(sql)
  const significant = all.filter((t) => !isTrivia(t) && t.kind !== 'eof')

  const context: CompletionContext = {
    offset,
    word: '',
    wordStart: offset,
    qualifier: [],
    keywords: [],
    expects: {
      table: false,
      column: false,
      columnName: false,
      alias: false,
      newName: false,
    },
    previousToken: '',
    inCommentOrString: false,
    errorBeforeCursor: false,
    statementType: null,
    tables: [],
    ctes: [],
  }

  // Inside a comment or a string: nothing to complete
  const around = all.find((t) => t.start < offset && offset <= t.end)
  if (
    around &&
    (around.kind === 'line_comment' ||
      (around.kind === 'block_comment' &&
        (offset < around.end || around.unterminated)) ||
      (around.kind === 'string' &&
        (offset < around.end || around.unterminated)) ||
      (around.kind === 'quoted_ident' &&
        around.unterminated &&
        around.text[0] === '"' &&
        !isQualifiedPart(all, around) &&
        sql.slice(around.start, offset).includes('.')))
  ) {
    context.inCommentOrString = true
    return context
  }

  // The word being typed
  const wordToken = significant.find(
    (t) =>
      t.start < offset &&
      offset <= t.end &&
      (isName(t) ||
        (t.kind === 'quoted_ident' &&
          (t.text[0] === '`' ||
            isQualifiedPart(all, t) ||
            (t.unterminated && !sql.slice(t.start, offset).includes('.')))))
  )
  if (wordToken) {
    context.wordStart = wordToken.start
    context.word = sql.slice(wordToken.start, offset)
  }

  // Qualifier: `a.b.` right before the word
  const before = significant.filter((t) => t.end <= context.wordStart)
  context.previousToken = (before[before.length - 1]?.text ?? '').toUpperCase()
  for (
    let n = before.length - 1;
    n >= 1 &&
    isPunct(before[n], '.') &&
    before[n].end ===
      (n === before.length - 1 ? context.wordStart : before[n + 1].start);
  ) {
    // skip subscripts: `abc[0].`
    let m = n - 1
    while (isPunct(before[m], ']')) {
      while (m >= 0 && !isPunct(before[m], '[')) m--
      m--
    }
    if (m < 0 || !isName(before[m])) break
    context.qualifier.unshift(unquote(before[m].text))
    n = m - 1
  }

  // The statement containing the cursor
  const [statementStart, statementEnd] = statementRange(
    significant,
    offset,
    sql.length
  )
  const statementTokens = significant.filter(
    (t) => t.start >= statementStart && t.end <= statementEnd
  )
  context.statementType = statementType(statementTokens)

  // What the parser expects at the cursor
  const parser = new Parser(sql, {
    range: [statementStart, context.wordStart],
    forCompletion: true,
  })
  try {
    // At the start of a statement nothing has been tried yet
    if (parser.atEnd) parser.parseStatement()
    else parser.parseStatements()
  } catch (e) {
    if (!(e instanceof ParseFailure)) throw e
  }
  const cursorIndex = parser.tokens.length - 1
  context.errorBeforeCursor = parser.furthest < cursorIndex
  let labels = [...parser.expected]
  if (context.errorBeforeCursor) {
    // Something before the cursor is broken: parse again from the clause
    // that contains the cursor
    labels =
      parseClauseAtCursor(
        sql,
        significant,
        statementStart,
        context.wordStart
      ) ?? labels
  }
  context.keywords = labels.filter((l) => !isRole(l))
  context.expects = {
    table: labels.includes(ROLE.table),
    column: labels.includes(ROLE.column),
    columnName: labels.includes(ROLE.columnName),
    alias: labels.includes(ROLE.alias),
    newName: labels.includes(ROLE.newName),
  }

  // A word typed where an alias or a column may appear may also be the next
  // keyword, e.g. `SELECT a AS F|` or `SELECT F|` (FROM)
  if ((context.expects.alias || context.expects.column) && context.word) {
    const after = new Parser(sql, {
      range: [statementStart, offset],
      forCompletion: true,
    })
    try {
      after.parseStatements()
    } catch (e) {
      if (!(e instanceof ParseFailure)) throw e
    }
    if (after.furthest === after.tokens.length - 1) {
      for (const label of after.expected) {
        // After a column, only clause keywords (FROM, AS, ...) are useful
        const operator = context.expects.column && OPERATOR_WORDS.has(label)
        if (!isRole(label) && !operator && !context.keywords.includes(label)) {
          context.keywords.push(label)
        }
      }
    }
  }

  // Scope
  // Scope uses lenient quotes so that an unterminated quote before the cursor
  // does not hide the rest of the statement (e.g. `SELECT t.\`wi| FROM t`)
  const scopeTokens = tokenize(sql, { lenientQuotes: true }).filter(
    (t) =>
      !isTrivia(t) &&
      t.kind !== 'eof' &&
      t.start >= statementStart &&
      t.end <= statementEnd
  )
  context.ctes = collectCtes(sql, scopeTokens, statementEnd)
  context.tables = collectTables(sql, scopeTokens, statementEnd, offset)
  return context
}

const OPERATOR_WORDS = new Set([
  'AND',
  'OR',
  'NOT',
  'IN',
  'IS',
  'LIKE',
  'BETWEEN',
  'CONTAINS',
  '!=',
  '<>',
  '<=',
  '>=',
  '<',
  '>',
  '=',
  '(',
  '.',
])

const CLAUSE_KEYWORDS = new Set([
  'SELECT',
  'FROM',
  'JOIN',
  'ON',
  'WHERE',
  'HAVING',
  'SET',
  'BY',
])

/**
 * Parses from the last clause keyword (or opening parenthesis) at the depth
 * of the cursor, and returns what is expected at the cursor, or null.
 */
function parseClauseAtCursor(
  sql: string,
  tokens: Token[],
  statementStart: number,
  cursor: number
): string[] | null {
  const before = tokens.filter(
    (t) => t.start >= statementStart && t.end <= cursor
  )
  let depth = 0
  let boundary: Token | null = null
  for (let n = before.length - 1; n >= 0; n--) {
    const t = before[n]
    if (isPunct(t, ')')) depth++
    else if (isPunct(t, '(')) {
      if (depth === 0) {
        boundary = t
        break
      }
      depth--
    } else if (depth === 0 && CLAUSE_KEYWORDS.has(upper(t))) {
      boundary = t
      break
    }
  }
  if (!boundary) return null
  const parser = new Parser(sql, {
    range: [boundary.start, cursor],
    forCompletion: true,
  })
  const keyword = upper(boundary)
  try {
    if (keyword === 'SELECT') {
      parser.parseSelect(null)
    } else if (keyword === 'FROM' || keyword === 'JOIN') {
      parser.i++
      parser.parseTableList()
    } else if (keyword === 'SET') {
      parser.i++
      do {
        parser.expect(ROLE.columnName)
        parser.requireQualifiedName(true)
        parser.requirePunct('=')
        parser.parseExpression()
      } while (parser.acceptPunct(','))
    } else if (keyword === 'BY') {
      parser.i++
      do {
        parser.parseExpression()
      } while (parser.acceptPunct(','))
    } else {
      // ON / WHERE / HAVING / an opening parenthesis: expressions
      parser.i++
      do {
        parser.parseExpression()
      } while (parser.acceptPunct(','))
    }
  } catch (e) {
    if (!(e instanceof ParseFailure)) throw e
  }
  return parser.furthest === parser.tokens.length - 1
    ? [...parser.expected]
    : null
}

/** [start, end) offsets of the statement containing the offset */
function statementRange(
  tokens: Token[],
  offset: number,
  length: number
): [number, number] {
  let start = 0
  let end = length
  let depth = 0
  for (const t of tokens) {
    if (isPunct(t, '(')) depth++
    else if (isPunct(t, ')')) depth = Math.max(0, depth - 1)
    else if (isPunct(t, ';') && depth === 0) {
      if (t.end <= offset) start = t.end
      else {
        end = t.start
        break
      }
    }
  }
  return [start, end]
}

function statementType(tokens: Token[]): string | null {
  let n = 0
  while (isPunct(tokens[n], '(')) n++
  const first = upper(tokens[n])
  if (first === 'WITH') {
    // The statement type comes after the CTEs
    let depth = 0
    for (let m = n + 1; m < tokens.length; m++) {
      if (isPunct(tokens[m], '(')) depth++
      else if (isPunct(tokens[m], ')')) depth--
      else if (
        depth === 0 &&
        ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REPLACE'].includes(
          upper(tokens[m])
        )
      ) {
        return upper(tokens[m]) === 'REPLACE'
          ? 'insert'
          : upper(tokens[m]).toLowerCase()
      }
    }
    return 'select'
  }
  const types: Record<string, string> = {
    SELECT: 'select',
    INSERT: 'insert',
    REPLACE: 'insert',
    UPDATE: 'update',
    DELETE: 'delete',
    CREATE: 'create',
    ALTER: 'alter_table',
    DROP: 'drop',
  }
  return types[first] ?? null
}

type QueryRange = { start: number; end: number }

/** Ranges of `(SELECT ...)` / `(WITH ...)` in the statement */
function queryRanges(tokens: Token[], statementEnd: number): QueryRange[] {
  const ranges: QueryRange[] = []
  const stack: { index: number; query: boolean }[] = []
  tokens.forEach((t, n) => {
    if (isPunct(t, '(')) {
      stack.push({
        index: n,
        query: ['SELECT', 'WITH'].includes(upper(tokens[n + 1])),
      })
    } else if (isPunct(t, ')')) {
      const open = stack.pop()
      if (open?.query)
        ranges.push({ start: tokens[open.index + 1].start, end: t.start })
    }
  })
  // Unclosed parentheses run to the end of the statement
  for (const open of stack) {
    if (open.query)
      ranges.push({ start: tokens[open.index + 1].start, end: statementEnd })
  }
  return ranges
}

/** Tables visible at the offset */
function collectTables(
  sql: string,
  tokens: Token[],
  statementEnd: number,
  offset: number
): A.FromTableNode[] {
  if (tokens.length === 0) return []
  const innermost = queryRanges(tokens, statementEnd)
    .filter((r) => r.start < offset && offset <= r.end)
    .sort((a, b) => b.start - a.start)[0]
  const range = innermost ?? { start: tokens[0].start, end: statementEnd }
  const inRange = tokens.filter(
    (t) => t.start >= range.start && t.end <= range.end
  )
  const type = statementType(inRange)
  if (type === 'select') return fromClauseTables(sql, inRange, range.end)
  return targetTables(sql, inRange, range.end)
}

/** Tables of the first FROM clause at the top level of the query */
function fromClauseTables(
  sql: string,
  tokens: Token[],
  end: number
): A.FromTableNode[] {
  let depth = 0
  let from: Token | null = null
  let n = 0
  while (isPunct(tokens[n], '(')) n++
  if (upper(tokens[n]) === 'WITH') {
    // Skip the CTEs to the main query
    for (n++; n < tokens.length; n++) {
      if (isPunct(tokens[n], '(')) depth++
      else if (isPunct(tokens[n], ')')) depth--
      else if (depth === 0 && upper(tokens[n]) === 'SELECT') break
    }
  }
  for (; n < tokens.length; n++) {
    const t = tokens[n]
    if (isPunct(t, '(')) depth++
    else if (isPunct(t, ')')) depth--
    else if (depth === 0 && upper(t) === 'FROM') {
      from = t
      break
    }
  }
  if (!from) return []
  const parser = new Parser(sql, {
    range: [from.start, end],
    recoverFromSubquery: true,
  })
  try {
    parser.requireKeyword('FROM')
    return parser.parseTableList()
  } catch (e) {
    if (!(e instanceof ParseFailure)) throw e
    return []
  }
}

/** The target table of INSERT / UPDATE / DELETE / ALTER TABLE, plus UPDATE joins */
function targetTables(
  sql: string,
  tokens: Token[],
  end: number
): A.FromTableNode[] {
  let n = 0
  if (upper(tokens[n]) === 'WITH') {
    let depth = 0
    for (n++; n < tokens.length; n++) {
      if (isPunct(tokens[n], '(')) depth++
      else if (isPunct(tokens[n], ')')) depth--
      else if (
        depth === 0 &&
        ['INSERT', 'REPLACE', 'UPDATE', 'DELETE'].includes(upper(tokens[n]))
      )
        break
    }
  }
  const first = upper(tokens[n])
  const skip: Record<string, string[]> = {
    INSERT: ['INTO'],
    REPLACE: ['INTO'],
    UPDATE: [],
    DELETE: ['FROM'],
    ALTER: ['TABLE'],
  }
  if (!(first in skip)) return []
  n++
  if (first === 'INSERT' && upper(tokens[n]) === 'IGNORE') n++
  for (const word of skip[first]) {
    if (upper(tokens[n]) !== word) return []
    n++
  }
  const nameStart = tokens[n]
  if (!isName(nameStart)) return []
  if (first === 'UPDATE') {
    // UPDATE t [alias] [JOIN ...] SET: reuse the FROM clause parser
    const parser = new Parser(sql, {
      range: [nameStart.start, end],
      recoverFromSubquery: true,
    })
    try {
      return parser.parseTableList()
    } catch (e) {
      if (!(e instanceof ParseFailure)) throw e
    }
  }
  const parts: string[] = [unquote(nameStart.text)]
  for (n++; isPunct(tokens[n], '.') && isName(tokens[n + 1]); n += 2) {
    parts.push(unquote(tokens[n + 1].text))
  }
  const [catalog, db, table] = ['', '', ...parts].slice(-3)
  const last = tokens[Math.min(n, tokens.length) - 1]
  const range = (from: number, to: number) => {
    const lines = sql.slice(0, from).split('\n')
    const toLines = sql.slice(0, to).split('\n')
    return {
      start: {
        offset: from,
        line: lines.length,
        column: lines[lines.length - 1].length + 1,
      },
      end: {
        offset: to,
        line: toLines.length,
        column: toLines[toLines.length - 1].length + 1,
      },
    }
  }
  return [
    {
      type: 'table',
      catalog,
      db,
      table,
      as: null,
      location: range(nameStart.start, last.end),
    },
  ]
}

/** Names and output columns of the CTEs of the statement */
function collectCtes(
  sql: string,
  tokens: Token[],
  statementEnd: number
): CompletionContext['ctes'] {
  let n = 0
  while (isPunct(tokens[n], '(')) n++
  if (upper(tokens[n]) !== 'WITH') return []
  const parser = new Parser(sql, {
    range: [tokens[n].start, statementEnd],
    recoverFromSubquery: true,
  })
  try {
    return parser.parseWith().cteList.map((cte) => ({
      name: cte.name,
      columns:
        cte.arguments.length > 0 ? cte.arguments : outputColumns(cte.query),
    }))
  } catch (e) {
    if (!(e instanceof ParseFailure)) throw e
  }
  // The cursor may be inside a CTE: collect the names only
  const ctes: CompletionContext['ctes'] = []
  let depth = 0
  for (let m = n + 1; m < tokens.length; m++) {
    if (isPunct(tokens[m], '(')) depth++
    else if (isPunct(tokens[m], ')')) depth--
    else if (
      depth === 0 &&
      isName(tokens[m]) &&
      upper(tokens[m + 1]) === 'AS' &&
      isPunct(tokens[m + 2], '(')
    ) {
      ctes.push({ name: unquote(tokens[m].text), columns: [] })
    }
  }
  return ctes
}

function outputColumns(query: A.AST): string[] {
  if (query.type !== 'select' || !Array.isArray(query.columns)) return []
  return query.columns
    .map((c) => c.as ?? (c.expr.type === 'column_ref' ? c.expr.column : null))
    .filter((v): v is string => !!v)
}
