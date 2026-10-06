const User = require('../models/User');
const Order = require('../models/Order');
const PointsTransaction = require('../models/PointsTransaction');
const WheelSpin = require('../models/WheelSpin');

const POINTS_PER_TOMAN = 1 / 10000;

// ثبت امتیاز با کلید یکتا؛ اگر همان رویداد دوباره برسد امتیاز تکراری اضافه نمی‌شود
async function addPoints(userId, points, { title, source, refKey, type = 'earn' }) {
  if (!userId || !points) return { added: false };
  try { await PointsTransaction.create({ user: userId, points, type, title, source, refKey }); }
  catch (error) { if (error?.code === 11000) return { added: false, reason: 'duplicate' }; throw error; }
  const inc = { 'loyalty.points': points };
  if (points > 0) inc['loyalty.lifetimePoints'] = points;
  await User.updateOne({ _id: userId }, { $inc: inc });
  return { added: true };
}

async function activeMultiplier(userId, at = new Date()) {
  const spin = await WheelSpin.findOne({ user: userId, prizeId: 'double-points', createdAt: { $lte: at }, expiresAt: { $gt: at } }).lean();
  return spin ? Number(spin.prize?.value || 2) : 1;
}

async function awardOrderPoints(orderId) {
  const order = await Order.findById(orderId);
  if (!order || order.loyaltyState !== 'pending' || order.paymentStatus !== 'paid') return { awarded: false };
  if (!order.user) { await Order.updateOne({ _id: order._id, loyaltyState: 'pending' }, { $set: { loyaltyState: 'skipped' } }); return { awarded: false, reason: 'guest' }; }
  const multiplier = await activeMultiplier(order.user, order.paymentInfo?.paidAt || order.createdAt);
  const points = Math.floor(Number(order.total || 0) * POINTS_PER_TOMAN) * multiplier;
  const claim = await Order.updateOne({ _id: order._id, loyaltyState: 'pending' }, { $set: { loyaltyState: points ? 'awarded' : 'skipped', loyaltyPoints: points } });
  if (!claim.modifiedCount || !points) return { awarded: false };
  await addPoints(order.user, points, { title: `خرید سفارش ${order.orderNumber}${multiplier > 1 ? ' (امتیاز دوبرابر)' : ''}`, source: 'order', refKey: `order:${order._id}` });
  return { awarded: true, points };
}

module.exports = { addPoints, awardOrderPoints, activeMultiplier };
