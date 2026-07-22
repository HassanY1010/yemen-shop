# Yemen Shop Laravel API

Laravel API backend for a SaaS multi-store platform. It mirrors the existing D1/Hono routes used by the frontend in `D:\qwe\qwe` and uses Laravel Sanctum bearer tokens for admin and merchant authentication.

## Run

```bash
composer install
php artisan migrate:fresh --seed
php artisan serve --port=8000
```

Demo accounts:

- `admin@platform.com` / `password`
- `merchant@demo.com` / `password`
- Demo storefront slug: `demo`

## Frontend API Base URL

Set the frontend API base URL to:

```env
API_BASE_URL=http://127.0.0.1:8000/api
```

For Vite, use `VITE_API_BASE_URL=http://127.0.0.1:8000/api` if the client code reads `import.meta.env`.

## Auth

Send authenticated requests with:

```http
Authorization: Bearer <token>
Accept: application/json
```

Login endpoint:

```http
POST /api/auth/login
```

## Route Groups

- Public storefront: `/api/store/{slug}`
- Merchant dashboard: `/api/dashboard/*`
- Platform admin: `/api/admin/*`
- Auth: `/api/auth/*`

All dashboard queries are scoped to the authenticated merchant or staff store. Admin routes require role `admin`.

## Main Tables

`plans`, `users`, `stores`, `store_staff`, `categories`, `products`, `product_images`, `customers`, `orders`, `order_items`, `coupons`, `subscriptions`, `activity_logs`, `product_reviews`, `flash_sales`, `product_variants`.

## Suggested Frontend Migration Order

1. Replace local/D1 auth calls with `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`.
2. Replace dashboard product reads/writes with `/api/dashboard/products`.
3. Replace storefront reads with `/api/store/demo`, `/api/store/demo/products`, `/api/store/demo/categories`.
4. Replace checkout order creation with `/api/store/demo/orders`.
5. Continue page-by-page for coupons, customers, staff, analytics, and admin screens.

## QWE Compatibility Endpoints

The backend also includes the extra endpoints used by the original `D:\qwe\qwe` project:

- `POST /api/dashboard/upload`
- `POST /api/dashboard/subscribe`
- `GET|POST /api/dashboard/flash-sales`
- `PUT|DELETE /api/dashboard/flash-sales/{id}`
- `GET|POST /api/dashboard/products/{id}/variants`
- `GET /api/public/flash-sale/{productId}`
- `GET /api/public/products/{productId}/variants`
- `POST /api/store/{slug}/products/{id}/reviews`

Legacy dashboard shortcuts are also available for the old frontend calls:

- `/api/products/*`
- `/api/orders/*`
- `/api/store`
- `/api/coupons/*`
- `/api/staff/*`
- `/api/profile`
- `/api/notifications/*`

Run verification:

```bash
php artisan migrate:fresh --seed
php artisan route:list
php artisan test
php artisan serve --port=8000
```

## Completion Notes

Current API coverage is 105 Laravel routes. Additional QWE page support includes:

- `GET /api/dashboard/plans`
- `GET /api/dashboard/orders/{id}`
- `POST /api/dashboard/coupons/validate`
- `GET /api/admin/stores/{id}`
- `GET /api/admin/subscriptions`
- `GET /api/admin/settings`
- `GET /api/health`
- `GET /api/init-db`
- `POST /api/webhooks/stripe`

Verified smoke paths:

- merchant login
- dashboard plans
- dashboard order details
- dashboard coupon validation
- admin store details
- admin subscriptions
- health endpoint

## Local PostgreSQL Setup

This project is currently configured to use PostgreSQL:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=db_shop
DB_USERNAME=postgres
DB_PASSWORD=
```

Ensure PostgreSQL is running on your machine, create a database named `db_shop`, and run:

```bash
php artisan key:generate
php artisan migrate:fresh --seed
php artisan serve --host=127.0.0.1 --port=8000
```
