import { useState } from 'react'
import { Package, PackagePlus, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react'
import { BarcodeScanner, BarcodeScannerStyles } from './BarcodeScanner'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { cn } from '../../lib/cn'
import { isLowStock } from '../../hooks/useInventory'
import type { InventoryItem } from '../../types/database.types'

type Mode = 'check' | 'receive'

interface ReceivingScannerProps {
  mode: Mode
  items: InventoryItem[]
  onReceive: (item: InventoryItem, qty: number) => Promise<void>
  onNotFound: (barcode: string) => void
  onClose: () => void
}

interface FoundState {
  item: InventoryItem
  barcode: string
}

export function ReceivingScanner({ mode, items, onReceive, onNotFound, onClose }: ReceivingScannerProps) {
  const [found, setFound] = useState<FoundState | null>(null)
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notFound, setNotFound] = useState<string | null>(null)

  function onDetected(barcode: string) {
    const match = items.find((i) => i.barcode === barcode)
    if (match) {
      setFound({ item: match, barcode })
      setNotFound(null)
    } else {
      setFound(null)
      setNotFound(barcode)
    }
  }

  async function handleReceive() {
    if (!found || !qty || Number(qty) <= 0) return
    setSaving(true)
    try {
      await onReceive(found.item, Number(qty))
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setFound(null)
        setQty('')
      }, 1800)
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setFound(null)
    setNotFound(null)
    setQty('')
    setSaved(false)
  }

  const low = found ? isLowStock(found.item) : false

  return (
    <div className="flex flex-col gap-4">
      <BarcodeScannerStyles />

      {/* Scanner — always visible until something is found */}
      {!found && !notFound && (
        <BarcodeScanner onDetected={onDetected} onClose={onClose} />
      )}

      {/* Not found state */}
      {notFound && !found && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div>
              <p className="font-semibold text-white/90">Product not in inventory</p>
              <p className="font-mono text-xs text-white/40 mt-1">{notFound}</p>
              <p className="text-sm text-white/50 mt-2">
                This barcode isn't linked to any item yet.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={reset}>Scan again</Button>
            <Button className="flex-1" onClick={() => onNotFound(notFound)}>
              Add to inventory <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Found state */}
      {found && (
        <div className="flex flex-col gap-4">
          {/* Item card */}
          <div className={cn(
            'rounded-2xl border p-4 flex items-start gap-4',
            low ? 'border-red-500/30 bg-red-500/8' : 'border-white/10 bg-white/5',
          )}>
            <div className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
              low ? 'bg-red-500/15 text-red-400' : 'bg-brand-orange/15 text-brand-orange',
            )}>
              <Package className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white leading-snug truncate">{found.item.name}</p>
              <p className="font-mono text-[11px] text-white/35 mt-0.5">{found.barcode}</p>
              <div className="flex items-center gap-3 mt-2 text-sm">
                <span className={cn('font-semibold', low ? 'text-red-300' : 'text-emerald-300')}>
                  {found.item.quantity} {found.item.unit}
                </span>
                <span className="text-white/30">·</span>
                <span className="text-white/50">min {found.item.min_stock_level} {found.item.unit}</span>
                {low && <span className="text-xs text-red-400 font-medium">LOW</span>}
              </div>
              {found.item.cost_per_unit != null && (
                <p className="text-xs text-white/35 mt-1">
                  €{found.item.cost_per_unit.toFixed(4)} / {found.item.unit}
                </p>
              )}
            </div>
          </div>

          {/* Receive mode — quantity input */}
          {mode === 'receive' && !saved && (
            <div className="flex flex-col gap-3">
              <Input
                type="number"
                label={`Quantity received (${found.item.unit})`}
                placeholder="0"
                min={0.001}
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                autoFocus
              />
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={reset}>Scan again</Button>
                <Button
                  className="flex-1"
                  leftIcon={<PackagePlus className="h-4 w-4" />}
                  disabled={!qty || Number(qty) <= 0 || saving}
                  onClick={() => void handleReceive()}
                >
                  {saving ? 'Saving…' : 'Receive'}
                </Button>
              </div>
            </div>
          )}

          {/* Check mode — just a "scan again" button */}
          {mode === 'check' && (
            <Button variant="secondary" onClick={reset}>Scan another</Button>
          )}

          {/* Success */}
          {saved && (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-300 font-medium">
                Stock updated: +{qty} {found.item.unit}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
