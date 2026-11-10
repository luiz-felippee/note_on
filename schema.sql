-- Schema para Cloudflare D1 (NoteOn)
CREATE TABLE IF NOT EXISTS users (
  userId TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  salt TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_entities (
  userId TEXT NOT NULL,
  entityId TEXT NOT NULL,
  entityType TEXT NOT NULL,
  data TEXT NOT NULL,
  updatedAt INTEGER NOT NULL,
  deletedAt INTEGER,
  PRIMARY KEY (userId, entityId)
);

CREATE INDEX IF NOT EXISTS idx_sync_updated ON sync_entities (userId, updatedAt);
CREATE INDEX IF NOT EXISTS idx_sync_deleted ON sync_entities (userId, deletedAt);

CREATE TABLE IF NOT EXISTS media_blobs (
  userId TEXT NOT NULL,
  mediaId TEXT NOT NULL,
  dataUrl TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  PRIMARY KEY (userId, mediaId)
);


