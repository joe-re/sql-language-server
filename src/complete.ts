import { Parser, AstReader } from '@joe-re/node-sql-parser'

const CLAUSES = ['SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'LIMIT']

function extractExpectedLiterals(expected: { type: string, text: string }[]): string[] {
  return expected.filter(v => v.type === 'literal')
	  .map(v => v.text)
		.filter((v, i, self) => self.indexOf(v) === i)
}

function getLastToken(sql: string) {
  const match = sql.match(/^.*[\s|.](.*?)$/)
	if (!match) { return sql }
	return match[1]
}

export default function complete(sql: string, pos: { line: number, column: number }) {
  let candidates: string[] = []
	let error = null;
  try {
    const ast = Parser.parse(sql);
    const ar  = new AstReader(ast);
		candidates = CLAUSES
  } catch (e) {
	  candidates = extractExpectedLiterals(e.expected)
		error = {
      label: e.name,
      detail: e.message,
      line: e.line,
      offset: e.offset
    }
  }
  const lastToken = getLastToken(sql)
	candidates = candidates.filter(v => v.startsWith(lastToken))
	return { candidates, error }
}
