import * as path from 'path';

import { workspace, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

export function activate(context: ExtensionContext) {
  let serverModule = context.asAbsolutePath(path.join('server', 'dist', 'server.js'));
  let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  let serverOptions: ServerOptions = {
    run : { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
  }

  let clientOptions: LanguageClientOptions = {
    documentSelector: [{scheme: 'file', language: 'sql', pattern: '**/*.sql'}],
    synchronize: {
      configurationSection: 'sqlLanguageServer',
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    }
  }

  let disposable = new LanguageClient('sqlLanguageServer', 'SQL Language Server', serverOptions, clientOptions).start();

  context.subscriptions.push(disposable);
}
