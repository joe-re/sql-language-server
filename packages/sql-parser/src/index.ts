import type * as A from './ast'
import {
  describeExpected,
  EXPECTED_COLUMN_NAME,
  ExpectedNode,
  SqlSyntaxError,
} from './errors'
import { ParseFailure, Parser } from './parser'

export * from './ast'
export * from './errors'
export { tokenize, isTrivia } from './lexer'
export type { Token, TokenKind } from './lexer'

// Names used by consumers of the previous type definitions
export type ParseError = SqlSyntaxError
export type Node = A.BaseNode

/** Converts an internal parse failure to the public error */
function toSyntaxError(parser: Parser, e: ParseFailure): SqlSyntaxError {
  if (e.kind === 'expected_column_name' && parser.columnNameAt !== null) {
    const token = parser.tokens[parser.columnNameAt]
    const start = parser.columnNameAtEnd ? token.end : token.start
    return new SqlSyntaxError(
      EXPECTED_COLUMN_NAME,
      null,
      null,
      parser.range(start, token.end)
    )
  }
  if (parser.emptyExpectedAt !== null) {
    const offset = parser.emptyExpectedAt
    const found = parser.sql[offset] ?? null
    return new SqlSyntaxError(
      describeExpected([], found),
      [],
      found,
      parser.range(offset, found === null ? offset : offset + 1)
    )
  }
  if (parser.unterminatedAt !== null) {
    const token = parser.tokens[parser.unterminatedAt]
    const labels = [...parser.expected]
    return new SqlSyntaxError(
      describeExpected(labels, null),
      labels.map(literal),
      null,
      parser.range(token.end, token.end)
    )
  }
  const token =
    parser.tokens[
      Math.max(0, Math.min(parser.furthest, parser.tokens.length - 1))
    ]
  // Whitespace and comments may appear wherever a token is expected. The
  // order matters: sql-language-server lists completion candidates in it.
  const labels = [...new Set(['--', '/*', ...parser.expected])]
  const found = token.kind === 'eof' ? null : token.text[0]
  return new SqlSyntaxError(
    describeExpected(labels, found),
    labels.map(literal),
    found,
    parser.range(
      token.start,
      token.kind === 'eof' ? token.start : token.start + 1
    )
  )
}

function literal(text: string): ExpectedNode {
  return { type: 'literal', text, ignoreCase: /^[A-Z]/.test(text) }
}

function run<T>(parser: Parser, fn: () => T): T {
  try {
    return fn()
  } catch (e) {
    if (e instanceof ParseFailure) throw toSyntaxError(parser, e)
    throw e
  }
}

/** An unterminated block comment at the end: only its end can follow */
function checkUnterminatedComment(parser: Parser) {
  const last = parser.allTokens[parser.allTokens.length - 2]
  if (last?.kind === 'block_comment' && last.unterminated) {
    throw new SqlSyntaxError(
      describeExpected(['*/'], null),
      [literal('*/')],
      null,
      parser.range(parser.sql.length, parser.sql.length)
    )
  }
}

/** Parses all statements separated by `;` */
export function parseAll(sql: string): A.AST[] {
  const parser = new Parser(sql)
  checkUnterminatedComment(parser)
  return run(parser, () => parser.parseStatements())
}

/** Parses the SQL and returns its first statement */
export function parse(sql: string): A.AST {
  // Compatibility: the previous parser returned an empty array for ''
  if (sql === '') return [] as unknown as A.AST
  const parser = new Parser(sql)
  checkUnterminatedComment(parser)
  return run(parser, () => {
    const statements = parser.parseStatements()
    if (statements.length === 0) {
      parser.expect(...[])
      parser.parseStatement() // throws with the expected statement keywords
    }
    return statements[0]
  })
}

/**
 * Extracts the first FROM clause of a SELECT even when the rest of the SQL is
 * incomplete. Subqueries in FROM that cannot be parsed are returned as
 * `incomplete_subquery` nodes.
 */
export function parseFromClause(sql: string): A.FromClauseParserResult {
  const parser = new Parser(sql, { recoverFromSubquery: true })
  return run(parser, () => {
    const { tokens } = parser
    let depth = 0
    while (parser.acceptPunct('(')) depth++
    const baseDepth = depth
    parser.requireKeyword('SELECT')
    let fromIndex: number | null = null
    for (let n = parser.i; n < tokens.length; n++) {
      if (parser.isPunct(tokens[n], '(')) depth++
      else if (parser.isPunct(tokens[n], ')')) depth--
      else if (
        depth === baseDepth &&
        tokens[n].kind === 'word' &&
        tokens[n].text.toUpperCase() === 'FROM'
      ) {
        fromIndex = n
        break
      }
    }
    if (fromIndex === null) return { before: sql, from: null, after: '' }
    parser.i = fromIndex
    let from: A.FromClause | null = null
    const start = parser.i
    try {
      const keyword = parser.requireKeyword('FROM')
      const tables = parser.parseTableList()
      from = { type: 'from', keyword, tables, location: parser.loc(start) }
    } catch (e) {
      if (!(e instanceof ParseFailure)) throw e
      parser.i = tokens.length - 1
    }
    return {
      before: sql.slice(0, tokens[fromIndex].start),
      from,
      after: sql.slice(parser.peek().start),
    }
  })
}
