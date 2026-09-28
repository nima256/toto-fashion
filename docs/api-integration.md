# نقشه اتصال API

## Authentication

- `POST /auth/otp/request`
- `POST /auth/otp/verify`
- `POST /auth/logout`

سرور مسئول Rate Limit، انقضا، تعداد تلاش، Session و تشخیص سوءاستفاده است.

## Catalog

- `GET /products`
- `GET /products/:id`
- `GET /categories`
- `GET /search`
- `GET /filters`
- `POST /availability-alerts`

فیلترها باید Query Parameterهای فعلی را بپذیرند تا Back Navigation حفظ شود.

## Commerce

- `GET/PUT /cart`
- `POST /cart/validate`
- `POST /discounts/validate`
- `POST /orders`
- `POST /payments`
- `GET /payments/:order/status`

قیمت نهایی، تخفیف، موجودی و مبلغ پرداخت فقط از پاسخ سرور معتبر است. Idempotency Key برای ثبت سفارش و پرداخت الزامی است.

## Customer

- `GET/PATCH /account`
- `GET /orders`
- `GET /orders/:id`
- `POST /returns`
- `GET /loyalty`
- `POST /wheel/spin`

نتیجه چرخونه باید در سرور تعیین شود و محدودیت روزانه بر اساس حساب/موبایل اعمال شود.

## Content

- `GET /articles`
- `GET /articles/:slug`
- `GET /content/:slug`
- `POST /contact`

## Admin

- `GET /admin/dashboard`
- `GET/POST/PATCH /admin/products`
- `PATCH /admin/variants/:id/inventory`
- `GET/PATCH /admin/orders`
- `GET/PATCH /admin/customers`
- `GET/POST/PATCH /admin/content`
- `GET/POST/PATCH /admin/campaigns`
- `GET/PATCH /admin/roles`
- `GET /admin/activity-logs`
- `POST /admin/reports/export`

تمام endpointهای ادمین باید RBAC، Audit Log، CSRF Protection و Session Rotation داشته باشند.
