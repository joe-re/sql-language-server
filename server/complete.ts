import { Parser, AstReader } from '@joe-re/node-sql-parser'
import * as log4js from 'log4js';

const logger = log4js.getLogger()

type Table = { table: string, columns: string[] }
type ColumnRefNode = {
	type: 'column_ref',
	table: string,
	column: string,
	location: {
		start: { offset: number, line: number, column: number },
		end: { offset: number, line: number, column: number },
	}
}

const CLAUSES = ['SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'LIMIT']

function extractExpectedLiterals(expected: { type: string, text: string }[]): string[] {
	return expected.filter(v => v.type === 'literal')
		.map(v => v.text)
		.filter((v, i, self) => self.indexOf(v) === i)
}

function getLastToken(sql: string) {
	const match = sql.match(/^.*[\s|.|,](.*?)$/)
	if (!match) { return sql }
	return match[1]
}

function getColumnRefByPos(columns: ColumnRefNode[], pos: { line: number, column: number }) {
	return columns.find(v =>
		(v.location.start.line === pos.line + 1 && v.location.start.column <= pos.column) &&
		(v.location.end.line === pos.line + 1 && v.location.end.column >= pos.column)
	)
}

function getCandidatesFromColumnRefNode(columnRefNode: ColumnRefNode, tables: Table[]) {
	const tableCandidates = tables.map(v => v.table).filter(v => v.startsWith(columnRefNode.table))
	const columnCandidates = Array.prototype.concat.apply([], tables.filter(v => tableCandidates.includes(v.table)).map(v => v.columns))
	return tableCandidates.concat(columnCandidates)
}

export default function complete(sql: string, pos: { line: number, column: number }, tables: Table[] = []) {
    logger.debug(`complete: ${sql}, ${JSON.stringify(pos)}`)
	let candidates: string[] = []
	let error = null;
	const target = sql.split('\n').filter((_v, idx) => pos.line >= idx).map((v, idx) => idx === pos.line ? v.slice(0, pos.column) : v).join('\n')
	logger.debug(`target: ${target}`)
	try {
		candidates = CLAUSES
		logger.debug('before parse')
		const ast = Parser.parse(target);
		const ar = new AstReader(ast)
		logger.debug(`ast: ${JSON.stringify(ar.getAst())}`)
   	logger.debug(`columns: ${JSON.stringify(ar.getAst().columns)}`)
		if (Array.isArray(ar.getAst().columns)) {
			const columnRef = getColumnRefByPos(ar.getAst().columns.map((v: any) => v.expr), pos)
      logger.debug(JSON.stringify(columnRef))
			if (columnRef) {
				candidates = candidates.concat(getCandidatesFromColumnRefNode(columnRef, tables))
			}
		}
	} catch (e) {
		logger.debug('error')
		logger.debug(e)
		if (e.name !== 'SyntaxError') {
			throw e
		}
		candidates = extractExpectedLiterals(e.expected)
    if (target[pos.column - 1] === '.') {
      const tableName = getLastToken(target.slice(0, target.length - 1))
      const table = tables.find(v => v.table === tableName)
      if (table) {
        candidates = table.columns
      }
    }
		error = {
			label: e.name,
			detail: e.message,
			line: e.line,
			offset: e.offset
		}
	}
	const lastToken = getLastToken(target)
	candidates = candidates.filter(v => v.startsWith(lastToken))
	return { candidates, error }
}
