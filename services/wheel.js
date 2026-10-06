// چرخونه شانس: تنها منبع جایزه‌ها؛ هر جایزه تخفیفی به یک کد شخصی واقعی و قابل استفاده در تسویه حساب تبدیل می‌شود.
const crypto = require('crypto');
const Coupon = require('../models/Coupon');
const WheelSpin = require('../models/WheelSpin');
const User = require('../models/User');
const { AppError } = require('../utils/http');
const { tehranDayKey, faLongDate } = require('../utils/formatters');
const { addPoints } = require('./loyalty');

const DAY = 86400000;
// ترتیب آرایه = ترتیب خانه‌های چرخونه در فرانت‌اند
const PRIZES = [
  { id:'discount-5', title:'۵٪ تخفیف', short:'۵٪', type:'discount', value:5, weight:24, expiresInDays:7, condition:'خرید بالای ۱٬۵۰۰٬۰۰۰ تومان', coupon:{ type:'percent', value:5, minSubtotal:1500000 } },
  { id:'discount-10', title:'۱۰٪ تخفیف', short:'۱۰٪', type:'discount', value:10, weight:10, expiresInDays:5, condition:'خرید بالای ۲٬۵۰۰٬۰۰۰ تومان، سقف تخفیف ۴۰۰ هزار تومان', coupon:{ type:'percent', value:10, minSubtotal:2500000, maxDiscount:400000 } },
  { id:'points-150', title:'۱۵۰ امتیاز توتو', short:'۱۵۰ امتیاز', type:'points', value:150, weight:20, expiresInDays:null, condition:'امتیاز بلافاصله به موجودی باشگاه مشتریان افزوده می‌شود' },
  { id:'free-shipping', title:'ارسال رایگان', short:'ارسال رایگان', type:'shipping', value:0, weight:16, expiresInDays:7, condition:'ویژه ارسال استاندارد', coupon:{ type:'shipping', shippingMethods:['standard'] } },
  { id:'category-bag', title:'۱۲٪ تخفیف کیف', short:'تخفیف کیف', type:'category', value:12, weight:8, expiresInDays:7, condition:'قابل استفاده برای گروه کیف‌های بدون تخفیف', coupon:{ type:'category', value:12, category:'کیف', onlyNonDiscounted:true } },
  { id:'double-points', title:'امتیاز دوبرابر امروز', short:'امتیاز ×۲', type:'multiplier', value:2, weight:7, expiresInDays:0, condition:'برای خریدهایی که تا پایان امروز پرداخت شوند خودکار اعمال می‌شود' },
  { id:'no-reward', title:'امروز هدیه‌ای ثبت نشد', short:'فرصت فردا', type:'none', value:0, weight:15, expiresInDays:0, condition:'فردا دوباره می‌توانید شانس خود را امتحان کنید' }
];
const publicPrize = prize => ({ id:prize.id, title:prize.title, short:prize.short, type:prize.type, value:prize.value, expiresInDays:prize.expiresInDays, condition:prize.condition });

// پایان روز جاری به وقت تهران (UTC+03:30)
const endOfTehranDay = (now = new Date()) => new Date(Date.parse(`${tehranDayKey(now)}T00:00:00+03:30`) + DAY);
const pickPrize = () => {
  const total = PRIZES.reduce((sum, prize) => sum + prize.weight, 0);
  let roll = crypto.randomInt(total);
  for (const prize of PRIZES) { if (roll < prize.weight) return prize; roll -= prize.weight; }
  return PRIZES[PRIZES.length - 1];
};
const spinView = spin => spin ? ({
  id: String(spin._id), date: spin.dayKey, reward: publicPrize(PRIZES.find(p => p.id === spin.prizeId) || spin.prize), code: spin.couponCode || '',
  expiresAt: spin.expiresAt, expiresAtLabel: spin.expiresAt ? faLongDate(spin.expiresAt) : '', issuedAt: spin.createdAt
}) : null;

async function wheelState(userId, now = new Date()) {
  const dayKey = tehranDayKey(now);
  const [spin, user] = await Promise.all([WheelSpin.findOne({ user: userId, dayKey }), User.findById(userId).select('wheelLastDate')]);
  const usedToday = Boolean(spin) || user?.wheelLastDate === dayKey;
  return { prizes: PRIZES.map(publicPrize), usedToday, today: spinView(spin), nextSpinAt: endOfTehranDay(now) };
}

async function makeCouponCode() {
  for (let i = 0; i < 6; i += 1) {
    const code = `WHEEL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    if (!(await Coupon.exists({ code }))) return code;
  }
  throw new AppError(500, 'ساخت کد پاداش انجام نشد');
}

async function spin(userId, now = new Date()) {
  const dayKey = tehranDayKey(now);
  const user = await User.findById(userId).select('wheelLastDate');
  if (user?.wheelLastDate === dayKey) throw new AppError(429, 'امروز یک‌بار از چرخونه استفاده کرده‌اید');
  const prize = pickPrize();
  const expiresAt = prize.expiresInDays === null ? null : prize.expiresInDays === 0 ? endOfTehranDay(now) : new Date(now.getTime() + prize.expiresInDays * DAY);
  let record;
  // ایندکس یکتای (user, dayKey) از چرخش دوباره حتی در درخواست‌های هم‌زمان جلوگیری می‌کند
  try { record = await WheelSpin.create({ user: userId, dayKey, prizeId: prize.id, prize: publicPrize(prize), expiresAt: prize.type === 'none' ? null : expiresAt }); }
  catch (error) { if (error?.code === 11000) throw new AppError(429, 'امروز یک‌بار از چرخونه استفاده کرده‌اید'); throw error; }
  try {
    if (prize.coupon) {
      const code = await makeCouponCode();
      const coupon = await Coupon.create({ code, title: prize.title, condition: prize.condition, ...prize.coupon, user: userId, usageLimit: 1, perUserLimit: 1, expiresAt, source: 'wheel' });
      record.coupon = coupon._id; record.couponCode = code; await record.save();
    }
    if (prize.type === 'points') await addPoints(userId, prize.value, { title: 'جایزه چرخونه شانس', source: 'wheel', refKey: `wheel:${record._id}` });
    await User.updateOne({ _id: userId }, { $set: { wheelLastDate: dayKey } });
  } catch (error) {
    // اگر صدور جایزه ناموفق بود، چرخش ثبت‌شده حذف می‌شود تا کاربر بتواند دوباره تلاش کند
    if (record.coupon) await Coupon.deleteOne({ _id: record.coupon }).catch(() => {});
    await WheelSpin.deleteOne({ _id: record._id }).catch(() => {});
    throw error;
  }
  return { ...spinView(record), reward: publicPrize(prize), nextSpinAt: endOfTehranDay(now) };
}

module.exports = { PRIZES, publicPrize, wheelState, spin, endOfTehranDay };
