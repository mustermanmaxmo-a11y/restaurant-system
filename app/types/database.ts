export type OrderType = 'dine_in' | 'delivery' | 'pickup'
export type OrderStatus = 'pending_payment' | 'new' | 'cooking' | 'served' | 'cancelled'
export type StaffRole = 'kitchen' | 'waiter'
export type RestaurantPlan = 'basic' | 'pro'
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
