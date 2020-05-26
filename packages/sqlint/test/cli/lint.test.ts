import { lint } from '../../src/cli/lint'

describe('lint', () => {
  describe('format stylish', () => {
    test('get formatted message', () => {
      const result = lint(`${__dirname}/fixtures/lint`, 'stylish', `${__dirname}/fixtures/lint`)
      expect(result.length).toEqual(2)
      expect(result[0]).toEqual('1:0 reserved word must be uppercase')
      expect(result[1]).toEqual('1:9 reserved word must be uppercase')
    })
  })
  describe('format json', () => {
    test('get formatted message', () => {
      const result = lint(`${__dirname}/fixtures/lint`, 'json', `${__dirname}/fixtures/lint`) as string
      const parsed = JSON.parse(result)
      expect(parsed.length).toEqual(1)
      expect(parsed[0].filepath).toContain('sqlint/test/cli/fixtures/lint/errorSql.sql')
      expect(parsed[0].diagnostics.length).toEqual(2)
      expect(parsed[0].diagnostics[0]).toMatchObject({
        location: {
          end: { column: 7, line: 1, offset: 6},
          start: {column: 1, line: 1, offset: 0}
        },
        message: 'reserved word must be uppercase',
        rulename: 'reserved-word-case'
      })
      expect(parsed[0].diagnostics[1]).toMatchObject({
        location: {
          end: { column: 14, line: 1, offset: 13 },
          start: { column: 10, line: 1, offset: 9 }
        },
        message: 'reserved word must be uppercase',
        rulename: 'reserved-word-case'
      })
    })
  })
})