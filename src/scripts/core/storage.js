const getBrowserStorage = name => {
  try { return window[name]; }
  catch { return null; }
};

const safeStorage = storage => ({
  get(key, fallback = null) {
    if (!storage) return fallback;
    try {
      const raw = storage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    if (!storage) return false;
    try { storage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  remove(key) {
    if (!storage) return;
    try { storage.removeItem(key); }
    catch { /* storage can be unavailable */ }
  }
});

export const localStore = safeStorage(getBrowserStorage('localStorage'));
export const sessionStore = safeStorage(getBrowserStorage('sessionStorage'));
