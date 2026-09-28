export const customerGallerySamples = [
  { id:'gallery-sample-1', customerName:'سارا', productName:'مانتوی لینن توتو', caption:'برای یک روز شلوغ با شلوار راسته و کیف ساده ستش کردم.', image:'./src/assets/images/detail-1.webp', status:'approved', createdAt:'۱۲ مرداد ۱۴۰۵' },
  { id:'gallery-sample-2', customerName:'مریم', productName:'شومیز مینیمال سفید', caption:'هم برای محل کار خوبه، هم برای یک قرار عصرانه.', image:'./src/assets/images/editorial-1.webp', status:'approved', createdAt:'۹ مرداد ۱۴۰۵' },
  { id:'gallery-sample-3', customerName:'نسترن', productName:'پیراهن میدی مشکی', caption:'با اکسسوری‌های کم و یک کیف کوچک، دقیقاً همون استایلی شد که می‌خواستم.', image:'./src/assets/images/detail-3.webp', status:'approved', createdAt:'۴ مرداد ۱۴۰۵' },
  { id:'gallery-sample-4', customerName:'الهام', productName:'کت کوتاه طوسی', caption:'کت خوش‌فرمیه و با رنگ‌های روشن خیلی خوب هماهنگ می‌شه.', image:'./src/assets/images/hero-2.webp', status:'approved', createdAt:'۳۰ تیر ۱۴۰۵' }
];
export const galleryStatusLabel = status => ({ pending:'در انتظار تأیید', approved:'منتشرشده', rejected:'نیازمند ویرایش' }[status] || status);
