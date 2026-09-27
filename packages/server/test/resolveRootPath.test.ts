import resolveRootPath from '../src/resolveRootPath'

describe('resolveRootPath', () => {
  it('should prefer the first workspace folder', () => {
    expect(
      resolveRootPath({
        workspaceFolders: [
          { uri: 'file:///work/folder1' },
          { uri: 'file:///work/folder2' },
        ],
        rootUri: 'file:///work/root-uri',
        rootPath: '/work/root-path',
      })
    ).toEqual('/work/folder1')
  })

  it('should use rootUri when there are no workspace folders', () => {
    expect(
      resolveRootPath({
        workspaceFolders: null,
        rootUri: 'file:///work/my%20project',
        rootPath: '/work/root-path',
      })
    ).toEqual('/work/my project')
  })

  it('should fall back to the deprecated rootPath', () => {
    expect(
      resolveRootPath({ rootUri: null, rootPath: '/work/root-path' })
    ).toEqual('/work/root-path')
  })

  it('should ignore non-file URIs', () => {
    expect(
      resolveRootPath({
        workspaceFolders: [{ uri: 'vscode-vfs://github/joe-re/repo' }],
        rootUri: 'untitled:project',
        rootPath: '/work/root-path',
      })
    ).toEqual('/work/root-path')
  })

  it('should return an empty string when nothing is given', () => {
    expect(resolveRootPath({})).toEqual('')
  })
})
