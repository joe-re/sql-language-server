import { fileURLToPath } from 'url'

type RootParams = {
  workspaceFolders?: { uri: string }[] | null
  rootUri?: string | null
  rootPath?: string | null
}

function fileUriToPath(uri: string): string | null {
  try {
    return uri.startsWith('file:') ? fileURLToPath(uri) : null
  } catch {
    return null
  }
}

/**
 * Returns the project root from InitializeParams, preferring the first
 * workspace folder, then rootUri, then the deprecated rootPath.
 */
export default function resolveRootPath(params: RootParams): string {
  const folder = params.workspaceFolders?.[0]?.uri
  return (
    (folder && fileUriToPath(folder)) ||
    (params.rootUri && fileUriToPath(params.rootUri)) ||
    params.rootPath ||
    ''
  )
}
