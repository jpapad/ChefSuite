import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, Tablet, Monitor } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'

export default function BuffetPulse() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
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

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Buffet Monitor */}
        <button
          onClick={() => navigate('/buffet-monitor')}
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 rounded-2xl"
        >
          <GlassCard
            hover
            className="flex flex-col gap-4 h-full border border-emerald-500/20 hover:border-emerald-500/50 transition-colors"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15">
              <Tablet className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-emerald-300">{t('buffetPulse.monitorMode')}</h2>
              <p className="text-white/50 text-sm mt-1">{t('buffetPulse.monitorDesc')}</p>
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
          onClick={() => navigate('/buffet-kds')}
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 rounded-2xl"
        >
          <GlassCard
            hover
            className="flex flex-col gap-4 h-full border border-red-500/20 hover:border-red-500/50 transition-colors"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15">
              <Monitor className="h-7 w-7 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-red-300">{t('buffetPulse.kdsMode')}</h2>
              <p className="text-white/50 text-sm mt-1">{t('buffetPulse.kdsDesc')}</p>
            </div>
            <div className="mt-auto pt-4 border-t border-white/10">
              <span className="text-sm font-medium text-red-400">
                {t('buffetPulse.openKds')} →
              </span>
            </div>
          </GlassCard>
        </button>
      </div>

      <GlassCard className="text-xs text-white/40 space-y-1">
        <p>
          <span className="text-emerald-400 font-semibold">{t('buffetPulse.monitorMode')}</span>
          {' '}— {t('buffetPulse.monitorDesc')}
        </p>
        <p>
          <span className="text-red-400 font-semibold">{t('buffetPulse.kdsMode')}</span>
          {' '}— {t('buffetPulse.kdsDesc')}
        </p>
      </GlassCard>
    </div>
  )
}
