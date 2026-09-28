#!/usr/bin/env node

const yargs = require('yargs')
const { hideBin } = require('yargs/helpers')
const commands = require('../dist/src/index')
const { version } = require('../package.json')

async function readStdin() {
  let content = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) {
    content += chunk
  }
  return content
}

yargs(hideBin(process.argv))
  .scriptName('sqlint')
  .version(version)
  .usage('SQLint: Lint tool for SQL')
  .command(
    '* [options] [file]',
    'lint sql files',
    {
      config: {
        alias: 'c',
        type: 'string',
        describe: 'Configuration file path',
      },
      output: {
        alias: 'o',
        type: 'string',
        describe: 'Specify file to write report to',
      },
      format: {
        alias: 'f',
        type: 'string',
        choices: ['stylish', 'json'],
        describe: 'Select a output format',
        default: 'stylish',
      },
      stdin: {
        type: 'boolean',
        describe: 'Lint code provide on <STDIN>',
        default: false,
      },
      fix: {
        type: 'boolean',
        describe: 'Automatically fix problems',
        default: false,
      },
    },
    async (argv) => {
      // `* [options] [file]`: the first positional argument is `options`
      const file = argv.file ?? argv.options ?? argv._[0]
      if (!file && !argv.stdin) {
        yargs(hideBin(process.argv)).scriptName('sqlint').showHelp()
        process.exit(1)
      }
      const result = commands.lint({
        path: file,
        formatType: argv.format,
        configPath: argv.config,
        outputFile: argv.output,
        text: argv.stdin ? await readStdin() : null,
        fix: argv.fix,
      })
      if (!argv.output) {
        console.log(result)
      }
    }
  )
  .example('$0 ./sql/a.sql', 'lint the specified sql file')
  .help('h')
  .parse()
