import {
  ColumnRefNode,
  ExpectedLiteralNode,
  FromTableNode,
  NodeRange,
} from "@joe-re/sql-parser";
import {
  CompletionItem,
  CompletionItemKind,
} from "vscode-languageserver-types";
import { Table, DbFunction } from "../database_libs/AbstractClient";
import { Identifier } from "./Identifier";

type Pos = { line: number; column: number };

export const ICONS = {
  KEYWORD: CompletionItemKind.Text,
  COLUMN: CompletionItemKind.Interface,
  TABLE: CompletionItemKind.Field,
  FUNCTION: CompletionItemKind.Property,
  ALIAS: CompletionItemKind.Variable,
  UTILITY: CompletionItemKind.Event,
};

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

export function makeTableAlias(tableName: string): string {
  if (tableName.length > 3) {
    return tableName.substring(0, 3);
  }
  return tableName;
}

export function getRidOfAfterPosString(sql: string, pos: Pos) {
  return sql
    .split("\n")
    .filter((_v, idx) => pos.line >= idx)
    .map((v, idx) => (idx === pos.line ? v.slice(0, pos.column) : v))
    .join("\n");
}

// Gets the last token from the given string considering that tokens can contain dots.
export function getLastToken(sql: string): string {
  const match = sql.match(/^(?:.|\s)*[^A-z0-9\\.:'](.*?)$/);
  if (match) {
    let prevToken = "";
    let currentToken = match[1];
    while (currentToken != prevToken) {
      prevToken = currentToken;
      currentToken = prevToken.replace(/\[.*?\]/, "");
    }
    return currentToken;
  }
  return sql;
}

export function makeTableName(table: Table): string {
  if (table.catalog) {
    return table.catalog + "." + table.database + "." + table.tableName;
  } else if (table.database) {
    return table.database + "." + table.tableName;
  }
  return table.tableName;
}

export function isPosInLocation(location: NodeRange, pos: Pos) {
  return (
    location.start.line === pos.line + 1 &&
    location.start.column <= pos.column &&
    location.end.line === pos.line + 1 &&
    location.end.column >= pos.column
  );
}

export function toCompletionItemForFunction(f: DbFunction): CompletionItem {
  const item: CompletionItem = {
    label: f.name,
    detail: "function",
    kind: ICONS.FUNCTION,
    documentation: f.description,
  };
  return item;
}

export function toCompletionItemForAlias(alias: string): CompletionItem {
  const item: CompletionItem = {
    label: alias,
    detail: "alias",
    kind: ICONS.ALIAS,
  };
  return item;
}

export function toCompletionItemForKeyword(name: string): CompletionItem {
  const item: CompletionItem = {
    label: name,
    kind: ICONS.KEYWORD,
    detail: "keyword",
  };
  return item;
}

export function createCandidatesForColumnsOfAnyTable(
  tables: Table[],
  lastToken: string
): CompletionItem[] {
  return tables
    .flatMap((table) => table.columns)
    .map((column) => {
      return new Identifier(
        lastToken,
        column.columnName,
        column.description,
        ICONS.TABLE
      );
    })
    .filter((item) => item.matchesLastToken())
    .map((item) => item.toCompletionItem());
}

export function createCandidatesForTables(tables: Table[], lastToken: string) {
  return tables
    .flatMap((table) => allTableNameCombinations(table))
    .map((aTableNameVariant) => {
      return new Identifier(lastToken, aTableNameVariant, "", ICONS.TABLE);
    })
    .filter((item) => item.matchesLastToken())
    .map((item) => item.toCompletionItem());
}

/**
 * Given a table returns all possible ways to refer to it.
 * That is by table name only, using the database scope,
 * using the catalog and database scopes.
 * @param table
 * @returns
 */
export function allTableNameCombinations(table: Table): string[] {
  const names = [table.tableName];
  if (table.database) names.push(table.database + "." + table.tableName);
  if (table.catalog)
    names.push(table.catalog + "." + table.database + "." + table.tableName);
  return names;
}

// Check if parser expects us to terminate a single quote value or double quoted column name
// SELECT TABLE1.COLUMN1 FROM TABLE1 WHERE TABLE1.COLUMN1 = "hoge.
// We don't offer the ', the ", the ` as suggestions
export function createCandidatesForExpectedLiterals(
  nodes: ExpectedLiteralNode[]
): CompletionItem[] {
  const literals = nodes.map((v) => v.text);
  const uniqueLiterals = [...new Set(literals)];
  return uniqueLiterals
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
    .map((v) => toCompletionItemForKeyword(v));
}

export function getAliasFromFromTableNode(node: FromTableNode): string {
  if (node.as) {
    return node.as;
  }
  if (node.type === "table") {
    return node.table;
  }
  return "";
}

/**
 * Test if the given table matches the fromNode.
 * @param fromNode
 * @param table
 * @returns
 */
export function isTableMatch(fromNode: FromTableNode, table: Table): boolean {
  switch (fromNode.type) {
    case "subquery": {
      if (fromNode.as && fromNode.as !== table.tableName) {
        return false;
      }
      break;
    }
    case "table": {
      if (fromNode.table && fromNode.table !== table.tableName) {
        return false;
      }
      if (fromNode.db && fromNode.db !== table.database) {
        return false;
      }
      if (fromNode.catalog && fromNode.catalog !== table.catalog) {
        return false;
      }
      break;
    }
    default: {
      return false;
    }
  }
  return true;
}

export function getColumnRefByPos(columns: ColumnRefNode[], pos: Pos) {
  return columns.find(
    (v) =>
      // guard against ColumnRefNode that don't have a location,
      // for example sql functions that are not known to the parser
      v.location &&
      v.location.start.line === pos.line + 1 &&
      v.location.start.column <= pos.column &&
      v.location.end.line === pos.line + 1 &&
      v.location.end.column >= pos.column
  );
}

export function  makeColumnName(alias: string, columnName: string) {
  return alias ? alias + "." + columnName : columnName;
}