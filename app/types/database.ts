export type OrderType = 'dine_in' | 'delivery' | 'pickup'
export type OrderStatus = 'pending_payment' | 'new' | 'cooking' | 'out_for_delivery' | 'served' | 'cancelled'
export type StaffRole = 'kitchen' | 'waiter' | 'delivery'
export type RestaurantPlan = 'trial' | 'starter' | 'pro' | 'enterprise' | 'expired'
export type ServiceCallType = 'waiter' | 'bill'

export interface Restaurant {
  id: string
  owner_id: string
  name: string
  slug: string
  plan: RestaurantPlan
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  active: boolean
  trial_ends_at: string | null
  floor_plan_url: string | null
  opening_hours: Record<string, { open: string; close: string; closed: boolean }> | null
  created_at: string
  // Branding
  primary_color:   string | null
  surface_color:   string | null
  logo_url:        string | null
  brand_preset:    string | null
  contact_email:   string | null
  contact_phone:   string | null
  contact_address: string | null
  description:     string | null
  anthropic_api_key: string | null
  auto_translate_enabled: boolean | null
  // Design customization
  design_package:  string | null
  layout_variant:  string | null
  font_pair:       string | null
  header_color:    string | null
  button_color:    string | null
  card_color:      string | null
  text_color:      string | null
  bg_color:        string | null
  // Versioned design system
  admin_design_version: 'v1' | 'v2' | null
  guest_design_version: 'v1' | 'v2' | null
}

export interface PlatformSettings {
  id: number
  platform_design_version:    'v1' | 'v2' | null
  restaurants_default_version: 'v1' | 'v2' | null
}

export interface Staff {
  id: string
  restaurant_id: string
  name: string
  code: string
  role: StaffRole
  active: boolean
  created_at: string
}

export interface Table {
  id: string
  restaurant_id: string
  table_num: number
  label: string
  qr_token: string
  capacity: number
  position_x: number | null
  position_y: number | null
  section: string | null
  shape: 'rect' | 'circle' | null
  active: boolean
  occupied_manual: boolean
  occupied_since: string | null
  created_at: string
}

export interface MenuCategory {
  id: string
  restaurant_id: string
  name: string
  sort_order: number
  active: boolean
  created_at: string
}

export interface MenuItem {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  allergens: string[]
  tags: string[]
  available: boolean
  sort_order: number
  created_at: string
  translations?: Record<string, { name: string; description: string }> | null
}

export interface ExtractedMenuItem {
  name: string
  description: string | null
  price: number
  category: string
  tags: string[]
  allergens: string[]
}

export interface ExtractedMenu {
  categories: string[]
  items: ExtractedMenuItem[]
}

export interface OrderItem {
  item_id: string
  name: string
  price: number
  qty: number
}

export interface Order {
  id: string
  restaurant_id: string
  order_type: OrderType
  table_id: string | null
  status: OrderStatus
  items: OrderItem[]
  note: string | null
  total: number
  customer_name: string | null
  customer_phone: string | null
  delivery_address: {
    street: string
    city: string
    zip: string
  } | null
  estimated_time: number | null
  source: 'guest' | 'staff'
  created_at: string
}

export interface ServiceCall {
  id: string
  restaurant_id: string
  table_id: string
  type: ServiceCallType
  resolved: boolean
  created_at: string
}

export type GroupStatus = 'active' | 'submitted' | 'ordering' | 'cancelled'

export interface OrderGroup {
  id: string
  restaurant_id: string
  table_id: string | null
  group_code: string
  status: GroupStatus
  created_at: string
  expires_at: string
}

export interface GroupItem {
  id: string
  group_id: string
  added_by: string
  item_id: string
  name: string
  price: number
  qty: number
  note: string | null
  created_at: string
}

export type PosProvider = 'sumup' | 'zettle' | 'square'
export type ExternalTransactionSource = 'stripe_terminal' | 'sumup' | 'zettle' | 'square' | 'cash'

export interface ExternalTransaction {
  id: string
  restaurant_id: string
  source: ExternalTransactionSource
  external_id: string | null
  amount: number
  currency: string
  note: string | null
  paid_at: string
  created_at: string
}

export interface PosConnection {
  id: string
  restaurant_id: string
  provider: PosProvider
  access_token: string
  refresh_token: string | null
  connected_at: string
}

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled'

export interface Reservation {
  id: string
  restaurant_id: string
  customer_name: string
  customer_email: string | null
  customer_phone: string
  guests: number
  date: string
  time_from: string
  note: string | null
  status: ReservationStatus
  table_id: string | null
  created_at: string
}

export type GroupPaymentStatus = 'pending' | 'paid' | 'covered' | 'cash' | 'terminal'

export interface GroupPayment {
  id: string
  group_id: string
  member_name: string
  stripe_session_id: string | null
  amount: number
  status: GroupPaymentStatus
  covered_by: string | null
  paid_at: string | null
  created_at: string
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export type StockMovementType = 'order_deduction' | 'delivery' | 'correction' | 'waste'
export type WasteReason = 'spoiled' | 'overcooked' | 'dropped' | 'other'
export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received'

export interface Ingredient {
  id: string
  restaurant_id: string
  name: string
  unit: string
  current_stock: number
  min_stock: number
  purchase_price: number | null
  supplier_id: string | null
  created_at: string
}

export interface MenuItemIngredient {
  id: string
  menu_item_id: string
  ingredient_id: string
  quantity_per_serving: number
  created_at: string
}

export interface StockMovement {
  id: string
  restaurant_id: string
  ingredient_id: string
  movement_type: StockMovementType
  quantity_delta: number
  note: string | null
  order_id: string | null
  created_at: string
}

export interface Supplier {
  id: string
  restaurant_id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
}

export interface PurchaseOrder {
  id: string
  restaurant_id: string
  supplier_id: string
  status: PurchaseOrderStatus
  notes: string | null
  ordered_at: string | null
  received_at: string | null
  created_at: string
}

export interface PurchaseOrderLine {
  id: string
  purchase_order_id: string
  ingredient_id: string
  quantity_ordered: number
  quantity_received: number | null
  unit_price: number | null
  created_at: string
}

export interface WasteLog {
  id: string
  restaurant_id: string
  ingredient_id: string
  quantity: number
  reason: WasteReason
  note: string | null
  logged_at: string
  created_at: string
}
