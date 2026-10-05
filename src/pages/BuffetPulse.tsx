import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Tablet, Monitor, ChefHat, CheckCircle2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Page, PageHeader, PillButton, Panel, Notice } from '../components/ui/page'
import { cn } from '../lib/cn'

interface BuffetMenu {
  id: string
  name: string
  itemCount: number
}

function todayKey(teamId: string) {
  const d = new Date().toISOString().slice(0, 10)
  return `chefsuite_buffet_menu_${teamId}_${d}`
}

export default function BuffetPulse() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null

  const [menus, setMenus] = useState<BuffetMenu[]>([])
  const [loading, setLoading] = useState(true)
  const [todayMenuId, setTodayMenuId] = useState<string | null>(null)

  // Load persisted selection for today, auto-fill from weekly schedule if none
  useEffect(() => {
    if (!teamId) return
    const saved = localStorage.getItem(todayKey(teamId))
    if (saved) {
      setTodayMenuId(saved)
    } else {
      supabase.rpc('get_daily_menu', { p_team_id: teamId }).then(({ data }) => {
        if (data) {
          setTodayMenuId(data as string)
          localStorage.setItem(todayKey(teamId), data as string)
        }
      })
    }
  }, [teamId])

  const loadMenus = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    const { data } = await supabase
      .from('menus')
      .select('id, name, menu_sections(menu_items(id))')
      .eq('team_id', teamId)
      .eq('type', 'buffet')
      .eq('active', true)
      .order('name')

    type Raw = { id: string; name: string; menu_sections: { menu_items: { id: string }[] }[] }
    const parsed: BuffetMenu[] = ((data ?? []) as unknown as Raw[]).map((m) => ({
      id: m.id,
      name: m.name,
      itemCount: m.menu_sections.reduce((sum, s) => sum + s.menu_items.length, 0),
    }))
    setMenus(parsed)

    // Auto-select if only one menu and nothing saved yet
    if (parsed.length === 1 && !todayMenuId) {
      setTodayMenuId(parsed[0]!.id)
      localStorage.setItem(todayKey(teamId), parsed[0]!.id)
    }
    setLoading(false)
  }, [teamId, todayMenuId])

  useEffect(() => { void loadMenus() }, [loadMenus])

  function selectMenu(id: string) {
    if (!teamId) return
    setTodayMenuId(id)
    localStorage.setItem(todayKey(teamId), id)
  }

  function openMonitor() {
    if (todayMenuId) navigate(`/buffet-monitor?menu=${todayMenuId}`)
    else navigate('/buffet-monitor')
  }

  function openKds() {
    if (todayMenuId) navigate(`/buffet-kds?menu=${todayMenuId}`)
    else navigate('/buffet-kds')
  }

  const selectedMenu = menus.find((m) => m.id === todayMenuId)

  return (
    <Page>
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />{t('buffetPulse.liveIndicator')}</span>}
        title={t('buffetPulse.title')}
        subtitle="Διάλεξε το σημερινό μενού και άνοιξε τις οθόνες της αίθουσας και της κουζίνας."
        actions={<PillButton icon={RefreshCw} onClick={() => void loadMenus()}>Ανανέωση</PillButton>}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        {/* ── Step 1: today's menu ── */}
        <Panel title={<span className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-sm font-semibold text-ink">1</span>Σημερινό μενού</span>}>
          {loading ? (
            <p className="text-sm text-white/55">Φόρτωση μενού…</p>
          ) : menus.length === 0 ? (
            <Notice tone="warn">Δεν υπάρχουν ενεργά μενού τύπου «Μπουφέ». Δημιούργησε ένα από τη σελίδα Μενού.</Notice>
          ) : (
            <div className="flex flex-col gap-2">
              {menus.map((m) => {
                const selected = m.id === todayMenuId
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectMenu(m.id)}
                    className={cn('flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition', selected ? 'bg-ink text-white-fixed' : 'bg-white/[0.04] hover:bg-white/[0.07]')}
                  >
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', selected ? 'bg-lime text-ink' : 'bg-white/[0.06] text-white/55')}>
                      {selected ? <CheckCircle2 className="h-5 w-5" /> : <ChefHat className="h-5 w-5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{m.name}</span>
                      <span className={cn('block text-xs', selected ? 'text-white-fixed/60' : 'text-white/50')}>{m.itemCount} πιάτα</span>
                    </span>
                    {selected && <span className="shrink-0 rounded-full bg-lime px-3 py-1 text-xs font-semibold text-ink">Σήμερα</span>}
                  </button>
                )
              })}
            </div>
          )}
        </Panel>

        {/* ── Step 2: launch screens ── */}
        <Panel title={<span className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-sm font-semibold text-ink">2</span>Εκκίνηση οθονών</span>}>
          {!todayMenuId && <p className="-mt-1 text-sm text-white/55">Επίλεξε πρώτα ποιο μενού τρέχει σήμερα.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { onClick: openMonitor, icon: Tablet, title: t('buffetPulse.monitorMode'), desc: t('buffetPulse.monitorDesc'), cta: t('buffetPulse.openMonitor'), dark: false },
              { onClick: openKds, icon: Monitor, title: t('buffetPulse.kdsMode'), desc: t('buffetPulse.kdsDesc'), cta: t('buffetPulse.openKds'), dark: true },
            ].map(({ onClick, icon: Icon, title, desc, cta, dark }) => (
              <button
                key={title}
                type="button"
                onClick={onClick}
                disabled={!todayMenuId}
                className={cn(
                  'flex min-h-[220px] flex-col gap-4 rounded-3xl p-5 text-left transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40',
                  dark ? 'bg-ink text-white-fixed' : 'bg-lime text-ink',
                )}
              >
                <span className={cn('flex h-12 w-12 items-center justify-center rounded-full', dark ? 'bg-lime text-ink' : 'bg-ink text-lime')}>
                  <Icon className="h-6 w-6" />
                </span>
                <span>
                  <span className="block text-xl font-medium">{title}</span>
                  <span className={cn('mt-1 block text-sm', dark ? 'text-white-fixed/65' : 'text-ink/70')}>{desc}</span>
                </span>
                {selectedMenu && <span className={cn('text-xs font-medium', dark ? 'text-lime' : 'text-ink/70')}>{selectedMenu.name}</span>}
                <span className="mt-auto text-sm font-semibold">{cta} →</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </Page>
  )
}
