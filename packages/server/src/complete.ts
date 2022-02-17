/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: remove all "any" types from this file
import {
  parse,
  parseFromClause,
  SelectStatement,
  FromTableNode,
  ColumnRefNode,
  IncompleteSubqueryNode,
  FromClauseParserResult,
  DeleteStatement,
} from "@joe-re/sql-parser";
import log4js from "log4js";
import { Schema, Table } from "./database_libs/AbstractClient";
import { CompletionItem } from "vscode-languageserver-types";
import {
  makeTableAlias,
  getRidOfAfterPosString,
  getLastToken,
  makeTableName,
  isPosInLocation,
  toCompletionItemForKeyword,
  toCompletionItemForAlias,
  toCompletionItemForFunction,
  ICONS,
} from "./complete/utils";
import { Identifier } from "./complete/Identifier";

type Pos = { line: number; column: number };

const logger = log4js.getLogger();

const CLAUSES: string[] = [
  "SELECT",
  "WHERE",
  "ORDER BY",
  "GROUP BY",
  "LIMIT",
  "--",
  "/*",
  "(",
];

const UNDESIRED_LITERAL = [
  "+",
  "-",
  "*",
  "$",
  ":",
  "COUNT",
  "AVG",
  "SUM",
  "MIN",
  "MAX",
  "`",
  '"',
  "'",
];

function getFromNodesFromClause(sql: string): FromClauseParserResult | null {
  try {
    return parseFromClause(sql);
  } catch (_e) {
    // no-op
    return null;
  }
}

class Completer {
  lastToken = "";
  candidates: CompletionItem[] = [];
  schema: Schema;
  error: any = "";
  sql: string;
  pos: Pos;
  isSpaceTriggerCharacter = false;
  isDotTriggerCharacter = false;
  jupyterLabMode: boolean;

  constructor(schema: Schema, sql: string, pos: Pos, jupyterLabMode: boolean) {
    this.schema = schema;
    this.sql = sql;
    this.pos = pos;
    this.jupyterLabMode = jupyterLabMode;
  }

  complete() {
    const target = getRidOfAfterPosString(this.sql, this.pos);
    logger.debug(`target: ${target}`);
    this.lastToken = getLastToken(target);
    const idx = this.lastToken.lastIndexOf(".");
    this.isSpaceTriggerCharacter = this.lastToken === "";
    this.isDotTriggerCharacter =
      !this.isSpaceTriggerCharacter && idx == this.lastToken.length - 1;

    try {
      const ast = parse(target);
      this.addCandidatesForParsedStatement(ast);
    } catch (e: any) {
      logger.debug("error");
      logger.debug(e);
      if (e.name !== "SyntaxError") {
        throw e;
      }
      const parsedFromClause = getFromNodesFromClause(this.sql);
      if (parsedFromClause) {
        const fromNodes = this.getAllNestedFromNodes(
          parsedFromClause?.from?.tables || []
        );
        const fromNodeOnCursor = this.getFromNodeByPos(fromNodes);
        if (
          fromNodeOnCursor &&
          fromNodeOnCursor.type === "incomplete_subquery"
        ) {
          // Incomplete sub query 'SELECT sub FROM (SELECT e. FROM employees e) sub'
          this.addCandidatesForIncompleteSubquery(fromNodeOnCursor);
        } else {
          this.addCandidatesForSelectQuery(e, fromNodes);
          this.addCandidatesForJoins(e.expected || [], fromNodes);
        }
      } else if (e.message === "EXPECTED COLUMN NAME") {
        this.addCandidatesForInsert();
      } else {
        this.addCandidatesForError(e);
      }
      this.error = {
        label: e.name,
        detail: e.message,
        line: e.line,
        offset: e.offset,
      };
    }
    return this.candidates;
  }

  addCandidatesForBasicKeyword() {
    CLAUSES.map((v) => toCompletionItemForKeyword(v)).forEach((v) =>
      this.addCandidateIfStartsWithLastToken(v)
    );
  }

  // Check if parser expects us to terminate a single quote value or double quoted column name
  // SELECT TABLE1.COLUMN1 FROM TABLE1 WHERE TABLE1.COLUMN1 = "hoge.
  // We don't offer the ', the ", the ` as suggestions
  addCandidatesForExpectedLiterals(expected: { type: string; text: string }[]) {
    const literals = expected
      .filter((v) => v.type === "literal")
      .map((v) => v.text);
    const uniqueLiterals = [...new Set(literals)];
    uniqueLiterals
      .filter((v) => !UNDESIRED_LITERAL.includes(v))
      .map((v) => {
        switch (v) {
          case "ORDER":
            return "ORDER BY";
          case "GROUP":
            return "GROUP BY";
          case "LEFT":
            return "LEFT JOIN";
          case "RIGHT":
            return "RIGHT JOIN";
          case "INNER":
            return "INNER JOIN";
          default:
            return v;
        }
      })
      .map((v) => toCompletionItemForKeyword(v))
      .forEach((v) => this.addCandidateIfStartsWithLastToken(v));
  }

  getColumnRefByPos(columns: ColumnRefNode[]) {
    return columns.find(
      (v) =>
        // guard against ColumnRefNode that don't have a location,
        // for example sql functions that are not known to the parser
        v.location &&
        v.location.start.line === this.pos.line + 1 &&
        v.location.start.column <= this.pos.column &&
        v.location.end.line === this.pos.line + 1 &&
        v.location.end.column >= this.pos.column
    );
  }

  /**
   * Finds the most deeply nested FROM node that have a range encompasing the position.
   * In cases such as SELECT * FROM T1 JOIN (SELECT * FROM (SELECT * FROM T2 <pos>))
   * We will get a list of nodes like this
   * SELECT * FROM T1
   * (SELECT * FROM
   *    (SELECT * FROM T2))
   * The idea is to reverse the list so that the most nested queries come first. Then
   * apply a filter to keep only the FROM nodes which encompass the position and take
   * the first one from that resulting list.
   * @param fromNodes
   * @param pos
   * @returns
   */
  getFromNodeByPos(fromNodes: FromTableNode[]) {
    return fromNodes
      .reverse()
      .filter((tableNode) => isPosInLocation(tableNode.location, this.pos))
      .shift();
  }

  /**
   * Given a table returns all possible ways to refer to it.
   * That is by table name only, using the database scope,
   * using the catalog and database scopes.
   * @param table
   * @returns
   */
  allTableNameCombinations(table: Table): string[] {
    const names = [table.tableName];
    if (table.database) names.push(table.database + "." + table.tableName);
    if (table.catalog)
      names.push(table.catalog + "." + table.database + "." + table.tableName);
    return names;
  }

  addCandidatesForTables(tables: Table[]) {
    tables
      .flatMap((table) => this.allTableNameCombinations(table))
      .map((aTableNameVariant) => {
        return new Identifier(
          this.lastToken,
          aTableNameVariant,
          "",
          ICONS.TABLE,
        );
      })
      .filter((item) => item.matchesLastToken())
      .map((item) => item.toCompletionItem())
      .forEach((item) => this.addCandidate(item));
  }

  addCandidatesForColumnsOfAnyTable(tables: Table[]) {
    tables
      .flatMap((table) => table.columns)
      .map((column) => {
        return new Identifier(
          this.lastToken,
          column.columnName,
          column.description,
          ICONS.TABLE,
        );
      })
      .filter((item) => item.matchesLastToken())
      .map((item) => item.toCompletionItem())
      .forEach((item) => this.addCandidate(item));
  }

  addCandidate(item: CompletionItem) {
    // JupyterLab requires the dot or space character preceeding the <tab> key pressed
    // If the dot or space character are not added to the label then searching
    // in the list of suggestion does not work.
    // Here we fix this issue by adding the dot or space character
    // to the filterText and insertText.
    // TODO: report this issue to JupyterLab-LSP project.
    if (this.jupyterLabMode) {
      const text = item.insertText || item.label;
      if (this.isSpaceTriggerCharacter) {
        item.insertText = " " + text;
        item.filterText = " " + text;
      } else if (this.isDotTriggerCharacter) {
        item.insertText = "." + text;
        item.filterText = "." + text;
      }
    }
    this.candidates.push(item);
  }

  addCandidateIfStartsWithLastToken(item: CompletionItem) {
    if (item.label.startsWith(this.lastToken)) {
      this.addCandidate(item);
    }
  }

  addCandidatesForIncompleteSubquery(
    incompleteSubquery: IncompleteSubqueryNode
  ) {
    const parsedFromClause = getFromNodesFromClause(incompleteSubquery.text);
    try {
      parse(incompleteSubquery.text);
    } catch (e: any) {
      if (e.name !== "SyntaxError") {
        throw e;
      }
      const fromText = incompleteSubquery.text;
      const newPos = parsedFromClause
        ? {
            line: this.pos.line - (incompleteSubquery.location.start.line - 1),
            column:
              this.pos.column - incompleteSubquery.location.start.column + 1,
          }
        : { line: 0, column: 0 };
      const completer = new Completer(
        this.schema,
        fromText,
        newPos,
        this.jupyterLabMode
      );
      completer.complete().forEach((item) => this.addCandidate(item));
    }
  }

  createTablesFromFromNodes(fromNodes: FromTableNode[]): Table[] {
    return fromNodes.reduce((p: any, c) => {
      if (c.type !== "subquery") {
        return p;
      }
      if (!Array.isArray(c.subquery.columns)) {
        return p;
      }
      const columns = c.subquery.columns.map((v) => {
        if (typeof v === "string") {
          return null;
        }
        return {
          columnName:
            v.as || (v.expr.type === "column_ref" && v.expr.column) || "",
          description: "alias",
        };
      });
      return p.concat({ database: null, columns, tableName: c.as });
    }, []);
  }

  /**
   * INSERT INTO TABLE1 (C
   */
  addCandidatesForInsert() {
    this.addCandidatesForColumnsOfAnyTable(this.schema.tables);
  }

  addCandidatesForError(e: any) {
    this.addCandidatesForExpectedLiterals(e.expected || []);
    this.addCandidatesForFunctions();
    this.addCandidatesForTables(this.schema.tables);
  }

  addCandidatesForSelectQuery(e: any, fromNodes: FromTableNode[]) {
    const subqueryTables = this.createTablesFromFromNodes(fromNodes);
    const schemaAndSubqueries = this.schema.tables.concat(subqueryTables);
    this.addCandidatesForSelectStar(fromNodes, schemaAndSubqueries);
    this.addCandidatesForExpectedLiterals(e.expected || []);
    this.addCandidatesForFunctions();
    this.addCandidatesForScopedColumns(fromNodes, schemaAndSubqueries);
    this.addCandidatesForAliases(fromNodes);
    this.addCandidatesForTables(schemaAndSubqueries);
    if (logger.isDebugEnabled())
      logger.debug(
        `candidates for error returns: ${JSON.stringify(this.candidates)}`
      );
  }

  addCandidatesForJoins(
    expected: { type: string; text: string }[],
    fromNodes: FromTableNode[]
  ) {
    let joinType = "";
    if ("INNER".startsWith(this.lastToken)) joinType = "INNER";
    if ("LEFT".startsWith(this.lastToken)) joinType = "LEFT";
    if ("RIGH".startsWith(this.lastToken)) joinType = "RIGHT";

    if (joinType && expected.map((v) => v.text).find((v) => v === "JOIN")) {
      if (fromNodes && fromNodes.length > 0) {
        const fromNode: any = fromNodes[0];
        const fromAlias = fromNode.as || fromNode.table;
        const fromTable = this.schema.tables.find((table) =>
          this.tableMatch(fromNode, table)
        );

        this.schema.tables
          .filter((table) => table != fromTable)
          .forEach((table) => {
            table.columns
              .filter((column) =>
                fromTable?.columns
                  .map((col) => col.columnName)
                  .includes(column.columnName)
              )
              .map((column) => {
                return {
                  tableName: makeTableName(table),
                  alias: makeTableAlias(table.tableName),
                  columnName: column.columnName,
                };
              })
              .map((match) => {
                const label = `${joinType} JOIN ${match.tableName} AS ${match.alias} ON ${match.alias}.${match.columnName} = ${fromAlias}.${match.columnName}`;
                return {
                  label: label,
                  detail: "utility",
                  kind: ICONS.UTILITY,
                };
              })
              .forEach((item) => this.addCandidate(item));
          });
      }
    }
  }

  getRidOfAfterCursorString() {
    return this.sql
      .split("\n")
      .filter((_v, idx) => this.pos.line >= idx)
      .map((v, idx) =>
        idx === this.pos.line ? v.slice(0, this.pos.column) : v
      )
      .join("\n");
  }

  addCandidatesForParsedDeleteStatement(ast: DeleteStatement) {
    if (isPosInLocation(ast.table.location, this.pos)) {
      this.addCandidatesForTables(this.schema.tables);
    } else if (
      ast.where &&
      isPosInLocation(ast.where.expression.location, this.pos)
    ) {
      const expr = ast.where.expression;
      if (expr.type === "column_ref") {
        this.addCandidatesForColumnsOfAnyTable(this.schema.tables);
      }
    }
  }

  completeSelectStatement(ast: SelectStatement) {
    if (Array.isArray(ast.columns)) {
      this.addCandidateIfStartsWithLastToken(
        toCompletionItemForKeyword("FROM")
      );
      this.addCandidateIfStartsWithLastToken(
        toCompletionItemForKeyword("AS")
      );
    }
  }

  /**
   * Recursively pull out the FROM nodes (including sub-queries)
   * @param tableNodes
   * @returns
   */
  getAllNestedFromNodes(tableNodes: FromTableNode[]): FromTableNode[] {
    return tableNodes.flatMap((tableNode) => {
      let result = [tableNode];
      if (tableNode.type == "subquery") {
        const subTableNodes = tableNode.subquery.from?.tables || [];
        result = result.concat(this.getAllNestedFromNodes(subTableNodes));
      }
      return result;
    });
  }

  addCandidatesForParsedSelectQuery(ast: any) {
    this.addCandidatesForBasicKeyword();
    this.completeSelectStatement(ast);
    if (!ast.distinct) {
      this.addCandidateIfStartsWithLastToken(
        toCompletionItemForKeyword("DISTINCT")
      );
    }
    const columnRef = this.findColumnAtPosition(ast);
    if (!columnRef) {
      this.addJoinCondidates(ast);
    } else {
      const parsedFromClause = getFromNodesFromClause(this.sql);
      const fromNodes = parsedFromClause?.from?.tables || [];
      const subqueryTables = this.createTablesFromFromNodes(fromNodes);
      const schemaAndSubqueries = this.schema.tables.concat(subqueryTables);
      if (columnRef.table) {
        // We know what table/alias this column belongs to
        // Find the corresponding table and suggest it's columns
        this.addCandidatesForScopedColumns(fromNodes, schemaAndSubqueries);
      } else {
        // Column is not scoped to a table/alias yet
        // Could be an alias, a talbe or a function
        this.addCandidatesForAliases(fromNodes);
        this.addCandidatesForTables(schemaAndSubqueries);
        this.addCandidatesForFunctions();
      }
    }
    if (logger.isDebugEnabled())
      logger.debug(`parse query returns: ${JSON.stringify(this.candidates)}`);
  }

  addCandidatesForParsedStatement(ast: any) {
    if (logger.isDebugEnabled())
      logger.debug(
        `getting candidates for parse query ast: ${JSON.stringify(ast)}`
      );
    if (!ast.type) {
      this.addCandidatesForBasicKeyword();
    } else if (ast.type === "delete") {
      this.addCandidatesForParsedDeleteStatement(ast);
    } else if (ast.type === "select") {
      this.addCandidatesForParsedSelectQuery(ast);
    } else {
      console.log(`AST type not supported yet: ${ast.type}`);
    }
  }

  addJoinCondidates(ast: any) {
    // from clause: complete 'ON' keyword on 'INNER JOIN'
    if (ast.type === "select" && Array.isArray(ast.from?.tables)) {
      const fromTable = this.getFromNodeByPos(ast.from?.tables || []);
      if (fromTable && fromTable.type === "table") {
        this.addCandidatesForTables(this.schema.tables);
        this.addCandidateIfStartsWithLastToken(
          toCompletionItemForKeyword("INNER JOIN")
        );
        this.addCandidateIfStartsWithLastToken(
          toCompletionItemForKeyword("LEFT JOIN")
        );
        if (fromTable.join && !fromTable.on) {
          this.addCandidateIfStartsWithLastToken(
            toCompletionItemForKeyword("ON")
          );
        }
      }
    }
  }

  findColumnAtPosition(ast: any): ColumnRefNode | undefined {
    const columns = ast.columns;
    if (Array.isArray(columns)) {
      // columns in select clause
      const columnRefs = (columns as any)
        .map((col: any) => col.expr)
        .filter((expr: any) => !!expr);
      if (ast.type === "select" && ast.where?.expression) {
        // columns in where clause
        columnRefs.push(ast.where.expression);
      }
      // column at position
      const columnRef = this.getColumnRefByPos(columnRefs);
      if (logger.isDebugEnabled()) logger.debug(JSON.stringify(columnRef));
      return columnRef;
    } else if (columns.type == "star") {
      if (ast.type === "select" && ast.where?.expression) {
        // columns in where clause
        const columnRefs = [ast.where.expression];
        // column at position
        const columnRef = this.getColumnRefByPos(columnRefs);
        if (logger.isDebugEnabled()) logger.debug(JSON.stringify(columnRef));
        return columnRef;
      }
    }
    return undefined;
  }

  addCandidatesForFunctions() {
    console.time("addCandidatesForFunctions");
    if (!this.lastToken) {
      // Nothing was typed, return all lowercase functions
      this.schema.functions
        .map((func) => toCompletionItemForFunction(func))
        .forEach((item) => this.addCandidate(item));
    } else {
      // If user typed the start of the function
      const lower = this.lastToken.toLowerCase();
      const isTypedUpper = this.lastToken != lower;
      this.schema.functions
        // Search using lowercase prefix
        .filter((v) => v.name.startsWith(lower))
        // If typed string is in upper case, then return upper case suggestions
        .map((v) => {
          if (isTypedUpper) v.name = v.name.toUpperCase();
          return v;
        })
        .map((v) => toCompletionItemForFunction(v))
        .forEach((item) => this.addCandidate(item));
    }
    console.timeEnd("addCandidatesForFunctions");
  }

  makeColumnName(alias: string, columnName: string) {
    return alias ? alias + "." + columnName : columnName;
  }

  addCandidatesForSelectStar(fromNodes: FromTableNode[], tables: Table[]) {
    console.time("addCandidatesForSelectStar");
    tables
      .flatMap((table) => {
        return fromNodes
          .filter((fromNode: any) => this.tableMatch(fromNode, table))
          .map((fromNode: any) => fromNode.as || fromNode.table)
          .filter(
            () =>
              this.lastToken.toUpperCase() === "SELECT" || // complete SELECT keyword
              this.lastToken === ""
          ) // complete at space after SELECT
          .map((alias) => {
            const columnNames = table.columns
              .map((col) => this.makeColumnName(alias, col.columnName))
              .join(",\n");
            const label = `Select all columns from ${alias}`;
            let prefix = "";
            if (this.lastToken) {
              prefix = this.lastToken + "\n";
            }

            return {
              label: label,
              insertText: prefix + columnNames,
              filterText: prefix + label,
              detail: "utility",
              kind: ICONS.UTILITY,
            };
          });
      })
      .forEach((item) => this.addCandidate(item));
    console.timeEnd("addCandidatesForSelectStar");
  }

  addCandidatesForScopedColumns(fromNodes: FromTableNode[], tables: Table[]) {
    console.time("addCandidatesForScopedColumns");
    tables
      .flatMap((table) => {
        return fromNodes
          .filter((fromNode: any) => this.tableMatch(fromNode, table))
          .map((fromNode: any) => fromNode.as || fromNode.table)
          .filter((alias) => this.lastToken.startsWith(alias + "."))
          .flatMap((alias) =>
            table.columns.map((col) => {
              return new Identifier(
                this.lastToken,
                this.makeColumnName(alias, col.columnName),
                col.description,
                ICONS.COLUMN,
              );
            })
          );
      })
      .filter((item) => item.matchesLastToken())
      .map((item) => item.toCompletionItem())
      .forEach((item) => this.addCandidate(item));
    console.timeEnd("addCandidatesForScopedColumns");
  }

  /**
   * Test if the given table matches the fromNode.
   * @param fromNode
   * @param table
   * @returns
   */
  tableMatch(fromNode: any, table: Table) {
    // Assume table matches from node and disprove
    let matchingTable = true;
    if (fromNode.type == "subquery") {
      // If we have an alias it should match the subquery table name
      if (fromNode.as && fromNode.as != table.tableName) {
        matchingTable = false;
      }
    }
    // Regular tables
    // If we have a from node with a table name
    // and it does not match the table, we know it's not a match
    else {
      if (fromNode.table && fromNode.table != table.tableName) {
        matchingTable = false;
      } else if (fromNode.db && fromNode.db != table.database) {
        matchingTable = false;
      } else if (fromNode.catalog && fromNode.catalog != table.catalog) {
        matchingTable = false;
      }
    }
    return matchingTable;
  }

  addCandidatesForAliases(fromNodes: FromTableNode[]) {
    fromNodes
      .map((fromNode: any) => fromNode.as)
      .filter((aliasName) => aliasName && aliasName.startsWith(this.lastToken))
      .map((aliasName) => toCompletionItemForAlias(aliasName))
      .forEach((item) => this.addCandidate(item));
  }
}

export function complete(
  sql: string,
  pos: Pos,
  schema: Schema = { tables: [], functions: [] },
  jupyterLabMode = false
) {
  console.time("complete");
  if (logger.isDebugEnabled())
    logger.debug(`complete: ${sql}, ${JSON.stringify(pos)}`);
  const completer = new Completer(schema, sql, pos, jupyterLabMode);
  const candidates = completer.complete();
  console.timeEnd("complete");
  return { candidates: candidates, error: completer.error };
}
