import { supabase } from './supabase'

const BUCKET = 'warehouse-docs'

export async function uploadWarehouseDoc(
  folder: 'invoices' | 'catalogs',
  id: string,
  file: File,
): Promise<string | null> {
  const ext  = file.name.split('.').pop() ?? 'pdf'
  const path = `${folder}/${id}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) { console.error('Upload error', error); return null }
  return path
}

export async function getWarehouseDocUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error || !data) return null
  return data.signedUrl
}

export async function deleteWarehouseDoc(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}
