// وضعیت حساب در مرورگر فقط «کش» آخرین پاسخ سرور است. منبع اصلی ورود، نشست کوکی سرور (/api/auth/me) است
// و هیچ داده نمونه‌ای برای کاربر واقعی نمایش داده نمی‌شود.
import { localStore } from './storage.js';

const clone = value => JSON.parse(JSON.stringify(value));
const SESSION_KEY = 'toto-session';
const USER_KEYS = ['toto-session', 'toto-account', 'toto-orders', 'toto-addresses', 'toto-saved', 'toto-saved-owner', 'toto-last-order', 'toto-checkout', 'toto-checkout-draft', 'toto-discount-code', 'toto-wheel-state', 'toto-customer-gallery', 'toto-admin-management', 'toto-admin-role-permissions'];

export const emptyAccount = () => ({
  profile: { firstName: '', lastName: '', mobile: '', email: '', birthday: '', completed: 0 },
  loyalty: { points: 0, lifetimePoints: 0, level: 'member', transactions: [] },
  rewards: [], availabilityAlerts: [], returns: [], addresses: [], gallery: [], wheel: null,
  notifications: { orderSms: true, stockSms: true, campaignSms: true, loyaltySms: true, emailMagazine: false }
});

export const getSession = () => {
  const session = localStore.get(SESSION_KEY, null);
  return session?.authenticated && session?.customer ? session : null;
};

export const setSessionFromServer = me => {
  if (!me?.authenticated || !me.user) {
    // فقط اگر قبلاً کاربری وارد بوده (نشست سرور منقضی/خارج شده) داده‌های شخصی پاک می‌شود؛ داده‌های مهمان (سبد و تسویه) دست نمی‌خورد
    if (getSession()) clearLocalAccountData(); else localStore.remove(SESSION_KEY);
    return null;
  }
  const previous = getSession();
  if (previous && previous.customer.id !== me.user.id) clearLocalAccountData();
  const session = { authenticated: true, customer: { id: me.user.id, firstName: me.user.firstName || 'کاربر توتو', mobile: me.user.mobile }, syncedAt: new Date().toISOString() };
  localStore.set(SESSION_KEY, session);
  return session;
};

// پاک‌کردن همه داده‌های شخصی کش‌شده هنگام خروج یا تعویض حساب (برای دستگاه‌های مشترک)
export const clearLocalAccountData = () => { USER_KEYS.forEach(key => localStore.remove(key)); };

/**
 * همگام‌سازی وضعیت ورود با سرور در شروع هر صفحه. اگر سرور در دسترس نباشد، کش قبلی حفظ می‌شود
 * ولی درخواست‌های محافظت‌شده همچنان توسط سرور بررسی می‌شوند.
 */
export const syncSession = async api => {
  try { const me = await api.me(); return { session: setSessionFromServer(me), me, offline: false }; }
  catch (error) { if (error.status === 401) { setSessionFromServer(null); return { session: null, me: null, offline: false }; } return { session: getSession(), me: null, offline: true }; }
};

export const getAccountData = () => localStore.get('toto-account', null) || emptyAccount();

export const saveAccountData = data => {
  localStore.set('toto-account', data);
  document.dispatchEvent(new CustomEvent('toto:account-updated', { detail: data }));
  return data;
};

export const getOrders = () => { const stored = localStore.get('toto-orders', []); return Array.isArray(stored) ? stored : []; };
export const setOrders = orders => { const next = Array.isArray(orders) ? clone(orders) : []; localStore.set('toto-orders', next); return next; };

// ساخت کامل حساب از پاسخ سرور؛ هیچ مقدار پیش‌فرض نمونه‌ای ادغام نمی‌شود
export const hydrateAccountFromServer = payload => {
  const user = payload?.user || {};
  const account = emptyAccount();
  account.profile = { firstName: user.firstName || '', lastName: user.lastName || '', mobile: user.mobile || '', email: user.email || '', birthday: user.birthday || '', completed: user.email && user.birthday && user.firstName ? 100 : (user.firstName || user.lastName ? 70 : 40) };
  account.loyalty = { points: Number(payload?.loyalty?.points || 0), lifetimePoints: Number(payload?.loyalty?.lifetimePoints || 0), level: payload?.loyalty?.level || 'member', transactions: payload?.loyalty?.transactions || [] };
  account.rewards = payload?.rewards || [];
  account.availabilityAlerts = payload?.availabilityAlerts || [];
  account.returns = payload?.returns || [];
  account.addresses = user.addresses || [];
  account.gallery = payload?.gallery || [];
  account.wheel = payload?.wheel || null;
  account.notifications = { ...account.notifications, ...(user.notifications || {}) };
  saveAccountData(account);
  if (Array.isArray(payload?.orders)) setOrders(payload.orders);
  return account;
};

export const getOrderById = id => getOrders().find(order => order.id === id || order.orderNumber === id);

export const updateAccount = updater => {
  const current = getAccountData();
  const next = updater(clone(current)) || current;
  return saveAccountData(next);
};
