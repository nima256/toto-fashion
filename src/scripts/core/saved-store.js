// فهرست علاقه‌مندی/ذخیره برای بعد. برای کاربر واردشده در حساب (سرور) ذخیره می‌شود و بین دستگاه‌ها همگام است؛
// برای مهمان در مرورگر می‌ماند و پس از ورود با حساب ادغام می‌شود.
import { localStore } from './storage.js';
import { api } from '../services/api.js';
import { getSession } from './account-store.js';

const KEY = 'toto-saved';
const OWNER_KEY = 'toto-saved-owner';
export const getSavedIds = () => { const ids = localStore.get(KEY, []); return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []; };
const setLocal = (ids, owner) => {
  localStore.set(KEY, [...new Set(ids)]);
  if (owner) localStore.set(OWNER_KEY, owner);
  document.dispatchEvent(new CustomEvent('toto:saved-updated', { detail: ids }));
  return ids;
};
export const isSaved = id => getSavedIds().includes(id);

export async function setSaved(id, shouldSave) {
  const session = getSession();
  if (session) return setLocal(shouldSave ? await api.addSaved(id) : await api.removeSaved(id), session.customer.id);
  const ids = getSavedIds();
  return setLocal(shouldSave ? [...ids, id] : ids.filter(item => item !== id), 'guest');
}
export const toggleSaved = async id => { const next = !isSaved(id); await setSaved(id, next); return next; };

// پس از همگام‌سازی نشست: فهرست مهمان با حساب ادغام می‌شود و فهرست حساب در مرورگر به‌روز می‌شود
export async function syncSavedWithSession(me) {
  const owner = localStore.get(OWNER_KEY, 'guest');
  if (!me?.authenticated) { if (owner !== 'guest') { localStore.remove(KEY); localStore.set(OWNER_KEY, 'guest'); } return getSavedIds(); }
  const local = getSavedIds();
  if (owner === 'guest' && local.length) {
    try { return setLocal(await api.mergeSaved(local), me.user.id); } catch { return local; }
  }
  return setLocal(me.user.savedProducts || [], me.user.id);
}
