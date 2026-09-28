export const orderStatuses = [
  { id: 'registered', label: 'ثبت سفارش' },
  { id: 'awaiting-payment', label: 'در انتظار پرداخت' },
  { id: 'paid', label: 'پرداخت‌شده' },
  { id: 'processing', label: 'در حال پردازش' },
  { id: 'ready', label: 'آماده ارسال' },
  { id: 'shipped', label: 'ارسال‌شده' },
  { id: 'delivered', label: 'تحویل‌شده' }
];

export const mockOrders = [
  {
    id: 'TOTO-1405-10482',
    orderNumber: '۱۴۰۵۱۰۴۸۲',
    placedAt: '۱۴۰۵/۰۵/۰۶',
    placedAtIso: '2026-07-28T10:35:00+03:30',
    status: 'shipped',
    statusLabel: 'ارسال‌شده',
    total: 4540000,
    subtotal: 4770000,
    discount: 350000,
    shipping: 120000,
    trackingCode: '۲۴۹۸۷۶۵۴۱۲۳۴۵۶۷۸۹۰۱۲۳۴',
    paymentTrackingCode: '۸۲۷۴۹۱۳۶۵۰۱۲',
    paymentMethod: 'درگاه پرداخت اینترنتی',
    deliveryEstimate: 'بین ۱۲ تا ۱۴ مرداد',
    carrier: 'پست پیشتاز',
    mobile: '09121234567',
    customerName: 'سارا احمدی',
    address: 'تهران، خیابان ولیعصر، بالاتر از پارک ساعی، کوچه نمونه، پلاک ۲۴، واحد ۶',
    items: [
      { productId: 'product-1', name: 'مانتوی لینن توتو', image: './src/assets/images/product-1.webp', color: 'مشکی', size: '۳۸', quantity: 1, price: 2890000, returnEligible: true },
      { productId: 'product-3', name: 'شلوار راسته کرپ', image: './src/assets/images/product-3.webp', color: 'طوسی', size: '۴۰', quantity: 1, price: 1880000, returnEligible: true }
    ],
    timeline: [
      { status: 'registered', label: 'سفارش ثبت شد', date: '۶ مرداد، ۱۰:۳۵', detail: 'سفارش شما با موفقیت در توتو ثبت شد.' },
      { status: 'paid', label: 'پرداخت تأیید شد', date: '۶ مرداد، ۱۰:۳۷', detail: 'پرداخت اینترنتی با موفقیت تأیید شد.' },
      { status: 'processing', label: 'آماده‌سازی سفارش', date: '۷ مرداد، ۱۲:۱۰', detail: 'محصولات کنترل کیفیت و بسته‌بندی شدند.' },
      { status: 'ready', label: 'تحویل به واحد ارسال', date: '۸ مرداد، ۰۹:۱۵', detail: 'سفارش برای تحویل به شرکت حمل آماده شد.' },
      { status: 'shipped', label: 'ارسال شد', date: '۸ مرداد، ۱۶:۴۵', detail: 'مرسوله به پست پیشتاز تحویل داده شد.' }
    ]
  },
  {
    id: 'TOTO-1405-10139',
    orderNumber: '۱۴۰۵۱۰۱۳۹',
    placedAt: '۱۴۰۵/۰۴/۳۰',
    placedAtIso: '2026-07-21T15:20:00+03:30',
    status: 'delivered',
    statusLabel: 'تحویل‌شده',
    total: 3290000,
    subtotal: 3290000,
    discount: 0,
    shipping: 0,
    trackingCode: '۲۴۹۸۷۶۵۴۱۲۳۰۰۰۱۱۲۲۳۳۴۴',
    paymentTrackingCode: '۵۰۱۳۴۸۹۰۷۶۲۱',
    paymentMethod: 'درگاه پرداخت اینترنتی',
    deliveryEstimate: 'تحویل در ۴ مرداد',
    carrier: 'پست پیشتاز',
    mobile: '09121234567',
    customerName: 'سارا احمدی',
    address: 'تهران، خیابان ولیعصر، بالاتر از پارک ساعی، کوچه نمونه، پلاک ۲۴، واحد ۶',
    items: [
      { productId: 'product-4', name: 'پیراهن میدی مشکی', image: './src/assets/images/product-4.webp', color: 'مشکی', size: '۳۸', quantity: 1, price: 3290000, returnEligible: true }
    ],
    timeline: [
      { status: 'registered', label: 'سفارش ثبت شد', date: '۳۰ تیر، ۱۵:۲۰', detail: 'سفارش شما با موفقیت ثبت شد.' },
      { status: 'paid', label: 'پرداخت تأیید شد', date: '۳۰ تیر، ۱۵:۲۲', detail: 'پرداخت با موفقیت تأیید شد.' },
      { status: 'processing', label: 'آماده‌سازی سفارش', date: '۱ مرداد، ۱۰:۰۰', detail: 'سفارش در حال کنترل و بسته‌بندی بود.' },
      { status: 'shipped', label: 'ارسال شد', date: '۲ مرداد، ۱۳:۴۰', detail: 'مرسوله به پست تحویل داده شد.' },
      { status: 'delivered', label: 'تحویل‌شده', date: '۴ مرداد، ۱۷:۱۰', detail: 'سفارش با موفقیت تحویل شد.' }
    ]
  },
  {
    id: 'TOTO-1405-9844',
    orderNumber: '۱۴۰۵۰۹۸۴۴',
    placedAt: '۱۴۰۵/۰۳/۲۶',
    placedAtIso: '2026-06-16T09:12:00+03:30',
    status: 'cancelled',
    statusLabel: 'لغوشده',
    total: 2140000,
    subtotal: 2140000,
    discount: 0,
    shipping: 0,
    trackingCode: '',
    paymentTrackingCode: '',
    paymentMethod: 'پرداخت انجام نشد',
    deliveryEstimate: 'لغوشده',
    carrier: '',
    mobile: '09121234567',
    customerName: 'سارا احمدی',
    address: 'تهران، خیابان ولیعصر، بالاتر از پارک ساعی، کوچه نمونه، پلاک ۲۴، واحد ۶',
    items: [
      { productId: 'product-5', name: 'کت کوتاه طوسی', image: './src/assets/images/product-5.webp', color: 'طوسی', size: '۴۰', quantity: 1, price: 2140000, returnEligible: false }
    ],
    timeline: [
      { status: 'registered', label: 'سفارش ثبت شد', date: '۲۶ خرداد، ۰۹:۱۲', detail: 'سفارش ثبت شد اما پرداخت تکمیل نشد.' },
      { status: 'cancelled', label: 'سفارش لغو شد', date: '۲۶ خرداد، ۰۹:۳۵', detail: 'به دلیل تکمیل‌نشدن پرداخت، سفارش به‌صورت خودکار لغو شد.' }
    ]
  },
  {
    id: 'TOTO-1405-9361',
    orderNumber: '۱۴۰۵۰۹۳۶۱',
    placedAt: '۱۴۰۵/۰۲/۰۸',
    placedAtIso: '2026-04-28T11:44:00+03:30',
    status: 'returned',
    statusLabel: 'مرجوع‌شده',
    total: 1780000,
    subtotal: 1780000,
    discount: 0,
    shipping: 0,
    trackingCode: '۲۴۹۸۷۶۵۴۱۲۳۰۰۲۲۳۳۴۴۵۵۶',
    paymentTrackingCode: '۳۳۸۱۲۶۷۴۹۰۵۲',
    paymentMethod: 'درگاه پرداخت اینترنتی',
    deliveryEstimate: 'مرجوعی تکمیل شده',
    carrier: 'پست پیشتاز',
    mobile: '09121234567',
    customerName: 'سارا احمدی',
    address: 'تهران، خیابان ولیعصر، بالاتر از پارک ساعی، کوچه نمونه، پلاک ۲۴، واحد ۶',
    items: [
      { productId: 'product-2', name: 'شومیز مینیمال سفید', image: './src/assets/images/product-2.webp', color: 'سفید', size: '۳۸', quantity: 1, price: 1780000, returnEligible: false }
    ],
    timeline: [
      { status: 'registered', label: 'سفارش ثبت شد', date: '۸ اردیبهشت، ۱۱:۴۴', detail: 'سفارش با موفقیت ثبت شد.' },
      { status: 'delivered', label: 'تحویل‌شده', date: '۱۳ اردیبهشت، ۱۵:۲۰', detail: 'سفارش به مشتری تحویل شد.' },
      { status: 'return-requested', label: 'درخواست مرجوعی', date: '۱۵ اردیبهشت، ۱۰:۱۵', detail: 'درخواست بررسی و تأیید شد.' },
      { status: 'returned', label: 'مرجوعی تکمیل شد', date: '۲۱ اردیبهشت، ۱۴:۳۰', detail: 'مبلغ محصول به حساب بانکی اعلام‌شده بازگشت داده شد.' }
    ]
  }
];

export const loyaltyLevels = [
  { id: 'member', label: 'عضو توتو', min: 0, max: 1499 },
  { id: 'silver', label: 'نقره‌ای', min: 1500, max: 4999 },
  { id: 'gold', label: 'طلایی', min: 5000, max: 9999 },
  { id: 'special', label: 'ویژه', min: 10000, max: null }
];

export const defaultAccount = {
  profile: {
    firstName: 'سارا',
    lastName: 'احمدی',
    mobile: '09121234567',
    email: 'sara.ahmadi@example.com',
    birthday: '۱۳۷۳/۰۷/۲۱',
    completed: 80
  },
  loyalty: {
    points: 2840,
    level: 'silver',
    expiringPoints: 320,
    expiryDate: '۱۴۰۵/۰۶/۳۱',
    lifetimePoints: 6340,
    transactions: [
      { id: 'lp-1', title: 'خرید سفارش ۱۴۰۵۱۰۴۸۲', date: '۶ مرداد ۱۴۰۵', points: 454, type: 'earn' },
      { id: 'lp-2', title: 'تکمیل اطلاعات پروفایل', date: '۲۹ تیر ۱۴۰۵', points: 100, type: 'earn' },
      { id: 'lp-3', title: 'استفاده از پاداش ارسال رایگان', date: '۱۱ تیر ۱۴۰۵', points: -200, type: 'spend' },
      { id: 'lp-4', title: 'ثبت نظر تأییدشده', date: '۲۰ تیر ۱۴۰۵', points: 50, type: 'earn' },
      { id: 'lp-5', title: 'خرید سفارش ۱۴۰۵۱۰۱۳۹', date: '۱۱ تیر ۱۴۰۵', points: 329, type: 'earn' }
    ]
  },
  discounts: [
    { code: 'TOTO-SILVER', title: '۱۵٪ تخفیف اعضای نقره‌ای', condition: 'خرید بالای ۲ میلیون تومان', expiresAt: '۱۴۰۵/۰۵/۲۰', status: 'active' },
    { code: 'BIRTHDAY-300', title: '۳۰۰ هزار تومان هدیه تولد', condition: 'قابل استفاده برای محصولات بدون تخفیف', expiresAt: '۱۴۰۵/۰۷/۳۰', status: 'active' }
  ],
  rewards: [
    { id: 'reward-welcome', title: 'ارسال رایگان', source: 'تکمیل پروفایل', code: 'SHIP-TOTO', expiresAt: '۱۴۰۵/۰۵/۲۵', condition: 'یک‌بار استفاده برای ارسال استاندارد', status: 'active' }
  ],
  availabilityAlerts: [
    { id: 'alert-1', productId: 'product-1', productName: 'مانتوی لینن توتو', image: './src/assets/images/product-1.webp', variant: 'مشکی، سایز ۴۰', createdAt: '۲۸ تیر ۱۴۰۵', status: 'waiting' }
  ],
  returns: [
    { id: 'RET-1405-0028', orderId: 'TOTO-1405-9361', orderNumber: '۱۴۰۵۰۹۳۶۱', type: 'مرجوعی محصول', status: 'completed', statusLabel: 'بازپرداخت انجام شد', createdAt: '۱۵ اردیبهشت ۱۴۰۵', productName: 'شومیز مینیمال سفید' }
  ],
  notifications: {
    orderSms: true,
    stockSms: true,
    campaignSms: false,
    loyaltySms: true,
    emailMagazine: false
  }
};

export const wheelRewards = [
  { id: 'discount-5', title: '۵٪ تخفیف', short: '۵٪', type: 'discount', value: 5, expiresInDays: 7, condition: 'خرید بالای ۱٬۵۰۰٬۰۰۰ تومان' },
  { id: 'discount-10', title: '۱۰٪ تخفیف', short: '۱۰٪', type: 'discount', value: 10, expiresInDays: 5, condition: 'خرید بالای ۲٬۵۰۰٬۰۰۰ تومان، سقف تخفیف ۴۰۰ هزار تومان' },
  { id: 'points-150', title: '۱۵۰ امتیاز توتو', short: '۱۵۰ امتیاز', type: 'points', value: 150, expiresInDays: 30, condition: 'امتیاز به موجودی باشگاه مشتریان افزوده می‌شود' },
  { id: 'free-shipping', title: 'ارسال رایگان', short: 'ارسال رایگان', type: 'shipping', value: 0, expiresInDays: 7, condition: 'ویژه ارسال استاندارد' },
  { id: 'category-bag', title: '۱۲٪ تخفیف کیف', short: 'تخفیف کیف', type: 'category', value: 12, expiresInDays: 7, condition: 'قابل استفاده برای گروه کیف‌های بدون تخفیف' },
  { id: 'double-points', title: 'امتیاز دوبرابر امروز', short: 'امتیاز ×۲', type: 'multiplier', value: 2, expiresInDays: 1, condition: 'برای خریدهای ثبت‌شده تا پایان امروز' },
  { id: 'no-reward', title: 'امروز هدیه‌ای ثبت نشد', short: 'فرصت فردا', type: 'none', value: 0, expiresInDays: 0, condition: 'فردا دوباره می‌توانید شانس خود را امتحان کنید' }
];
