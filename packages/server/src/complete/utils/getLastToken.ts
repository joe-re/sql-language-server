// Gets the last token from the given string considering that tokens can contain dots.
export function getLastToken(sql: string): string {
  const match = sql.match(/^(?:.|\s)*[^A-z0-9\\.:'"](.*?)$/)
  if (match) {
    let prevToken = ''
    let currentToken = match[1]
    while (currentToken !== prevToken) {
      prevToken = currentToken
      currentToken = prevToken.replace(/\[.*?\]/, '') // remove []
    }
    return currentToken.replace(/"/g, '') // remove ""
  }
  return sql
}
