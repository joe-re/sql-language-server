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

  describe('fix', () => {
    it('should be fixed correctly. case1', () => {
      const sql = 'SELECT employees.first_name, employees.email, e.first_name, e.department_id, e.manager_id, e.hire_date' +
       ' FROM employees e' +
       ' WHERE e.job_id = "job_id" AND e.saraly > 6000000 AND e.first_name > 100'
      const result = lint({
        text: sql,
        formatType: 'json',
        fix: true
      })
      const parsed = JSON.parse(result)
      expect(parsed.length).toEqual(1)
      expect(parsed[0].diagnostics.length).toEqual(0)
      expect(parsed[0].filepath).toEqual('text')
      expect(parsed[0].fixedText).toEqual(`
SELECT
  employees.first_name,
  employees.email,
  e.first_name,
  e.department_id,
  e.manager_id,
  e.hire_date
FROM
  employees e
WHERE
  e.job_id = "job_id" AND
  e.saraly > 6000000 AND
  e.first_name > 100
`.trim())
    })

    it('should be fixed correctly. case2', () => {
      const sql = `
SELECT
  e.email,
  e.first_name, e.hire_date
FROM
  employes e
WHERE
  e.job_id = "jobid1" AND
  e.saraly > 6000000 AND
  e.first_name = "joe"
`.trim()
      const result = lint({
        text: sql,
        formatType: 'json',
        fix: true
      })
      const parsed = JSON.parse(result)
      expect(parsed.length).toEqual(1)
      expect(parsed[0].diagnostics.length).toEqual(0)
      expect(parsed[0].filepath).toEqual('text')
      expect(parsed[0].fixedText).toEqual(`
SELECT
  e.email,
  e.first_name,
  e.hire_date
FROM
  employes e
WHERE
  e.job_id = "jobid1" AND
  e.saraly > 6000000 AND
  e.first_name = "joe"
`.trim())
    })
  })
})