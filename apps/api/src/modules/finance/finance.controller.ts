import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { PayoutStatus, UserRole } from '../../packages/shared/src/index';
import { Auth, CurrentUser, type AuthenticatedUser } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { FinanceService } from './finance.service';

class RequestPayoutDto {
  @ApiPropertyOptional({ example: 5_000_000 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ example: 'IR820540102680020817909002' })
  @IsOptional()
  @Matches(/^IR\d{24}$/, { message: 'iban must be a valid Iranian IBAN (IR + 24 digits)' })
  iban?: string;
}

class ProcessPayoutDto {
  @ApiPropertyOptional({ enum: [PayoutStatus.APPROVED, PayoutStatus.PAID, PayoutStatus.REJECTED] })
  @IsEnum([PayoutStatus.APPROVED, PayoutStatus.PAID, PayoutStatus.REJECTED])
  status!: PayoutStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

@ApiTags('finance')
@Controller()
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Get('institutes/:instituteId/wallet')
  @ApiOperation({ summary: 'Wallet balances and commission totals' })
  wallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
  ) {
    return this.finance.getWallet(user, instituteId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Get('institutes/:instituteId/transactions')
  @ApiOperation({ summary: 'Wallet ledger' })
  transactions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.finance.listTransactions(user, instituteId, query.page, query.pageSize);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Get('institutes/:instituteId/revenue')
  @ApiOperation({ summary: 'Monthly revenue / commission series' })
  revenue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
    @Query('months', new ParseIntPipe({ optional: true })) months?: number,
  ) {
    return this.finance.getRevenueReport(user, instituteId, months ?? 12);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Post('institutes/:instituteId/payouts')
  @ApiOperation({ summary: 'Request a payout of the available balance' })
  requestPayout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
    @Body() dto: RequestPayoutDto,
  ) {
    return this.finance.requestPayout(user, instituteId, dto.amount, dto.iban);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Get('institutes/:instituteId/payouts')
  @ApiOperation({ summary: 'Payout request history' })
  payouts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
  ) {
    return this.finance.listPayouts(user, instituteId);
  }

  /* ----------------------------------------------------- super admin --- */

  @Auth(UserRole.SUPER_ADMIN)
  @Get('admin/payouts')
  @ApiOperation({ summary: 'All payout requests (super admin)' })
  allPayouts(@Query('status') status?: PayoutStatus) {
    return this.finance.listAllPayoutRequests(status);
  }

  @Auth(UserRole.SUPER_ADMIN)
  @Post('admin/payouts/:payoutId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve, pay or reject a payout request' })
  processPayout(
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
    @Body() dto: ProcessPayoutDto,
  ) {
    return this.finance.processPayout(payoutId, dto.status, dto.note);
  }

  @Auth(UserRole.SUPER_ADMIN)
  @Get('admin/platform-stats')
  @ApiOperation({ summary: 'Platform-wide commission and volume' })
  platformStats() {
    return this.finance.getPlatformStats();
  }
}
