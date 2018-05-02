import { Parser, AstReader } from '@joe-re/node-sql-parser'

export default function complete(sql) {
  const candidates = []
  try {
    const ast = Parser.parse(sql);
    const ar  = new AstReader(ast);
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
