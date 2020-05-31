import { lint } from '../../src/cli/lint'
import chalk from 'chalk'

describe('lint', () => {
  describe('format stylish', () => {
    it('should get formatted message', () => {
      const result = lint({
        path: `${__dirname}/fixtures/lint`,
        formatType: 'stylish',
        configPath: `${__dirname}/fixtures/lint`
      })
      expect(result).toContain(`${chalk.dim('1:0')} ${chalk.red('error')} reserved word must be uppercase`)
      expect(result).toContain(`${chalk.dim('1:9')} ${chalk.red('error')} reserved word must be uppercase`)
    })
  })
  describe('format json', () => {
    it('should get formatted message', () => {
      const result = lint({
        path: `${__dirname}/fixtures/lint`,
        formatType: 'json',
        configPath: `${__dirname}/fixtures/lint`
      }) as string
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

  describe('input text', () => {
    it('should do lint input text', () => {
      const result = lint({
        text: 'select * from bar',
        formatType: 'json',
        configPath: `${__dirname}/fixtures/lint`
      })
      const parsed = JSON.parse(result)
      expect(parsed.length).toEqual(1)
      expect(parsed[0].diagnostics.length).toEqual(2)
      expect(parsed[0].filepath).toEqual('text')
    })
  })
})