import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Star, MessageSquare, ThumbsDown, QrCode, Trash2 } from 'lucide-react'
import { Page, PageHeader, StatRow, StatTile, Panel, Segmented, EmptyState, Notice } from '../components/ui/page'
import { useDishFeedback } from '../hooks/useDishFeedback'
import { cn } from '../lib/cn'

function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(size, n <= Math.round(value) ? 'fill-current text-amber-500' : 'text-white/15')} />
      ))}
    </span>
  )
}

export default function GuestFeedback() {
  const { t, i18n } = useTranslation()
  const [days, setDays] = useState<'7' | '30' | '90'>('30')
  const { feedback, byDish, loading, error, remove } = useDishFeedback(Number(days))
  const [sort, setSort] = useState<'worst' | 'best' | 'most'>('worst')

  const avg = feedback.length ? feedback.reduce((s, f) => s + f.rating, 0) / feedback.length : null
  const withComments = feedback.filter((f) => f.comment)
  const ranked = byDish.filter((d) => d.count >= 3)
  const worst = [...ranked].sort((a, b) => a.avg - b.avg)[0]
  const dishes = [...byDish].sort((a, b) =>
    sort === 'worst' ? a.avg - b.avg || b.count - a.count : sort === 'best' ? b.avg - a.avg || b.count - a.count : b.count - a.count)

  return (
    <Page>
      <PageHeader
        title={t('feedback.title')}
        subtitle={t('feedback.subtitle')}
        actions={<Segmented value={days} onChange={setDays} options={[
          { value: '7', label: t('feedback.days', { count: 7 }) },
          { value: '30', label: t('feedback.days', { count: 30 }) },
          { value: '90', label: t('feedback.days', { count: 90 }) },
        ]} />}
      />
      {error && <Notice>{error}</Notice>}

      <StatRow>
        <StatTile label={t('feedback.stat.avg')} value={avg != null ? avg.toFixed(2) : '—'} icon={Star} tone="ink" hint={avg != null ? '★'.repeat(Math.round(avg)) : undefined} />
        <StatTile label={t('feedback.stat.ratings')} value={feedback.length} icon={QrCode} />
        <StatTile label={t('feedback.stat.comments')} value={withComments.length} icon={MessageSquare} />
        <StatTile label={t('feedback.stat.worst')} value={worst ? worst.avg.toFixed(1) : '—'} icon={ThumbsDown}
          tone={worst && worst.avg < 3.5 ? 'bad' : 'default'} hint={worst ? worst.name : t('feedback.stat.worstHint')} />
      </StatRow>

      {loading ? null : feedback.length === 0 ? (
        <EmptyState icon={Star} title={t('feedback.empty')} body={t('feedback.emptyHint')} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Panel title={t('feedback.byDish')} padded={false}
            actions={<Segmented value={sort} onChange={setSort} options={[
              { value: 'worst', label: t('feedback.sort.worst') },
              { value: 'best', label: t('feedback.sort.best') },
              { value: 'most', label: t('feedback.sort.most') },
            ]} />}>
            <ul className="divide-y divide-white/[0.06] pb-2">
              {dishes.map((d) => (
                <li key={d.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.name}</span>
                    <span className="block text-xs text-white/50">{t('feedback.ratingsN', { count: d.count })}{d.comments ? ` · ${t('feedback.commentsN', { count: d.comments })}` : ''}</span>
                  </span>
                  <span className="hidden flex-col gap-0.5 sm:flex" aria-hidden>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <span key={n} className="flex items-center gap-1.5">
                        <span className="w-2 text-[10px] text-white/40">{n}</span>
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-bg-input">
                          <span className={cn('block h-full rounded-full', n >= 4 ? 'bg-ink' : n === 3 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${(d.dist[n - 1] / d.count) * 100}%` }} />
                        </span>
                      </span>
                    ))}
                  </span>
                  <span className="flex flex-col items-end">
                    <span className={cn('text-2xl font-medium tabular-nums', d.avg < 3.5 ? 'text-red-500' : d.avg >= 4.5 ? 'text-emerald-500' : '')}>{d.avg.toFixed(1)}</span>
                    <Stars value={d.avg} size="h-3 w-3" />
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={t('feedback.recent')} padded={false}>
            {withComments.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-white/55">{t('feedback.noComments')}</p>
            ) : (
              <ul className="flex flex-col gap-2 px-3 pb-3">
                {withComments.slice(0, 60).map((f) => (
                  <li key={f.id} className="group rounded-2xl bg-bg-input px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Stars value={f.rating} size="h-3.5 w-3.5" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.item_name}</span>
                      <span className="shrink-0 text-[11px] text-white/45">
                        {new Date(f.created_at).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}{f.lang ? ` · ${f.lang.toUpperCase()}` : ''}
                      </span>
                      <button type="button" onClick={() => { if (window.confirm(t('feedback.deleteConfirm'))) void remove(f.id) }}
                        aria-label={t('common.delete')} className="text-white/30 opacity-0 transition hover:text-red-500 group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/80">“{f.comment}”</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </Page>
  )
}
