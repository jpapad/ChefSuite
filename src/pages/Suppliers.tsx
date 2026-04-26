import { useState } from 'react'
import {
  Plus, Pencil, Trash2, Truck, Mail, Phone, User, Search, X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { ImageUpload } from '../components/ui/ImageUpload'
import { useSuppliers } from '../hooks/useSuppliers'
import { useInventory } from '../hooks/useInventory'
import type { Supplier } from '../types/database.types'

interface SupplierFormValues {
  name: string
  contact_name: string
  email: string
  phone: string
  notes: string
  logo_url: string | null
}

function blank(s?: Supplier): SupplierFormValues {
  return {
    name: s?.name ?? '',
    contact_name: s?.contact_name ?? '',
    email: s?.email ?? '',
    phone: s?.phone ?? '',
    notes: s?.notes ?? '',
    logo_url: s?.logo_url ?? null,
  }
}

export default function Suppliers() {
  const { t } = useTranslation()
  const { suppliers, loading, error, create, update, remove } = useSuppliers()
  const { items: inventoryItems, update: updateInventoryItem } = useInventory()

  const [query, setQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [values, setValues] = useState<SupplierFormValues>(blank())

  // Items linked drawer
  const [linkedDrawerSupplier, setLinkedDrawerSupplier] = useState<Supplier | null>(null)

  const filtered = suppliers.filter((s) =>
    !query.trim() || s.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  function openCreate() {
    setEditing(null)
    setValues(blank())
    setFormError(null)
    setDrawerOpen(true)
  }

  function openEdit(s: Supplier) {
    setEditing(s)
    setValues(blank(s))
    setFormError(null)
    setDrawerOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!values.name.trim()) { setFormError(t('suppliers.form.nameRequired')); return }
    setSaving(true)
    try {
      const payload = {
        name: values.name.trim(),
        contact_name: values.contact_name.trim() || null,
        email: values.email.trim() || null,
        phone: values.phone.trim() || null,
        notes: values.notes.trim() || null,
        logo_url: values.logo_url ?? null,
      }
      if (editing) await update(editing.id, payload)
      else await create(payload)
      setDrawerOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('common.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s: Supplier) {
    const ok = window.confirm(t('suppliers.deleteConfirm', { name: s.name }))
    if (!ok) return
    await remove(s.id)
  }

  function itemCountFor(supplierId: string) {
    return inventoryItems.filter((i) => i.supplier_id === supplierId).length
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">{t('suppliers.title')}</h1>
          <p className="text-white/60 mt-1">{t('suppliers.subtitle')}</p>
        </div>
        <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openCreate}>
          {t('suppliers.addSupplier')}
        </Button>
      </header>

      {error && (
        <GlassCard className="border border-red-500/40 text-red-300">{error}</GlassCard>
      )}

      {suppliers.length > 0 && (
        <div className="max-w-md">
          <Input
            name="search"
            placeholder={t('suppliers.searchPlaceholder')}
            leftIcon={<Search className="h-5 w-5" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <GlassCard><p className="text-white/60">{t('common.loading')}</p></GlassCard>
      ) : suppliers.length === 0 ? (
        <GlassCard className="flex flex-col items-center text-center gap-3 py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
            <Truck className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">{t('suppliers.empty.title')}</h2>
          <p className="text-white/60 max-w-sm">{t('suppliers.empty.description')}</p>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openCreate} className="mt-2">
            {t('suppliers.empty.cta')}
          </Button>
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard><p className="text-white/60">{t('suppliers.noMatch')}</p></GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => {
            const count = itemCountFor(s.id)
            return (
              <GlassCard key={s.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange overflow-hidden">
                      {s.logo_url
                        ? <img src={s.logo_url} alt={s.name} className="w-full h-full object-cover" />
                        : <Truck className="h-5 w-5" />
                      }
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{s.name}</h3>
                      {s.contact_name && (
                        <p className="text-xs text-white/50 flex items-center gap-1">
                          <User className="h-3 w-3" />{s.contact_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => openEdit(s)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/5">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(s)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-white/60 hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-sm text-white/60">
                  {s.email && (
                    <a href={`mailto:${s.email}`} className="flex items-center gap-2 hover:text-white transition">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{s.email}</span>
                    </a>
                  )}
                  {s.phone && (
                    <a href={`tel:${s.phone}`} className="flex items-center gap-2 hover:text-white transition">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{s.phone}</span>
                    </a>
                  )}
                  {s.notes && (
                    <p className="text-xs text-white/40 line-clamp-2 mt-1">{s.notes}</p>
                  )}
                </div>

                <div className="border-t border-glass-border pt-3 mt-auto">
                  <button
                    type="button"
                    onClick={() => setLinkedDrawerSupplier(s)}
                    className="text-xs text-white/50 hover:text-white transition"
                  >
                    {count > 0
                      ? t('suppliers.linkedItems', { count })
                      : t('suppliers.noLinkedItems')}
                  </button>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}

      {/* Create / Edit drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => { if (!saving) setDrawerOpen(false) }}
        title={editing ? t('suppliers.editSupplier') : t('suppliers.newSupplier')}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <ImageUpload
            value={values.logo_url}
            onChange={(url) => setValues((v) => ({ ...v, logo_url: url }))}
            bucket="supplier-logos"
            label={t('suppliers.form.logo')}
            aspectClass="h-28"
          />
          <Input
            name="name"
            label={t('suppliers.form.name')}
            placeholder={t('suppliers.form.namePlaceholder')}
            required
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
          <Input
            name="contact_name"
            label={t('suppliers.form.contactName')}
            placeholder={t('suppliers.form.contactNamePlaceholder')}
            value={values.contact_name}
            onChange={(e) => setValues((v) => ({ ...v, contact_name: e.target.value }))}
          />
          <Input
            name="email"
            type="email"
            label={t('suppliers.form.email')}
            placeholder="orders@supplier.com"
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          />
          <Input
            name="phone"
            type="tel"
            label={t('suppliers.form.phone')}
            placeholder="+30 210 000 0000"
            value={values.phone}
            onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
          />
          <Textarea
            name="notes"
            label={t('suppliers.form.notes')}
            placeholder={t('suppliers.form.notesPlaceholder')}
            rows={3}
            value={values.notes}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          />
          {formError && (
            <div className="glass rounded-xl px-4 py-3 text-sm text-red-300 border border-red-500/40">
              {formError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('common.saving') : editing ? t('common.save') : t('suppliers.form.create')}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Linked inventory items drawer */}
      <Drawer
        open={!!linkedDrawerSupplier}
        onClose={() => setLinkedDrawerSupplier(null)}
        title={t('suppliers.linkedItemsTitle', { name: linkedDrawerSupplier?.name ?? '' })}
      >
        <div className="space-y-3">
          {linkedDrawerSupplier && (() => {
            const linked = inventoryItems.filter((i) => i.supplier_id === linkedDrawerSupplier.id)
            const unlinked = inventoryItems.filter((i) => !i.supplier_id)
            return (
              <>
                {linked.length === 0 ? (
                  <p className="text-white/50 text-sm">{t('suppliers.noLinkedItems')}</p>
                ) : (
                  <ul className="divide-y divide-glass-border rounded-xl border border-glass-border overflow-hidden">
                    {linked.map((item) => (
                      <li key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
                        <span className="font-medium">{item.name}</span>
                        <button
                          type="button"
                          onClick={() => updateInventoryItem(item.id, { supplier_id: null })}
                          className="text-white/30 hover:text-red-400 transition"
                          title={t('suppliers.unlinkItem')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {unlinked.length > 0 && (
                  <>
                    <p className="text-xs text-white/40 pt-2">{t('suppliers.addItems')}</p>
                    <ul className="divide-y divide-glass-border rounded-xl border border-glass-border overflow-hidden">
                      {unlinked.map((item) => (
                        <li key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
                          <span className="text-white/60">{item.name}</span>
                          <button
                            type="button"
                            onClick={() => updateInventoryItem(item.id, { supplier_id: linkedDrawerSupplier.id })}
                            className="text-white/30 hover:text-brand-orange transition"
                            title={t('suppliers.linkItem')}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )
          })()}
        </div>
      </Drawer>
    </div>
  )
}
