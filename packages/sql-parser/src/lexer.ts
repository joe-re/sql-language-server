export type TokenKind =
  | 'whitespace'
  | 'line_comment'
  | 'block_comment'
  | 'word' // identifiers and keywords (keywords are resolved by the parser)
  | 'quoted_ident' // "ident" or `ident`
  | 'string' // 'text'
  | 'number'
  | 'pg_promise_var' // ${name} / $(name) / $<name> / $[name] / $/name/
  | 'param' // $1, ?, :name, @name
  | 'operator'
  | 'punct'
  | 'unknown'
  | 'eof'

export type Token = {
  kind: TokenKind
  text: string
  /** 0-based offset of the first character */
  start: number
  /** 0-based offset just after the last character */
  end: number
  /** true when the token is not closed (e.g. `'abc` or `/* ...`) */
  unterminated?: boolean
}

export const isTrivia = (t: Token) =>
  t.kind === 'whitespace' ||
  t.kind === 'line_comment' ||
  t.kind === 'block_comment'

const OPERATORS = [
  // longest first
  '::',
  '||',
  '<=',
  '>=',
  '<>',
  '!=',
  '==',
  '->>',
  '->',
  '=',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '!',
  '~',
  '&',
  '|',
  '^',
].sort((a, b) => b.length - a.length)

const PUNCT = new Set(['(', ')', ',', ';', '.', '[', ']', '{', '}', ':'])

const isWordStart = (c: string) => /[A-Za-z_\u0080-￿]/.test(c)
const isWordPart = (c: string) => /[A-Za-z0-9_$\u0080-￿]/.test(c)
const isDigit = (c: string) => c >= '0' && c <= '9'

/**
 * Splits SQL into tokens, keeping whitespace and comments so that the
 * original text can be reconstructed from the token list.
 */
export type TokenizeOptions = {
  /**
   * Treat an unterminated quote as a single character instead of a token
   * running to the end of input
   */
  lenientQuotes?: boolean
}

export function tokenize(sql: string, options: TokenizeOptions = {}): Token[] {
  const tokens: Token[] = []
  let i = 0
  const push = (kind: TokenKind, start: number, unterminated = false) => {
    tokens.push({
      kind,
      text: sql.slice(start, i),
      start,
      end: i,
      ...(unterminated ? { unterminated } : {}),
    })
  }

  while (i < sql.length) {
    const start = i
    const c = sql[i]
    const next = sql[i + 1]

    if (/\s/.test(c)) {
      while (i < sql.length && /\s/.test(sql[i])) i++
      push('whitespace', start)
    } else if (c === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') i++
      push('line_comment', start)
    } else if (c === '/' && next === '*') {
      const close = sql.indexOf('*/', i + 2)
      i = close === -1 ? sql.length : close + 2
      push('block_comment', start, close === -1)
    } else if (c === "'" || c === '"' || c === '`') {
      i = readQuoted(sql, i, c, c !== '`')
      const unterminated = sql[i - 1] !== c || i - start < 2
      if (unterminated && options.lenientQuotes) {
        i = start + 1
        push('unknown', start)
      } else {
        push(c === "'" ? 'string' : 'quoted_ident', start, unterminated)
      }
    } else if (
      isDigit(c) ||
      (c === '.' && next !== undefined && isDigit(next))
    ) {
      i = readNumber(sql, i)
      push('number', start)
    } else if (c === '$' && next !== undefined && '{(<[/'.includes(next)) {
      const close = { '{': '}', '(': ')', '<': '>', '[': ']', '/': '/' }[next]!
      const end = sql.indexOf(close, i + 2)
      i = end === -1 ? sql.length : end + 1
      push('pg_promise_var', start, end === -1)
    } else if (c === '$' && next !== undefined && isDigit(next)) {
      i++
      while (i < sql.length && isDigit(sql[i])) i++
      push('param', start)
    } else if (
      (c === '@' || c === ':') &&
      next !== undefined &&
      isWordStart(next)
    ) {
      i++
      while (i < sql.length && isWordPart(sql[i])) i++
      push('param', start)
    } else if (c === '?') {
      i++
      push('param', start)
    } else if (isWordStart(c)) {
      while (i < sql.length && isWordPart(sql[i])) i++
      push('word', start)
    } else {
      const op = OPERATORS.find((o) => sql.startsWith(o, i))
      if (op) {
        i += op.length
        push('operator', start)
      } else if (PUNCT.has(c)) {
        i++
        push('punct', start)
      } else {
        i++
        push('unknown', start)
      }
    }
  }
  tokens.push({ kind: 'eof', text: '', start: sql.length, end: sql.length })
  return tokens
}

/**
 * Reads a quoted token starting at `i`. A doubled quote is an escaped quote;
 * with `backslash`, `\x` escapes the next character.
 */
function readQuoted(sql: string, i: number, quote: string, backslash: boolean) {
  i++
  while (i < sql.length) {
    const c = sql[i]
    if (backslash && c === '\\') {
      i += 2
    } else if (c === quote) {
      if (sql[i + 1] === quote) {
        i += 2
      } else {
        return i + 1
      }
    } else {
      i++
    }
  }
  return sql.length
}

function readNumber(sql: string, i: number) {
  while (i < sql.length && isDigit(sql[i])) i++
  if (sql[i] === '.' && isDigit(sql[i + 1] ?? '')) {
    i++
    while (i < sql.length && isDigit(sql[i])) i++
  }
  if (
    (sql[i] === 'e' || sql[i] === 'E') &&
    /[+-]?\d/.test(sql.slice(i + 1, i + 3))
  ) {
    i++
    if (sql[i] === '+' || sql[i] === '-') i++
    while (i < sql.length && isDigit(sql[i])) i++
  }
  return i
}

/** Converts offsets to 1-based line / column positions. */
export class LineMap {
  private readonly lineStarts: number[] = [0]

  constructor(sql: string) {
    for (let i = 0; i < sql.length; i++) {
      if (sql[i] === '\n') this.lineStarts.push(i + 1)
    }
  }

  position(offset: number) {
    let lo = 0
    let hi = this.lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.lineStarts[mid] <= offset) lo = mid
      else hi = mid - 1
    }
    return { offset, line: lo + 1, column: offset - this.lineStarts[lo] + 1 }
  }
}
