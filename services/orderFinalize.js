// جداسازی «تأیید پرداخت» از «عملیات پس از پرداخت».
// وقتی پرداخت تأیید شد، هیچ خطای ثانویه (موجودی، امتیاز، کد تخفیف، پیامک) نمی‌تواند سفارش را payment-failed کند.
const Order = require('../models/Order');
const { applyInventory } = require('./inventory');
const { awardOrderPoints } = require('./loyalty');
const { redeemOrderCoupon } = require('./coupons');
const { sendOrderRegisteredSms } = require('./sms');

const timelineEntry = (status, label, detail = '') => ({ status, label, date: new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date()), detail });

// انتقال اتمیک به وضعیت پرداخت‌شده؛ اگر سفارش قبلاً پرداخت شده باشد null برمی‌گرداند (callback تکراری)
async function markOrderPaid(orderId, { refId = '', cardPan = '', detail = 'پرداخت اینترنتی با موفقیت تأیید شد.' } = {}) {
  return Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $ne: 'paid' } },
    {
      $set: { paymentStatus: 'paid', status: 'processing', 'paymentInfo.refId': refId, 'paymentInfo.cardPan': cardPan, 'paymentInfo.paidAt': new Date(), 'paymentInfo.lastError': '' },
      $push: { timeline: { $each: [timelineEntry('paid', 'پرداخت تأیید شد', detail), timelineEntry('processing', 'آماده‌سازی سفارش', 'سفارش برای آماده‌سازی وارد صف شد.')] } }
    },
    { new: true }
  );
}

// فقط سفارش‌هایی که هنوز پرداخت نشده‌اند به payment-failed می‌روند
async function markOrderFailed(orderId, { label = 'پرداخت ناموفق بود', detail = '', error = '' } = {}) {
  return Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $nin: ['paid', 'refunded'] } },
    { $set: { paymentStatus: 'failed', status: 'payment-failed', 'paymentInfo.failedAt': new Date(), 'paymentInfo.lastError': String(error).slice(0, 300) }, $push: { timeline: timelineEntry('payment-failed', label, detail) } },
    { new: true }
  );
}

async function flag(orderId, note, extra = {}) {
  await Order.updateOne({ _id: orderId }, { $set: { needsReview: true, ...extra.$set }, $push: { reviewNotes: note, ...(extra.timeline ? { timeline: extra.timeline } : {}) } }).catch(error => console.error('[order] flag failed', error.message));
}

// همه مراحل idempotent هستند؛ اجرای دوباره (مثلاً callback تکراری) اثر جانبی تکراری ایجاد نمی‌کند
async function runPostPaymentTasks(orderId) {
  const results = {};
  try { results.inventory = await applyInventory(orderId); }
  catch (error) {
    results.inventory = { error: error.message };
    console.error('[order] inventory after payment failed', String(orderId), error.message);
    await flag(orderId, `پرداخت موفق بوده اما کسر موجودی انجام نشد: ${error.message}`, { $set: { status: 'paid' }, timeline: timelineEntry('paid', 'نیازمند بررسی موجودی', 'پرداخت موفق بوده و تیم فروش موجودی را بررسی می‌کند.') });
  }
  try { results.coupon = await redeemOrderCoupon(orderId); }
  catch (error) { results.coupon = { error: error.message }; console.error('[order] coupon redemption failed', String(orderId), error.message); await flag(orderId, `ثبت مصرف کد تخفیف: ${error.message}`); }
  try { results.loyalty = await awardOrderPoints(orderId); }
  catch (error) { results.loyalty = { error: error.message }; console.error('[order] loyalty award failed', String(orderId), error.message); await flag(orderId, `ثبت امتیاز باشگاه انجام نشد: ${error.message}`); }
  try {
    const order = await Order.findOneAndUpdate({ _id: orderId, paidSmsSent: false, paymentStatus: 'paid' }, { $set: { paidSmsSent: true } }, { new: true });
    if (order) sendOrderRegisteredSms(order).catch(error => console.error('[order] sms failed', error.message));
  } catch (error) { console.error('[order] sms claim failed', error.message); }
  return results;
}

module.exports = { timelineEntry, markOrderPaid, markOrderFailed, runPostPaymentTasks };
