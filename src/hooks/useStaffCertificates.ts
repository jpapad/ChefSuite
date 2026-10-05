import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { StaffCertificate, StaffCertificateDraft } from '../types/database.types'

const BUCKET = 'staff-docs'

export type CertStatus = 'valid' | 'expiring' | 'expired' | 'no_expiry'

/** Days until expiry (negative = expired); null when there is no expiry date. */
export function daysLeft(expiresOn: string | null): number | null {
  if (!expiresOn) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((new Date(expiresOn + 'T00:00:00').getTime() - today.getTime()) / 86400000)
}

export function certStatus(c: Pick<StaffCertificate, 'expires_on'>, warnDays = 30): CertStatus {
  const d = daysLeft(c.expires_on)
  if (d == null) return 'no_expiry'
  if (d < 0) return 'expired'
  if (d <= warnDays) return 'expiring'
  return 'valid'
}

export function useStaffCertificates() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const userId = profile?.id ?? null
  const [certs, setCerts] = useState<StaffCertificate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!teamId) { setCerts([]); setLoading(false); return }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('staff_certificates')
      .select('*')
      .eq('team_id', teamId)
      .order('expires_on', { ascending: true, nullsFirst: false })
    setCerts((data ?? []) as StaffCertificate[])
    setError(err?.message ?? null)
    setLoading(false)
  }, [teamId])

  useEffect(() => { void load() }, [load])

  const save = useCallback(async (draft: StaffCertificateDraft, id?: string) => {
    if (!teamId) throw new Error('No team')
    const q = id
      ? supabase.from('staff_certificates').update({ ...draft, updated_at: new Date().toISOString() }).eq('id', id)
      : supabase.from('staff_certificates').insert({ ...draft, team_id: teamId, created_by: userId })
    const { error: err } = await q
    if (err) throw err
    await load()
  }, [teamId, userId, load])

  const remove = useCallback(async (cert: StaffCertificate) => {
    const { error: err } = await supabase.from('staff_certificates').delete().eq('id', cert.id)
    if (err) throw err
    if (cert.doc_path) await supabase.storage.from(BUCKET).remove([cert.doc_path])
    setCerts((cs) => cs.filter((c) => c.id !== cert.id))
  }, [])

  const uploadDoc = useCallback(async (file: File): Promise<string> => {
    if (!teamId) throw new Error('No team')
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
    const path = `${teamId}/${crypto.randomUUID()}.${ext}`
    const { error: err } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
    if (err) throw err
    return path
  }, [teamId])

  /** Short-lived link — the bucket is private. */
  const openDoc = useCallback(async (path: string) => {
    const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120)
    if (err || !data) throw err ?? new Error('No link')
    window.open(data.signedUrl, '_blank', 'noopener')
  }, [])

  return { certs, loading, error, reload: load, save, remove, uploadDoc, openDoc }
}
