# SaaS Multi-Store Platform

منصة متجر متعدد متكاملة مبنية على Hono + Cloudflare Workers/Pages مع دعم Dark/Light Mode.

---

## نظرة عامة
- **الاسم**: SaaS Multi-Store Platform
- **الهدف**: منصة SaaS لإنشاء وإدارة المتاجر الإلكترونية بنموذج Multi-Tenant
- **التقنية**: Hono + TypeScript + Cloudflare D1 + Cloudflare Pages
- **الحالة**: ✅ نشط ومكتمل — v2.0

---

## المميزات المكتملة

### 🎨 واجهة المستخدم
- [x] **Dark/Light Mode** كامل عبر CSS Variables + localStorage
  - CSS custom properties: `--color-bg-page`, `--color-bg-card`, `--color-text-main` إلخ
  - Utility classes: `bg-card`, `bg-page`, `text-main`, `text-sub`, `border-std`
  - Toggle button في الـ sidebar مع حفظ التفضيل
- [x] **Responsive Design** — يعمل على جميع الأجهزة
- [x] **Notification Bell** مع dropdown وعداد الإشعارات الحية
- [x] **Mobile Sidebar** مع toggle

### 🛒 لوحة التحكم (Merchant Dashboard)
| الصفحة | URL | المميزات |
|--------|-----|-----------|
| Overview | `/dashboard` | Welcome Banner، Smart Alerts، إحصائيات، رسم بياني |
| المنتجات | `/dashboard/products` | CRUD، Pagination، فلتر الحالة، البحث |
| الطلبات | `/dashboard/orders` | تحديث الحالة، تصفية بالتابات، CSV Export، Print |
| العملاء | `/dashboard/customers` | بطاقات إحصائيات، بحث، ترتيب |
| التصنيفات | `/dashboard/categories` | CRUD كامل، Dark Mode |
| الكوبونات | `/dashboard/coupons` | CRUD، Progress bars، إدارة التواريخ |
| الموظفين | `/dashboard/staff` | إضافة/تعديل/حذف، phone field، تفعيل/تعطيل |
| التحليلات | `/dashboard/analytics` | 4 رسوم بيانية (إيرادات، طلبات، تصنيفات، ساعات) |
| الملف الشخصي | `/dashboard/profile` | Quick Stats، تحديث البيانات، تغيير كلمة المرور |
| الإعدادات | `/dashboard/settings` | بيانات المتجر، شعار، عملات، اشتراكات |

### 🏪 المتجر الإلكتروني (Storefront)
- [x] صفحة المتجر: `/store/{slug}`
- [x] صفحة المنتج: `/store/{slug}/product/{product-slug}`
- [x] صفحة الدفع
- [x] Dark/Light Mode toggle
- [x] عرض المنتجات مع الفلتر والبحث

### 👑 لوحة الأدمن
- [x] إدارة المتاجر (تفعيل/تعطيل)
- [x] إدارة المستخدمين
- [x] URL: `/admin`

---

## الـ API Endpoints

### Auth
| Method | URL | الوصف |
|--------|-----|--------|
| POST | `/api/auth/login` | تسجيل الدخول |
| POST | `/api/auth/register` | إنشاء حساب جديد |
| GET | `/api/auth/logout` | تسجيل الخروج |

### Dashboard API (Cookie Auth)
| Method | URL | الوصف |
|--------|-----|--------|
| GET | `/api/dashboard/products` | قائمة المنتجات |
| POST | `/api/dashboard/products` | إضافة منتج |
| PUT | `/api/dashboard/products/:id` | تحديث منتج |
| DELETE | `/api/dashboard/products/:id` | حذف منتج |
| GET | `/api/dashboard/categories` | قائمة التصنيفات |
| POST | `/api/dashboard/categories` | إضافة تصنيف |
| PUT | `/api/dashboard/categories/:id` | تحديث تصنيف |
| DELETE | `/api/dashboard/categories/:id` | حذف تصنيف |
| PUT | `/api/dashboard/orders/:id/status` | تحديث حالة الطلب |
| GET | `/api/dashboard/orders/export` | تصدير CSV |
| GET | `/api/dashboard/coupons` | قائمة الكوبونات |
| POST | `/api/dashboard/coupons` | إضافة كوبون |
| PUT | `/api/dashboard/coupons/:id` | تحديث كوبون |
| DELETE | `/api/dashboard/coupons/:id` | حذف كوبون |
| GET | `/api/dashboard/staff` | قائمة الموظفين |
| POST | `/api/dashboard/staff` | إضافة موظف |
| PUT | `/api/dashboard/staff/:id` | تحديث موظف |
| DELETE | `/api/dashboard/staff/:id` | حذف موظف |
| PUT | `/api/dashboard/profile` | تحديث الملف الشخصي |
| PUT | `/api/dashboard/password` | تغيير كلمة المرور |
| PUT | `/api/dashboard/store` | تحديث إعدادات المتجر |

### Direct API (Bearer Token / Cookie)
| Method | URL | الوصف |
|--------|-----|--------|
| GET | `/api/products` | قائمة المنتجات (مع pagination وبحث) |
| GET | `/api/orders` | قائمة الطلبات |
| GET | `/api/store` | بيانات المتجر |
| GET | `/api/categories` | قائمة التصنيفات |
| GET | `/api/coupons` | قائمة الكوبونات |
| GET | `/api/staff` | قائمة الموظفين |
| GET | `/api/profile` | الملف الشخصي |
| GET | `/api/notifications` | الإشعارات الذكية |
| POST | `/api/notifications/read-all` | تحديد الكل مقروء |
| GET | `/api/products/stock-alerts` | تنبيهات المخزون |

### Storefront API (Public)
| Method | URL | الوصف |
|--------|-----|--------|
| GET | `/api/store/:slug/products` | منتجات المتجر العامة |
| POST | `/api/store/:slug/orders` | إنشاء طلب جديد |
| POST | `/api/coupons/validate` | التحقق من كوبون |

---

## هيكل قاعدة البيانات (Cloudflare D1)

### الجداول الرئيسية
| الجدول | الوصف |
|--------|--------|
| `users` | المستخدمون (admin, merchant, staff) — مع `store_id`, `phone` |
| `stores` | المتاجر مع إعدادات الألوان والعملة |
| `products` | المنتجات مع المخزون والأسعار |
| `product_images` | صور المنتجات |
| `categories` | تصنيفات المنتجات |
| `orders` | الطلبات مع `discount_amount` |
| `order_items` | عناصر الطلبات |
| `coupons` | كوبونات الخصم مع `description`, `min_order_amount` |
| `sessions` | جلسات المستخدمين |
| `plans` | باقات الاشتراك |

### Migrations
```
migrations/
├── 0001_initial_schema.sql  — الجداول الأساسية
└── 0002_add_features.sql   — إضافة phone, store_id, coupons v2
```

---

## بيانات Demo

```
Admin:    admin@platform.com  / password  → /admin
Merchant: merchant@demo.com   / password  → /dashboard
```

**متجر Demo**: `/store/demo`

**كوبونات Demo**: `SUMMER20` (20%)، `WELCOME50` (50% للطلبات +500)، `VIP30` (30% مستخدم مرة)

---

## التثبيت والتشغيل

### البيئة المحلية
```bash
# تهيئة قاعدة البيانات
npx wrangler d1 migrations apply saas-platform-db --local

# تشغيل seed data
curl http://localhost:3000/api/init-db

# تشغيل المشروع
npm run build
pm2 start ecosystem.config.cjs
```

### الـ Scripts المتاحة
```bash
npm run build          # بناء المشروع
npm run db:migrate:local   # تطبيق migrations محلياً
npm run db:seed            # إضافة بيانات تجريبية
npm run db:reset           # إعادة تعيين قاعدة البيانات
npm run deploy             # نشر على Cloudflare Pages
```

---

## بنية المشروع

```
src/
├── index.tsx              # نقطة الدخول — Global routes + auth setup
├── middleware/
│   └── auth.ts            # Authentication middleware (Cookie + Bearer)
├── routes/
│   ├── dashboard.ts       # Merchant dashboard pages (Enhanced v2)
│   ├── api.ts             # Dashboard API routes (RESTful)
│   ├── admin.ts           # Admin panel routes
│   ├── storefront.ts      # Public storefront
│   └── landing.ts         # Landing page
├── utils/
│   ├── templates.ts       # dashboardLayout, baseLayout, CSS Variables
│   └── helpers.ts         # formatCurrency, generateSlug, hashPassword
└── types/
    └── index.ts           # TypeScript interfaces
```

---

## النشر

- **المنصة**: Cloudflare Pages
- **قاعدة البيانات**: Cloudflare D1 — `saas-platform-db`
- **Stack**: Hono 4 + TypeScript + Tailwind CDN + Chart.js
- **آخر تحديث**: 2026-07-05
- **الإصدار**: v2.0

---

## الخطوات التالية المقترحة

- [ ] إضافة رفع الصور عبر Cloudflare R2
- [ ] تطوير نظام تقييمات المنتجات
- [ ] إضافة نظام إشعارات بريد إلكتروني
- [ ] إضافة صفحة تتبع الطلبات للعملاء
- [ ] تطوير نظام الدفع (Stripe/PayPal integration)
- [ ] Dashboard للعملاء (customer portal)
