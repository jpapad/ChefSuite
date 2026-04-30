import { useEffect, useRef, useState } from 'react'
import { ScanLine, X, Flashlight, AlertCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'

interface BarcodeScannerProps {
  onDetected: (barcode: string, productName?: string, unit?: string) => void
  onClose: () => void
}

interface OFFProduct {
  product_name?: string
  product_name_en?: string
  quantity?: string
}

async function lookupBarcode(code: string): Promise<{ name?: string; unit?: string }> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`,
      { signal: AbortSignal.timeout(4000) },
    )
    if (!res.ok) return {}
    const json = (await res.json()) as { status: number; product?: OFFProduct }
    if (json.status !== 1 || !json.product) return {}
    const p = json.product
    const name = p.product_name_en || p.product_name || undefined
    // Try to extract unit from quantity string e.g. "500g", "1 kg", "6x250ml"
    let unit: string | undefined
    if (p.quantity) {
      const m = p.quantity.match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ml|L)/i)
      if (m) unit = m[2].toLowerCase()
    }
    return { name, unit }
  } catch {
    return {}
  }
}

// Type declaration for BarcodeDetector (not yet in all TS libs)
interface BarcodeDetectorType {
  detect(image: HTMLVideoElement | ImageBitmap): Promise<Array<{ rawValue: string }>>
}
declare const BarcodeDetector: {
  new (options: { formats: string[] }): BarcodeDetectorType
  getSupportedFormats?(): Promise<string[]>
}

const SUPPORTED = typeof window !== 'undefined' && 'BarcodeDetector' in window

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetectorType | null>(null)
  const rafRef = useRef<number>(0)
  const detectedRef = useRef(false)

  const [status, setStatus] = useState<'requesting' | 'scanning' | 'detected' | 'error' | 'unsupported'>(
    SUPPORTED ? 'requesting' : 'unsupported',
  )
  const [errorMsg, setErrorMsg] = useState('')
  const [detectedCode, setDetectedCode] = useState('')
  const [looking, setLooking] = useState(false)
  const [torch, setTorch] = useState(false)

  // Start camera
  useEffect(() => {
    if (!SUPPORTED) return
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        detectorRef.current = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'data_matrix'],
        })
        setStatus('scanning')
        scan()
      } catch (err) {
        if (cancelled) return
        setErrorMsg(err instanceof Error ? err.message : 'Camera access denied')
        setStatus('error')
      }
    }

    function scan() {
      if (cancelled || detectedRef.current || !videoRef.current || !detectorRef.current) return
      detectorRef.current.detect(videoRef.current).then((results) => {
        if (cancelled || detectedRef.current) return
        if (results.length > 0) {
          const code = results[0].rawValue
          detectedRef.current = true
          setDetectedCode(code)
          setStatus('detected')
          // vibrate on mobile
          if ('vibrate' in navigator) navigator.vibrate(120)
          handleLookup(code)
        } else {
          rafRef.current = requestAnimationFrame(scan)
        }
      }).catch(() => {
        if (!cancelled) rafRef.current = requestAnimationFrame(scan)
      })
    }

    void start()
    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function handleLookup(code: string) {
    setLooking(true)
    const result = await lookupBarcode(code)
    setLooking(false)
    onDetected(code, result.name, result.unit)
  }

  function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (track as any).applyConstraints({ advanced: [{ torch: next }] }).catch(() => {})
    setTorch(next)
  }

  // Unsupported browser: fallback to file input
  if (!SUPPORTED) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 px-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
          <AlertCircle className="h-7 w-7" />
        </div>
        <div>
          <p className="font-semibold text-white/90">Barcode scanning not supported</p>
          <p className="text-sm text-white/50 mt-1">
            Your browser doesn't support live scanning. Use Chrome/Edge on Android or desktop.
          </p>
          <p className="text-sm text-white/50 mt-2">
            You can also type the barcode manually in the item name field.
          </p>
        </div>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Viewfinder */}
      <div className="relative overflow-hidden rounded-2xl bg-black aspect-video max-h-72">
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Scanning overlay */}
        {status === 'scanning' && (
          <>
            {/* Corner brackets */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-48 h-32">
                {/* TL */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-brand-orange rounded-tl" />
                {/* TR */}
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-brand-orange rounded-tr" />
                {/* BL */}
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-brand-orange rounded-bl" />
                {/* BR */}
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-brand-orange rounded-br" />
                {/* Scan line animation */}
                <div className="absolute left-1 right-1 h-0.5 bg-brand-orange/70 shadow-[0_0_8px_#C4956A] animate-scan-line" />
              </div>
            </div>
            <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/60">
              Point at a barcode
            </p>
          </>
        )}

        {/* Detected state */}
        {status === 'detected' && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-900/60 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-3xl mb-1">✓</div>
              <p className="text-sm font-semibold text-emerald-300">{detectedCode}</p>
              {looking && <p className="text-xs text-white/60 mt-1">Looking up product…</p>}
            </div>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-center px-4">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-300">{errorMsg || 'Camera error'}</p>
            </div>
          </div>
        )}

        {/* Loading camera */}
        {status === 'requesting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <p className="text-sm text-white/60">Requesting camera…</p>
          </div>
        )}

        {/* Torch button */}
        {status === 'scanning' && (
          <button
            type="button"
            onClick={toggleTorch}
            className={cn(
              'absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full transition',
              torch ? 'bg-amber-400 text-black' : 'bg-black/50 text-white/70 hover:text-white',
            )}
          >
            <Flashlight className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          <X className="h-4 w-4 mr-1.5" />
          Cancel
        </Button>
        {status === 'detected' && (
          <Button
            className="flex-1"
            disabled={looking}
            onClick={() => { onDetected(detectedCode) }}
          >
            {looking ? 'Looking up…' : 'Use this code'}
          </Button>
        )}
      </div>

      {/* Supported formats hint */}
      <p className="text-center text-[11px] text-white/25">
        EAN-13 · EAN-8 · UPC-A · Code 128 · QR
      </p>
    </div>
  )
}

// Scan-line animation — add to tailwind config or inline keyframes via style tag
export function BarcodeScannerStyles() {
  return (
    <style>{`
      @keyframes scan-line {
        0%   { top: 4px; }
        50%  { top: calc(100% - 4px); }
        100% { top: 4px; }
      }
      .animate-scan-line {
        animation: scan-line 2s ease-in-out infinite;
        position: absolute;
      }
    `}</style>
  )
}

export function BarcodeScanButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-brand-orange hover:text-brand-orange/80 transition font-medium"
    >
      <ScanLine className="h-4 w-4" />
      Scan barcode
    </button>
  )
}
