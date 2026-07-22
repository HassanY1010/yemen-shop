// ============================================
// Type Definitions for SaaS Multi-Store Platform
// ============================================

export type UserRole = 'admin' | 'merchant' | 'staff';
export type StoreStatus = 'active' | 'suspended' | 'inactive';
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'trial';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  is_active: number;
  created_at: string;
}

export interface Plan {
  id: number;
  name: string;
  slug: string;
  price: number;
  billing_cycle: string;
  max_products: number;
  max_images: number;
  max_staff: number;
  max_orders: number;
  features: string;
  is_active: number;
}

export interface Store {
  id: number;
  user_id: number;
  plan_id: number;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  banner?: string;
  primary_color: string;
  secondary_color: string;
  currency: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  whatsapp?: string;
  status: StoreStatus;
  subscription_status: SubscriptionStatus;
  subscription_ends_at?: string;
  total_sales: number;
  created_at: string;
  // Relations
  owner?: User;
  plan?: Plan;
}

export interface Category {
  id: number;
  store_id: number;
  parent_id?: number;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  sort_order: number;
  is_active: number;
}

export interface Product {
  id: number;
  store_id: number;
  category_id?: number;
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  sku?: string;
  price: number;
  sale_price?: number;
  stock: number;
  manage_stock: number;
  status: string;
  featured: number;
  views: number;
  total_sold: number;
  tags: string;
  created_at: string;
  // Relations
  images?: ProductImage[];
  category?: Category;
}

export interface ProductImage {
  id: number;
  product_id: number;
  store_id: number;
  url: string;
  alt?: string;
  sort_order: number;
  is_primary: number;
}

export interface Customer {
  id: number;
  store_id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country: string;
  total_orders: number;
  total_spent: number;
  created_at: string;
}

export interface Order {
  id: number;
  store_id: number;
  customer_id?: number;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method?: string;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  shipping_address?: string;
  shipping_city?: string;
  notes?: string;
  created_at: string;
  // Relations
  items?: OrderItem[];
  customer?: Customer;
}

export interface OrderItem {
  id: number;
  order_id: number;
  store_id: number;
  product_id?: number;
  product_name: string;
  price: number;
  quantity: number;
  total: number;
}

export interface AuthSession {
  user: User;
  store?: Store;
  token: string;
}

export interface Bindings {
  DB: D1Database;
  SESSIONS: KVNamespace;
  JWT_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

export interface Variables {
  user?: User;
  store?: Store;
  session?: AuthSession;
}
