import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'kysely';
import { ConfigService } from '@nestjs/config';
import {
  PayoutStatus,
  TransactionType,
  type Paginated,
  type RevenuePoint,
  type WalletSummary,
  type WalletTransaction,
} from '@institutes/shared';
import type { AppConfig } from '../../config/configuration';
import { DatabaseService } from '../../db/database.service';
import { InstituteAccessService } from '../institutes/institute-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/decorators';

@Injectable()
export class FinanceService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: InstituteAccessService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Wallet balances.
   *
   * `availableBalance` = every ledger entry summed. Revenue is positive,
   * commission and payouts are negative, so the sum is always withdrawable
   * cash and can never be gamed by a partial write.
   */
  async getWallet(user: AuthenticatedUser, instituteId: string): Promise<WalletSummary> {
    await this.access.assertCanManage(user, instituteId);

    const result = await sql<{
      gross: string;
      commission: string;
      payouts: string;
      balance: string;
    }>`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE type = 'ENROLLMENT_REVENUE'), 0)::text  AS gross,
        COALESCE(-SUM(amount) FILTER (WHERE type = 'PLATFORM_COMMISSION'), 0)::text AS commission,
        COALESCE(-SUM(amount) FILTER (WHERE type = 'PAYOUT'), 0)::text            AS payouts,
        COALESCE(SUM(amount), 0)::text                                            AS balance
      FROM wallet_transactions
      WHERE institute_id = ${instituteId}::uuid
    `.execute(this.database.db);

    const row = result.rows[0];

    const pending = await this.database.db
      .selectFrom('payout_requests')
      .select((eb) => eb.fn.sum<string>('amount').as('total'))
      .where('institute_id', '=', instituteId)
      .where('status', 'in', [PayoutStatus.REQUESTED, PayoutStatus.APPROVED])
      .executeTakeFirst();

    const gross = Number(row?.gross ?? 0);
    const commission = Number(row?.commission ?? 0);
    const paidOut = Number(row?.payouts ?? 0);
    const balance = Number(row?.balance ?? 0);
    const pendingPayout = Number(pending?.total ?? 0);

    return {
      instituteId,
      currency: this.config.get('platform', { infer: true }).currency,
      grossRevenue: gross,
      commissionPaid: commission,
      netEarnings: gross - commission,
      // Money already requested is reserved and not re-withdrawable.
      availableBalance: Math.max(0, balance - pendingPayout),
      pendingPayout,
      paidOut,
    };
  }

  async listTransactions(
    user: AuthenticatedUser,
    instituteId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<WalletTransaction>> {
    await this.access.assertCanManage(user, instituteId);

    const rows = await this.database.db
      .selectFrom('wallet_transactions')
      .selectAll()
      .where('institute_id', '=', instituteId)
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute();

    const { count } = await this.database.db
      .selectFrom('wallet_transactions')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('institute_id', '=', instituteId)
      .executeTakeFirstOrThrow();

    return paginate(
      rows.map((row) => ({
        id: row.id,
        instituteId: row.institute_id,
        amount: Number(row.amount),
        type: row.type as TransactionType,
        payoutStatus: row.payout_status as PayoutStatus,
        description: row.description,
        referenceId: row.reference_id,
        createdAt: row.created_at.toISOString(),
      })),
      Number(count),
      page,
      pageSize,
    );
  }

  /** Monthly revenue series for the dashboard chart. */
  async getRevenueReport(
    user: AuthenticatedUser,
    instituteId: string,
    months = 12,
  ): Promise<RevenuePoint[]> {
    await this.access.assertCanManage(user, instituteId);

    const result = await sql<{
      period: string;
      gross: string;
      commission: string;
      enrollments: string;
    }>`
      WITH series AS (
        SELECT generate_series(
          date_trunc('month', now()) - (${months - 1} || ' months')::interval,
          date_trunc('month', now()),
          '1 month'::interval
        ) AS month_start
      )
      SELECT
        to_char(s.month_start, 'YYYY-MM') AS period,
        COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'ENROLLMENT_REVENUE'), 0)::text   AS gross,
        COALESCE(-SUM(t.amount) FILTER (WHERE t.type = 'PLATFORM_COMMISSION'), 0)::text AS commission,
        COUNT(DISTINCT t.reference_id) FILTER (WHERE t.type = 'ENROLLMENT_REVENUE')::text AS enrollments
      FROM series s
      LEFT JOIN wallet_transactions t
        ON t.institute_id = ${instituteId}::uuid
       AND date_trunc('month', t.created_at) = s.month_start
      GROUP BY s.month_start
      ORDER BY s.month_start ASC
    `.execute(this.database.db);

    return result.rows.map((row) => {
      const gross = Number(row.gross);
      const commission = Number(row.commission);
      return {
        period: row.period,
        gross,
        commission,
        net: gross - commission,
        enrollments: Number(row.enrollments),
      };
    });
  }

  /**
   * Requests a payout.
   *
   * The balance is re-read inside the transaction with a row lock over the
   * institute so two concurrent requests cannot both pass the balance check.
   */
  async requestPayout(
    user: AuthenticatedUser,
    instituteId: string,
    amount: number,
    iban?: string,
  ) {
    await this.access.assertCanManage(user, instituteId);
    if (amount <= 0) throw new BadRequestException('Amount must be greater than zero');

    return this.database.transaction(async (trx) => {
      // Serialize payout requests per institute.
      await trx
        .selectFrom('institutes')
        .select('id')
        .where('id', '=', instituteId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      const balanceRow = await sql<{ balance: string }>`
        SELECT COALESCE(SUM(amount), 0)::text AS balance
          FROM wallet_transactions
         WHERE institute_id = ${instituteId}::uuid
      `.execute(trx);

      const pendingRow = await trx
        .selectFrom('payout_requests')
        .select((eb) => eb.fn.sum<string>('amount').as('total'))
        .where('institute_id', '=', instituteId)
        .where('status', 'in', [PayoutStatus.REQUESTED, PayoutStatus.APPROVED])
        .executeTakeFirst();

      const available =
        Number(balanceRow.rows[0]?.balance ?? 0) - Number(pendingRow?.total ?? 0);

      if (amount > available) {
        throw new BadRequestException(
          `Requested amount exceeds the available balance of ${available}`,
        );
      }

      return trx
        .insertInto('payout_requests')
        .values({
          institute_id: instituteId,
          amount,
          status: PayoutStatus.REQUESTED,
          iban: iban ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  async listPayouts(user: AuthenticatedUser, instituteId: string) {
    await this.access.assertCanManage(user, instituteId);
    return this.database.db
      .selectFrom('payout_requests')
      .selectAll()
      .where('institute_id', '=', instituteId)
      .orderBy('created_at', 'desc')
      .execute();
  }

  /* ----------------------------------------------------- super admin --- */

  async listAllPayoutRequests(status?: PayoutStatus) {
    let query = this.database.db
      .selectFrom('payout_requests as p')
      .innerJoin('institutes as i', 'i.id', 'p.institute_id')
      .select([
        'p.id',
        'p.amount',
        'p.status',
        'p.iban',
        'p.created_at',
        'i.id as institute_id',
        'i.name as institute_name',
      ])
      .orderBy('p.created_at', 'desc');

    if (status) query = query.where('p.status', '=', status);
    return query.execute();
  }

  /**
   * Approves/pays/rejects a payout.
   * Marking it PAID writes the negative ledger entry — the single place where
   * money leaves the wallet.
   */
  async processPayout(payoutId: string, status: PayoutStatus, note?: string) {
    const payout = await this.database.db
      .selectFrom('payout_requests')
      .selectAll()
      .where('id', '=', payoutId)
      .executeTakeFirst();
    if (!payout) throw new NotFoundException('Payout request not found');

    if (payout.status === PayoutStatus.PAID) {
      throw new BadRequestException('This payout has already been paid');
    }
    const allowed: PayoutStatus[] = [
      PayoutStatus.APPROVED,
      PayoutStatus.PAID,
      PayoutStatus.REJECTED,
    ];
    if (!allowed.includes(status)) {
      throw new BadRequestException('Unsupported payout status transition');
    }

    return this.database.transaction(async (trx) => {
      await trx
        .updateTable('payout_requests')
        .set({
          status,
          note: note ?? payout.note,
          processed_at:
            status === PayoutStatus.PAID || status === PayoutStatus.REJECTED
              ? new Date()
              : null,
        })
        .where('id', '=', payoutId)
        .execute();

      if (status === PayoutStatus.PAID) {
        await trx
          .insertInto('wallet_transactions')
          .values({
            institute_id: payout.institute_id,
            amount: -Number(payout.amount),
            type: TransactionType.PAYOUT,
            payout_status: PayoutStatus.PAID,
            description: 'Payout to institute bank account',
            reference_id: payoutId,
            payout_request_id: payoutId,
          })
          .execute();
      }

      const members = await trx
        .selectFrom('institute_members')
        .select('user_id')
        .where('institute_id', '=', payout.institute_id)
        .execute();

      for (const member of members) {
        await trx
          .insertInto('notifications')
          .values({
            user_id: member.user_id,
            title: `Payout ${status.toLowerCase()}`,
            body: note ?? `Your payout request of ${payout.amount} was ${status.toLowerCase()}.`,
            kind: 'PAYOUT',
          })
          .execute();
      }

      return { id: payoutId, status };
    });
  }

  /** Platform-wide revenue for the super-admin console. */
  async getPlatformStats() {
    const result = await sql<{
      total_commission: string;
      total_gross: string;
      institute_count: string;
      enrollment_count: string;
    }>`
      SELECT
        COALESCE(-SUM(t.amount) FILTER (WHERE t.type = 'PLATFORM_COMMISSION'), 0)::text AS total_commission,
        COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'ENROLLMENT_REVENUE'), 0)::text   AS total_gross,
        (SELECT COUNT(*) FROM institutes WHERE is_published)::text                      AS institute_count,
        (SELECT COUNT(*) FROM enrollments)::text                                        AS enrollment_count
      FROM wallet_transactions t
    `.execute(this.database.db);

    const row = result.rows[0];
    return {
      totalCommission: Number(row?.total_commission ?? 0),
      totalGrossVolume: Number(row?.total_gross ?? 0),
      publishedInstitutes: Number(row?.institute_count ?? 0),
      totalEnrollments: Number(row?.enrollment_count ?? 0),
    };
  }
}
