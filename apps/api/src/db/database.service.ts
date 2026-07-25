import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CamelCasePlugin, Kysely, PostgresDialect, sql } from 'kysely';
import { Pool, types } from 'pg';
import type { AppConfig } from '../config/configuration';
import type { Database } from './schema';

/**
 * Owns the pg connection pool and the Kysely instance.
 *
 * Note: `CamelCasePlugin` is deliberately NOT enabled — the Kysely schema in
 * `schema.ts` uses snake_case identifiers that match the SQL migrations exactly,
 * which keeps hand-written raw SQL and the query builder consistent.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;
  public readonly db: Kysely<Database>;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const dbConfig = this.config.get('database', { infer: true });

    // pg returns int8/numeric as strings by default. Keep numeric as string
    // (money precision) but parse int8 counts into numbers.
    types.setTypeParser(types.builtins.INT8, (value) => Number.parseInt(value, 10));

    this.pool = new Pool({
      connectionString: dbConfig.url,
      max: dbConfig.poolMax,
      ssl: dbConfig.ssl ? { rejectUnauthorized: false } : undefined,
      statement_timeout: dbConfig.statementTimeoutMs,
      application_name: 'institutes-api',
    });

    this.pool.on('error', (error) => {
      this.logger.error(`Idle client error: ${error.message}`, error.stack);
    });

    this.db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool: this.pool }),
      log: (event) => {
        if (event.level === 'error') {
          this.logger.error(
            `Query failed after ${event.queryDurationMillis.toFixed(1)}ms: ${event.query.sql}`,
          );
        } else if (
          process.env.LOG_SQL === 'true' &&
          event.queryDurationMillis > 200
        ) {
          this.logger.warn(
            `Slow query ${event.queryDurationMillis.toFixed(1)}ms: ${event.query.sql}`,
          );
        }
      },
    });
  }

  async onModuleInit(): Promise<void> {
    // Skip the connectivity probe in unit tests / offline CI.
    if (process.env.NODE_ENV === 'test' || process.env.SKIP_DB_PING === 'true') {
      return;
    }
    try {
      await sql`SELECT 1`.execute(this.db);
      this.logger.log('PostgreSQL connection established');
    } catch (error) {
      this.logger.error(
        `Unable to reach PostgreSQL: ${(error as Error).message}. ` +
          'Start it with `npm run infra:up` or set DATABASE_URL.',
      );
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.db.destroy().catch(() => undefined);
  }

  /** Run a callback inside a single transaction. */
  transaction<T>(fn: (trx: Kysely<Database>) => Promise<T>): Promise<T> {
    return this.db.transaction().execute((trx) => fn(trx));
  }

  /** Escape hatch for raw SQL (PostGIS functions, window queries). */
  get raw() {
    return sql;
  }
}

export { CamelCasePlugin };
