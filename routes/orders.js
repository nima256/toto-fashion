const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const Order = require('../models/Order');
const User = require('../models/User');
const env = require('../config/env');
const { requestPayment, verifyPayment, providerName } = require('../services/payment');
const { checkoutConfig, quote, quoteView } = require('../services/checkout');
const { timelineEntry, markOrderPaid, markOrderFailed, runPostPaymentTasks } = require('../services/orderFinalize');
const S = require('../services/serializers');
const { asyncHandler, ok, AppError } = require('../utils/http');
const { requireCsrf } = require('../middlewares/auth');
const { normalizeDigits } = require('../utils/formatters');
const { z, validate, text, optionalText, int, mobile, orderNumber, publicId } = require('../utils/validate');

const router = express.Router();
const trackLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'تعداد استعلام بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید.' } });
const orderLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'تعداد درخواست ثبت سفارش بیش از حد مجاز است.' } });

const cartItem = z.object({
  productId: publicId,
  size: z.string().trim().max(24).optional().default(''),
  colorIndex: int({ min: 0, max: 50 }).optional().default(0),
  quantity: int({ min: 1, max: 5 })
});
const items = z.array(cartItem, { invalid_type_error: 'اقلام سبد معتبر نیست' }).min(1, 'سبد خرید خالی است').max(30, 'تعداد اقلام سبد بیش از حد مجاز است');
const postal = z.preprocess(value => normalizeDigits(String(value ?? '')).replace(/\D/g, ''), z.string().max(10, 'کد پستی باید ۱۰ رقم باشد'));
const addressSchema = z.object({
  firstName: text(60, { min: 2, message: 'نام را حداقل با دو حرف وارد کنید' }), lastName: text(60, { min: 2, message: 'نام خانوادگی را کامل وارد کنید' }), mobile,
  province: optionalText(60).optional().default(''), city: optionalText(60).optional().default(''), postalCode: postal.optional().default(''),
  buildingNumber: optionalText(20).optional().default(''), unit: optionalText(20).optional().default(''), address: optionalText(400).optional().default('')
});
const shippingMethodId = z.enum(['standard', 'express-tehran', 'pickup'], { errorMap: () => ({ message: 'روش ارسال معتبر نیست' }) });
const discountCode = z.preprocess(value => String(value ?? '').trim().toUpperCase(), z.string().max(40));

const quoteBody = z.object({ items, shippingMethodId: shippingMethodId.optional().default('standard'), address: addressSchema.partial().optional(), discountCode: discountCode.optional().default('') });
const createBody = z.object({
  items, shippingMethodId, address: addressSchema, discountCode: discountCode.optional().default(''), notes: optionalText(500).optional().default(''),
  idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9-]{16,64}$/, 'کلید درخواست معتبر نیست').optional()
});

function requireDeliveryAddress(address) {
  const issues = [];
  if (!address.province) issues.push({ path: 'address.province', message: 'استان را انتخاب کنید' });
  if (!address.city) issues.push({ path: 'address.city', message: 'شهر را انتخاب کنید' });
  if (!/^\d{10}$/.test(address.postalCode || '')) issues.push({ path: 'address.postalCode', message: 'کد پستی باید دقیقاً ۱۰ رقم باشد' });
  if (!address.buildingNumber) issues.push({ path: 'address.buildingNumber', message: 'پلاک را وارد کنید' });
  if ((address.address || '').length < 10) issues.push({ path: 'address.address', message: 'نشانی کامل را وارد کنید' });
  if (issues.length) throw new AppError(400, 'اطلاعات نشانی کامل یا معتبر نیست', issues);
}
const addressText = address => [address.province, address.city, address.address, address.buildingNumber ? `پلاک ${address.buildingNumber}` : '', address.unit ? `واحد ${address.unit}` : ''].filter(Boolean).join('، ');
async function uniqueOrderNumber() {
  for (let i = 0; i < 10; i++) {
    const d = new Date();
    const stamp = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const suffix = i < 5 ? crypto.randomInt(1000, 10000) : crypto.randomInt(100000, 1000000);
    const candidate = `TO-${stamp}-${suffix}`;
    if (!(await Order.exists({ orderNumber: candidate }))) return candidate;
  }
  throw new AppError(503, 'ساخت شماره سفارش انجام نشد؛ دوباره تلاش کنید');
}
// سفارش‌هایی که در همین نشست ثبت شده‌اند (برای مهمان) جزئیات کامل را می‌بینند
const rememberOrder = (req, number) => { req.session.orderAccess = [...(req.session.orderAccess || []).filter(n => n !== number), number].slice(-20); };
const hasFullAccess = (req, order) => (order.user ? String(order.user) === String(req.session?.userId || '') : (req.session?.orderAccess || []).includes(order.orderNumber));

router.get('/config', (_req, res) => ok(res, { config: checkoutConfig() }));

router.post('/quote', requireCsrf, validate({ body: quoteBody }), asyncHandler(async (req, res) => {
  const q = await quote({ ...req.body, userId: req.session?.userId || null, mobile: req.body.address?.mobile || '', strictCoupon: false, lenient: true });
  ok(res, { quote: quoteView(q) });
}));
// سازگاری با کلاینت قدیمی: بررسی سختگیرانه موجودی و کد تخفیف پیش از پرداخت
router.post('/validate-cart', requireCsrf, validate({ body: quoteBody }), asyncHandler(async (req, res) => {
  const q = await quote({ ...req.body, userId: req.session?.userId || null, mobile: req.body.address?.mobile || '' });
  ok(res, { ok: true, quote: quoteView(q), amounts: quoteView(q).amounts });
}));

router.post('/', requireCsrf, orderLimiter, validate({ body: createBody }), asyncHandler(async (req, res) => {
  const { address, shippingMethodId: methodId, idempotencyKey } = req.body;
  if (idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey });
    if (existing) {
      if (!hasFullAccess(req, existing)) throw new AppError(409, 'این درخواست قبلاً ثبت شده است');
      if (existing.paymentStatus === 'paid') return ok(res, { paymentId: existing.orderNumber, redirectUrl: `/payment-success?order=${encodeURIComponent(existing.orderNumber)}`, order: S.order(existing), duplicate: true });
      if (existing.paymentInfo?.url && existing.paymentStatus === 'pending') return ok(res, { paymentId: existing.paymentInfo.authority, redirectUrl: existing.paymentInfo.url, order: S.order(existing), duplicate: true });
      throw new AppError(409, 'این سفارش قبلاً ثبت شده است؛ برای پرداخت دوباره از سبد خرید اقدام کنید');
    }
  }
  const pickup = methodId === 'pickup';
  if (!pickup) requireDeliveryAddress(address);
  const user = req.session?.userId ? await User.findById(req.session.userId) : null;
  const q = await quote({ items: req.body.items, shippingMethodId: methodId, address: pickup ? null : address, discountCode: req.body.discountCode, userId: user?._id || null, mobile: address.mobile });
  const orderNumberValue = await uniqueOrderNumber();
  const snapshot = pickup ? { firstName: address.firstName, lastName: address.lastName, mobile: address.mobile } : address;
  let order;
  try {
    order = await Order.create({
      orderNumber: orderNumberValue, user: user?._id || null, idempotencyKey,
      customerName: `${address.firstName} ${address.lastName}`.trim(), mobile: address.mobile, email: user?.email || '',
      address: pickup ? 'تحویل حضوری از فروشگاه' : addressText(address), addressSnapshot: snapshot,
      items: q.lines.map(l => ({ productId: l.product.publicId, name: l.product.name, category: l.product.category, image: l.product.image, color: l.color, colorIndex: l.colorIndex, size: l.size, variantId: l.variantId, quantity: l.quantity, price: l.currentPrice, previousPrice: l.previousPrice, returnEligible: true })),
      subtotal: q.subtotal, productDiscount: q.productDiscount, couponDiscount: q.couponDiscount, discount: q.productDiscount + q.couponDiscount,
      shipping: q.shipping, total: q.total, couponCode: q.coupon?.code || '', coupon: q.coupon?._id || null, couponState: q.coupon ? 'pending' : 'none',
      shippingMethod: { id: q.selected.id, title: q.selected.title, eta: q.selected.eta, price: q.shipping }, customerNote: req.body.notes,
      status: 'awaiting-payment', paymentStatus: 'pending', paymentInfo: { provider: providerName() }, carrier: q.selected.title, deliveryEstimate: q.selected.eta,
      timeline: [timelineEntry('registered', 'سفارش ثبت شد', 'سفارش در انتظار تأیید پرداخت است.')]
    });
  } catch (error) {
    if (error?.code === 11000 && idempotencyKey) throw new AppError(409, 'این سفارش در حال ثبت است؛ چند لحظه بعد وضعیت را بررسی کنید');
    throw error;
  }
  rememberOrder(req, order.orderNumber);
  try {
    const payment = await requestPayment(order);
    if (!payment?.url || !payment?.authority) throw new Error('پاسخ معتبر از درگاه دریافت نشد');
    order.paymentInfo.authority = payment.authority; order.paymentInfo.url = payment.url; await order.save();
    return ok(res, { paymentId: payment.authority, redirectUrl: payment.url, order: S.order(order) }, 201);
  } catch (e) {
    console.error('[payment] request failed', order.orderNumber, e.message);
    await markOrderFailed(order._id, { label: 'ایجاد پرداخت ناموفق بود', detail: 'اتصال به درگاه پرداخت برقرار نشد.', error: e.message });
    throw new AppError(502, 'اتصال به درگاه پرداخت انجام نشد؛ دوباره تلاش کنید');
  }
}));

router.get('/payment/callback', asyncHandler(async (req, res) => {
  const authority = String(req.query.Authority || req.query.authority || '');
  const status = String(req.query.Status || req.query.status || '').toUpperCase();
  if (!/^[A-Za-z0-9]{8,64}$/.test(authority)) return res.redirect('/payment-failed?reason=invalid');
  const order = await Order.findOne({ 'paymentInfo.authority': authority });
  if (!order) return res.redirect('/payment-failed?reason=order-not-found');
  const success = `/payment-success?order=${encodeURIComponent(order.orderNumber)}`;
  // callback تکراری: پرداخت قبلاً تأیید شده؛ فقط عملیات ناتمام (idempotent) تکمیل می‌شود
  if (order.paymentStatus === 'paid') { await runPostPaymentTasks(order._id); return res.redirect(success); }
  if (status !== 'OK') {
    await markOrderFailed(order._id, { label: 'پرداخت لغو شد', detail: 'پرداخت در درگاه تکمیل نشد.' });
    return res.redirect(`/payment-failed?order=${encodeURIComponent(order.orderNumber)}`);
  }
  let result;
  try { result = await verifyPayment(order, authority); }
  catch (error) {
    // خطای ارتباطی: نتیجه نامشخص است؛ سفارش ناموفق علامت نمی‌خورد
    console.error('[payment] verification error', order.orderNumber, error.message);
    await Order.updateOne({ _id: order._id, paymentStatus: 'pending' }, { $set: { 'paymentInfo.lastError': String(error.message).slice(0, 300) } });
    return res.redirect(`/payment-pending?order=${encodeURIComponent(order.orderNumber)}`);
  }
  if (![100, 101].includes(Number(result?.status))) {
    await markOrderFailed(order._id, { label: 'تأیید پرداخت ناموفق بود', detail: 'پرداخت توسط درگاه تأیید نشد.', error: `gateway status ${result?.status ?? 'unknown'}` });
    return res.redirect(`/payment-failed?order=${encodeURIComponent(order.orderNumber)}`);
  }
  // مرحله حیاتی: ثبت پرداخت. از این نقطه به بعد سفارش هرگز payment-failed نمی‌شود.
  await markOrderPaid(order._id, { refId: String(result.refId || result.RefID || ''), cardPan: String(result.cardPan || ''), detail: env.paymentMock ? 'پرداخت آزمایشی (Mock) با موفقیت تأیید شد.' : 'پرداخت اینترنتی با موفقیت تأیید شد.' });
  await runPostPaymentTasks(order._id);
  return res.redirect(success);
}));

router.get('/:orderNumber/status', validate({ params: z.object({ orderNumber }) }), asyncHandler(async (req, res) => {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber }); if (!order) throw new AppError(404, 'سفارش پیدا نشد');
  if (order.user && String(order.user) !== String(req.session?.userId || '')) throw new AppError(403, 'دسترسی به این سفارش مجاز نیست');
  const full = hasFullAccess(req, order);
  ok(res, { status: order.paymentStatus, access: full ? 'full' : 'public', order: full ? S.order(order) : S.publicOrder(order), trackingCode: full ? (order.paymentInfo?.refId || order.trackingCode || '') : (order.trackingCode || '') });
}));

router.post('/track', requireCsrf, trackLimiter, validate({ body: z.object({ orderNumber, mobile }) }), asyncHandler(async (req, res) => {
  const order = await Order.findOne({ orderNumber: req.body.orderNumber, mobile: req.body.mobile });
  if (!order) throw new AppError(404, 'سفارشی با این شماره و موبایل پیدا نشد');
  ok(res, { order: S.publicOrder(order), canViewDetails: Boolean(order.user && String(order.user) === String(req.session?.userId || '')), detailsId: order.user && String(order.user) === String(req.session?.userId || '') ? String(order._id) : null });
}));

module.exports = router;
