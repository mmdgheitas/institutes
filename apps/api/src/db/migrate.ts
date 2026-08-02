#!/usr/bin/env ts-node
/**
 * Minimal forward-only SQL migration runner.
 *
 *   npm run db:migrate          # apply pending migrations
 *   npm run db:migrate:down     # roll back the last applied migration file
 *   npm run db:reset            # drop the public schema and re-apply everything
 *
 * Migrations are plain .sql files in `apps/api/migrations`, applied in
 * filename order inside a transaction and recorded in `_migrations`.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import 'dotenv/config';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://institutes:institutes@localhost:5433/institutes';

interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

function loadMigrations(): MigrationFile[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
      return {
        name,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex').slice(0, 32),
      };
    });
}

async function ensureTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          serial PRIMARY KEY,
      name        text NOT NULL UNIQUE,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function up(client: Client): Promise<void> {
  await ensureTable(client);
  const { rows } = await client.query<{ name: string; checksum: string }>(
    'SELECT name, checksum FROM _migrations ORDER BY name',
  );
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));

  let count = 0;
  for (const migration of loadMigrations()) {
    const existing = applied.get(migration.name);
    if (existing) {
      if (existing !== migration.checksum) {
        throw new Error(
          `Migration ${migration.name} was modified after being applied ` +
            `(expected checksum ${existing}, got ${migration.checksum}). ` +
            'Create a new migration instead of editing an applied one.',
        );
      }
      continue;
    }

    process.stdout.write(`→ applying ${migration.name} ... `);
    await client.query('BEGIN');
    try {
      await client.query(migration.sql);
      await client.query(
        'INSERT INTO _migrations (name, checksum) VALUES ($1, $2)',
        [migration.name, migration.checksum],
      );
      await client.query('COMMIT');
      process.stdout.write('done\n');
      count += 1;
    } catch (error) {
      await client.query('ROLLBACK');
      process.stdout.write('failed\n');
      throw error;
    }
  }

  console.log(count === 0 ? 'Database already up to date.' : `Applied ${count} migration(s).`);
}

async function down(client: Client): Promise<void> {
  await ensureTable(client);
  const { rows } = await client.query<{ name: string }>(
    'SELECT name FROM _migrations ORDER BY name DESC LIMIT 1',
  );
  if (rows.length === 0) {
    console.log('Nothing to roll back.');
    return;
  }

  const name = rows[0].name;
  const downFile = name.replace(/\.sql$/, '.down.sql');
  let downSql: string;
  try {
    downSql = readFileSync(join(MIGRATIONS_DIR, downFile), 'utf8');
  } catch {
    throw new Error(`No rollback file found: migrations/${downFile}`);
  }

  await client.query('BEGIN');
  try {
    await client.query(downSql);
    await client.query('DELETE FROM _migrations WHERE name = $1', [name]);
    await client.query('COMMIT');
    console.log(`Rolled back ${name}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function reset(client: Client): Promise<void> {
  console.log('Dropping public schema ...');
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await up(client);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'up';
  const client = new Client({ connectionString: DATABASE_URL });
  console.log(`Connecting to database at ${DATABASE_URL} ...`);
  await client.connect();
  try {
    if (command === 'up') await up(client);
    else if (command === 'down') await down(client);
    else if (command === 'reset') await reset(client);
    else throw new Error(`Unknown command "${command}". Use up | down | reset.`);
  } finally {
    await client.end();
  }
}

main().catch((error: Error) => {
  console.error(`\nMigration failed: ${error.message}`);
  process.exit(1);
});
