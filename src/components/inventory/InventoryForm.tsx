import { useEffect, useState, type FormEvent } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Drawer } from '../ui/Drawer'
import { BarcodeScanner, BarcodeScanButton, BarcodeScannerStyles } from './BarcodeScanner'
import type { InventoryItem, InventoryLocation } from '../../types/database.types'

export interface InventoryFormValues {
  name: string
  unit: string
  quantity: number
  min_stock_level: number
  cost_per_unit: number | null
  location_id: string | null
  barcode: string | null
}

interface InventoryFormProps {
  initial?: InventoryItem
  locations: InventoryLocation[]
  submitting?: boolean
  onSubmit: (values: InventoryFormValues) => void | Promise<void>
  onCancel: () => void
}

const UNIT_SUGGESTIONS = ['g', 'kg', 'ml', 'l', 'piece', 'pack', 'box']

function blank(initial?: InventoryItem): InventoryFormValues {
  return {
    name: initial?.name ?? '',
    unit: initial?.unit ?? 'kg',
    quantity: initial?.quantity ?? 0,
    min_stock_level: initial?.min_stock_level ?? 0,
    cost_per_unit: initial?.cost_per_unit ?? null,
    location_id: initial?.location_id ?? null,
    barcode: initial?.barcode ?? null,
  }
}

export function InventoryForm({
  initial,
  locations,
  submitting,
  onSubmit,
  onCancel,
}: InventoryFormProps) {
  const [values, setValues] = useState<InventoryFormValues>(() => blank(initial))
  const [error, setError] = useState<string | null>(null)
  const [scanOpen, setScanOpen] = useState(false)

  useEffect(() => {
    setValues(blank(initial))
  }, [initial])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!values.name.trim()) {
      setError('Name is required')
      return
    }
    if (!values.unit.trim()) {
      setError('Unit is required')
      return
    }
    try {
      await onSubmit({
        ...values,
        name: values.name.trim(),
        unit: values.unit.trim(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  function onBarcodeDetected(barcode: string, productName?: string, unit?: string) {
    setScanOpen(false)
    setValues((v) => ({
      ...v,
      name: productName ? productName : v.name || barcode,
      unit: unit ?? v.unit,
      barcode,
    }))
  }

  return (
    <>
    <BarcodeScannerStyles />
    <Drawer open={scanOpen} onClose={() => setScanOpen(false)} title="Scan Barcode">
      <BarcodeScanner onDetected={onBarcodeDetected} onClose={() => setScanOpen(false)} />
    </Drawer>
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <div className="flex items-end justify-between mb-1">
          <span className="text-sm font-medium text-white/80">Item name</span>
          <BarcodeScanButton onClick={() => setScanOpen(true)} />
        </div>
        <Input
          name="name"
          placeholder="Olive oil"
          required
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          label=""
        />
        {values.barcode && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/40">
            <span className="font-mono bg-white/5 rounded px-1.5 py-0.5">{values.barcode}</span>
            <button type="button" onClick={() => setValues((v) => ({ ...v, barcode: null }))}
              className="hover:text-red-400 transition">✕</button>
          </p>
        )}
      </div>

      <div>
        <Input
          name="unit"
          label="Unit"
          placeholder="kg"
          list="unit-suggestions"
          required
          value={values.unit}
          onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))}
        />
        <datalist id="unit-suggestions">
          {UNIT_SUGGESTIONS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          type="number"
          name="quantity"
          label="Quantity on hand"
          step="any"
          min={0}
          required
          value={values.quantity}
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              quantity: e.target.value === '' ? 0 : Number(e.target.value),
            }))
          }
        />
        <Input
          type="number"
          name="min_stock_level"
          label="Reorder below"
          step="any"
          min={0}
          required
          value={values.min_stock_level}
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              min_stock_level:
                e.target.value === '' ? 0 : Number(e.target.value),
            }))
          }
        />
      </div>

      {locations.length > 0 && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-white/80">
            Storage location
          </label>
          <select
            value={values.location_id ?? ''}
            onChange={(e) =>
              setValues((v) => ({ ...v, location_id: e.target.value || null }))
            }
            className="w-full h-11 rounded-xl px-3 text-sm bg-white/5 border border-glass-border text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
          >
            <option value="">— Unassigned —</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <Input
        type="number"
        name="cost_per_unit"
        label={`Cost per ${values.unit || 'unit'} (€)`}
        placeholder="0.00"
        step="0.0001"
        min={0}
        hint="Optional — used to auto-cost recipes that use this ingredient."
        value={values.cost_per_unit ?? ''}
        onChange={(e) =>
          setValues((v) => ({
            ...v,
            cost_per_unit:
              e.target.value === '' ? null : Number(e.target.value),
          }))
        }
      />

      {error && (
        <div className="glass rounded-xl px-4 py-3 text-sm text-red-300 border border-red-500/40">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : initial ? 'Save changes' : 'Add item'}
        </Button>
      </div>
    </form>
    </>
  )
}
