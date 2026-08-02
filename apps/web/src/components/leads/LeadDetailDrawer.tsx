'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {Phone, Mail, FileText, History, CalendarClock, Send} from 'lucide-react';
import { crm, courses as coursesApi } from '@/lib/api/endpoints';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {Select, Textarea} from '@/components/ui/Field';
import { SkeletonRows } from '@/components/ui/Skeleton';
import {LEAD_STATUS_FA, LEAD_COLORS} from '@/lib/constants';
import { formatJalaliDateTime, formatRelative } from '@/lib/format';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';
import { useActiveInstitute } from '@/stores/activeInstitute';
import type { SubmissionValue } from '@shared/dto';

function renderValue(value: SubmissionValue): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.join('، ');
    if ('fileName' in value) return value.fileName;
    return JSON.stringify(value);
  }
  return String(value);
}

export function LeadDetailDrawer({ submissionId, onClose }: { submissionId: string | null; onClose: () => void }) {
  const { instituteId } = useActiveInstitute();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [newCourseId, setNewCourseId] = useState('');

  const { data: lead, isLoading } = useQuery({
    queryKey: ['crm', 'lead', submissionId],
    queryFn: () => crm.lead(submissionId!),
    enabled: Boolean(submissionId),
  });

  const { data: courses } = useQuery({
    queryKey: ['courses', 'list', instituteId],
    queryFn: () => coursesApi.list(instituteId!),
    enabled: Boolean(instituteId),
  });

  const statusMutation = useMutation({
    mutationFn: (to: string) => crm.updateStatus(submissionId!, { to }),
    onSuccess: () => {
      toastSuccess('وضعیت لید تغییر کرد');
      queryClient.invalidateQueries({ queryKey: ['crm'] });
    },
    onError: (error) => toastError('خطا در تغییر وضعیت', errorMessage(error)),
  });

  const courseMutation = useMutation({
    mutationFn: (courseId: string) => crm.assignCourse(submissionId!, courseId),
    onSuccess: () => {
      toastSuccess('دوره موردنظر لید ثبت شد');
      queryClient.invalidateQueries({ queryKey: ['crm', 'lead', submissionId] });
    },
    onError: (error) => toastError('خطا در ثبت دوره', errorMessage(error)),
  });

  const noteMutation = useMutation({
    mutationFn: () => crm.addNote(submissionId!, note.trim()),
    onSuccess: () => {
      toastSuccess('یادداشت ثبت شد');
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['crm', 'lead', submissionId] });
    },
    onError: (error) => toastError('خطا در ثبت یادداشت', errorMessage(error)),
  });

  return (
    <Modal open={Boolean(submissionId)} onClose={onClose} title={lead?.studentName ?? 'جزئیات لید'} size="lg">
      {isLoading || !lead ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="flex flex-col gap-5">
          {/* Header info */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge dot={LEAD_COLORS[lead.status]} tone="slate">
              {LEAD_STATUS_FA[lead.status]}
            </Badge>
            {lead.courseTitle && <Badge tone="blue">{lead.courseTitle}</Badge>}
            <span className="text-xs text-slate-400">{formatJalaliDateTime(lead.createdAt)}</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Phone className="h-4 w-4 text-slate-400" />
              <span dir="ltr">{lead.studentPhone}</span>
            </p>
            {lead.email && (
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="h-4 w-4 text-slate-400" />
                {lead.email}
              </p>
            )}
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <FileText className="h-4 w-4 text-slate-400" />
              فرم: {lead.formTitle}
            </p>
            {lead.booking && (
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <CalendarClock className="h-4 w-4 text-slate-400" />
                رزرو: {formatJalaliDateTime(lead.booking.startsAt)}
                {lead.booking.location ? ` (${lead.booking.location})` : ''}
              </p>
            )}
          </div>

          {/* Submission data */}
          <div>
            <p className="mb-2 text-sm font-bold text-slate-800">پاسخ‌های فرم</p>
            <div className="grid gap-2 rounded-card border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2">
              {lead.formFields.map((field) => {
                const value = lead.data[field.key];
                return (
                  <div key={field.key}>
                    <p className="text-xs text-slate-400">
                      {field.label} <span className="text-[10px]" dir="ltr">({field.key})</span>
                    </p>
                    <p className="mt-0.5 text-sm text-slate-700">{renderValue(value)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-end gap-2">
              <Select label="انتقال به ستون" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                <option value="">انتخاب…</option>
                {Object.keys(LEAD_STATUS_FA).map((status) =>
                  status === lead.status ? null : (
                    <option key={status} value={status}>
                      {LEAD_STATUS_FA[status as keyof typeof LEAD_STATUS_FA]}
                    </option>
                  ),
                )}
              </Select>
              <Button
                size="sm"
                disabled={!newStatus}
                loading={statusMutation.isPending}
                onClick={() => newStatus && statusMutation.mutate(newStatus)}
              >
                انتقال
              </Button>
            </div>
            <div className="flex items-end gap-2">
              <Select label="دوره موردنظر" value={newCourseId} onChange={(e) => setNewCourseId(e.target.value)}>
                <option value="">بدون دوره</option>
                {courses?.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!newCourseId}
                loading={courseMutation.isPending}
                onClick={() => newCourseId && courseMutation.mutate(newCourseId)}
              >
                ثبت
              </Button>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <History className="h-4 w-4" />
              تاریخچه فعالیت
            </p>
            <div className="flex flex-col gap-3 border-s-2 border-slate-100 ps-4">
              {lead.events.length === 0 && <p className="text-sm text-slate-400">رویدادی ثبت نشده است.</p>}
              {lead.events.map((event) => (
                <div key={event.id} className="relative">
                  <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary-500" />
                  <p className="text-xs text-slate-600">
                    <b>
                      {event.fromStatus ? LEAD_STATUS_FA[event.fromStatus as keyof typeof LEAD_STATUS_FA] : 'جدید'} ←{' '}
                      {event.toStatus ? LEAD_STATUS_FA[event.toStatus as keyof typeof LEAD_STATUS_FA] : '؟'}
                    </b>
                    <span className="ms-2 text-slate-400">
                      {event.actorName ? `توسط ${event.actorName}` : ''} · {formatRelative(event.createdAt)}
                    </span>
                  </p>
                  {event.note && <p className="mt-0.5 text-xs text-slate-500">{event.note}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Add note */}
          <div className="flex items-end gap-2 border-t border-slate-100 pt-4">
            <div className="flex-1">
              <Textarea
                label="افزودن یادداشت"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="نتیجه تماس، نکات مذاکره…"
              />
            </div>
            <Button size="sm" disabled={!note.trim()} loading={noteMutation.isPending} onClick={() => noteMutation.mutate()}>
              <Send className="h-4 w-4" />
              ثبت
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
