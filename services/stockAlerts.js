// اطلاع‌رسانی موجودشدن دوباره یک تنوع (رنگ/سایز) به کاربرانی که هشدار ثبت کرده‌اند
const StockAlert = require('../models/StockAlert');
const User = require('../models/User');
const env = require('../config/env');
const { sendPatternSmsWithBodyId } = require('./sms');

async function notifyRestocked(product, previousVariants = []) {
  const before = new Map(previousVariants.map(v => [`${v.color || ''}\u0000${v.size || ''}`, Number(v.stock || 0)]));
  const restocked = (product.variants || []).filter(v => Number(v.stock) > 0 && !(before.get(`${v.color || ''}\u0000${v.size || ''}`) > 0));
  let notified = 0;
  for (const variant of restocked) {
    const alerts = await StockAlert.find({ productId: product.publicId, color: variant.color || '', size: variant.size || '', status: 'waiting' });
    for (const alert of alerts) {
      // ادعای اتمیک تا هر هشدار فقط یک‌بار ارسال شود
      const claimed = await StockAlert.findOneAndUpdate({ _id: alert._id, status: 'waiting' }, { $set: { status: 'notified', notifiedAt: new Date() } });
      if (!claimed) continue;
      notified += 1;
      const user = await User.findById(alert.user).select('mobile notifications isActive');
      if (!user?.isActive || user.notifications?.restock === false) continue;
      if (env.melipayamakRestockBodyId) sendPatternSmsWithBodyId(user.mobile, [product.name, [variant.color, variant.size].filter(Boolean).join(' ')], env.melipayamakRestockBodyId).catch(error => console.error('[stock-alert] sms failed', error.message));
      else if (!env.isProduction) console.log(`[DEV RESTOCK] ${product.publicId} ${variant.color}/${variant.size} -> user ${String(user._id)}`);
    }
  }
  return { notified };
}
module.exports = { notifyRestocked };
