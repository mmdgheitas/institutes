'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, Send } from 'lucide-react';
import { discovery, institutes as institutesApi } from '@/lib/api/endpoints';
import { InstituteScope, useInstituteId } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Textarea } from '@/components/ui/Field';
import {EmptyState} from '@/components/ui/States';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { formatJalaliDateTime, formatNumber } from '@/lib/format';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';

export default function ReviewsPage() {
  const instituteId = useInstituteId();
  const queryClient = useQueryClient();
  const [replies, setReplies] = useState<Record<string, string>>({});

  const { data: institute } = useQuery({
    queryKey: ['institutes', 'manage', instituteId],
    queryFn: () => institutesApi.manage(instituteId!),
    enabled: Boolean(instituteId),
  });

  const { data: storefront, isLoading, isError, refetch } = useQuery({
    queryKey: ['discovery', 'storefront', institute?.slug],
    queryFn: () => discovery.storefront(institute!.slug),
    enabled: Boolean(institute?.slug),
    retry: false,
  });

  const replyMutation = useMutation({
    mutationFn: ({ reviewId, reply }: { reviewId: string; reply: string }) =>
      institutesApi.replyReview(reviewId, { reply }),
    onSuccess: (_data, variables) => {
      toastSuccess('پاسخ ثبت شد');
      setReplies((r) => ({ ...r, [variables.reviewId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['discovery', 'storefront', institute?.slug] });
    },
    onError: (error) => toastError('خطا در ثبت پاسخ', errorMessage(error)),
  });

  const reviews = storefront?.reviews ?? [];

  return (
    <InstituteScope>
      <PageHeader
        title="نظرات دانش‌آموزان"
        description={`میانگین امتیاز: ${formatNumber(storefront?.rating)} از ۵ (${formatNumber(storefront?.reviewCount)} نظر)`}
      />

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : isError || !storefront ? (
        <Card>
          <EmptyState
            icon={<Star className="h-7 w-7" />}
            title="امکان نمایش نظرات نیست"
            description="آموزشگاه باید منتشر شده باشد تا نظرات قابل مشاهده باشند. اگر آموزشگاه منتشر است، دوباره تلاش کنید."
            action={
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                تلاش دوباره
              </Button>
            }
          />
        </Card>
      ) : reviews.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Star className="h-7 w-7" />}
            title="نظری ثبت نشده"
            description="وقتی دانش‌آموزان نظر بدهند، اینجا نمایش داده می‌شود."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Avatar name={review.authorName} src={review.authorAvatarUrl} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">{review.authorName}</p>
                      <span className="text-xs text-slate-400">{formatJalaliDateTime(review.createdAt)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                        />
                      ))}
                    </div>
                    {review.title && <p className="mt-2 text-sm font-semibold text-slate-800">{review.title}</p>}
                    <p className="mt-1 text-sm leading-6 text-slate-600">{review.body}</p>
                  </div>
                </div>

                {review.instituteReply ? (
                  <div className="rounded-lg bg-primary-50/60 px-4 py-3">
                    <p className="text-xs font-bold text-primary-800">پاسخ آموزشگاه:</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{review.instituteReply}</p>
                  </div>
                ) : (
                  <div className="flex items-end gap-2 border-t border-slate-100 pt-3">
                    <div className="flex-1">
                      <Textarea
                        placeholder="پاسخ عمومی به این نظر…"
                        value={replies[review.id] ?? ''}
                        onChange={(e) => setReplies((r) => ({ ...r, [review.id]: e.target.value }))}
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={!(replies[review.id] ?? '').trim()}
                      loading={replyMutation.isPending}
                      onClick={() => replyMutation.mutate({ reviewId: review.id, reply: (replies[review.id] ?? '').trim() })}
                    >
                      <Send className="h-4 w-4" />
                      پاسخ
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </InstituteScope>
  );
}
