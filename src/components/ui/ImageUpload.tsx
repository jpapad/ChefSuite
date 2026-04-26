import { useRef, useState, useCallback } from 'react'
import { ImageIcon, X, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_DIM = 2400 // max width/height after resize

function toJpeg(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { naturalWidth: w, naturalHeight: h } = img
      if (w > MAX_DIM || h > MAX_DIM) {
        const scale = MAX_DIM / Math.max(w, h)
        w = Math.round(w * scale)
        h = Math.round(h * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not available')); return }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Conversion failed')); return }
          resolve(new File([blob], 'image.jpg', { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.92,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image')) }
    img.src = url
  })
}

interface ImageUploadProps {
  value: string | null
  onChange: (url: string | null) => void
  bucket: string
  label?: string
  aspectClass?: string
}

export function ImageUpload({ value, onChange, bucket, label, aspectClass = 'h-36' }: ImageUploadProps) {
  const { profile } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const upload = useCallback(async (file: File) => {
    if (!profile?.team_id) return
    if (file.size > MAX_BYTES) {
      setError(`File too large (max 10 MB). This file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`)
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const converted = await toJpeg(file)
      const path = `${profile.team_id}/${crypto.randomUUID()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, converted, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      onChange(data.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }, [profile?.team_id, bucket, onChange])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void upload(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void upload(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    // only fire when leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
  }

  function handlePaste(e: React.ClipboardEvent) {
    const file = Array.from(e.clipboardData.items)
      .find((i) => i.kind === 'file' && i.type.startsWith('image/'))
      ?.getAsFile()
    if (file) void upload(file)
  }

  return (
    <div onPaste={handlePaste}>
      {label && (
        <span className="mb-2 block text-sm font-medium text-white/80">{label}</span>
      )}
      {value ? (
        <div className={`relative rounded-xl overflow-hidden border border-glass-border ${aspectClass}`}>
          <img src={value} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white hover:bg-black/80 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          disabled={uploading}
          className={[
            'w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition disabled:opacity-50',
            aspectClass,
            dragging
              ? 'border-brand-orange bg-brand-orange/10 text-brand-orange scale-[1.01]'
              : 'border-white/20 hover:border-brand-orange/60 text-white/40 hover:text-white/60',
          ].join(' ')}
        >
          {uploading ? (
            <span className="text-sm">Uploading…</span>
          ) : dragging ? (
            <>
              <Upload className="h-7 w-7" />
              <span className="text-xs font-medium">Drop to upload</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-7 w-7" />
              <span className="text-xs">Click, drag & drop, or paste an image</span>
              <span className="text-xs opacity-50">JPG · PNG · WebP · AVIF · HEIC · GIF · max 10 MB</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
