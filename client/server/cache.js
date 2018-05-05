"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
class Cache {
    constructor() {
        this._cache = new Map();
    }
    get(uri) {
        let contents = this._cache.get(uri);
        return contents;
    }
    set(uri, contents) {
        this._cache.set(uri, contents);
    }
    setFromUri(uri) {
        this.set(uri, fs.readFileSync(uri, 'utf8'));
    }
}
exports.default = new Cache();
//# sourceMappingURL=cache.js.map