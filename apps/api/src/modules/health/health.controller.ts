import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'kysely';
import { Public } from '../../common/decorators';
import { DatabaseService } from '../../db/database.service';
import { QueueService } from '../queue/queue.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly queue: QueueService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — checks PostGIS and the queues' })
  async ready() {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    try {
      const result = await sql<{ postgis: string }>`SELECT PostGIS_Version() AS postgis`.execute(
        this.database.db,
      );
      checks.database = { ok: true, detail: `PostGIS ${result.rows[0]?.postgis ?? 'unknown'}` };
    } catch (error) {
      checks.database = { ok: false, detail: (error as Error).message };
    }

    try {
      const stats = await this.queue.getStats();
      checks.queue = { ok: true, detail: JSON.stringify(stats) };
    } catch (error) {
      checks.queue = { ok: false, detail: (error as Error).message };
    }

    const ok = Object.values(checks).every((check) => check.ok);
    return { status: ok ? 'ready' : 'degraded', checks, timestamp: new Date().toISOString() };
  }
}
