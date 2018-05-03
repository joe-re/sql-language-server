import { Parser, AstReader } from '@joe-re/node-sql-parser'

function extractExpectedLiterals(expected: { type: string, text: string }[]): string[] {
  return expected.filter(v => v.type === 'literal')
	  .map(v => v.text)
		.filter((v, i, self) => self.indexOf(v) === i)
}

export default function complete(sql: string, pos: { line: number, column: number }) {
  let candidates: string[] = []
	let error = {};
  try {
    const ast = Parser.parse(sql);
    const ar  = new AstReader(ast);
  } catch (e) {
	  candidates = extractExpectedLiterals(e.expected)
		error = {
      label: e.name,
      detail: e.message,
      line: e.line,
      offset: e.offset
    }
  }
	candidates = candidates.filter(v => v.startsWith(sql))
	return { candidates, error }
}
