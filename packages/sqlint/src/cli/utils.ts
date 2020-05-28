import * as fs from 'fs'

export function fileExists(path: string) {
  try {
    return fs.statSync(path).isFile()
  } catch (error) {
    if (error && error.code === "ENOENT") {
        return false;
    }
    throw error;
  }
}

export function directoryExists(path: string) {
  try {
    return fs.statSync(path).isDirectory()
  } catch (error) {
    if (error && error.code === "ENOENT") {
        return false;
    }
    throw error;
  }
}

function readdirSafeSync(path: string) {
    try {
        return fs.readdirSync(path, { withFileTypes: true });
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
        return [];
    }
}

export function getFileList(path: string): string[] {
  if (!directoryExists(path)) {
    return fileExists(path) ? [path] : []
  }
  return readdirSafeSync(path).map(v => {
    if (v.isDirectory()) {
      const files = getFileList(`${path}/${v.name}`)
      return files
    }
    return [`${path}/${v.name}`]
  }).flat().filter((v: string) => {
    return v.match(/.sql$/)
  })
}

export function readFile(filePath: string) {
  return fs.readFileSync(filePath, "utf8").replace(/^\ufeff/u, "");
}
