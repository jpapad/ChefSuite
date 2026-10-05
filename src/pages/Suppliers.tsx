import { useState } from 'react'
import {
  Plus, Pencil, Trash2, Truck, Mail, Phone, User, Search, X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, PillButton, StatRow, StatTile, SearchField, Panel, EmptyState, Notice } from '../components/ui/page'
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

  const linkedTotal = inventoryItems.filter((i) => i.supplier_id).length
  const withoutContact = suppliers.filter((s) => !s.email && !s.phone).length
  const iconBtn = 'flex h-9 w-9 items-center justify-center rounded-full text-white/55 hover:bg-white/[0.06] hover:text-white transition'

  return (
    <Page>
      <PageHeader
        title={t('suppliers.title')}
        subtitle={t('suppliers.subtitle')}
        actions={<PillButton icon={Plus} variant="primary" onClick={openCreate}>{t('suppliers.addSupplier')}</PillButton>}
      />

      {error && <Notice>{error}</Notice>}

      {suppliers.length > 0 && (
        <StatRow>
          <StatTile tone="ink" label={t('suppliers.title')} value={suppliers.length} />
          <StatTile label={t('suppliers.v2.linkedItems')} value={linkedTotal} hint={t('suppliers.v2.linkedHint', { total: inventoryItems.length })} />
          <StatTile label={t('suppliers.v2.unlinked')} value={inventoryItems.length - linkedTotal} tone={inventoryItems.length - linkedTotal > 0 ? 'warn' : 'default'} hint={t('suppliers.v2.unlinkedHint')} to="/inventory" />
          <StatTile label={t('suppliers.v2.noContact')} value={withoutContact} hint={t('suppliers.v2.noContactHint')} />
        </StatRow>
      )}

      {suppliers.length > 0 && (
        <SearchField value={query} onChange={setQuery} placeholder={t('suppliers.searchPlaceholder')} className="max-w-md" />
      )}

      {loading ? (
        <Panel><p className="text-white/55">{t('common.loading')}</p></Panel>
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={t('suppliers.empty.title')}
          body={t('suppliers.empty.description')}
          action={<PillButton icon={Plus} variant="primary" onClick={openCreate}>{t('suppliers.empty.cta')}</PillButton>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title={t('suppliers.noMatch')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => {
            const count = itemCountFor(s.id)
            return (
              <article key={s.id} className="flex flex-col gap-4 rounded-3xl bg-bg-card p-5 shadow-card">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06]">
                    {s.logo_url ? <img src={s.logo_url} alt={s.name} className="h-full w-full object-cover" /> : <Truck className="h-5 w-5 text-white/60" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-medium">{s.name}</h3>
                    {s.contact_name && <p className="flex items-center gap-1 text-sm text-white/55"><User className="h-3.5 w-3.5" />{s.contact_name}</p>}
                  </div>
                  <button type="button" aria-label={t('common.edit')} onClick={() => openEdit(s)} className={iconBtn}><Pencil className="h-4 w-4" /></button>
                  <button type="button" aria-label={t('common.delete')} onClick={() => handleDelete(s)} className={`${iconBtn} hover:text-red-500`}><Trash2 className="h-4 w-4" /></button>
                </div>

                {s.notes && <p className="line-clamp-2 text-sm text-white/55">{s.notes}</p>}

                <div className="mt-auto flex flex-wrap items-center gap-2">
                  {s.phone && (
                    <a href={`tel:${s.phone}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-orange px-4 text-sm font-medium text-on-accent">
                      <Phone className="h-4 w-4" />{s.phone}
                    </a>
                  )}
                  {s.email && (
                    <a href={`mailto:${s.email}`} aria-label={s.email} title={s.email} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.06] px-4 text-sm font-medium hover:bg-white/[0.1]">
                      <Mail className="h-4 w-4" /><span className="max-w-[140px] truncate">{s.email}</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setLinkedDrawerSupplier(s)}
                    className="ml-auto rounded-full bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/70 hover:text-white"
                  >
                    {count > 0 ? t('suppliers.linkedItems', { count }) : t('suppliers.noLinkedItems')}
                  </button>
                </div>
              </article>
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
    </Page>
  )
}
