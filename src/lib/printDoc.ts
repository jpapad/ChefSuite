/** Opens a clean printable page (the browser's print dialog can save it as PDF). */
export function printDoc(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'width=820,height=960')
  if (!w) return
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body{font-family:Geologica,system-ui,sans-serif;color:#0F1210;padding:44px;max-width:720px;margin:auto;font-size:14px;line-height:1.5}
  h1{font-size:28px;margin:0 0 4px;letter-spacing:-.02em} h2{font-size:16px;margin:28px 0 8px}
  .muted{color:#666} .lime{display:inline-block;background:#C8F03C;border-radius:999px;padding:2px 10px;font-weight:600;font-size:12px}
  table{width:100%;border-collapse:collapse} td,th{padding:8px 6px;border-bottom:1px solid #e5e5e0;text-align:left;vertical-align:top}
  th{font-size:11px;color:#777;font-weight:500;text-transform:uppercase;letter-spacing:.04em} .n{text-align:right;font-variant-numeric:tabular-nums}
  .total td{font-weight:600;border-bottom:0;border-top:2px solid #0F1210} .box{background:#F1F2EE;border-radius:14px;padding:14px 16px;margin-top:16px;white-space:pre-wrap}
  .sign{display:flex;gap:40px;margin-top:56px} .sign div{flex:1;border-top:1px solid #0F1210;padding-top:6px;font-size:12px;color:#666}
</style></head><body>${bodyHtml}<script>window.onload=()=>window.print()</script></body></html>`)
  w.document.close()
}

export function esc(s: string | number | null | undefined) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
