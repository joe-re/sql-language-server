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
function getCandidatesFromError(target, tables, pos, e, fromClauseTables) {
    let candidates = extractExpectedLiterals(e.expected);
    console.log(candidates);
    if (candidates.includes("'") || candidates.includes('"')) {
        return [];
    }
    if (candidates.includes('.')) {
        candidates = candidates.concat(tables.map(v => v.table));
    }
    const lastChar = target[target.length - 1];
    logger.debug(`lastChar: ${lastChar}`);
    console.log('lastchar!');
    console.log(lastChar);
    if (lastChar === '.') {
        const removedLastDotTarget = target.slice(0, target.length - 1);
        if (isCursorOnFromClause(removedLastDotTarget, { line: pos.line, column: pos.column - 1 })) {
            return [];
        }
        const tableName = getLastToken(removedLastDotTarget);
        const attachedAlias = tables.map(v => {
            const as = fromClauseTables.filter(v2 => v.table === v2.table).map(v => v.as);
            return Object.assign({}, v, { as: as ? as : [] });
        });
        console.log('attachedAlias');
        console.log(attachedAlias);
        let table = attachedAlias.find(v => v.table === tableName || v.as.includes(tableName));
        if (table) {
            candidates = table.columns;
        }
    }
    return candidates;
}
function getTableNodeFromClause(sql) {
    try {
        return node_sql_parser_1.Parser.parseFromClause(sql).from;
    }
    catch (_e) {
        // no-op
        return null;
    }
}
function complete(sql, pos, tables = []) {
    logger.debug(`complete: ${sql}, ${JSON.stringify(pos)}`);
    let candidates = [];
    let error = null;
    const target = sql.split('\n').filter((_v, idx) => pos.line >= idx).map((v, idx) => idx === pos.line ? v.slice(0, pos.column) : v).join('\n');
    logger.debug(`target: ${target}`);
    console.log(`target: ${target}`);
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
        const fromClauseTables = getTableNodeFromClause(sql) || [];
        console.log(fromClauseTables);
        candidates = getCandidatesFromError(target, tables, pos, e, fromClauseTables);
        error = { label: e.name, detail: e.message, line: e.line, offset: e.offset };
    }
    const lastToken = getLastToken(target);
    logger.debug(`lastToken: ${lastToken}`);
    candidates = candidates.filter(v => v.startsWith(lastToken));
    return { candidates, error };
}
exports.default = complete;
