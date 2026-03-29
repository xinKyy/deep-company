import { config as dotenvConfig } from "dotenv";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== dirname(dir)) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
}

const root = findProjectRoot();

const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
  dotenvConfig({ path: envPath });
}

const dbPath = process.env.DATABASE_URL?.startsWith("/")
  ? process.env.DATABASE_URL
  : resolve(root, process.env.DATABASE_URL || "data/ai-dev-pro.db");

mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite);

console.log(`Running migrations on: ${dbPath}`);
migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
console.log("Migrations complete.");

sqlite.close();
