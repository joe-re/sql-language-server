import {
  parse,
  parseAll,
  parseFromClause,
  tokenize,
  SqlSyntaxError,
  SelectStatement,
  BinaryExpressionNode,
  InsertStatement,
} from '../src'

const select = (sql: string) => parse(sql) as SelectStatement

function syntaxError(sql: string): SqlSyntaxError {
  try {
    parse(sql)
  } catch (e) {
    if (e instanceof SqlSyntaxError) return e
    throw e
  }
  throw new Error(`expected a syntax error: ${sql}`)
}

const expectedTexts = (e: SqlSyntaxError) =>
  (e.expected ?? []).map((v) => (v.type === 'literal' ? v.text : ''))

describe('tokenize', () => {
  it('keeps whitespace and comments so that the text can be restored', () => {
    const sql = "SELECT a, -- c\n  'it''s' /* b */ FROM t;"
    const tokens = tokenize(sql)
    expect(tokens.map((t) => t.text).join('')).toEqual(sql)
    expect(tokens.map((t) => t.kind)).toContain('line_comment')
    expect(tokens.map((t) => t.kind)).toContain('block_comment')
    expect(tokens.find((t) => t.kind === 'string')?.text).toEqual("'it''s'")
  })

  it('marks unterminated tokens', () => {
    expect(tokenize("SELECT 'abc").find((t) => t.kind === 'string')).toMatchObject({
      unterminated: true,
    })
    expect(tokenize('SELECT /* abc').find((t) => t.kind === 'block_comment')).toMatchObject({
      unterminated: true,
    })
  })
})

describe('locations', () => {
  it('are exact and do not include surrounding whitespace', () => {
    const sql = 'SELECT a\nFROM t\nWHERE  x  >=  1  AND y = 2'
    const ast = select(sql)
    const expr = ast.where!.expression as BinaryExpressionNode
    const text = (n: { location: { start: { offset: number }; end: { offset: number } } }) =>
      sql.slice(n.location.start.offset, n.location.end.offset)
    expect(expr.operator).toEqual('AND')
    expect(text(expr)).toEqual('x  >=  1  AND y = 2')
    expect(text(expr.left as BinaryExpressionNode)).toEqual('x  >=  1')
    expect(text(ast.from!)).toEqual('FROM t')
    expect(ast.where!.keyword.location.start).toEqual({ offset: 16, line: 3, column: 1 })
  })

  it('keep the source text of keywords', () => {
    const ast = select('select a from t')
    expect(ast.keyword.value).toEqual('select')
    expect(ast.from!.keyword.value).toEqual('from')
  })
})

describe('SELECT', () => {
  it('parses set operations', () => {
    const ast = select('SELECT 1 UNION ALL SELECT 2 UNION SELECT 3')
    expect(ast.set_op?.value).toEqual('UNION ALL')
    expect(ast._next?.type).toEqual('select')
    expect(ast._next?.set_op?.value).toEqual('UNION')
    expect(ast._next?._next?.type).toEqual('select')
  })

  it('normalizes join types', () => {
    const ast = select(`
      SELECT * FROM a
      LEFT OUTER JOIN b ON a.id = b.id
      RIGHT JOIN c ON a.id = c.id
      FULL OUTER JOIN d ON a.id = d.id
      CROSS JOIN e
      JOIN f USING (id)
    `)
    expect(ast.from!.tables.map((t) => t.join ?? null)).toEqual([
      null,
      'LEFT JOIN',
      'RIGHT JOIN',
      'FULL JOIN',
      'CROSS JOIN',
      'INNER JOIN',
    ])
    expect(ast.from!.tables[4].on).toBeNull()
    expect(ast.from!.tables[5].on).toMatchObject({ type: 'expr_list' })
  })

  it('parses subqueries in FROM with aliases', () => {
    const ast = select('SELECT s.x FROM (SELECT x FROM t) AS s')
    expect(ast.from!.tables[0]).toMatchObject({ type: 'subquery', as: 's' })
  })

  it('parses GROUP BY, ORDER BY and LIMIT', () => {
    const ast = select(
      'SELECT a, COUNT(*) FROM t GROUP BY a ORDER BY a DESC, 2 LIMIT 10 OFFSET 5'
    )
    expect(ast.groupby).toHaveLength(1)
    expect(ast.orderby?.map((v) => v.order?.value ?? null)).toEqual(['DESC', null])
    expect(ast.limit).toMatchObject({
      value: { type: 'number', value: 10 },
      offset: { type: 'number', value: 5 },
    })
  })

  it('parses MySQL LIMIT offset, count', () => {
    const ast = select('SELECT a FROM t LIMIT 5, 10')
    expect(ast.limit).toMatchObject({ value: { value: 10 }, offset: { value: 5 } })
  })

  it('keeps DISTINCT as a keyword', () => {
    expect(select('SELECT DISTINCT a FROM t').distinct?.value).toEqual('DISTINCT')
  })
})

describe('expressions', () => {
  const where = (cond: string) =>
    select(`SELECT * FROM t WHERE ${cond}`).where!.expression as BinaryExpressionNode

  it('respects precedence and left associativity', () => {
    const e = where('a = 1 OR b = 2 AND c = 3 OR d = 4')
    expect(e.operator).toEqual('OR')
    expect((e.left as BinaryExpressionNode).operator).toEqual('OR')
    expect(((e.left as BinaryExpressionNode).right as BinaryExpressionNode).operator).toEqual('AND')
  })

  it('parses arithmetic with precedence', () => {
    const e = where('a = 1 + 2 * 3')
    const right = e.right as BinaryExpressionNode
    expect(right.operator).toEqual('+')
    expect((right.right as BinaryExpressionNode).operator).toEqual('*')
  })

  it('parses predicates', () => {
    expect(where('a IS NOT NULL')).toMatchObject({ operator: 'IS NOT', right: { type: 'null' } })
    expect(where('a NOT IN (1, 2)')).toMatchObject({
      operator: 'NOT IN',
      right: { type: 'expr_list', value: [{ value: 1 }, { value: 2 }] },
    })
    expect(where('a BETWEEN 1 AND 5')).toMatchObject({
      operator: 'BETWEEN',
      right: { type: 'expr_list', value: [{ value: 1 }, { value: 5 }] },
    })
    expect(where("a LIKE 'x%'")).toMatchObject({ operator: 'LIKE', right: { type: 'string' } })
    expect(where('a IN (SELECT b FROM u)')).toMatchObject({
      right: { type: 'expr_list', value: [{ type: 'select' }] },
    })
  })

  it('parses functions, CASE and unary operators', () => {
    const ast = select(`
      SELECT
        COALESCE(a, 0),
        COUNT(DISTINCT b),
        CASE WHEN c > 0 THEN 'p' ELSE 'n' END,
        -d,
        e::int,
        a || b
      FROM t
    `)
    const exprs = (ast.columns as { expr: unknown }[]).map((c) => c.expr)
    expect(exprs[0]).toMatchObject({ type: 'function', name: 'COALESCE' })
    expect(exprs[1]).toMatchObject({ type: 'aggr_func', name: 'COUNT', args: { distinct: { value: 'DISTINCT' } } })
    expect(exprs[2]).toMatchObject({ type: 'case', whens: [{ then: { value: 'p' } }], else: { value: 'n' } })
    expect(exprs[3]).toMatchObject({ type: 'unary_expr', operator: '-' })
    expect(exprs[4]).toMatchObject({ type: 'column_ref', column: 'e' })
    expect(exprs[5]).toMatchObject({ type: 'binary_expr', operator: '||' })
  })

  it('treats a lone double quoted token as a string', () => {
    expect(where('a = "x"').right).toMatchObject({ type: 'string', value: 'x' })
    expect(where('a = "t"."c"').right).toMatchObject({ type: 'column_ref', table: 't', column: 'c' })
  })

  it('unescapes strings', () => {
    expect(where("a = 'it''s \\n'").right).toMatchObject({ value: "it's \n" })
  })
})

describe('INSERT', () => {
  it('keeps the first row in values and the rest in more_rows', () => {
    const ast = parse('INSERT INTO t (a, b) VALUES (1, 2), (3, 4)') as InsertStatement
    expect(ast.columns).toEqual(['a', 'b'])
    expect(ast.values?.values.map((v) => (v as { value: number }).value)).toEqual([1, 2])
    expect(ast.values?.more_rows).toHaveLength(1)
  })

  it('parses INSERT ... SELECT', () => {
    const ast = parse('INSERT INTO t (a) SELECT a FROM u') as InsertStatement
    expect(ast.values).toBeNull()
    expect(ast.select?.type).toEqual('select')
  })
})

describe('parseAll', () => {
  it('returns every statement', () => {
    expect(parseAll('SELECT 1; ; UPDATE t SET a = 1; DELETE FROM t').map((v) => v.type)).toEqual([
      'select',
      'update',
      'delete',
    ])
  })

  it('returns no statements for blank input', () => {
    expect(parseAll('  -- nothing\n')).toEqual([])
  })
})

describe('errors', () => {
  it('report expected statement keywords at the start', () => {
    const e = syntaxError('S')
    expect(e.name).toEqual('SyntaxError')
    expect(e.location.start.offset).toEqual(0)
    expect(expectedTexts(e)).toEqual(expect.arrayContaining(['SELECT', 'INSERT', 'CREATE TABLE']))
  })

  it('report the next word of a multi word keyword', () => {
    expect(expectedTexts(syntaxError('SELECT a FROM t GROUP '))).toContain('BY')
  })

  it('report EXPECTED COLUMN NAME while a column name is typed', () => {
    expect(syntaxError('UPDATE t SET c').message).toEqual('EXPECTED COLUMN NAME')
    expect(syntaxError('ALTER TABLE t MODIFY c').message).toEqual('EXPECTED COLUMN NAME')
  })

  it('report the closing quote of an unterminated string', () => {
    const e = syntaxError("SELECT 'abc")
    expect(expectedTexts(e)[0]).toEqual("'")
    expect(e.location.start.offset).toEqual(11)
  })

  it('report the end of an unterminated block comment', () => {
    expect(expectedTexts(syntaxError('SELECT 1 /* abc'))).toEqual(['*/'])
  })

  it('returns an empty array for an empty string (compatibility)', () => {
    expect(parse('')).toEqual([])
  })
})

describe('parseFromClause', () => {
  it('extracts FROM even when the rest is incomplete', () => {
    const result = parseFromClause('SELECT t. FROM users t WHERE t.')
    expect(result.before).toEqual('SELECT t. ')
    expect(result.after).toEqual('WHERE t.')
    expect(result.from?.tables[0]).toMatchObject({ table: 'users', as: 't' })
  })

  it('returns incomplete subqueries', () => {
    const result = parseFromClause('SELECT x FROM (SELECT e. FROM emp e) sub')
    expect(result.from?.tables[0]).toMatchObject({
      type: 'incomplete_subquery',
      text: '(SELECT e. FROM emp e)',
      as: 'sub',
    })
  })

  it('keeps joined tables when an ON condition is incomplete', () => {
    const result = parseFromClause('SELECT * FROM a JOIN b ON a.')
    expect(result.from?.tables.map((t) => (t.type === 'table' ? t.table : t.type))).toEqual([
      'a',
      'b',
    ])
  })

  it('tolerates unterminated quotes', () => {
    expect(parseFromClause("SELECT 'abc. FROM t").from?.tables[0]).toMatchObject({ table: 't' })
  })

  it('returns no FROM when there is none', () => {
    expect(parseFromClause('SELECT a')).toEqual({ before: 'SELECT a', from: null, after: '' })
  })
})
