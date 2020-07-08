"use strict";
require('monaco-editor-core');
self.MonacoEnvironment = {
    getWorkerUrl: () => './editor.worker.bundle.js'
};
require('./client');
//# sourceMappingURL=main.js.map