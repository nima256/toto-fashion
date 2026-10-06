// گزارش داشبورد بر اساس داده واقعی و بازه انتخابی (امروز، ۷ روز، ۳۰ روز یا بازه دلخواه).
// شاخص‌هایی که داده واقعی ندارند (سبد رهاشده، سهم دستگاه) عمداً حذف شده‌اند.
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const ReturnRequest = require('../models/ReturnRequest');
const PointsTransaction = require('../models/PointsTransaction');
const GalleryPost = require('../models/GalleryPost');
const Review = require('../models/Review');
const ProductQuestion = require('../models/ProductQuestion');
const Coupon = require('../models/Coupon');
const { AppError } = require('../utils/http');
const { tehranDayKey } = require('../utils/formatters');

const HOUR = 3600000; const DAY = 24 * HOUR;
const tehranMidnight = dayKey => new Date(Date.parse(`${dayKey}T00:00:00+03:30`));
const RANGE_LABELS = { today: 'امروز', '7d': '۷ روز اخیر', '30d': '۳۰ روز اخیر', custom: 'بازه دلخواه' };

function resolveRange({ range = '30d', from, to } = {}, now = new Date()) {
  let start; let end = now;
  if (range === 'today') start = tehranMidnight(tehranDayKey(now));
  else if (range === '7d') start = new Date(now.getTime() - 7 * DAY);
  else if (range === '30d') start = new Date(now.getTime() - 30 * DAY);
  else if (range === 'custom') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(from || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(to || ''))) throw new AppError(400, 'برای بازه دلخواه، تاریخ شروع و پایان را انتخاب کنید');
    start = tehranMidnight(from); end = new Date(Math.min(tehranMidnight(to).getTime() + DAY, now.getTime()));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) throw new AppError(400, 'بازه تاریخ معتبر نیست');
    if (end - start > 366 * DAY) throw new AppError(400, 'بازه دلخواه حداکثر یک سال است');
  } else throw new AppError(400, 'بازه زمانی معتبر نیست');
  const span = end - start;
  return { range, label: RANGE_LABELS[range], start, end, prevStart: new Date(start.getTime() - span), prevEnd: start, span };
}

function buckets({ start, end, span }) {
  const list = []; const fmtDay = new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric', timeZone: 'Asia/Tehran' });
  const fmtHour = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Tehran' });
  const step = span <= 2 * DAY ? 3 * HOUR : span <= 45 * DAY ? DAY : 7 * DAY;
  for (let t = start.getTime(); t < end.getTime(); t += step) list.push({ start: new Date(t), end: new Date(Math.min(t + step, end.getTime())), label: step < DAY ? fmtHour.format(new Date(t)) : fmtDay.format(new Date(t)) });
  return list.slice(-60);
}
const pct = (current, previous) => (!previous ? (current ? 100 : 0) : Number((((current - previous) / previous) * 100).toFixed(1)));
const sum = list => list.reduce((s, o) => s + Number(o.total || 0), 0);
const inRange = (date, a, b) => { const t = new Date(date).getTime(); return t >= a.getTime() && t < b.getTime(); };

async function buildAnalytics(query = {}) {
  const r = resolveRange(query);
  const [orders, prevOrders, newUsers, prevNewUsers, returnsInRange, pointsAgg, products, pendingOrders, openReturns, reviewQueue, galleryQueue, questionQueue, needsReview, expiringCoupons] = await Promise.all([
    Order.find({ createdAt: { $gte: r.start, $lt: r.end } }).select('total paymentStatus status items couponCode paymentMethod paymentInfo.provider createdAt').lean(),
    Order.find({ createdAt: { $gte: r.prevStart, $lt: r.prevEnd }, paymentStatus: 'paid' }).select('total couponCode').lean(),
    User.find({ createdAt: { $gte: r.start, $lt: r.end } }).select('createdAt').lean(),
    User.countDocuments({ createdAt: { $gte: r.prevStart, $lt: r.prevEnd } }),
    ReturnRequest.countDocuments({ createdAt: { $gte: r.start, $lt: r.end } }),
    PointsTransaction.aggregate([{ $match: { createdAt: { $gte: r.start, $lt: r.end }, points: { $gt: 0 } } }, { $group: { _id: null, points: { $sum: '$points' } } }]),
    Product.find({ status: { $ne: 'draft' } }).select('variants inventory').lean(),
    Order.countDocuments({ paymentStatus: 'paid', status: { $in: ['paid', 'processing', 'ready'] } }),
    ReturnRequest.countDocuments({ status: { $in: ['received', 'reviewing', 'approved', 'awaiting-item', 'replacement-processing'] } }),
    Review.countDocuments({ status: 'pending' }), GalleryPost.countDocuments({ 'images.status': 'pending' }), ProductQuestion.countDocuments({ status: 'pending' }),
    Order.countDocuments({ needsReview: true }),
    Coupon.countDocuments({ isActive: true, expiresAt: { $gt: new Date(), $lt: new Date(Date.now() + 3 * DAY) }, $expr: { $or: [{ $eq: ['$usageLimit', null] }, { $lt: ['$usedCount', '$usageLimit'] }] } })
  ]);
  const paid = orders.filter(o => o.paymentStatus === 'paid');
  const revenue = sum(paid); const prevRevenue = sum(prevOrders);
  const avg = paid.length ? Math.round(revenue / paid.length) : 0; const prevAvg = prevOrders.length ? Math.round(prevRevenue / prevOrders.length) : 0;
  const couponUses = paid.filter(o => o.couponCode).length; const prevCouponUses = prevOrders.filter(o => o.couponCode).length;
  const lowStockVariants = products.reduce((s, p) => s + ((p.variants || []).length ? p.variants.filter(v => v.stock < 5).length : (p.inventory < 10 ? 1 : 0)), 0);
  const kpis = [
    { id: 'revenue', label: `فروش ${r.label}`, value: revenue, type: 'currency', delta: pct(revenue, prevRevenue), note: 'نسبت به دوره قبل' },
    { id: 'orders', label: 'سفارش پرداخت‌شده', value: paid.length, type: 'number', delta: pct(paid.length, prevOrders.length), note: 'نسبت به دوره قبل' },
    { id: 'averageOrder', label: 'میانگین سفارش', value: avg, type: 'currency', delta: pct(avg, prevAvg), note: 'نسبت به دوره قبل' },
    { id: 'customers', label: 'مشتری جدید', value: newUsers.length, type: 'number', delta: pct(newUsers.length, prevNewUsers), note: 'نسبت به دوره قبل' },
    { id: 'discounts', label: 'استفاده از کد تخفیف', value: couponUses, type: 'number', delta: pct(couponUses, prevCouponUses), note: 'نسبت به دوره قبل' },
    { id: 'loyalty', label: 'امتیاز باشگاه صادرشده', value: pointsAgg[0]?.points || 0, type: 'number', delta: null, note: 'در این بازه' },
    { id: 'pending', label: 'سفارش در انتظار پردازش', value: pendingOrders, type: 'number', delta: null, note: 'وضعیت فعلی' },
    { id: 'returns', label: 'مرجوعی باز', value: openReturns, type: 'number', delta: null, note: 'وضعیت فعلی' },
    { id: 'lowStock', label: 'تنوع کم‌موجودی', value: lowStockVariants, type: 'number', delta: null, note: 'رنگ/سایز با موجودی کمتر از ۵' }
  ];
  const slots = buckets(r);
  const salesSeries = slots.map(b => { const list = paid.filter(o => inRange(o.createdAt, b.start, b.end)); return { label: b.label, sales: Number((sum(list) / 1000000).toFixed(2)), orders: list.length }; });
  const customerSeries = slots.map(b => ({ label: b.label, value: newUsers.filter(u => inRange(u.createdAt, b.start, b.end)).length }));
  const share = map => { const total = [...map.values()].reduce((a, b) => a + b, 0); return [...map.entries()].map(([label, value]) => ({ label, value: total ? Math.round(value / total * 100) : 0, raw: value })).sort((a, b) => b.raw - a.raw); };
  const categoryMap = new Map(); const productMap = new Map(); const paymentMap = new Map();
  for (const o of paid) {
    const method = o.paymentInfo?.provider === 'mock' ? 'پرداخت آزمایشی (Mock)' : (o.paymentMethod || 'درگاه پرداخت اینترنتی');
    paymentMap.set(method, (paymentMap.get(method) || 0) + 1);
    for (const i of o.items || []) {
      const amount = Number(i.price || 0) * Number(i.quantity || 1);
      categoryMap.set(i.category || 'سایر', (categoryMap.get(i.category || 'سایر') || 0) + amount);
      const current = productMap.get(i.productId) || { productId: i.productId, name: i.name, image: i.image, quantity: 0, revenue: 0 };
      current.quantity += Number(i.quantity || 1); current.revenue += amount; productMap.set(i.productId, current);
    }
  }
  return {
    range: { id: r.range, label: r.label, start: r.start, end: r.end },
    kpis, salesSeries, customerSeries,
    categoryRevenue: share(categoryMap).slice(0, 8), paymentMethods: share(paymentMap),
    topProducts: [...productMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    returnRate: { requests: returnsInRange, paidOrders: paid.length, value: paid.length ? Number((returnsInRange / paid.length * 100).toFixed(1)) : 0 },
    tasks: { pendingOrders, lowStockVariants, openReturns, reviewQueue: reviewQueue + questionQueue, galleryQueue, needsReview, expiringCoupons }
  };
}
module.exports = { buildAnalytics, resolveRange };
