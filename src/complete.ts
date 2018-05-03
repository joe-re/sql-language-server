import { Parser, AstReader } from '@joe-re/node-sql-parser'

export default function complete(sql: string, pos: { line: number, column: number }) {
  const candidates = []
  try {
    const ast = Parser.parse(sql);
    const ar  = new AstReader(ast);
    const lines = sql.split('\n')
    console.log(ar.getAst())
  } catch (e) {
    return(
      {
        error: {
          label: e.name,
          detail: e.message,
          line: e.line,
          offset: e.offset
        },
        candidates: e.candidates
      }
    )
  }
}
