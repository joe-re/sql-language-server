// Prints a Homebrew formula for the release archives built by build-binaries.mjs.
//
// usage: node scripts/homebrew-formula.mjs <version> <checksums.txt> [owner/repo]

import { readFileSync } from 'node:fs'

const [version, checksumsFile, repo = 'joe-re/sql-language-server'] =
  process.argv.slice(2)
if (!version || !checksumsFile) {
  throw new Error(
    'usage: homebrew-formula.mjs <version> <checksums.txt> [owner/repo]'
  )
}

const sha = {}
for (const line of readFileSync(checksumsFile, 'utf8').trim().split('\n')) {
  const [hash, file] = line.trim().split(/\s+/)
  const target = /-v[^-]+-(.+)\.(?:tar\.gz|zip)$/.exec(file)?.[1]
  if (target) sha[target] = hash
}

const asset = (target) => {
  if (!sha[target]) throw new Error(`no checksum for ${target}`)
  const url = `https://github.com/${repo}/releases/download/v${version}/sql-language-server-v${version}-${target}.tar.gz`
  return `      url "${url}"\n      sha256 "${sha[target]}"`
}

process.stdout.write(`class SqlLanguageServer < Formula
  desc "SQL language server with completion and linting (includes sqlint)"
  homepage "https://github.com/${repo}"
  version "${version}"
  license "MIT"

  on_macos do
    on_arm do
${asset('darwin-arm64')}
    end
    on_intel do
${asset('darwin-x64')}
    end
  end

  on_linux do
    on_arm do
${asset('linux-arm64')}
    end
    on_intel do
${asset('linux-x64')}
    end
  end

  def install
    bin.install "sql-language-server", "sqlint"
  end

  test do
    assert_equal version.to_s, shell_output("#{bin}/sql-language-server --version").strip
    (testpath/"query.sql").write("select a from t\\n")
    assert_match "reserved-word-case", shell_output("#{bin}/sqlint #{testpath}/query.sql")
  end
end
`)
