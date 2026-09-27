import type { NodeRange } from './ast'

export type ExpectedLiteralNode = {
  type: 'literal'
  text: string
  ignoreCase: boolean
}

export type ExpectedOtherNode = {
  type: 'other'
  description: string
}

export type ExpectedNode = ExpectedLiteralNode | ExpectedOtherNode

/**
 * Thrown by parse() / parseAll(). The shape (name, expected, found, location)
 * is kept compatible with the errors of the previous PEG based parser, which
 * sql-language-server uses for keyword completion.
 */
export class SqlSyntaxError extends Error {
  expected: ExpectedNode[] | null
  found: string | null
  location: NodeRange

  constructor(
    message: string,
    expected: ExpectedNode[] | null,
    found: string | null,
    location: NodeRange
  ) {
    super(message)
    this.name = 'SyntaxError'
    this.expected = expected
    this.found = found
    this.location = location
  }
}

/** Message used when a column name is being typed where one is required */
export const EXPECTED_COLUMN_NAME = 'EXPECTED COLUMN NAME'

export function describeExpected(expected: string[], found: string | null) {
  const quoted = expected.map((v) => JSON.stringify(v))
  const list =
    quoted.length <= 1
      ? (quoted[0] ?? 'nothing')
      : `${quoted.slice(0, -1).join(', ')} or ${quoted[quoted.length - 1]}`
  return `Expected ${list} but ${found === null ? 'end of input' : JSON.stringify(found)} found.`
}
