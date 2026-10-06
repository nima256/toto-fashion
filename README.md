# Toto Fashion — Full Stack Backend

این نسخه، فرانت اصلی Toto Fashion را با ساختار یکپارچه **Node.js + Express + EJS + MongoDB** اجرا می‌کند. همه صفحه‌های HTML مستقل حذف شده‌اند و صفحات فقط از `views/*.ejs` با Routeهای Express و `res.render()` نمایش داده می‌شوند. ساختار و الگوی سرویس‌های اصلی از پروژه CribFlag هماهنگ شده، اما API ترب عمداً به این پروژه اضافه نشده است.

## قابلیت‌های فعال

- ثبت‌نام/ورود بدون رمز با OTP ملی‌پیامک و Session امن
- نمایش محصولات از MongoDB در فروشگاه
- ساخت، ویرایش، حذف، تغییر موجودی و آپلود تصویر محصول در پنل ادمین
- ورود امن ادمین، ثبت Activity Log و تنظیمات مدیریتی
- سفارش واقعی با محاسبه قیمت در سرور، کنترل موجودی، کد تخفیف و هزینه ارسال
- اتصال زرین‌پال، Callback و Verification واقعی؛ حالت Mock نیز از env قابل کنترل است
- پنل کاربر: پروفایل، سفارش‌ها، جزئیات سفارش، مرجوعی، امتیاز و چرخونه
- ذخیره و ویرایش آدرس‌های کاربر در MongoDB و استفاده در Checkout
- رهگیری سفارش با شماره سفارش + موبایل
- داشبورد ادمین و KPI/نمودارهای متصل به اطلاعات واقعی دیتابیس
- ذخیره تغییر وضعیت سفارش، کد رهگیری و یادداشت داخلی در MongoDB
- فرم تماس متصل به دیتابیس
- CSRF، Rate Limit برای OTP/ادمین، Helmet، Session Cookie و اعتبارسنجی سمت سرور

## اجرا

پیش‌نیاز: Node.js 18.18+ و MongoDB.

```bash
npm install          # وابستگی جدید: zod (اعتبارسنجی متمرکز)
npm run migrate      # مهاجرت‌های امن و تکرارپذیر (در هر شروع سرور هم خودکار اجرا می‌شود)
npm run seed
npm run dev
```

برای کسر موجودی کاملاً تراکنشی، MongoDB را به‌صورت Replica Set (حتی تک‌نود) اجرا کنید؛ در حالت Standalone، کسر موجودی با ادعای اتمیک سفارش و جبران کنترل‌شده انجام می‌شود و هر خطای بازگردانی سفارش را «نیازمند بررسی» علامت می‌زند.

سایت به‌صورت پیش‌فرض روی این آدرس اجرا می‌شود:

```text
http://localhost:4173
```

پنل مدیریت:

```text
http://localhost:4173/admin
```

اطلاعات ورود مدیر از `ADMIN_EMAIL` و `ADMIN_PASSWORD` در فایل `.env` خوانده می‌شود.

## تنظیمات مهم `.env`

- `MONGODB_URI`: دیتابیس مستقل Toto Fashion
- `MELIPAYAMAK_SHARED_KEY` و `MELIPAYAMAK_BODY_ID`: ورود پیامکی
- `ZARINPAL_MERCHANT_ID`: درگاه زرین‌پال
- `PAYMENT_MOCK=true`: پرداخت آزمایشی؛ سفارش از همان مسیر Callback و تأیید سرور عبور می‌کند ولی هیچ ارتباطی با زرین‌پال برقرار نمی‌شود
- `FREE_SHIPPING_THRESHOLD`، `STANDARD_SHIPPING_PRICE`، `EXPRESS_SHIPPING_PRICE`: تنها منبع قوانین ارسال؛ فرانت‌اند از `GET /api/orders/config` و `POST /api/orders/quote` می‌خواند
- `RETURN_WINDOW_DAYS`: مهلت ثبت مرجوعی پس از تحویل
- `MELIPAYAMAK_RESTOCK_BODY_ID`: (اختیاری) الگوی پیامک «موجود شد»
- `SITE_URL`: در محیط واقعی باید دامنه HTTPS سایت باشد تا Callback زرین‌پال درست برگردد
- `SESSION_STORE=mongo`: برای Production توصیه می‌شود (در Production کد به‌صورت خودکار MongoStore را هم فعال می‌کند)

## Seed

در اولین اجرا، اگر collection محصولات خالی باشد، ۱۲ محصول فعلی فرانت وارد MongoDB می‌شوند. ادمین اولیه نیز از `.env` ساخته/همگام می‌شود.

```bash
npm run seed
```

## تست

```bash
npm run check
node scripts/project-check.mjs
node scripts/phase6-logic-test.mjs
# آزمون یکپارچه API (دیتابیس آزمایشی پاک می‌شود؛ نام آن باید شامل test باشد)
TEST_MONGODB_URI="mongodb://127.0.0.1:27017/toto_test" npm test
```

## نقش‌ها و مجوزها

مجوزها در `services/permissions.js` تعریف و در همه مسیرهای `/api/admin/*` با `requirePermission` بررسی می‌شوند. ادمین تعریف‌شده در `.env` همیشه مدیر کل است. فقط مدیر کل می‌تواند نقش‌ها را تغییر دهد یا مدیر جدید بسازد.

## فایل‌های آپلودی

- `uploads/products` و `uploads/content`: تصاویر عمومی محصول و محتوا
- `storage/gallery` و `storage/returns`: تصاویر خصوصی (فقط از مسیرهای کنترل‌شده API و با بررسی مالکیت/مجوز سرو می‌شوند)

## نکات پرداخت

قیمت نهایی، موجودی، کد تخفیف و هزینه ارسال سمت سرور دوباره محاسبه می‌شوند و مبلغی که مرورگر می‌فرستد مبنای پرداخت نیست. پس از Callback زرین‌پال، پرداخت Verify می‌شود و سپس موجودی کم می‌شود. اگر پرداخت تأیید شده باشد ولی تخصیص موجودی نیازمند بررسی شود، سفارش به‌جای «پرداخت ناموفق» با وضعیت پرداخت‌شده و یادداشت مدیریتی ثبت می‌شود.

## امنیت و انتشار

فایل `.env` فقط محلی است. **این فایل را در Git، ZIP یا برای شخص ثالث منتشر نکنید.** نمونه امن در `.env.example` است. اگر بسته‌ای که شامل `.env` بوده جایی منتشر شده، این مقادیر را عوض کنید: `SESSION_SECRET`، `MELIPAYAMAK_SHARED_KEY`، `ZARINPAL_MERCHANT_ID`، `ADMIN_EMAIL`/`ADMIN_PASSWORD` و (در صورت داشتن رمز) اعتبار `MONGODB_URI`.

## ساختار صفحات و فونت

صفحات فقط داخل `views/` و با پسوند `.ejs` نگه‌داری می‌شوند. برای نمونه:

- `/` → `res.render('index')`
- `/shop` → `res.render('shop')`
- `/product` → `res.render('product')`
- `/admin` → `res.render('admin')`
- `/account` → `res.render('account')`

تمام لینک‌های داخلی، canonicalها، sitemap، robots و redirectهای پرداخت نیز به URLهای بدون پسوند تبدیل شده‌اند. فونت اصلی رابط کاربری **Vazirmatn** است و از Google Fonts بارگذاری می‌شود؛ fallbackهای فارسی/سیستمی نیز در `src/styles/tokens.css` تعریف شده‌اند.
