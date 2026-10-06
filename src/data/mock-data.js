export const categories = [
  { label: 'محصولات جدید', href: './shop?new=1', key: 'new' },
  { label: 'مانتو و کت', href: './shop?category=مانتو%20و%20کت', key: 'outerwear', mega: true },
  { label: 'پیراهن', href: './shop?category=پیراهن', key: 'dress' },
  { label: 'شومیز', href: './shop?category=شومیز', key: 'shirt' },
  { label: 'شلوار', href: './shop?category=شلوار', key: 'pants' },
  { label: 'دامن', href: './shop?category=دامن', key: 'skirt' },
  { label: 'کیف', href: './shop?category=کیف', key: 'bag' },
  { label: 'کفش', href: './shop?category=کفش', key: 'shoe' },
  { label: 'اکسسوری', href: './shop?category=اکسسوری', key: 'accessory' },
  { label: 'تخفیف‌ها', href: './shop?discount=1', key: 'sale', sale: true },
  { label: 'گالری مشتریان', href: './gallery', key: 'gallery' },
  { label: 'مجله توتو', href: './blog', key: 'magazine' }
];

// فهرست محصولات فقط از API پر می‌شود (/api/products). هیچ محصول نمونه‌ای در زمان اجرا نمایش داده نمی‌شود.
export const products = [];
export const productsState = { loaded: false, error: null };

export const replaceProducts = nextProducts => {
  products.splice(0, products.length, ...(Array.isArray(nextProducts) ? nextProducts : []));
  productsState.loaded = true;
  productsState.error = null;
  return products;
};
export const markProductsFailed = error => { productsState.loaded = false; productsState.error = error?.message || 'دریافت محصولات انجام نشد.'; products.splice(0, products.length); };

// اسلایدهای پیش‌فرض فقط وقتی استفاده می‌شوند که محتوای مدیریت‌شده صفحه اصلی در دسترس نباشد
export const heroSlides = [
  { image: './src/assets/images/hero-new.webp', eyebrow: 'کالکشن تازه', title: 'سادگی‌ای که هر روز پوشیده می‌شود', text: 'فرم‌های دقیق، رنگ‌های خنثی و لباس‌هایی که به‌راحتی کنار هم قرار می‌گیرند.', cta: 'مشاهده کالکشن', href: './shop?new=1' },
  { image: './src/assets/images/catalog-5.webp', eyebrow: 'ویرایش اداری', title: 'مرتب، راحت و آمادهٔ تکرار', text: 'انتخاب‌هایی کاربردی برای ساختن یک کمد منسجم و ماندگار.', cta: 'خرید استایل اداری', href: './shop?occasion=اداری' },
  { image: './src/assets/images/catalog-4.webp', eyebrow: 'انتخاب توتو', title: 'مشکی؛ همیشه یک انتخاب مطمئن', text: 'برش‌های ساده‌ای که برای قرارهای روزمره و مهمانی‌ها همراه شما می‌مانند.', cta: 'مشاهده پیراهن‌ها', href: './shop?category=پیراهن' }
];

export const popularSearches = ['مانتوی لینن', 'شومیز سفید', 'استایل مهمانی', 'شلوار کرپ', 'کالکشن جدید'];
export const defaultRecentSearches = [];

export const megaMenuColumns = [
  { title: 'مانتو', items: ['مانتوی کوتاه', 'مانتوی بلند', 'مانتوی لینن', 'مانتوی رسمی'] },
  { title: 'کت و ژاکت', items: ['کت کوتاه', 'کت اورسایز', 'کت رسمی', 'ژاکت سبک'] },
  { title: 'انتخاب بر اساس استایل', items: ['روزمره', 'اداری', 'مهمانی', 'مینیمال'] },
  { title: 'راهنمای خرید', items: ['محصولات جدید', 'پرفروش‌ها', 'راهنمای سایز', 'پیشنهاد استایلیست'] }
];
