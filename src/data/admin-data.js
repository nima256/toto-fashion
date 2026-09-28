import { products } from './mock-data.js';
import { mockOrders } from './account-data.js';

export const adminKpis = [
  { id: 'todayRevenue', label: 'فروش امروز', value: 38460000, type: 'currency', delta: 12.4, note: 'نسبت به روز قبل' },
  { id: 'weeklyRevenue', label: 'فروش هفتگی', value: 246870000, type: 'currency', delta: 8.1, note: 'نسبت به هفته قبل' },
  { id: 'monthlyRevenue', label: 'فروش ماهانه', value: 958320000, type: 'currency', delta: 15.7, note: 'نسبت به ماه قبل' },
  { id: 'orders', label: 'تعداد سفارش', value: 184, type: 'number', delta: 6.2, note: 'در ۳۰ روز اخیر' },
  { id: 'averageOrder', label: 'میانگین سفارش', value: 5210000, type: 'currency', delta: 3.4, note: 'ارزش هر سفارش' },
  { id: 'customers', label: 'مشتری جدید', value: 62, type: 'number', delta: 10.8, note: 'در ۳۰ روز اخیر' },
  { id: 'pending', label: 'سفارش در انتظار', value: 17, type: 'number', delta: -2.1, note: 'نیازمند بررسی' },
  { id: 'returns', label: 'مرجوعی فعال', value: 6, type: 'number', delta: 1.3, note: 'در حال رسیدگی' },
  { id: 'lowStock', label: 'موجودی رو به پایان', value: 9, type: 'number', delta: 0, note: 'ترکیب رنگ و سایز' },
  { id: 'abandoned', label: 'سبد رهاشده', value: 43, type: 'number', delta: -5.6, note: 'قابل بازیابی' },
  { id: 'discounts', label: 'استفاده از تخفیف', value: 71, type: 'number', delta: 4.2, note: 'این ماه' },
  { id: 'loyalty', label: 'فعالیت باشگاه', value: 327, type: 'number', delta: 18.9, note: 'تراکنش امتیاز' }
];

export const salesSeries = [
  { label: 'شنبه', sales: 28, orders: 22 }, { label: 'یکشنبه', sales: 36, orders: 27 },
  { label: 'دوشنبه', sales: 31, orders: 24 }, { label: 'سه‌شنبه', sales: 49, orders: 38 },
  { label: 'چهارشنبه', sales: 45, orders: 34 }, { label: 'پنجشنبه', sales: 58, orders: 43 },
  { label: 'جمعه', sales: 42, orders: 31 }
];

export const categoryRevenue = [
  { label: 'مانتو و کت', value: 34 }, { label: 'شلوار', value: 21 }, { label: 'پیراهن', value: 18 },
  { label: 'شومیز', value: 13 }, { label: 'کیف و کفش', value: 9 }, { label: 'اکسسوری', value: 5 }
];

export const adminProducts = products.map((product, index) => ({
  ...product,
  inventory: Math.max(0, 26 - index * 2),
  status: product.availability ? (index % 5 === 0 ? 'draft' : 'active') : 'out-of-stock',
  variants: product.colors.length * product.sizes.length,
  views: 7200 - index * 310,
  conversion: Math.max(1.2, 5.8 - index * .25)
}));

export const adminOrders = mockOrders.map((order, index) => ({
  ...order,
  customer: ['سارا احمدی', 'مریم رضایی', 'نسترن کریمی', 'الهام محمدی'][index % 4],
  paymentMethod: index % 2 ? 'درگاه پرداخت آنلاین' : 'کیف پول و درگاه',
  risk: index === 3 ? 'review' : 'normal'
}));

export const adminCustomers = [
  { id: 'CUS-1042', name: 'سارا احمدی', mobile: '۰۹۱۲۱۲۳۴۵۶۷', level: 'طلایی', orders: 12, spent: 46850000, joined: '۱۴۰۴/۰۸/۱۲', status: 'active' },
  { id: 'CUS-1041', name: 'مریم رضایی', mobile: '۰۹۳۵۴۲۱۷۶۸۹', level: 'نقره‌ای', orders: 7, spent: 24100000, joined: '۱۴۰۴/۱۰/۰۳', status: 'active' },
  { id: 'CUS-1038', name: 'نسترن کریمی', mobile: '۰۹۱۰۸۸۷۶۵۴۳', level: 'عضو توتو', orders: 3, spent: 9650000, joined: '۱۴۰۵/۰۲/۲۱', status: 'active' },
  { id: 'CUS-1029', name: 'الهام محمدی', mobile: '۰۹۹۱۱۱۲۲۳۳۴', level: 'ویژه', orders: 21, spent: 92750000, joined: '۱۴۰۳/۰۶/۱۵', status: 'vip' }
];

export const adminActivities = [
  { person: 'مدیر سفارش‌ها', action: 'وضعیت سفارش TO-0510-4821 را به آماده ارسال تغییر داد.', time: '۸ دقیقه پیش' },
  { person: 'مدیر محصول', action: 'موجودی شلوار راسته کرپ، رنگ مشکی، سایز ۳۸ را ویرایش کرد.', time: '۲۲ دقیقه پیش' },
  { person: 'ویرایشگر محتوا', action: 'مقاله راهنمای انتخاب سایز را منتشر کرد.', time: '۱ ساعت پیش' },
  { person: 'مدیر بازاریابی', action: 'کمپین آفر تایم آخر هفته را زمان‌بندی کرد.', time: '۳ ساعت پیش' }
];

export const adminRoles = [
  { id: 'super-admin', label: 'مدیر کل', users: 1, permissions: 'دسترسی کامل' },
  { id: 'store-manager', label: 'مدیر فروشگاه', users: 2, permissions: 'محصول، سفارش، مشتری و گزارش' },
  { id: 'product-manager', label: 'مدیر محصول', users: 3, permissions: 'محصول، موجودی و دسته‌بندی' },
  { id: 'order-manager', label: 'مدیر سفارش', users: 4, permissions: 'سفارش، مرجوعی و بازپرداخت' },
  { id: 'content-editor', label: 'ویرایشگر محتوا', users: 2, permissions: 'مجله، بنر و صفحات محتوایی' },
  { id: 'support', label: 'پشتیبانی مشتری', users: 5, permissions: 'مشتری، تیکت و سفارش فقط خواندنی' },
  { id: 'marketing', label: 'مدیر بازاریابی', users: 2, permissions: 'کمپین، تخفیف و باشگاه مشتریان' }
];
