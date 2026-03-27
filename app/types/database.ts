export type OrderType = 'dine_in' | 'delivery' | 'pickup'
export type OrderStatus = 'new' | 'cooking' | 'served' | 'cancelled'
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
  created_at: string
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
