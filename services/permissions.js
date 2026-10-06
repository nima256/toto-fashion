// تعریف مرکزی مجوزها و نقش‌های مدیریتی؛ همه بررسی‌های دسترسی سمت سرور از اینجا انجام می‌شود.
const AdminSetting = require('../models/AdminSetting');

const PERMISSIONS = {
  'dashboard.view': 'مشاهده داشبورد و گزارش‌ها',
  'products.view': 'مشاهده محصولات',
  'products.edit': 'ایجاد، ویرایش و حذف محصول',
  'inventory.edit': 'ویرایش موجودی تنوع‌ها',
  'orders.view': 'مشاهده سفارش‌ها',
  'orders.edit': 'تغییر وضعیت سفارش',
  'returns.manage': 'رسیدگی به مرجوعی و تعویض',
  'customers.view': 'مشاهده مشتریان',
  'customers.edit': 'ویرایش پرونده مشتری',
  'content.edit': 'مدیریت محتوا و مجله',
  'gallery.moderate': 'تأیید گالری مشتریان',
  'reviews.moderate': 'مدیریت دیدگاه‌ها و پرسش‌ها',
  'marketing.edit': 'مدیریت کدهای تخفیف و بازاریابی',
  'reports.export': 'دریافت خروجی گزارش',
  'admins.manage': 'مدیریت مدیران و نقش‌ها'
};
const ALL = Object.keys(PERMISSIONS);

const DEFAULT_ROLES = {
  superadmin: { label: 'مدیر کل', permissions: ['*'], locked: true },
  'store-manager': { label: 'مدیر فروشگاه', permissions: ['dashboard.view','products.view','products.edit','inventory.edit','orders.view','orders.edit','returns.manage','customers.view','customers.edit','reports.export'] },
  'product-manager': { label: 'مدیر محصول', permissions: ['dashboard.view','products.view','products.edit','inventory.edit'] },
  'order-manager': { label: 'مدیر سفارش', permissions: ['dashboard.view','orders.view','orders.edit','returns.manage','products.view'] },
  'content-editor': { label: 'ویرایشگر محتوا', permissions: ['content.edit','gallery.moderate','reviews.moderate','products.view'] },
  support: { label: 'پشتیبانی مشتری', permissions: ['orders.view','customers.view','returns.manage','reviews.moderate'] },
  marketing: { label: 'مدیر بازاریابی', permissions: ['dashboard.view','marketing.edit','customers.view','reports.export'] }
};
// نگاشت مجوزهای قدیمی ذخیره‌شده از رابط کاربری قبلی (role:* با مقادیر products/orders/...)
const LEGACY_MAP = {
  products: ['products.view','products.edit','inventory.edit'], orders: ['orders.view','orders.edit','returns.manage'],
  customers: ['customers.view'], content: ['content.edit','reviews.moderate'], reports: ['dashboard.view','reports.export'], gallery: ['gallery.moderate']
};
const normalizePermissions = list => [...new Set((Array.isArray(list) ? list : []).flatMap(item => item === '*' ? ['*'] : LEGACY_MAP[item] || (PERMISSIONS[item] ? [item] : [])))];

async function getRoles() {
  const overrides = await AdminSetting.find({ key: /^role:/ }).lean();
  const byId = Object.fromEntries(overrides.map(item => [item.key.slice(5), item.value]));
  return Object.entries(DEFAULT_ROLES).map(([id, role]) => ({
    id, label: role.label, locked: Boolean(role.locked),
    permissions: role.locked ? ['*'] : (byId[id]?.permissions ? normalizePermissions(byId[id].permissions) : role.permissions)
  }));
}

async function effectivePermissions(admin) {
  if (!admin) return [];
  const own = normalizePermissions(admin.permissions);
  if (own.includes('*') || admin.role === 'superadmin') return ['*'];
  const role = (await getRoles()).find(item => item.id === admin.role);
  return [...new Set([...(role?.permissions || []), ...own])];
}
const can = (permissions, needed) => permissions.includes('*') || permissions.includes(needed);

module.exports = { PERMISSIONS, ALL, DEFAULT_ROLES, normalizePermissions, getRoles, effectivePermissions, can };
