import App from './App.svelte';
import { initClient } from './client'

require('monaco-editor-core');
(self as any).MonacoEnvironment = {
    getWorkerUrl: () => './editor.worker.bundle.js'
}

const app = new App({
  target: document.body,
});

(window as any).app = app;

initClient()

// export default app;