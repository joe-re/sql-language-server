import * as path from 'path';

import { workspace, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

export function activate(context: ExtensionContext) {
  let serverModule = context.asAbsolutePath(path.join('server', 'dist', 'bin', 'cli.js'))
  let execArgs = ['up', '--method', 'node-ipc']
  let debugOptions = { execArgv: ['--debug', '--nolazy', '--inspect=6009'] }

  let serverOptions: ServerOptions = {
    run : { module: serverModule, transport: TransportKind.ipc, args: execArgs },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions, args:execArgs }
  }

  let clientOptions: LanguageClientOptions = {
    documentSelector: [{scheme: 'file', language: 'sql', pattern: '**/*.sql'}],
    synchronize: {
      configurationSection: 'sqlLanguageServer',
      fileEvents: workspace.createFileSystemWatcher('**/.sqllsrc.json')
    }
  }

  let disposable = new LanguageClient('sqlLanguageServer', 'SQL Language Server', serverOptions, clientOptions).start()

  context.subscriptions.push(disposable)
}
