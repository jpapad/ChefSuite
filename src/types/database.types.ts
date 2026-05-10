export type UUID = string
export type ISODateString = string

export type UserRole = 'owner' | 'executive_chef' | 'head_chef' | 'sous_chef' | 'cook' | 'staff'

export interface Team {
  id: UUID
  name: string
  created_at: ISODateString
}

export interface Profile {
  id: UUID
  team_id: UUID | null
  active_team_id: UUID | null
  role: UserRole
  full_name: string | null
  permissions: string[] | null
  preferred_lang: string | null
  created_at: ISODateString
  updated_at: ISODateString
}

export interface TeamMembership {
  id: UUID
  user_id: UUID
  team_id: UUID
  role: UserRole
  invited_by: UUID | null
  created_at: ISODateString
}

export type RecipeCategory =
  | 'appetizer' | 'soup' | 'salad' | 'main' | 'side'
  | 'sauce' | 'bread' | 'dessert' | 'beverage' | 'other'

export type RecipeDifficulty = 'easy' | 'medium' | 'hard'

export interface Recipe {
  id: UUID
  team_id: UUID
  title: string
  description: string | null
  instructions: string | null
  cost_per_portion: number | null
  selling_price: number | null
  allergens: string[]
  category: RecipeCategory | null
  image_url: string | null
  prep_time: number | null
  cook_time: number | null
  servings: number | null
  difficulty: RecipeDifficulty | null
  parent_recipe_id: UUID | null
  variation_label: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  sodium_mg: number | null
  created_at: ISODateString
  updated_at: ISODateString
}

export type RecipeInsert = Pick<
  Recipe,
  'title' | 'description' | 'instructions' | 'cost_per_portion' | 'selling_price' | 'allergens' | 'category' | 'image_url' | 'prep_time' | 'cook_time' | 'servings' | 'difficulty' | 'parent_recipe_id' | 'variation_label'
> & { team_id: UUID; calories?: number | null; protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null; fiber_g?: number | null; sodium_mg?: number | null }

export type RecipeUpdate = Partial<
  Pick<
    Recipe,
    'title' | 'description' | 'instructions' | 'cost_per_portion' | 'selling_price' | 'allergens' | 'category' | 'image_url' | 'prep_time' | 'cook_time' | 'servings' | 'difficulty' | 'parent_recipe_id' | 'variation_label' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g' | 'sodium_mg'
  >
>

// ── Recipe Comments ────────────────────────────────────────────────────────────
export interface RecipeComment {
  id: UUID
  team_id: UUID
  recipe_id: UUID
  author_id: UUID | null
  content: string
  created_at: ISODateString
}

export interface RecipeCommentWithAuthor extends RecipeComment {
  author_name: string | null
}

export type RecipeCommentInsert = Pick<RecipeComment, 'recipe_id' | 'content'> & { team_id: UUID; author_id: UUID | null }

// ── HACCP Reminders ────────────────────────────────────────────────────────────
export interface HACCPReminder {
  id: UUID
  team_id: UUID
  location: string
  label: string
  frequency_h: number
  next_due: ISODateString
  assignee_id: UUID | null
  active: boolean
  created_at: ISODateString
}

export interface HACCPReminderWithAssignee extends HACCPReminder {
  assignee_name: string | null
}

export type HACCPReminderInsert = Pick<HACCPReminder, 'location' | 'label' | 'frequency_h' | 'next_due' | 'assignee_id' | 'active'> & { team_id: UUID }
export type HACCPReminderUpdate = Partial<Pick<HACCPReminder, 'location' | 'label' | 'frequency_h' | 'next_due' | 'assignee_id' | 'active'>>

export interface RecipeVersion {
  id: UUID
  recipe_id: UUID
  team_id: UUID
  saved_by: UUID | null
  title: string
  description: string | null
  instructions: string | null
  cost_per_portion: number | null
  selling_price: number | null
  allergens: string[]
  category: RecipeCategory | null
  prep_time: number | null
  cook_time: number | null
  servings: number | null
  difficulty: RecipeDifficulty | null
  created_at: ISODateString
}

export interface Supplier {
  id: UUID
  team_id: UUID
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  notes: string | null
  logo_url: string | null
  created_at: ISODateString
  updated_at: ISODateString
}

export type SupplierInsert = Pick<Supplier, 'name' | 'contact_name' | 'email' | 'phone' | 'notes' | 'logo_url'> & { team_id: UUID }
export type SupplierUpdate = Partial<Pick<Supplier, 'name' | 'contact_name' | 'email' | 'phone' | 'notes' | 'logo_url'>>

export interface InventoryLocation {
  id: UUID
  team_id: UUID
  name: string
  created_at: ISODateString
}

export interface InventoryItem {
  id: UUID
  team_id: UUID
  name: string
  quantity: number
  unit: string
  min_stock_level: number
  cost_per_unit: number | null
  location_id: UUID | null
  supplier_id: UUID | null
  barcode: string | null
  created_at: ISODateString
  updated_at: ISODateString
}

export type InventoryInsert = Pick<
  InventoryItem,
  'name' | 'quantity' | 'unit' | 'min_stock_level' | 'cost_per_unit' | 'location_id'
> & { team_id: UUID; supplier_id?: string | null; barcode?: string | null }

export type InventoryUpdate = Partial<
  Pick<
    InventoryItem,
    'name' | 'quantity' | 'unit' | 'min_stock_level' | 'cost_per_unit' | 'location_id' | 'supplier_id'
  >
>

export interface RecipeIngredient {
  id: UUID
  recipe_id: UUID
  inventory_item_id: UUID
  quantity: number
  created_at: ISODateString
}

export interface RecipeIngredientDraft {
  inventory_item_id: UUID
  quantity: number
}

export type PrepTaskStatus = 'pending' | 'in_progress' | 'done'

export interface PrepTemplate {
  id: UUID
  team_id: UUID
  name: string
  created_at: ISODateString
}

export interface PrepTemplateItem {
  id: UUID
  template_id: UUID
  title: string
  description: string | null
  recipe_id: UUID | null
  workstation_id: UUID | null
  quantity: number | null
  sort_order: number
}

export type PrepTemplateInsert = Pick<PrepTemplate, 'name'> & { team_id: UUID }
export type PrepTemplateItemInsert = Omit<PrepTemplateItem, 'id'>
export type PrepTemplateItemUpdate = Partial<Omit<PrepTemplateItem, 'id' | 'template_id'>>

export interface Workstation {
  id: UUID
  team_id: UUID
  name: string
  sort_order: number
  created_at: ISODateString
}

export type WorkstationInsert = Pick<Workstation, 'name' | 'sort_order'> & { team_id: UUID }
export type WorkstationUpdate = Partial<Pick<Workstation, 'name' | 'sort_order'>>

export interface PrepTask {
  id: UUID
  team_id: UUID
  title: string
  description: string | null
  recipe_id: UUID | null
  menu_id: UUID | null
  quantity: number | null
  assignee_id: UUID | null
  workstation_id: UUID | null
  prep_for: string // date (YYYY-MM-DD)
  status: PrepTaskStatus
  done_at: ISODateString | null
  created_by: UUID
  created_at: ISODateString
  updated_at: ISODateString
}

export type PrepTaskInsert = Pick<
  PrepTask,
  'title' | 'description' | 'recipe_id' | 'quantity' | 'assignee_id' | 'prep_for' | 'workstation_id' | 'status'
> & { team_id: UUID; created_by: UUID; menu_id?: string | null }

export type PrepTaskUpdate = Partial<
  Pick<
    PrepTask,
    | 'title'
    | 'description'
    | 'recipe_id'
    | 'menu_id'
    | 'quantity'
    | 'assignee_id'
    | 'prep_for'
    | 'workstation_id'
    | 'status'
    | 'done_at'
  >
>

export interface AppNotification {
  id: UUID
  team_id: UUID
  user_id: UUID
  type: string
  title: string
  body: string | null
  data: Record<string, unknown>
  read: boolean
  created_at: ISODateString
}

export interface PrepTaskStep {
  id: UUID
  task_id: UUID
  team_id: UUID
  title: string
  done: boolean
  position: number
  created_at: ISODateString
}

export interface TeamInvite {
  id: UUID
  team_id: UUID
  email: string
  token: string
  invited_by: UUID
  role: UserRole
  expires_at: ISODateString | null
  accepted_at: ISODateString | null
  created_at: ISODateString
}

export interface InventoryMovement {
  id: UUID
  team_id: UUID
  item_id: UUID
  delta: number
  reason: string
  user_id: UUID | null
  created_at: ISODateString
}

export type TempUnit = 'C' | 'F'

export interface HACCPLocation {
  id: UUID
  team_id: UUID
  name: string
  min_temp: number
  max_temp: number
  unit: TempUnit
}

export interface HACCPCheck {
  id: UUID
  team_id: UUID
  location: string
  temperature: number
  unit: TempUnit
  min_temp: number
  max_temp: number
  checked_by: UUID | null
  notes: string | null
  corrective_action: string | null
  created_at: ISODateString
}

export type HACCPCheckInsert = Omit<HACCPCheck, 'id' | 'created_at'>

export interface HACCPCheckWithChecker extends HACCPCheck {
  checked_by_name: string | null
}

export interface TeamMessage {
  id: UUID
  team_id: UUID
  sender_id: UUID
  content: string
  created_at: ISODateString
}

export interface TeamMessageWithSender extends TeamMessage {
  sender_name: string | null
}

export interface WalkieMessage {
  id: UUID
  team_id: UUID
  sender_id: UUID
  transcript: string
  created_at: ISODateString
}

export interface WalkieMessageWithSender extends WalkieMessage {
  sender_name: string | null
}

export type MenuType = 'a_la_carte' | 'buffet' | 'tasting' | 'daily'

export type PrintTemplate = 'classic' | 'modern' | 'elegant'

export interface Menu {
  id: UUID
  team_id: UUID
  name: string
  type: MenuType
  description: string | null
  price_per_person: number | null
  active: boolean
  show_prices: boolean
  valid_from: string | null
  valid_to: string | null
  print_template: PrintTemplate
  logo_url: string | null
  custom_footer: string | null
  created_at: ISODateString
  updated_at: ISODateString
}

export type MenuInsert = Pick<Menu,
  'name' | 'type' | 'description' | 'price_per_person' | 'active' | 'show_prices' |
  'valid_from' | 'valid_to' | 'print_template' | 'logo_url' | 'custom_footer'
> & { team_id: UUID }

export type MenuUpdate = Partial<Pick<Menu,
  'name' | 'type' | 'description' | 'price_per_person' | 'active' | 'show_prices' |
  'valid_from' | 'valid_to' | 'print_template' | 'logo_url' | 'custom_footer'
>>

export interface MenuSection {
  id: UUID
  menu_id: UUID
  name: string
  sort_order: number
  created_at: ISODateString
}

export type MenuSectionInsert = Pick<MenuSection, 'name' | 'sort_order'> & { menu_id: UUID }
export type MenuSectionUpdate = Partial<Pick<MenuSection, 'name' | 'sort_order'>>

export interface Shift {
  id: UUID
  team_id: UUID
  member_id: UUID
  shift_date: string // YYYY-MM-DD
  start_time: string // HH:MM
  end_time: string   // HH:MM
  role: string | null
  notes: string | null
  created_at: ISODateString
  updated_at: ISODateString
}

export type ShiftInsert = Pick<Shift, 'member_id' | 'shift_date' | 'start_time' | 'end_time' | 'role' | 'notes'> & { team_id: UUID }
export type ShiftUpdate = Partial<Pick<Shift, 'member_id' | 'shift_date' | 'start_time' | 'end_time' | 'role' | 'notes'>>

export type WasteReason = 'expired' | 'spoiled' | 'overproduction' | 'dropped' | 'other'

export interface WasteEntry {
  id: UUID
  team_id: UUID
  item_id: UUID | null
  item_name: string
  quantity: number
  unit: string
  reason: WasteReason
  cost: number | null
  recorded_by: UUID | null
  wasted_at: string // date YYYY-MM-DD
  notes: string | null
  created_at: ISODateString
}

export type WasteEntryInsert = Pick<
  WasteEntry,
  'item_id' | 'item_name' | 'quantity' | 'unit' | 'reason' | 'cost' | 'wasted_at' | 'notes'
> & { team_id: UUID; recorded_by: UUID | null }

export type WasteEntryUpdate = Partial<Pick<
  WasteEntry,
  'item_name' | 'quantity' | 'unit' | 'reason' | 'cost' | 'wasted_at' | 'notes'
>>

export type MenuItemTag = 'vegan' | 'vegetarian' | 'gluten_free' | 'spicy' | 'chefs_pick'

export interface MenuItem {
  id: UUID
  section_id: UUID
  recipe_id: UUID | null
  name: string
  description: string | null
  name_el: string | null
  description_el: string | null
  name_bg: string | null
  description_bg: string | null
  price: number | null
  available: boolean
  tags: MenuItemTag[]
  sort_order: number
  created_at: ISODateString
}

export type MenuItemInsert = Pick<MenuItem, 'name' | 'description' | 'name_el' | 'description_el' | 'name_bg' | 'description_bg' | 'price' | 'available' | 'sort_order' | 'recipe_id' | 'tags'> & { section_id: UUID }
export type MenuItemUpdate = Partial<Pick<MenuItem, 'name' | 'description' | 'name_el' | 'description_el' | 'name_bg' | 'description_bg' | 'price' | 'available' | 'sort_order' | 'recipe_id' | 'tags'>>

export interface MenuSectionWithItems extends MenuSection {
  items: MenuItem[]
}

export interface MenuWithSections extends Menu {
  sections: MenuSectionWithItems[]
}

// ── Purchase Orders ────────────────────────────────────────────────────────────
export type PurchaseOrderStatus = 'draft' | 'sent' | 'received' | 'cancelled'

export interface PurchaseOrder {
  id: UUID
  team_id: UUID
  supplier_id: UUID | null
  status: PurchaseOrderStatus
  notes: string | null
  ordered_at: ISODateString | null
  received_at: ISODateString | null
  created_at: ISODateString
  updated_at: ISODateString
}

export interface PurchaseOrderWithSupplier extends PurchaseOrder {
  supplier_name: string | null
}

export interface PurchaseOrderItem {
  id: UUID
  order_id: UUID
  inventory_item_id: UUID | null
  name: string
  quantity: number
  unit: string
  unit_price: number | null
  created_at: ISODateString
}

export type PurchaseOrderInsert = Pick<PurchaseOrder, 'supplier_id' | 'status' | 'notes' | 'ordered_at'> & { team_id: UUID }
export type PurchaseOrderUpdate = Partial<Pick<PurchaseOrder, 'supplier_id' | 'status' | 'notes' | 'ordered_at' | 'received_at' | 'updated_at'>>
export type PurchaseOrderItemInsert = Pick<PurchaseOrderItem, 'inventory_item_id' | 'name' | 'quantity' | 'unit' | 'unit_price'> & { order_id: UUID }

// ── Timeclock ──────────────────────────────────────────────────────────────────
export interface TimeEntry {
  id: UUID
  team_id: UUID
  member_id: UUID
  clock_in: ISODateString
  clock_out: ISODateString | null
  notes: string | null
  created_at: ISODateString
}

export interface TimeEntryWithMember extends TimeEntry {
  member_name: string | null
}

export type TimeEntryInsert = Pick<TimeEntry, 'clock_in' | 'notes'> & { team_id: UUID; member_id: UUID }
export type TimeEntryUpdate = Partial<Pick<TimeEntry, 'clock_out' | 'notes'>>

// ── Reservations ───────────────────────────────────────────────────────────────
export type ReservationStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled'

export interface Reservation {
  id: UUID
  team_id: UUID
  guest_name: string
  guest_phone: string | null
  guest_email: string | null
  party_size: number
  reservation_date: string // YYYY-MM-DD
  reservation_time: string // HH:MM
  status: ReservationStatus
  notes: string | null
  created_at: ISODateString
}

export type ReservationInsert = Pick<
  Reservation,
  'guest_name' | 'guest_phone' | 'guest_email' | 'party_size' | 'reservation_date' | 'reservation_time' | 'notes'
> & { team_id: UUID }

export type ReservationUpdate = Partial<Pick<
  Reservation,
  'status' | 'notes' | 'guest_name' | 'guest_phone' | 'party_size' | 'reservation_date' | 'reservation_time'
>>

// ── Online Orders ──────────────────────────────────────────────────────────────
export type OnlineOrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'

export interface OnlineOrder {
  id: UUID
  team_id: UUID
  menu_id: UUID | null
  table_ref: string | null
  customer_name: string | null
  customer_notes: string | null
  status: OnlineOrderStatus
  created_at: ISODateString
  updated_at: ISODateString
}

export interface OnlineOrderItem {
  id: UUID
  order_id: UUID
  menu_item_id: UUID | null
  name: string
  price: number | null
  quantity: number
  notes: string | null
  created_at: ISODateString
}

export interface OnlineOrderWithItems extends OnlineOrder {
  items: OnlineOrderItem[]
}

export type OnlineOrderInsert = Pick<OnlineOrder, 'menu_id' | 'table_ref' | 'customer_name' | 'customer_notes'> & { team_id: UUID }
export type OnlineOrderItemInsert = Pick<OnlineOrderItem, 'menu_item_id' | 'name' | 'price' | 'quantity' | 'notes'> & { order_id: UUID }
export type OnlineOrderUpdate = Partial<Pick<OnlineOrder, 'status' | 'updated_at'>>
