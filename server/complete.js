"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_sql_parser_1 = require("@joe-re/node-sql-parser");
const log4js = __importStar(require("log4js"));
const logger = log4js.getLogger();
const CLAUSES = ['SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'LIMIT'];
function extractExpectedLiterals(expected) {
    return expected.filter(v => v.type === 'literal')
        .map(v => v.text)
        .filter((v, i, self) => self.indexOf(v) === i);
}
function getLastToken(sql) {
    const match = sql.match(/^(?:.|\s)*[\s|.|,](.*?)$/);
    if (!match) {
        return sql;
    }
    return match[1];
}
function getColumnRefByPos(columns, pos) {
    return columns.find(v => (v.location.start.line === pos.line + 1 && v.location.start.column <= pos.column) &&
        (v.location.end.line === pos.line + 1 && v.location.end.column >= pos.column));
}
function getFromTableByPos(fromTables, pos) {
    return fromTables.find(v => (v.location.start.line === pos.line + 1 && v.location.start.column <= pos.column) &&
        (v.location.end.line === pos.line + 1 && v.location.end.column >= pos.column));
}
function getCandidatesFromColumnRefNode(columnRefNode, tables) {
    const tableCandidates = tables.map(v => v.table).filter(v => v.startsWith(columnRefNode.table));
    const columnCandidates = Array.prototype.concat.apply([], tables.filter(v => tableCandidates.includes(v.table)).map(v => v.columns));
    return tableCandidates.concat(columnCandidates);
}
function isCursorOnFromClause(sql, pos) {
    try {
        const ast = node_sql_parser_1.Parser.parse(sql);
        return !!getFromTableByPos(ast.from || [], pos);
    }
    catch (_e) {
        return false;
    }
}
function getCandidatesFromError(target, tables, pos, e) {
    let candidates = extractExpectedLiterals(e.expected);
    if (candidates.includes("'") || candidates.includes('"')) {
        return [];
    }
    if (candidates.includes('.')) {
        candidates = candidates.concat(tables.map(v => v.table));
    }
    const lastChar = target[target.length - 1];
    logger.debug(`lastChar: ${lastChar}`);
    if (lastChar === '.') {
        const removedLastDotTarget = target.slice(0, target.length - 1);
        if (!isCursorOnFromClause(removedLastDotTarget, { line: pos.line, column: pos.column - 1 })) {
            const tableName = getLastToken(removedLastDotTarget);
            const table = tables.find(v => v.table === tableName);
            if (table) {
                candidates = table.columns;
            }
        }
    }
    return candidates;
}
function complete(sql, pos, tables = []) {
    logger.debug(`complete: ${sql}, ${JSON.stringify(pos)}`);
    let candidates = [];
    let error = null;
    const target = sql.split('\n').filter((_v, idx) => pos.line >= idx).map((v, idx) => idx === pos.line ? v.slice(0, pos.column) : v).join('\n');
    logger.debug(`target: ${target}`);
    try {
        candidates = [].concat(CLAUSES);
        const ast = node_sql_parser_1.Parser.parse(target);
        const ar = new node_sql_parser_1.AstReader(ast);
        logger.debug(`ast: ${JSON.stringify(ar.getAst())}`);
        if (!ar.getAst().distinct) {
            candidates.push('DISTINCT');
        }
        if (Array.isArray(ar.getAst().columns)) {
            const selectColumnRefs = ar.getAst().columns.map((v) => v.expr).filter((v) => !!v);
            const whereColumnRefs = ar.getAst().where || [];
            const columnRef = getColumnRefByPos(selectColumnRefs.concat(whereColumnRefs), pos);
            logger.debug(JSON.stringify(columnRef));
            if (columnRef) {
                candidates = candidates.concat(getCandidatesFromColumnRefNode(columnRef, tables));
            }
        }
        if (Array.isArray(ar.getAst().from)) {
            const fromTable = getFromTableByPos(ar.getAst().from || [], pos);
            if (fromTable) {
                candidates = candidates.concat(tables.map(v => v.table))
                    .concat(['INNER JOIN', 'LEFT JOIN']);
                if (fromTable.join && !fromTable.on) {
                    candidates.push('ON');
                }
            }
        }
    }
    catch (e) {
        logger.debug('error');
        logger.debug(e);
        if (e.name !== 'SyntaxError') {
            throw e;
        }
        candidates = getCandidatesFromError(target, tables, pos, e);
        error = { label: e.name, detail: e.message, line: e.line, offset: e.offset };
    }
    const lastToken = getLastToken(target);
    logger.debug(`lastToken: ${lastToken}`);
    candidates = candidates.filter(v => v.startsWith(lastToken));
    return { candidates, error };
}
exports.default = complete;
