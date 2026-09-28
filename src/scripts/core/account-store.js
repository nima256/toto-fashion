import { defaultAccount, mockOrders } from '../../data/account-data.js';
import { localStore } from './storage.js';

const clone = value => JSON.parse(JSON.stringify(value));

export const ensureDemoSession = () => {
  const query = new URLSearchParams(location.search);
  if (query.get('demo') !== '1' || localStore.get('toto-session', null)) return;
  localStore.set('toto-session', {
    token: 'mock-token-demo',
    customer: { id: 'customer-demo', firstName: 'سارا', mobile: '09121234567' },
    loggedInAt: new Date().toISOString()
  });
};

export const getSession = () => localStore.get('toto-session', null);

export const getAccountData = () => {
  const stored = localStore.get('toto-account', null);
  if (stored) return stored;
  const initial = clone(defaultAccount);
  localStore.set('toto-account', initial);
  return initial;
};

export const saveAccountData = data => {
  localStore.set('toto-account', data);
  document.dispatchEvent(new CustomEvent('toto:account-updated', { detail: data }));
  return data;
};

export const getOrders = () => {
  const stored = localStore.get('toto-orders', null);
  if (stored?.length) return stored;
  const initial = clone(mockOrders);
  localStore.set('toto-orders', initial);
  return initial;
};

export const setOrders = orders => {
  const next = Array.isArray(orders) ? clone(orders) : [];
  localStore.set('toto-orders', next);
  return next;
};

export const hydrateAccountFromServer = payload => {
  const account = getAccountData();
  const user = payload?.user || payload;
  if (user) {
    const points = Number(user.loyalty?.points || 0);
    const level = points >= 10000 ? 'special' : points >= 5000 ? 'gold' : points >= 1500 ? 'silver' : 'member';
    account.profile = { ...account.profile, firstName:user.firstName || '', lastName:user.lastName || '', mobile:user.mobile || account.profile.mobile, email:user.email || '', birthday:user.birthday || '', completed:user.email && user.birthday ? 100 : (user.firstName || user.lastName ? 80 : 50) };
    account.loyalty = { ...account.loyalty, points, level };
    if (Array.isArray(user.addresses)) account.addresses = user.addresses;
    if (user.notifications) account.notifications = { ...account.notifications, orderSms:user.notifications.sms !== false, campaignSms:user.notifications.offers !== false, stockSms:user.notifications.restock !== false };
  }
  if (Array.isArray(payload?.returns)) account.returns = payload.returns;
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

export const addReturnRequest = request => updateAccount(account => {
  account.returns.unshift(request);
  return account;
});
