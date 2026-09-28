# بودجه عملکرد نهایی

| منبع | بودجه انتشار | وضعیت سورس Prototype |
|---|---:|---:|
| JavaScript مسیر عمومی پس از Minify/Gzip | حداکثر ۱۸۰KB | کل فایل‌های خام پروژه حدود ۳۲۳KB؛ Routeها جدا هستند |
| CSS مسیر عمومی پس از Minify/Gzip | حداکثر ۱۰۰KB | کل CSS خام حدود ۱۵۳KB |
| تصاویر نمونه پروژه | حداکثر ۱MB اولیه Repository | حدود ۸۴۸KB WebP |
| تصویر Hero موبایل | حداکثر ۱۵۰KB | فایل‌های نمونه زیر بودجه‌اند |
| فونت اولیه | حداکثر ۱۰۰KB | فونت خارجی در Repository قرار نگرفته است |
| Third-party اولیه | صفر یا نزدیک صفر | صفر |

## اهداف Web Vitals

- LCP: حداکثر ۲٫۵ ثانیه
- INP: حداکثر ۲۰۰ میلی‌ثانیه
- CLS: حداکثر ۰٫۱

## اقدامات انتشار

- Minify و Brotli/Gzip برای CSS و JavaScript
- Cache بلندمدت با Hash فایل
- CDN برای تصاویر و `srcset` تولیدشده سمت Build/Image Service
- Subset فونت فارسی و فقط وزن‌های موردنیاز
- Lazy Load برای Admin Charts و Viewer سه‌بعدی
- Preconnect فقط برای سرویس‌های ضروری
- RUM برای پایش Web Vitals واقعی کاربران ایران
