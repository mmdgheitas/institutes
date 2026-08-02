'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {Search, Phone} from 'lucide-react';
import { crm, courses as coursesApi } from '@/lib/api/endpoints';
import { InstituteScope, useInstituteId } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import {Card} from '@/components/ui/Card';

import { Select } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { LEAD_STATUS_FA, LEAD_COLORS } from '@/lib/constants';
import {formatRelative, toPersianDigits} from '@/lib/format';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';
import { onSocketEvent, connectSocket } from '@/lib/realtime/socket';
import { LeadDetailDrawer } from '@/components/leads/LeadDetailDrawer';
import type { LeadStatus } from '@shared/enums';
import {LEAD_TRANSITIONS} from '@shared/enums';
import type { SubmissionRecord } from '@shared/dto';

export default function LeadsBoardPage() {
  const instituteId = useInstituteId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [dragging, setDragging] = useState<{ submissionId: string; from: LeadStatus } | null>(null);
  const [enrolling, setEnrolling] = useState<{ submissionId: string; studentName: string } | null>(null);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);

  const { data: board, isLoading, isError, refetch } = useQuery({
    queryKey: ['crm', 'board', instituteId, courseFilter, debouncedSearch],
    queryFn: () => crm.board(instituteId!, { courseId: courseFilter || undefined, search: debouncedSearch || undefined }),
    enabled: Boolean(instituteId),
  });

  const { data: courses } = useQuery({
    queryKey: ['courses', 'list', instituteId],
    queryFn: () => coursesApi.list(instituteId!),
    enabled: Boolean(instituteId),
  });

  // Live Kanban sync: other staff moving a lead refreshes this board.
  useEffect(() => {
    if (!instituteId) return;
    const socket = connectSocket();
    const off = onSocketEvent('lead:moved', (_event) => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'board', instituteId] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'stats', instituteId] });
    });
    return () => {
      off();
      void socket;
    };
  }, [instituteId, queryClient]);

  const moveMutation = useMutation({
    mutationFn: ({ submissionId, to }: { submissionId: string; to: LeadStatus }) =>
      crm.updateStatus(submissionId, { to }),
    onSuccess: () => {
      toastSuccess('لید منتقل شد');
      queryClient.invalidateQueries({ queryKey: ['crm', 'board', instituteId] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'stats', instituteId] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'wallet', instituteId] });
    },
    onError: (error) => {
      const message = errorMessage(error);
      toastError('انتقال انجام نشد', message);
      queryClient.invalidateQueries({ queryKey: ['crm', 'board', instituteId] });
    },
  });

  const total = useMemo(() => board?.reduce((sum, column) => sum + column.total, 0) ?? 0, [board]);

  const move = (submissionId: string, from: LeadStatus, to: LeadStatus) => {
    if (to === 'ENROLLED') {
      const lead = board?.find((c) => c.status === from)?.items.find((i) => i.id === submissionId);
      setEnrolling({ submissionId, studentName: lead?.studentName ?? '' });
      return;
    }
    moveMutation.mutate({ submissionId, to });
  };

  const isAllowed = (from: LeadStatus, to: LeadStatus) =>
    LEAD_TRANSITIONS[from]?.includes(to) ?? false;

  return (
    <InstituteScope>
      <PageHeader
        title="لیدها (CRM)"
        description={`کانبان فروش — انتقال لید به «ثبت‌نام شده» به‌صورت خودکار ثبت‌نام و تراکنش مالی می‌سازد (${toPersianDigits(total)} لید)`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              window.setTimeout(() => setDebouncedSearch(e.target.value), 350);
            }}
            placeholder="جستجوی نام یا شماره…"
            className="w-full rounded-control border border-slate-300 bg-white py-2.5 ps-10 pe-3.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/30"
          />
        </div>
        <div className="w-56">
          <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value="">همه دوره‌ها</option>
            {courses?.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !board ? (
        <Card>
          <EmptyState title="داده‌ای دریافت نشد" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 overflow-x-auto md:grid-cols-2 xl:grid-cols-5">
          {board.map((column) => (
            <div
              key={column.status}
              onDragOver={(e) => {
                if (dragging && isAllowed(dragging.from, column.status as LeadStatus)) {
                  e.preventDefault();
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging && isAllowed(dragging.from, column.status as LeadStatus)) {
                  move(dragging.submissionId, dragging.from, column.status as LeadStatus);
                } else if (dragging) {
                  toastError('این انتقال مجاز نیست', 'دنباله مجاز حرکت لید را بررسی کنید.');
                }
                setDragging(null);
              }}
              className="flex max-h-[75vh] min-w-64 flex-col rounded-card border bg-slate-100/70"
              style={{ borderColor: `${LEAD_COLORS[column.status as LeadStatus]}33` }}
            >
              <div
                className="flex items-center justify-between rounded-t-card px-3.5 py-2.5"
                style={{ backgroundColor: `${LEAD_COLORS[column.status as LeadStatus]}14` }}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LEAD_COLORS[column.status as LeadStatus] }} />
                  <p className="text-xs font-bold text-slate-700">{LEAD_STATUS_FA[column.status as LeadStatus]}</p>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500">
                  {toPersianDigits(column.total)}
                </span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
                {column.items.length === 0 && (
                  <p className="py-8 text-center text-[11px] text-slate-400">لیدی در این ستون نیست</p>
                )}
                {column.items.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    from={column.status as LeadStatus}
                    onDragStart={() => setDragging({ submissionId: lead.id, from: column.status as LeadStatus })}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => setSelectedLead(lead.id)}
                    onMove={(to) => move(lead.id, column.status as LeadStatus, to)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm when moving into ENROLLED */}
      <ConfirmDialog
        open={Boolean(enrolling)}
        onClose={() => setEnrolling(null)}
        onConfirm={() => {
          if (enrolling) {
            moveMutation.mutate({ submissionId: enrolling.submissionId, to: 'ENROLLED' });
            setEnrolling(null);
          }
        }}
        title="ثبت‌نام لید"
        message={
          <span>
            لید «<b>{enrolling?.studentName}</b>» به ستون «ثبت‌نام شده» منتقل شود؟ این کار به‌صورت
            خودکار <b>ثبت‌نام دوره</b> و <b>درآمد و کارمزد</b> را در کیف پول ایجاد می‌کند.
          </span>
        }
        confirmLabel="ثبت‌نام و انتقال"
        loading={moveMutation.isPending}
      />

      <LeadDetailDrawer submissionId={selectedLead} onClose={() => setSelectedLead(null)} />
    </InstituteScope>
  );
}

function LeadCard({
  lead,
  from,
  onDragStart,
  onDragEnd,
  onClick,
  onMove,
}: {
  lead: SubmissionRecord;
  from: LeadStatus;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  onMove: (to: LeadStatus) => void;
}) {
  const targets = LEAD_TRANSITIONS[from] ?? [];
  // First data value as a preview line (name field usually first).
  const preview = Object.entries(lead.data ?? {})[0];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow active:cursor-grabbing"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-slate-800">{lead.studentName}</p>
        <span className="shrink-0 text-[10px] text-slate-400">{formatRelative(lead.createdAt)}</span>
      </div>
      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
        <Phone className="h-3 w-3" />
        <span dir="ltr">{lead.studentPhone}</span>
      </p>
      {preview && typeof preview[1] === 'string' && preview[1].length > 0 && (
        <p className="mt-1.5 line-clamp-1 text-[11px] text-slate-400">
          {preview[0]}: {preview[1]}
        </p>
      )}
      {targets.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-2" onClick={(e) => e.stopPropagation()}>
          {targets.map((target) => (
            <button
              key={target}
              onClick={() => onMove(target)}
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition-colors hover:text-white"
              style={{ backgroundColor: `${LEAD_COLORS[target]}22`, color: LEAD_COLORS[target] }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = LEAD_COLORS[target];
                (e.currentTarget as HTMLButtonElement).style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${LEAD_COLORS[target]}22`;
                (e.currentTarget as HTMLButtonElement).style.color = LEAD_COLORS[target];
              }}
            >
              {LEAD_STATUS_FA[target]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
