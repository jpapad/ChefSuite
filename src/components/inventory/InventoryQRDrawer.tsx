import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Download } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import type { InventoryItem } from '../../types/database.types'

interface Props {
  item: InventoryItem | null
  onClose: () => void
}

export function InventoryQRDrawer({ item, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (!item || !canvasRef.current) return
    const qrUrl = `${window.location.origin}/inventory?item=${item.id}`
    setUrl(qrUrl)
    void QRCode.toCanvas(canvasRef.current, qrUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#ffffff', light: '#00000000' },
    })
  }, [item])

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas || !item) return
    // White background for download
    const out = document.createElement('canvas')
    out.width = canvas.width
    out.height = canvas.height
    const ctx = out.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(canvas, 0, 0)
    const a = document.createElement('a')
    a.download = `${item.name.replace(/\s+/g, '_')}_qr.png`
    a.href = out.toDataURL('image/png')
    a.click()
  }

  return (
    <Drawer open={!!item} onClose={onClose} title="QR Code">
      {item && (
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-lg font-semibold">{item.name}</span>
            <span className="text-sm text-white/50">{item.unit} · {item.quantity} on hand</span>
          </div>

          <div className="rounded-2xl bg-white/5 border border-glass-border p-4">
            <canvas ref={canvasRef} className="block" />
          </div>

          <p className="text-xs text-white/40 text-center break-all max-w-xs">{url}</p>

          <Button
            leftIcon={<Download className="h-5 w-5" />}
            onClick={handleDownload}
            className="w-full"
          >
            Download PNG
          </Button>
        </div>
      )}
    </Drawer>
  )
}
