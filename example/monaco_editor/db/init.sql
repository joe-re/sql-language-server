-- Sample schema shared by postgres, mysql (docker-entrypoint-initdb.d) and sqlite (pnpm setup:sqlite)
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  published_at TIMESTAMP
);
