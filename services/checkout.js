// محاسبه معتبر قیمت، ارسال و تخفیف فقط در سرور انجام می‌شود؛ فرانت‌اند همین خروجی را نمایش می‌دهد.
const env = require('../config/env');
const { AppError } = require('../utils/http');
const { validateAndPriceCart } = require('./inventory');
const { evaluateCoupon, couponView } = require('./coupons');

const shippingMethods = () => [
  { id:'standard', title:'ارسال استاندارد', description:'تهران ۱ تا ۳ و سایر شهرها ۳ تا ۶ روز کاری', price:env.standardShippingPrice, eta:'۱ تا ۶ روز کاری', freeOverThreshold:true, requiresAddress:true },
  { id:'express-tehran', title:'ارسال سریع تهران', description:'ویژه آدرس‌های شهر تهران؛ تحویل در روز کاری بعد', price:env.expressShippingPrice, eta:'روز کاری بعد', province:'تهران', city:'تهران', requiresAddress:true },
  { id:'pickup', title:'تحویل حضوری از فروشگاه', description:'پس از آماده‌شدن سفارش با پیامک اطلاع‌رسانی می‌شود', price:0, eta:'۱ تا ۲ روز کاری', requiresAddress:false }
];
const checkoutConfig = () => ({ freeShippingThreshold: env.freeShippingThreshold, currency: 'IRT', maxQuantityPerItem: 5, shippingMethods: shippingMethods() });
const methodAvailable = (method, address) => !method.province || (address?.province === method.province && address?.city === method.city);

/**
 * پیش‌فاکتور کامل سبد. اگر strictCoupon=false باشد، خطای کد تخفیف به‌جای throw در couponError برمی‌گردد (برای نمایش در سبد).
 */
async function quote({ items, shippingMethodId = 'standard', address = null, discountCode = '', userId = null, mobile = '', strictCoupon = true, lenient = false }) {
  const lines = await validateAndPriceCart(items, { lenient });
  const problems = lines.problems || [];
  const methods = shippingMethods();
  const selected = methods.find(method => method.id === shippingMethodId);
  if (!selected) throw new AppError(400, 'روش ارسال معتبر نیست');
  if (address && !methodAvailable(selected, address)) throw new AppError(400, 'ارسال سریع فقط برای شهر تهران فعال است');
  const subtotal = lines.reduce((sum, l) => sum + Number(l.previousPrice || l.currentPrice) * l.quantity, 0);
  const merchandiseSubtotal = lines.reduce((sum, l) => sum + Number(l.currentPrice) * l.quantity, 0);
  const productDiscount = Math.max(0, subtotal - merchandiseSubtotal);
  const effectivePrice = method => (method.freeOverThreshold && merchandiseSubtotal >= env.freeShippingThreshold ? 0 : method.price);
  let shipping = effectivePrice(selected);
  let couponResult = { coupon: null, discount: 0, shipping }; let couponError = '';
  try { if (lines.length) couponResult = await evaluateCoupon(discountCode, { lines, merchandiseSubtotal, shipping, shippingMethodId: selected.id, userId, mobile }); }
  catch (error) { if (strictCoupon || !(error instanceof AppError)) throw error; couponError = error.message; }
  shipping = couponResult.shipping;
  const couponDiscount = couponResult.discount;
  const total = Math.max(0, merchandiseSubtotal - couponDiscount + shipping);
  return {
    lines, problems, selected, subtotal, merchandiseSubtotal, productDiscount, couponDiscount, shipping, total, coupon: couponResult.coupon, couponError,
    remainingForFreeShipping: Math.max(0, env.freeShippingThreshold - merchandiseSubtotal),
    shippingOptions: methods.map(method => ({ ...method, effectivePrice: effectivePrice(method), available: methodAvailable(method, address) }))
  };
}

const quoteView = q => ({
  amounts: { subtotal: q.subtotal, merchandiseSubtotal: q.merchandiseSubtotal, productDiscount: q.productDiscount, couponDiscount: q.couponDiscount, shipping: q.shipping, total: q.total },
  problems: q.problems || [], remainingForFreeShipping: q.remainingForFreeShipping, freeShippingThreshold: env.freeShippingThreshold,
  shippingMethod: q.selected, shippingOptions: q.shippingOptions, coupon: couponView(q.coupon), couponError: q.couponError,
  lines: q.lines.map(l => ({ productId: l.product.publicId, name: l.product.name, image: l.product.image, color: l.color, colorIndex: l.colorIndex, size: l.size, quantity: l.quantity, available: l.available, unitPrice: l.currentPrice, previousPrice: l.previousPrice, lineTotal: l.currentPrice * l.quantity }))
});

module.exports = { shippingMethods, checkoutConfig, methodAvailable, quote, quoteView };
