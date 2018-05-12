"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
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
