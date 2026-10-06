# معماری نهایی TOTO Fashion

## رویکرد

پروژه Multi-page و بدون وابستگی سنگین است. هر صفحه HTML مستقل دارد، اما Shell، داده، Storage، Service Layer و کامپوننت‌ها مشترک‌اند. این ساختار برای SEO، کش مرورگر و مهاجرت مرحله‌ای به Framework یا Backend Template مناسب است.

## لایه‌ها

1. **Presentation:** فایل‌های HTML و CSS؛ محتوای اصلی محصول در HTML یا رندر قابل دسترس قرار دارد.
2. **Page Controllers:** ماژول‌های `src/scripts/pages` برای رفتار هر صفحه.
3. **Shared Components:** Shell، Product Card و Account Shell.
4. **Domain/Core:** محاسبه سبد، Storage Adapter و Utilityهای فارسی.
5. **Data:** داده Mock جدا از UI.
6. **Service Layer:** تمام تعامل‌های قابل جایگزینی با API در `services/api.js`.

## بارگذاری

- اولین تصویر Hero دارای Preload و Lazy Loading نیست.
- تصاویر زیر Fold دارای ابعاد صریح و Lazy Loading هستند.
- پنل مدیریت Entry مستقل دارد و در صفحات فروشگاه بارگذاری نمی‌شود.
- کتابخانه Chart یا UI ثالث استفاده نشده است.

## State Prototype

- `toto-cart`: سبد خرید
- `toto-customer-gallery`: عکس‌ها و وضعیت ارسال‌های گالری مشتریان
- `toto-saved`: ذخیره برای بعد
- `toto-session`: نشست نمایشی
- `toto-account`: حساب و وفاداری
- `toto-admin-products` و `toto-admin-orders`: تغییرات نمایشی ادمین

در Production این Stateها باید با نسخه سرور، Conflict Resolution و کنترل انقضا همگام شوند.
