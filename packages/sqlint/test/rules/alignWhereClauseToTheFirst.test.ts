import { execute } from '../../src/rules'
import { applyFixes } from '../testUtil'

test('valid case', () => {
  const sql = `
    SELECT foo.a
    FROM foo 
    WHERE foo.a = 'a' AND
          foo.b = 'b' AND
          foo.c = 'c'
  `
  const result = execute(sql, {
    rules: { 'align-where-clause-to-the-first': { level: 2 } },
  })
  expect(result).toEqual([])
})

test('Where clauses must align to the first clause', () => {
  const sql = `
    SELECT foo.a
    FROM foo 
    WHERE foo.a = 'a' AND foo.b = 'b' AND
    foo.c = 'c' AND
    foo.d = 'd'
  `
  const result = execute(sql, {
    rules: { 'align-where-clause-to-the-first': { level: 2 } },
  })
  expect(result.length).toEqual(2)
  expect(result[0].message).toEqual(
    'Where clauses must align to the first clause'
  )
  expect(result[0].location).toEqual({
    start: { column: 5, line: 6, offset: 98 },
    end: { column: 16, line: 6, offset: 109 },
  })
  expect(result[1].message).toEqual(
    'Where clauses must align to the first clause'
  )
  expect(result[1].location).toEqual({
    start: { column: 5, line: 5, offset: 78 },
    end: { column: 16, line: 5, offset: 89 },
  })
  const fixed = applyFixes(sql, result.map((v) => v.fix!).flat())
  expect(fixed).toEqual(`
    SELECT foo.a
    FROM foo 
    WHERE foo.a = 'a' AND foo.b = 'b' AND
          foo.c = 'c' AND
          foo.d = 'd'
  `)
})
