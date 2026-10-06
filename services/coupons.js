// منبع واحد قوانین کد تخفیف؛ هم برای پیش‌فاکتور، هم ثبت سفارش و هم پاداش‌های چرخونه
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const { AppError } = require('../utils/http');
const { faLongDate } = require('../utils/formatters');

const DEFAULT_COUPONS = [
  { code:'TOTO10', title:'۱۰٪ تخفیف', condition:'۱۰٪ تخفیف تا سقف ۵۰۰ هزار تومان', type:'percent', value:10, maxDiscount:500000, source:'seed' },
  { code:'NEWTOTO', title:'تخفیف خرید اول', condition:'۲۵۰ هزار تومان تخفیف خرید اول؛ حداقل خرید ۱٫۸ میلیون تومان', type:'fixed', value:250000, minSubtotal:1800000, firstOrderOnly:true, source:'seed' },
  { code:'FREESHIP', title:'ارسال رایگان', condition:'هزینه ارسال سفارش رایگان می‌شود', type:'shipping', value:0, source:'seed' }
];
async function ensureDefaultCoupons() {
  for (const coupon of DEFAULT_COUPONS) await Coupon.updateOne({ code: coupon.code }, { $setOnInsert: coupon }, { upsert: true });
}

const fa = value => Number(value || 0).toLocaleString('fa-IR');
const normalizeCode = code => String(code || '').trim().toUpperCase().replace(/\s+/g, '');

// بررسی کامل کد تخفیف؛ در صورت نامعتبر بودن خطای ۴۰۰ با پیام فارسی برمی‌گرداند
async function evaluateCoupon(rawCode, { lines, merchandiseSubtotal, shipping, shippingMethodId, userId = null, mobile = '', now = new Date() }) {
  const code = normalizeCode(rawCode);
  if (!code) return { coupon: null, discount: 0, shipping };
  if (!/^[A-Z0-9-]{3,40}$/.test(code)) throw new AppError(400, 'کد تخفیف معتبر نیست');
  const coupon = await Coupon.findOne({ code });
  if (!coupon || !coupon.isActive) throw new AppError(400, 'کد تخفیف معتبر نیست');
  if (coupon.startsAt && coupon.startsAt > now) throw new AppError(400, 'زمان استفاده از این کد هنوز شروع نشده است');
  if (coupon.expiresAt && coupon.expiresAt <= now) throw new AppError(400, 'مهلت استفاده از این کد به پایان رسیده است');
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new AppError(400, 'ظرفیت استفاده از این کد تکمیل شده است');
  if (coupon.user) {
    if (!userId) throw new AppError(401, 'این کد شخصی است؛ برای استفاده وارد حساب خود شوید');
    if (String(coupon.user) !== String(userId)) throw new AppError(400, 'این کد متعلق به حساب دیگری است');
  }
  if (coupon.perUserLimit) {
    const used = coupon.redemptions.filter(r => (userId && String(r.user) === String(userId)) || (mobile && r.mobile === mobile)).length;
    if (used >= coupon.perUserLimit) throw new AppError(400, 'سقف استفاده شما از این کد تکمیل شده است');
  }
  if (coupon.firstOrderOnly) {
    const or = [...(userId ? [{ user: userId }] : []), ...(mobile ? [{ mobile }] : [])];
    if (!or.length) throw new AppError(400, 'این کد فقط برای خرید اول است؛ ابتدا اطلاعات گیرنده را ثبت کنید');
    if (await Order.exists({ $or: or, paymentStatus: 'paid' })) throw new AppError(400, 'این کد فقط برای خرید اول قابل استفاده است');
  }
  if (coupon.shippingMethods?.length && !coupon.shippingMethods.includes(shippingMethodId)) throw new AppError(400, 'این کد برای روش ارسال انتخاب‌شده معتبر نیست');
  if (coupon.minSubtotal && merchandiseSubtotal < coupon.minSubtotal) throw new AppError(400, `حداقل خرید برای این کد ${fa(coupon.minSubtotal)} تومان است`);

  let base = merchandiseSubtotal;
  if (coupon.type === 'category' || coupon.onlyNonDiscounted) {
    base = lines.filter(line => (!coupon.category || line.product.category === coupon.category) && (!coupon.onlyNonDiscounted || !(line.previousPrice > line.currentPrice)))
      .reduce((sum, line) => sum + line.currentPrice * line.quantity, 0);
    if (!base) throw new AppError(400, coupon.category ? `این کد فقط برای محصولات ${coupon.category}${coupon.onlyNonDiscounted ? ' بدون تخفیف' : ''} است` : 'این کد فقط برای محصولات بدون تخفیف است');
  }
  let discount = 0; let nextShipping = shipping;
  if (coupon.type === 'percent' || coupon.type === 'category') discount = Math.round(base * coupon.value / 100);
  if (coupon.type === 'fixed') discount = Math.min(coupon.value, base);
  if (coupon.type === 'shipping') { if (!shipping) throw new AppError(400, 'هزینه ارسال این سفارش از قبل رایگان است'); nextShipping = 0; }
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.max(0, Math.min(discount, merchandiseSubtotal));
  return { coupon, discount, shipping: nextShipping };
}

const couponView = coupon => coupon ? ({
  code: coupon.code, title: coupon.title, label: coupon.condition || coupon.title, type: coupon.type, value: coupon.value,
  minSubtotal: coupon.minSubtotal || 0, maxDiscount: coupon.maxDiscount || null, category: coupon.category || '',
  expiresAt: coupon.expiresAt, expiresAtLabel: coupon.expiresAt ? faLongDate(coupon.expiresAt) : '', personal: Boolean(coupon.user)
}) : null;

// ثبت مصرف کد پس از پرداخت موفق؛ برای هر سفارش فقط یک‌بار
async function redeemOrderCoupon(orderId) {
  const order = await Order.findOneAndUpdate({ _id: orderId, couponState: 'pending' }, { $set: { couponState: 'redeemed' } }, { new: true });
  if (!order || !order.coupon) return { redeemed: false };
  const result = await Coupon.updateOne(
    { _id: order.coupon, 'redemptions.order': { $ne: order._id }, $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
    { $inc: { usedCount: 1 }, $push: { redemptions: { order: order._id, user: order.user, mobile: order.mobile, at: new Date() } } }
  );
  if (!result.modifiedCount) {
    const already = await Coupon.exists({ _id: order.coupon, 'redemptions.order': order._id });
    if (already) return { redeemed: false, reason: 'already' };
    await Order.updateOne({ _id: order._id }, { $set: { couponState: 'failed' } });
    throw new AppError(409, `ظرفیت کد ${order.couponCode} پیش از نهایی‌شدن پرداخت تکمیل شده بود`);
  }
  return { redeemed: true };
}

module.exports = { DEFAULT_COUPONS, ensureDefaultCoupons, evaluateCoupon, couponView, redeemOrderCoupon, normalizeCode };
