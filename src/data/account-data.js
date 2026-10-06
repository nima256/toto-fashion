export const orderStatuses = [
  { id: 'registered', label: 'ثبت سفارش' },
  { id: 'awaiting-payment', label: 'در انتظار پرداخت' },
  { id: 'paid', label: 'پرداخت‌شده' },
  { id: 'processing', label: 'در حال پردازش' },
  { id: 'ready', label: 'آماده ارسال' },
  { id: 'shipped', label: 'ارسال‌شده' },
  { id: 'delivered', label: 'تحویل‌شده' }
];

export const loyaltyLevels = [
  { id: 'member', label: 'عضو توتو', min: 0, max: 1499 },
  { id: 'silver', label: 'نقره‌ای', min: 1500, max: 4999 },
  { id: 'gold', label: 'طلایی', min: 5000, max: 9999 },
  { id: 'special', label: 'ویژه', min: 10000, max: null }
];
