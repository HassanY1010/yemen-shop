# SaaS Multi-Store Backend Architecture

This Laravel API is organized by product boundary, not by technical type only.

## Folder Structure

```plaintext
app/
|-- Actions/
|   |-- Admin/
|   |-- Merchant/
|   |-- Customer/
|   `-- Shared/
|-- DTOs/
|   |-- Admin/
|   |-- Merchant/
|   |-- Customer/
|   `-- Shared/
|-- Http/
|   |-- Controllers/
|   |   |-- Admin/
|   |   |-- Merchant/
|   |   |-- Customer/
|   |   `-- Shared/
|   `-- Requests/
|       |-- Admin/
|       |-- Merchant/
|       |-- Customer/
|       `-- Shared/
|-- Models/
|-- Policies/
|-- Services/
|-- Enums/
|-- Support/
`-- Routes/
    |-- admin.php
    |-- merchant.php
    |-- customer.php
    `-- shared.php
```

## Boundaries

### Admin
Platform-owner features only: stores, users, plans, subscriptions, platform analytics, settings, and global reports.

### Merchant
Store-owner and staff operations: products, categories, orders, coupons, staff, store settings, uploads, flash sales, and merchant analytics.

### Customer
Public storefront and buyer behavior: storefront browsing, products, categories, checkout, reviews, customer profile, and order tracking.

### Shared
Only truly reusable concerns: platform authentication, health checks, webhooks, tenant helpers, file upload primitives, reusable DTOs, notification utilities, and cross-boundary support code.

Do not put code in Shared just because it is hard to classify. If the behavior belongs to one actor, keep it in that actor boundary.

## Routing Rules

- `routes/api.php` only loads route modules.
- `app/Routes/admin.php` is protected by `auth:sanctum` and `role:admin`.
- `app/Routes/merchant.php` is protected by `auth:sanctum` and merchant/staff access.
- `app/Routes/customer.php` remains public where buyers do not need a platform account.
- `app/Routes/shared.php` contains auth, health checks, and webhooks.
- Avoid duplicate legacy routes. Keep one canonical route for each API.

## Authorization Rules

Use route middleware for coarse entry points, then use policies, gates, and tenant-scoped queries for resource ownership.

Examples:

- Admin can manage any store through policies such as `StorePolicy`.
- Merchant and staff must access products through the current tenant store query.
- Customer routes must resolve the active store by slug and never trust a client-provided `store_id`.

## Services And Actions

Controllers should stay thin. They receive requests, authorize, call an Action, then return responses.

Actions hold business workflows, for example:

- `Actions/Merchant/CreateProductAction`
- `Actions/Merchant/UpdateOrderStatusAction`
- `Actions/Customer/CreateOrderAction`
- `Actions/Admin/UpdateStorePlanAction`

DTOs carry validated input from Form Requests into Actions.

Services should orchestrate external systems or cross-cutting integrations only, for example payment providers, storage providers, notification delivery, and analytics export. Avoid large services that own all business rules.

## Current Refactor Notes

- `Dashboard` was renamed to `Merchant` because it represents store-owner behavior.
- `Storefront` was renamed to `Customer` because it represents buyer-facing behavior.
- Duplicate legacy dashboard routes were removed.
- Admin plan/store/user write operations now use Form Requests, DTOs, and Actions.
- Merchant products, categories, coupons, orders, staff, profile, store settings, subscriptions, flash sales, uploads, and variants now use focused Requests and Actions.
- Customer checkout, coupon validation, customer auth, customer profile, order tracking, and reviews now use focused Requests and Actions.
- Shared auth and upload behavior now live in Shared Actions/Requests.
- Controllers should now stay thin: keep simple reads there, move write workflows and business rules into Actions.
## Implemented Authorization And Tests

- Policies are registered explicitly in `AppServiceProvider` for stores, users, plans, products, categories, orders, coupons, and store staff.
- Merchant write operations now call policies in addition to tenant-scoped queries.
- Admin write operations now call policies in addition to admin route middleware.
- Feature tests cover merchant product creation, cross-store isolation, customer checkout stock updates, and admin route authorization.