import { IPCMessageReader, IPCMessageWriter, createConnection, TextDocuments } from 'vscode-languageserver';

function createServer() {
  const connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
  connection.onCompletion(docParams => {
    console.log(`completion requested for document ${docParams.textDocument.uri}`);
    return {
      isIncomplete: true,
      items: []
    }
  })
  const documents = new TextDocuments();
  documents.listen(connection);
  connection.listen();
}