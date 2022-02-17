export function makeTableAlias(tableName: string): string {
  if (tableName.length > 3) {
    return tableName.substring(0, 3)
  }
  return tableName
}