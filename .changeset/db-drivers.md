---
"sql-language-server": major
---

Database drivers:

- sqlite3: use the built-in `node:sqlite` module instead of the native `sqlite3` package. No rebuild is needed anymore, and the "Rebuild SQLite3 Client" command of the VS Code extension was removed. The VS Code extension now requires VS Code 1.101+.
- mysql2 2 -> 3, pg 8.10 -> 8.23, @google-cloud/bigquery 5 -> 9
- SSH tunneling uses `ssh2` directly instead of the unmaintained `node-ssh-forward`. `ssh.remotePort` is now honored (it was ignored before) and `~/` in `ssh.identityFile` is expanded.
- Table names are passed as query parameters / escaped identifiers, so tables whose names contain quotes are read correctly.
- The `Null` column in completion details now consistently means "nullable" for sqlite3 and postgres (it was inverted before).
