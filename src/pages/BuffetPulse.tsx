import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, Tablet, Monitor, ChefHat, CheckCircle2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { GlassCard } from '../components/ui/GlassCard'

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

  // Load persisted selection for today
  useEffect(() => {
    if (!teamId) return
    const saved = localStorage.getItem(todayKey(teamId))
    if (saved) setTodayMenuId(saved)
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
    <div className="space-y-6 max-w-2xl">
      <header>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold">{t('buffetPulse.title')}</h1>
            <p className="text-white/50 mt-0.5 text-sm">
              {t('buffetPulse.liveIndicator')} — Supabase Realtime
            </p>
          </div>
        </div>
      </header>

      {/* ── Step 1: Today's Menu ── */}
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange text-xs font-black">1</div>
            <h2 className="font-semibold text-base">Σημερινό Μενού Μπουφέ</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadMenus()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <p className="text-white/40 text-sm">Φόρτωση μενού…</p>
        ) : menus.length === 0 ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-300">
            Δεν υπάρχουν ενεργά μενού τύπου «Μπουφέ». Δημιούργησε ένα από τη σελίδα Μενού.
          </div>
        ) : (
          <div className="grid gap-2">
            {menus.map((m) => {
              const selected = m.id === todayMenuId
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMenu(m.id)}
                  className={[
                    'flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all border',
                    selected
                      ? 'bg-brand-orange/15 border-brand-orange/50 text-white'
                      : 'bg-white/4 border-white/8 text-white/60 hover:bg-white/8 hover:text-white',
                  ].join(' ')}
                >
                  <div className={['flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors', selected ? 'bg-brand-orange text-white-fixed' : 'bg-white/8 text-white/40'].join(' ')}>
                    {selected ? <CheckCircle2 className="h-4 w-4" /> : <ChefHat className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight">{m.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">{m.itemCount} πιάτα</p>
                  </div>
                  {selected && (
                    <span className="shrink-0 rounded-full bg-brand-orange/20 px-2 py-0.5 text-[10px] font-bold text-brand-orange uppercase tracking-wider">
                      Σήμερα
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </GlassCard>

      {/* ── Step 2: Launch screens ── */}
      <GlassCard className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange text-xs font-black">2</div>
          <h2 className="font-semibold text-base">Εκκίνηση</h2>
        </div>

        {!todayMenuId && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/50">
            ⬆ Επίλεξε πρώτα ποιο μενού τρέχει σήμερα
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Buffet Monitor */}
          <button
            onClick={openMonitor}
            disabled={!todayMenuId}
            className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <GlassCard
              hover
              className="flex flex-col gap-4 h-full border border-emerald-500/20 hover:border-emerald-500/50 transition-colors"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15">
                <Tablet className="h-7 w-7 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-emerald-300">{t('buffetPulse.monitorMode')}</h3>
                <p className="text-white/50 text-sm mt-1">{t('buffetPulse.monitorDesc')}</p>
                {selectedMenu && (
                  <p className="text-emerald-400/70 text-xs mt-2 font-medium">📋 {selectedMenu.name}</p>
                )}
              </div>
              <div className="mt-auto pt-4 border-t border-white/10">
                <span className="text-sm font-medium text-emerald-400">
                  {t('buffetPulse.openMonitor')} →
                </span>
              </div>
            </GlassCard>
          </button>

          {/* Kitchen KDS */}
          <button
            onClick={openKds}
            disabled={!todayMenuId}
            className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <GlassCard
              hover
              className="flex flex-col gap-4 h-full border border-red-500/20 hover:border-red-500/50 transition-colors"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15">
                <Monitor className="h-7 w-7 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-red-300">{t('buffetPulse.kdsMode')}</h3>
                <p className="text-white/50 text-sm mt-1">{t('buffetPulse.kdsDesc')}</p>
                {selectedMenu && (
                  <p className="text-red-400/70 text-xs mt-2 font-medium">📋 {selectedMenu.name}</p>
                )}
              </div>
              <div className="mt-auto pt-4 border-t border-white/10">
                <span className="text-sm font-medium text-red-400">
                  {t('buffetPulse.openKds')} →
                </span>
              </div>
            </GlassCard>
          </button>
        </div>
      </GlassCard>
    </div>
  )
}
