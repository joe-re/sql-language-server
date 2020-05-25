import { loadConfig } from '../../src/cli/loadConfig'

describe('loadConfig', () => {
  describe('valid config', () => {
    test('it should be able to load .sqlintrc.json', () => {
      const result = loadConfig(`${__dirname}/fixtures/loadconfig/json`)
      expect(result).toMatchObject({ rules: { "column-new-line": { level: 2 } } })
    })
    test('it should be able to load .sqlintrc.yaml', () => {
      const result = loadConfig(`${__dirname}/fixtures/loadconfig/yaml`)
      expect(result).toMatchObject({ rules: { "column-new-line": { level: 2 } } })
    })
  })

  describe('invalid config', () => {
    test('it should show error details', () => {
      expect(() => loadConfig(`${__dirname}/fixtures/loadconfig/invalid`)).toThrowError(/Unexpected property "bar"/)
    })
  })

  describe('no config file', () => {
    test('it should load default config', () => {
      const result = loadConfig('no_exists')
      expect(result).toMatchObject({
        rules: {
          'align-column-to-the-first': { level: 2 },
          'column-new-line': { level: 2 },
          'linebreak-after-clause-keyword': { level: 2 },
          'reserved-word-case': { level: 2, option: 'upper' },
          'space-surrounding-operators': { level: 2 },
          'where-clause-new-line': { level: 2 }
        }
      })
    })
  })
})