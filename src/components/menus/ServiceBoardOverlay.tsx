import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import type { MenuSectionWithItems } from '../../types/database.types'

interface ServiceBoardOverlayProps {
  sections: MenuSectionWithItems[]
  onClose: () => void
  onItemToggled: (itemId: string, available: boolean) => void
}

export function ServiceBoardOverlay({ sections, onClose, onItemToggled }: ServiceBoardOverlayProps) {
  const { t } = useTranslation()
  const [toggling, setToggling] = useState<Set<string>>(new Set())

  const allItems = sections.flatMap((s) => s.items)
  const unavailableCount = allItems.filter((i) => !i.available).length

  async function toggle(itemId: string, currentAvailable: boolean) {
    if (toggling.has(itemId)) return
    setToggling((p) => new Set(p).add(itemId))
    try {
      await supabase.from('menu_items').update({ available: !currentAvailable }).eq('id', itemId)
      onItemToggled(itemId, !currentAvailable)
    } finally {
      setToggling((p) => { const n = new Set(p); n.delete(itemId); return n })
    }
  }

  const S = {
    root:    { position: 'fixed' as const, inset: 0, zIndex: 50, background: 'rgb(26,18,8)', overflow: 'auto' },
    topBar:  { position: 'sticky' as const, top: 0, zIndex: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' },
    title:   { flex: 1, fontWeight: 700, fontSize: '16px', color: '#ffffff' },
    badge:   { fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '8px', background: unavailableCount > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)', color: unavailableCount > 0 ? '#f87171' : 'rgba(255,255,255,0.4)' },
    sHead:   { padding: '16px 20px 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const },
    grid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', padding: '0 20px 20px' },
    itemOn:  { borderRadius: '14px', border: '1.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', padding: '14px 12px', cursor: 'pointer', textAlign: 'center' as const, transition: 'all 0.15s', minHeight: '72px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '4px' },
    itemOff: { borderRadius: '14px', border: '1.5px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.12)', padding: '14px 12px', cursor: 'pointer', textAlign: 'center' as const, transition: 'all 0.15s', minHeight: '72px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '4px' },
    nameOn:  { fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.25 },
    nameOff: { fontSize: '13px', fontWeight: 700, color: '#f87171', lineHeight: 1.25, textDecoration: 'line-through' },
    label86: { fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: '#ef4444', marginTop: '2px' },
    hint:    { padding: '0 20px 24px', fontSize: '12px', color: 'rgba(255,255,255,0.2)', textAlign: 'center' as const },
    footer:  { position: 'sticky' as const, bottom: 0, background: 'rgba(26,18,8,0.95)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' },
    footerText: { fontSize: '13px', color: 'rgba(255,255,255,0.4)' },
  }

  return (
    <div style={S.root}>
      {/* Top bar */}
      <div style={S.topBar}>
        {unavailableCount > 0 && <AlertTriangle style={{ width: '18px', height: '18px', color: '#f87171', flexShrink: 0 }} />}
        <span style={S.title}>{t('menus.serviceBoard.title')}</span>
        <span style={S.badge}>
          {unavailableCount > 0
            ? t('menus.serviceBoard.eightySixCount', { count: unavailableCount })
            : t('menus.serviceBoard.allAvailable')}
        </span>
        <button type="button" onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>
          <X style={{ width: '16px', height: '16px', color: 'rgba(255,255,255,0.7)' }} />
        </button>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.id}>
          <p style={S.sHead}>{section.name}</p>
          <div style={S.grid}>
            {section.items.map((item) => {
              const isToggling = toggling.has(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id, item.available)}
                  disabled={isToggling}
                  style={{
                    ...(item.available ? S.itemOn : S.itemOff),
                    opacity: isToggling ? 0.5 : 1,
                  }}
                >
                  <span style={item.available ? S.nameOn : S.nameOff}>{item.name}</span>
                  {!item.available && <span style={S.label86}>86'd</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <p style={S.hint}>{t('menus.serviceBoard.hint')}</p>

      {/* Footer */}
      <div style={S.footer}>
        <span style={S.footerText}>
          {allItems.length - unavailableCount}/{allItems.length} {t('menus.serviceBoard.available')}
        </span>
        <button type="button" onClick={onClose}
          style={{ padding: '8px 20px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          {t('common.close')}
        </button>
      </div>

      <style>{`
        @media print { body > div[style*="position: fixed"] { display: none !important; } }
      `}</style>
    </div>
  )
}
