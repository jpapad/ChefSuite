// ── Warehouse Module Types ────────────────────────────────────────────────────

export interface WhCategory {
  id: string
  name: string
  group_name: string | null
  created_at: string
}

export interface WhStorageLocation {
  id: string
  name: string
  created_at: string
}

export interface WhSupplier {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  delivery_days: number[]        // weekday indices 0=Mon … 6=Sun
  order_lead_days: number
  order_deadline_time: string    // 'HH:MM'
  created_at: string
}

export interface WhProduct {
  id: string
  name: string
  product_code: string | null
  category_id: string | null
  supplier_id: string | null
  storage_unit_id: string | null
  unit: string
  purchase_price: number | null
  min_quantity: number
  current_stock: number
  notes: string | null
  created_at: string
  // joined
  categories?: Pick<WhCategory, 'id' | 'name'> | null
  wh_suppliers?: Pick<WhSupplier, 'id' | 'name'> | null
  wh_storage_locations?: Pick<WhStorageLocation, 'id' | 'name'> | null
}

export type WhOrderStatus = 'pending' | 'received' | 'cancelled'

export interface WhOrder {
  id: string
  supplier_id: string | null
  status: WhOrderStatus
  notes: string | null
  order_date: string | null
  expected_delivery_date: string | null
  received_at: string | null
  invoice_total: number | null
  created_at: string
  // joined
  wh_suppliers?: Pick<WhSupplier, 'id' | 'name'> | null
  wh_order_items?: WhOrderItem[]
}

export interface WhOrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  product_code: string | null
  quantity: number
  unit: string | null
  unit_price: number | null
  invoice_price: number | null
  received_quantity: number | null
  backorder_quantity: number | null
  backorder_status: string | null
  backorder_charged: boolean
  created_at: string
  // joined
  wh_products?: Pick<WhProduct, 'id' | 'name' | 'supplier_id' | 'unit'> | null
}

export interface WhInventorySession {
  id: string
  name: string
  month: string          // 'YYYY-MM'
  item_count: number
  is_draft: boolean
  created_by: string | null
  created_by_name: string | null
  created_at: string
}

export interface WhInventorySessionItem {
  id: string
  session_id: string
  product_id: string | null
  product_name: string
  category_name: string | null
  storage_unit_name: string | null
  unit: string | null
  system_quantity: number | null
  counted_quantity: number | null
  counted_unit: string | null
}

export interface WhSupplierCatalog {
  id: string
  supplier_id: string | null
  name: string
  source_filename: string | null
  uploaded_by: string | null
  uploaded_by_name: string | null
  total_items: number
  status: string
  uploaded_at: string
  // joined
  wh_suppliers?: Pick<WhSupplier, 'id' | 'name'> | null
}

export interface WhCatalogItem {
  id: string
  catalog_id: string
  raw_name: string
  raw_packaging: string | null
  raw_price: number | null
  raw_price_unit_label: string | null
  base_unit: string | null
  price_per_base_unit: number | null
  supplier_code: string | null
  ai_subcategory: string | null
  // runtime (joined)
  supplier_id?: string
  catalog_filename?: string
}

export interface WhProductReturn {
  id: string
  product_id: string | null
  product_name: string
  supplier_id: string | null
  supplier_name: string | null
  quantity: number
  unit: string | null
  reason: string | null
  status: 'open' | 'credited'
  credit_received_at: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
}

export interface WhSupplierCredit {
  id: string
  supplier_id: string | null
  amount: number | null
  credit_date: string
  notes: string | null
  created_at: string
}

export interface WhOrderWatchlist {
  id: string
  product_id: string
  quantity: number | null
  unit: string | null
  created_at: string
  // joined
  wh_products?: Pick<WhProduct, 'id' | 'name' | 'unit' | 'supplier_id'> | null
}

export interface WhActivityLog {
  id: string
  user_id: string | null
  username: string | null
  role: string | null
  action: string
  target: string | null
  details: string | null
  created_at: string
}

// ── Form shapes ───────────────────────────────────────────────────────────────

export type WhProductForm = {
  name: string
  product_code: string
  category_id: string
  supplier_id: string
  storage_unit_id: string
  unit: string
  purchase_price: string
  min_quantity: string
  current_stock: string
  notes: string
}

export type WhSupplierForm = {
  name: string
  phone: string
  email: string
  notes: string
  delivery_days: number[]
  order_lead_days: number
  order_deadline_time: string
}

// ── Warehouse sub-page key ────────────────────────────────────────────────────

export type WarehousePage =
  | 'products'
  | 'suppliers'
  | 'categories'
  | 'storage'
  | 'orders'
  | 'inventory'
  | 'price-comparison'
  | 'schedule'
  | 'import'
