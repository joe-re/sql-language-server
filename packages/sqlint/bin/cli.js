#!/usr/bin/env node

const yargs = require('yargs')
const commands = require('../dist/src/index')

function readStdin() {
  return new Promise((resolve, reject) => {
    let content = ''
    let chunk = ''
    process.stdin.setEncoding('utf8').on('readable', () => {
      while((chunk = process.stdin.read()) !== null) {
        content += chunk
      }
    })
    .on('end', () => resolve(content))
    .on('error', reject)
  })
}

yargs
  .usage('SQLint: Lint tool for SQL')
  .command('* [options] [file]', 'lint sql files', {
    config: {
      alias: 'c',
      type: 'string',
      describe: 'Configuration file path'
    },
    'output': {
      alias: 'o',
      type: 'string',
      describe: 'Specify file to write report to'
    },
    'format': {
      alias: 'f',
      type: 'string',
      choices: ['stylish', 'json'],
      describe: 'Select a output format',
      default: 'stylish'
    },
    'stdin': {
      type: 'boolean',
      describe: 'Lint code provide on <STDIN>',
      default: false
    },
    'fix': {
      type: 'boolean',
      describe: 'Automatically fix problems',
      default: false
    }
  }, async () => {
    if (yargs.argv._.length === 0 && !yargs.argv.stdin) {
      yargs.showHelp()
      process.exit(1)
    }
    const result = commands.lint({
      path: yargs.argv._[0],
      formatType: yargs.argv.format,
      configPath: yargs.argv.config,
      outputFile: yargs.argv.output,
      text: yargs.argv.stdin ? await readStdin() : null,
      fix: yargs.argv.fix
    })
    if (!yargs.argv.output) {
      console.log(result)
    }
  })
  .example('$0 lint ./sql/a.sql', 'lint the specified sql file')
  .help('h')
  .argv


process.stdin.on('close', () => {
  process.exit(0);
})
