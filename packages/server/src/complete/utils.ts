import { NodeRange } from "@joe-re/sql-parser";
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-types'
import { Table, DbFunction } from "../database_libs/AbstractClient";

type Pos = { line: number; column: number };
export const ICONS = {
  KEYWORD: CompletionItemKind.Text,
  COLUMN: CompletionItemKind.Interface,
  TABLE: CompletionItemKind.Field,
  FUNCTION: CompletionItemKind.Property,
  ALIAS: CompletionItemKind.Variable,
  UTILITY: CompletionItemKind.Event,
}

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
