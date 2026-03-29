import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { resolve, dirname } from "path";
import { existsSync, mkdirSync } from "fs";
import * as schema from "./schema.js";

let _db: ReturnType<typeof createDb> | null = null;

function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== dirname(dir)) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
}

function resolveDbPath(url?: string): string {
  const raw = url || process.env.DATABASE_URL;
  if (raw) {
    if (raw.startsWith("/")) return raw;
    return resolve(findProjectRoot(), raw);
  }
  return resolve(findProjectRoot(), "data/ai-dev-pro.db");
}

function createDb(url?: string) {
  const dbPath = resolveDbPath(url);
  mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export function getDb(url?: string) {
  if (!_db) {
    _db = createDb(url);
  }
  return _db;
}

export function initDb(url?: string) {
  const db = getDb(url);
  return db;
}

export type AppDatabase = ReturnType<typeof getDb>;

export * from "./schema.js";
