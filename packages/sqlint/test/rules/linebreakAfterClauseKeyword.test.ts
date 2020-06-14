import { execute } from '../../src/rules'
import { applyFixes } from '../testUtil'

test('valid case', () => {
  const sql = `
    SELECT
      *
    FROM
      foo
    WHERE
      foo.a > 1
  `
  const result = execute(sql, { rules: { 'linebreak-after-clause-keyword': { level: 2} } })
  expect(result).toEqual([])
})

test('require linebreak after SELECT, FROM, WHERE keyword', () => {
  const sql = 'SELECT  foo.a, foo.b FROM   foo WHERE  foo.a > 1'
  const result = execute(sql, { rules: { 'linebreak-after-clause-keyword': { level: 2} } })
  expect(result.length).toEqual(3)
  const fixed = applyFixes(sql, result.map(v => v.fix!).flat())
  expect(fixed).toContain(`
SELECT
  foo.a, foo.b
FROM
  foo
WHERE
  foo.a > 1
`.trim())
})