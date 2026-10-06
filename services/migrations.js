// مهاجرت‌های امن و idempotent که هنگام راه‌اندازی (و با npm run migrate) اجرا می‌شوند.
const env = require('../config/env');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Article = require('../models/Article');
const AdminSetting = require('../models/AdminSetting');
const { buildDefaultVariants } = require('./inventory');
const { ensureDefaultCoupons } = require('./coupons');
const seedContent = require('../data/seed-content.json');

const MIGRATIONS_KEY = 'system:migrations';
async function appliedMigrations() { return new Set((await AdminSetting.findOne({ key: MIGRATIONS_KEY }).lean())?.value?.applied || []); }
async function markApplied(id) { await AdminSetting.updateOne({ key: MIGRATIONS_KEY }, { $addToSet: { 'value.applied': id } }, { upsert: true }); }

// ۱) ساخت تنوع رنگ×سایز برای محصولاتی که فقط موجودی کلی داشتند؛ موجودی کل حفظ می‌شود
async function migrateProductVariants() {
  const products = await Product.find({ $or: [{ variants: { $exists: false } }, { variants: { $size: 0 } }] });
  for (const product of products) {
    // سایزهای ناموجود قدیمی به‌عنوان تنوع با موجودی صفر حفظ می‌شوند تا ثبت هشدار موجودی برایشان ممکن باشد
    const extra = (product.unavailableSizes || []).filter(size => !(product.sizes || []).includes(size));
    if (extra.length) product.sizes = [...(product.sizes || []), ...extra];
    product.variants = buildDefaultVariants(product, Number(product.inventory || 0));
    await product.save();
  }
  return products.length;
}

// ۲) پرچم‌های عملیات پس از پرداخت برای سفارش‌های قدیمی تا هیچ اثری دوباره اعمال نشود
async function migrateOrderFlags() {
  const legacyPaid = { paymentStatus: 'paid', inventoryState: { $exists: false } };
  await Order.updateMany({ ...legacyPaid, inventoryApplied: true }, { $set: { inventoryState: 'applied' } });
  await Order.updateMany({ ...legacyPaid, inventoryApplied: { $ne: true } }, { $set: { inventoryState: 'failed', needsReview: true }, $push: { reviewNotes: 'سفارش قدیمی پرداخت‌شده بدون ثبت کسر موجودی؛ موجودی دستی بررسی شود.' } });
  await Order.updateMany({ paymentStatus: 'paid', loyaltyState: { $exists: false } }, { $set: { loyaltyState: 'awarded' } });
  await Order.updateMany({ paymentStatus: 'paid', paidSmsSent: { $exists: false } }, { $set: { paidSmsSent: true } });
  await Order.updateMany({ couponState: { $exists: false } }, { $set: { couponState: 'none' } });
  await Order.updateMany({ inventoryState: { $exists: false } }, { $set: { inventoryState: 'pending' } });
  await Order.updateMany({ loyaltyState: { $exists: false } }, { $set: { loyaltyState: 'pending' } });
}

// ۳) فیلدهای جدید کاربر
async function migrateUsers() {
  await User.updateMany({ 'loyalty.lifetimePoints': { $exists: false } }, [{ $set: { 'loyalty.lifetimePoints': { $ifNull: ['$loyalty.points', 0] } } }]);
  await User.updateMany({ 'notifications.loyaltySms': { $exists: false } }, { $set: { 'notifications.loyaltySms': true } });
  await User.updateMany({ 'notifications.emailMagazine': { $exists: false } }, { $set: { 'notifications.emailMagazine': false } });
  await User.updateMany({ savedProducts: { $exists: false } }, { $set: { savedProducts: [] } });
}

// ۴) انتقال محتوای مجله و تنظیمات صفحه اصلی از فایل‌های استاتیک فرانت‌اند به دیتابیس (فقط یک‌بار)
async function seedContentOnce(applied) {
  if (applied.has('content-v1')) return;
  if (!(await Article.countDocuments())) {
    await Article.insertMany(seedContent.articles.map(a => ({
      slug: a.id, category: a.category, title: a.title, excerpt: a.excerpt, image: a.image, imageAlt: a.imageAlt, intro: a.intro,
      sections: a.sections, readingTime: a.readingTime, publishedAt: a.isoDate ? new Date(a.isoDate) : new Date(), featured: Boolean(a.featured), popular: Boolean(a.popular), status: 'published'
    })));
  }
  const defaults = {
    'content:announcement': { status: 'published', text: 'خریدهای بالای {freeShippingThreshold} ارسال رایگان دارند', linkLabel: 'مشاهده تخفیف‌ها', href: './shop?discount=1' },
    'content:hero': { status: 'published', slides: seedContent.heroSlides },
    'content:offer': { status: 'published', eyebrow: 'پیشنهاد محدود', title: 'آفر تایم', description: 'انتخاب‌های محدود این هفته با قیمت ویژه.', endAt: '2026-12-30T23:59:59+03:30' },
    'content:faq': { status: 'published', groups: seedContent.faqGroups }
  };
  for (const [key, value] of Object.entries(defaults)) await AdminSetting.updateOne({ key }, { $setOnInsert: { key, value } }, { upsert: true });
  await markApplied('content-v1');
}

// ۵) امتیاز و تعداد دیدگاه محصولات از این پس فقط از دیدگاه‌های تأییدشده واقعی محاسبه می‌شود (اعداد نمونه قبلی حذف می‌شوند)
async function recomputeRatingsOnce(applied) {
  if (applied.has('ratings-from-reviews-v1')) return;
  const Review = require('../models/Review');
  const stats = await Review.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: '$productId', count: { $sum: 1 }, avg: { $avg: '$rating' } } }]);
  await Product.updateMany({}, { $set: { rating: 0, reviewCount: 0 } });
  for (const item of stats) await Product.updateOne({ publicId: item._id }, { $set: { rating: Number(item.avg.toFixed(1)), reviewCount: item.count } });
  await markApplied('ratings-from-reviews-v1');
}

// ۶) گالری: تصویر تکی ارسال‌های قدیمی به آرایه images منتقل می‌شود (وضعیت قبلی حفظ می‌شود)
async function migrateGalleryImages() {
  const GalleryPost = require('../models/GalleryPost');
  const legacy = await GalleryPost.find({ 'image.filename': { $exists: true, $ne: null }, 'images.0': { $exists: false } });
  for (const post of legacy) {
    post.images = [{ filename: post.image.filename, mimeType: post.image.mimeType || '', size: post.image.size || 0, status: post.status, rejectionReason: post.rejectionReason || '', moderatedBy: post.moderatedBy, moderatedAt: post.moderatedAt }];
    await post.save();
  }
  return legacy.length;
}

async function runMigrations({ log = true } = {}) {
  const applied = await appliedMigrations();
  const variants = await migrateProductVariants();
  await migrateOrderFlags();
  await migrateUsers();
  await ensureDefaultCoupons();
  await seedContentOnce(applied);
  await recomputeRatingsOnce(applied);
  await migrateGalleryImages();
  if (log && variants) console.log(`[migrate] variant inventory created for ${variants} product(s)`);
  if (log && env.paymentMock) console.warn('[payment] PAYMENT_MOCK=true — پرداخت آزمایشی فعال است و هیچ وجهی دریافت نمی‌شود.');
  return { variants };
}

module.exports = { runMigrations, migrateProductVariants };
