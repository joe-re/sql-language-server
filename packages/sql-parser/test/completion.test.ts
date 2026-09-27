import { getCompletionContext, CompletionContext } from '../src'

/** `|` marks the cursor */
function context(sqlWithCursor: string): CompletionContext {
  const offset = sqlWithCursor.indexOf('|')
  return getCompletionContext(sqlWithCursor.replace('|', ''), offset)
}

const expects = (c: CompletionContext) =>
  Object.entries(c.expects)
    .filter(([, v]) => v)
    .map(([k]) => k)

const tableNames = (c: CompletionContext) =>
  c.tables.map((t) => (t.type === 'table' ? t.table : t.type) + (t.as ? ` ${t.as}` : ''))

describe('getCompletionContext', () => {
  it('offers statement keywords at the start', () => {
    const c = context('S|')
    expect(c.word).toEqual('S')
    expect(c.keywords).toEqual(expect.arrayContaining(['SELECT', 'INSERT', 'CREATE TABLE']))
  })

  it('knows a column is expected in the select list, with tables from FROM', () => {
    const c = context('SELECT | FROM users u JOIN orders o ON o.uid = u.id')
    expect(expects(c)).toContain('column')
    expect(c.keywords).toContain('DISTINCT')
    expect(tableNames(c)).toEqual(['users u', 'orders o'])
  })

  it('reports the qualifier and the word being typed', () => {
    const c = context('SELECT u.na| FROM users u')
    expect(c.word).toEqual('na')
    expect(c.qualifier).toEqual(['u'])
    expect(expects(c)).toEqual(['column'])
  })

  it('reports qualifiers with subscripts and quotes', () => {
    expect(context('SELECT t.abc[0].| FROM t').qualifier).toEqual(['t', 'abc'])
    expect(context('SELECT "T1"."c| FROM "T1"').qualifier).toEqual(['T1'])
  })

  it('knows a table is expected after FROM and JOIN', () => {
    expect(expects(context('SELECT * FROM |'))).toContain('table')
    expect(expects(context('SELECT * FROM a JOIN |'))).toContain('table')
  })

  it('offers clause keywords after a table', () => {
    const c = context('SELECT * FROM users u W|')
    expect(expects(c)).not.toContain('table')
    expect(c.keywords).toEqual(expect.arrayContaining(['WHERE', 'GROUP', 'INNER', 'JOIN']))
  })

  it('offers the next word of multi word keywords', () => {
    expect(context('SELECT * FROM t GROUP |').keywords).toEqual(['BY'])
    expect(context('SELECT 1 UNION |').keywords).toContain('ALL')
  })

  it('offers keywords after a word typed in a column or alias position', () => {
    expect(context('SELECT F|').keywords).toContain('FROM')
    expect(context('SELECT d, f AS F|').keywords).toContain('FROM')
  })

  it('knows column names are expected in INSERT, UPDATE and ALTER TABLE', () => {
    for (const sql of [
      'INSERT INTO users (|',
      'INSERT INTO users (id, n|',
      'UPDATE users SET |',
      'ALTER TABLE users DROP COLUMN |',
    ]) {
      const c = context(sql)
      expect(expects(c)).toEqual(['columnName'])
      expect(tableNames(c)).toEqual(['users'])
    }
  })

  it('knows an expression is expected in UPDATE SET values and DELETE WHERE', () => {
    expect(expects(context('UPDATE users u SET name = | WHERE id = 1'))).toContain('column')
    const c = context('DELETE FROM users WHERE |')
    expect(expects(c)).toContain('column')
    expect(tableNames(c)).toEqual(['users'])
  })

  it('uses the innermost query for the scope', () => {
    const c = context('SELECT x FROM (SELECT e.| FROM emp e) s')
    expect(c.qualifier).toEqual(['e'])
    expect(tableNames(c)).toEqual(['emp e'])
  })

  it('collects CTEs with their columns', () => {
    const c = context('WITH a AS (SELECT id, name AS n FROM t) SELECT | FROM a')
    expect(c.ctes).toEqual([{ name: 'a', columns: ['id', 'n'] }])
    expect(tableNames(c)).toEqual(['a'])
  })

  it('only looks at the statement containing the cursor', () => {
    const c = context('SELECT * FROM t; SELECT | FROM u; SELECT * FROM v')
    expect(tableNames(c)).toEqual(['u'])
  })

  it('does not complete inside strings and comments', () => {
    expect(context("SELECT 'ab|c' FROM t").inCommentOrString).toBe(true)
    expect(context('SELECT 1 -- c|').inCommentOrString).toBe(true)
    expect(context('SELECT /* x| */ 1').inCommentOrString).toBe(true)
    expect(context('SELECT "COL1.| FROM t').inCommentOrString).toBe(true)
  })

  it('treats an unterminated identifier as the word being typed', () => {
    const c = context('SELECT t.`wi| FROM t')
    expect(c.inCommentOrString).toBe(false)
    expect(c.word).toEqual('`wi')
    expect(tableNames(c)).toEqual(['t'])
  })

  it('recovers from an error before the cursor', () => {
    const c = context('SELECT jo. FROM employees jo JOIN jobs j ON jo.|')
    expect(c.errorBeforeCursor).toBe(false)
    expect(expects(c)).toContain('column')
    expect(c.qualifier).toEqual(['jo'])
    expect(tableNames(c)).toEqual(['employees jo', 'jobs j'])
  })

  it('recovers from the clause containing the cursor when earlier SQL is broken', () => {
    const c = context('SELECT a,, FROM t WHERE |')
    expect(c.errorBeforeCursor).toBe(true)
    expect(expects(c)).toContain('column')
  })

  it('knows a new name is expected in a column definition', () => {
    const c = context('CREATE TABLE t (id int, n|')
    expect(expects(c)).toEqual(['newName'])
    expect(c.keywords).toEqual(expect.arrayContaining(['PRIMARY KEY', 'FOREIGN KEY']))
  })
})
