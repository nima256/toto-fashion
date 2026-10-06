import { products, popularSearches, defaultRecentSearches, replaceProducts, markProductsFailed } from '../data/mock-data.js';
import { mountShell, renderAnnouncement } from './components/shell.js?v=4';
import { api } from './services/api.js';
import { localStore, sessionStore } from './core/storage.js';
import { icon, formatPrice, toEnglishDigits, toPersianDigits, debounce, trapFocus, getFocusable, announce, escapeHtml as esc, safeImage, safeColor, encodeParam } from './core/utils.js';
import { getSession, syncSession, setSessionFromServer, clearLocalAccountData } from './core/account-store.js';
import { toggleSaved, syncSavedWithSession } from './core/saved-store.js';
import { setSiteContent } from './core/site-store.js';
import { initHome } from './pages/home.js?v=4';
import { initCatalog } from './pages/catalog.js?v=4';
import { initProduct } from './pages/product.js?v=4';
import { initCollection } from './pages/collection.js?v=4';
import { initSizeGuide } from './pages/size-guide.js';
import { initCart } from './pages/cart.js?v=4';
import { initCheckout } from './pages/checkout.js?v=4';
import { initOrderReview } from './pages/order-review.js?v=4';
import { initPayment } from './pages/payment.js?v=4';
import { initAccount } from './pages/account.js?v=4';
import { initOrders } from './pages/orders.js?v=4';
import { initOrderDetails } from './pages/order-details.js?v=4';
import { initOrderTracking } from './pages/order-tracking.js?v=4';
import { initReturnRequest } from './pages/return-request.js?v=4';
import { initCustomerGallery } from './pages/customer-gallery.js?v=4';
import { initContentPages } from './pages/content.js?v=4';
import { addCartItem, isVariantAvailable } from './core/commerce.js';
import { notFoundTemplate } from './components/not-found.js';
import { productCardTemplate } from './components/product-card.js';

const state = {
  lastFocused: null, activeOverlay: null,
  cart: localStore.get('toto-cart', []),
  recentSearches: (localStore.get('toto-recent-searches', defaultRecentSearches) || []).filter(term => typeof term === 'string').slice(0, 5),
  searchResults: [], searchIndex: -1, otpMobile: '', otpTimer: null,
  quantity: 1, sheetProduct: null, selectedSize: null, selectedColor: 0
};

const overlaysTemplate = () => `
  <div class="search-overlay" id="search-overlay" aria-hidden="true"><section class="search-panel" role="dialog" aria-modal="true" aria-label="جست‌وجوی محصولات"><div class="search-panel__bar"><div class="container search-panel__bar-inner"><button class="icon-button" type="button" data-action="close-search" aria-label="بستن جست‌وجو">${icon('close')}</button><div class="input-wrap"><label class="visually-hidden" for="site-search">جست‌وجوی محصولات</label><input class="search-input" id="site-search" type="search" maxlength="64" placeholder="جست‌وجوی محصول، دسته‌بندی یا استایل" autocomplete="off" aria-controls="search-results" aria-autocomplete="list"></div><span aria-hidden="true">${icon('search')}</span></div></div><div class="container search-panel__content" id="search-content"></div></section></div>
  <div class="dialog-overlay" id="login-dialog" aria-hidden="true"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="login-title"><div class="dialog__head"><h2 id="login-title">ورود به حساب توتو</h2><button class="icon-button" type="button" data-action="close-login" aria-label="بستن پنجره ورود">${icon('close')}</button></div><div class="dialog__body" id="login-content"></div></section></div>
  <div class="dialog-overlay" id="product-sheet" aria-hidden="true"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="product-sheet-title"><div class="dialog__head"><h2 id="product-sheet-title">انتخاب محصول</h2><button class="icon-button" type="button" data-action="close-product-sheet" aria-label="بستن انتخاب محصول">${icon('close')}</button></div><div class="dialog__body" id="product-sheet-content"></div></section></div>
  <div class="toast-region" id="toast-region" aria-live="polite" aria-atomic="true"></div>`;

const updateCounters = () => {
  state.cart = localStore.get('toto-cart', []);
  const cartCount = (Array.isArray(state.cart) ? state.cart : []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  document.querySelectorAll('[data-cart-count]').forEach(item => { item.textContent = toPersianDigits(cartCount); });
};
const updateAccountLabels = () => {
  const signedIn = Boolean(getSession());
  document.querySelectorAll('[data-action="open-login"] span').forEach(span => { if (['ورود', 'حساب من'].includes(span.textContent)) span.textContent = signedIn ? 'حساب من' : 'ورود'; });
};

// پیام‌ها همیشه به‌صورت متن درج می‌شوند (ممکن است شامل نام محصول یا پیام سرور باشند)
export const toast = (message, type = 'success', options = {}) => {
  const region = document.getElementById('toast-region'); if (!region) return;
  const element = document.createElement('div'); element.className = `toast toast--${type === 'error' ? 'error' : type === 'info' ? 'info' : 'success'}`;
  element.innerHTML = `${icon(type === 'error' ? 'error' : type === 'info' ? 'info' : 'check')}<p></p>${options.label ? '<button class="toast__action" type="button"></button>' : ''}<button class="icon-button toast__close" type="button" aria-label="بستن پیام">${icon('close', 'icon icon--sm')}</button>`;
  element.querySelector('p').textContent = String(message ?? '');
  if (options.label) element.querySelector('.toast__action').textContent = options.label;
  region.append(element); const remove = () => element.remove(); element.querySelector('.toast__close')?.addEventListener('click', remove); element.querySelector('.toast__action')?.addEventListener('click', () => { options.onAction?.(); remove(); }); setTimeout(remove, options.label ? 6500 : 4300);
};

const openOverlay = (element, focusSelector) => {
  if (!element) return; state.lastFocused = document.activeElement; state.activeOverlay = element; element.classList.add('is-open'); element.setAttribute('aria-hidden', 'false'); document.body.classList.add('is-locked'); requestAnimationFrame(() => (element.querySelector(focusSelector) || getFocusable(element)[0])?.focus());
};
const closeOverlay = element => {
  if (!element) return; element.classList.remove('is-open'); element.setAttribute('aria-hidden', 'true'); if (state.activeOverlay === element) state.activeOverlay = null; document.body.classList.toggle('is-locked', Boolean(document.querySelector('.overlay.is-open,.dialog-overlay.is-open,.search-overlay.is-open'))); state.lastFocused?.focus?.();
};

const renderSearchIdle = () => {
  const recent = state.recentSearches.map(term => `<button class="chip" type="button" data-search-term="${esc(term)}">${icon('clock', 'icon icon--sm')}<span>${esc(term)}</span><span data-remove-search="${esc(term)}" role="button" tabindex="0" aria-label="حذف ${esc(term)} از تاریخچه">${icon('close', 'icon icon--sm')}</span></button>`).join('');
  document.getElementById('search-content').innerHTML = `<div class="search-grid search-grid--compact"><section class="search-group"><div class="search-group__head"><h2>جست‌وجوهای اخیر</h2>${recent ? '<button class="text-button" type="button" data-action="clear-search-history">پاک کردن</button>' : ''}</div><div class="search-chips">${recent || '<p>هنوز جست‌وجویی ذخیره نشده است.</p>'}</div></section><section class="search-group"><h2>جست‌وجوهای محبوب</h2><div class="search-chips">${popularSearches.map(term => `<button class="chip" type="button" data-search-term="${esc(term)}">${esc(term)}</button>`).join('')}</div></section></div>`;
};
const renderSearchLoading = () => { document.getElementById('search-content').innerHTML = `<div class="search-group"><h2>در حال جست‌وجو</h2>${[1, 2, 3].map(() => `<div class="search-result"><span class="skeleton" style="width:64px;height:76px"></span><span><span class="skeleton" style="display:block;height:17px;width:58%;margin-bottom:9px"></span><span class="skeleton" style="display:block;height:13px;width:38%"></span></span></div>`).join('')}</div>`; };
const renderSearchError = message => { document.getElementById('search-content').innerHTML = `<div class="search-empty"><div class="state-card__icon">${icon('error', 'icon icon--lg')}</div><h2>جست‌وجو انجام نشد</h2><p>${esc(message)}</p></div>`; };
const renderSearchResults = query => {
  const content = document.getElementById('search-content');
  if (!state.searchResults.length) { content.innerHTML = `<div class="search-empty"><div class="state-card__icon">${icon('search', 'icon icon--lg')}</div><h2>نتیجه‌ای برای «${esc(query)}» پیدا نشد</h2><p>عبارت کوتاه‌تری امتحان کنید یا پیشنهادهای زیر را ببینید.</p><div class="search-chips" style="justify-content:center">${popularSearches.slice(0, 3).map(term => `<button class="chip" data-search-term="${esc(term)}">${esc(term)}</button>`).join('')}</div><a class="button button--outline" href="./shop">مشاهده همه محصولات</a></div>`; return; }
  content.innerHTML = `<section class="search-group"><div class="search-group__head"><h2>نتایج پیشنهادی</h2><a href="./search?q=${encodeParam(query)}">مشاهده همه نتایج</a></div><div id="search-results" role="listbox">${state.searchResults.slice(0, 6).map((product, index) => `<a class="search-result ${index === state.searchIndex ? 'is-active' : ''}" href="./product?id=${encodeParam(product.id)}" role="option" aria-selected="${index === state.searchIndex}" data-search-index="${index}"><img src="${safeImage(product.image)}" alt="" width="64" height="76"><span><strong>${esc(product.name)}</strong><small>${esc(product.category)}</small></span><strong>${formatPrice(product.price)}</strong></a>`).join('')}</div></section>`;
};
let searchSeq = 0;
const runSearch = debounce(async query => {
  const clean = query.trim().slice(0, 64); const seq = ++searchSeq;
  if (!clean) { state.searchResults = []; state.searchIndex = -1; renderSearchIdle(); return; }
  renderSearchLoading();
  try { const results = await api.search(clean); if (seq !== searchSeq) return; state.searchResults = results; state.searchIndex = -1; renderSearchResults(clean); }
  catch (error) { if (seq === searchSeq) { state.searchResults = []; renderSearchError(error.message); } }
}, 220);
const saveSearch = term => { const clean = term.trim().slice(0, 64); if (!clean) return; state.recentSearches = [clean, ...state.recentSearches.filter(item => item !== clean)].slice(0, 5); localStore.set('toto-recent-searches', state.recentSearches); };

const renderMobileStep = () => {
  document.getElementById('login-content').innerHTML = `<div class="dialog__intro"><h3>خوش آمدید</h3><p>برای ورود یا ساخت حساب، شماره موبایل خود را وارد کنید.</p></div><form id="mobile-form" novalidate><div class="field"><label for="login-mobile">شماره موبایل</label><input class="input" id="login-mobile" name="mobile" inputmode="numeric" autocomplete="tel" placeholder="۰۹۱۲۱۲۳۴۵۶۷" maxlength="11" aria-describedby="mobile-error"><div class="field-message field-message--error" id="mobile-error"></div></div><button class="button button--block" style="margin-top:18px" type="submit">دریافت کد تأیید</button></form><p class="dialog-legal">با ادامه، قوانین استفاده و حریم خصوصی توتو را می‌پذیرید.</p>`;
  document.getElementById('mobile-form').addEventListener('submit', requestOtp);
};
const requestOtp = async event => {
  event.preventDefault(); const form = event.currentTarget; const input = form.elements.mobile; const error = document.getElementById('mobile-error'); const button = form.querySelector('button[type="submit"]'); error.textContent = ''; button.disabled = true; button.textContent = 'در حال ارسال...';
  try { const result = await api.requestOtp(input.value); state.otpMobile = result.normalizedMobile; renderOtpStep(result.debugOtp); } catch (err) { input.setAttribute('aria-invalid', 'true'); error.textContent = err.message; input.focus(); } finally { button.disabled = false; button.textContent = 'دریافت کد تأیید'; }
};
const renderOtpStep = debugOtp => {
  document.getElementById('login-content').innerHTML = `<div class="dialog__intro"><h3>کد تأیید را وارد کنید</h3><p>کد پنج‌رقمی برای ${esc(toPersianDigits(state.otpMobile))} ارسال شد.</p><button class="text-button" type="button" data-action="change-mobile">تغییر شماره</button></div><form id="otp-form" novalidate><div class="otp-inputs" dir="ltr">${Array.from({ length: 5 }, (_, i) => `<input inputmode="numeric" autocomplete="${i === 0 ? 'one-time-code' : 'off'}" maxlength="1" aria-label="رقم ${i + 1} کد تأیید">`).join('')}</div><div class="field-message field-message--error" id="otp-error"></div><button class="button button--block" type="submit">ورود به حساب</button></form><div class="otp-resend"><button class="text-button" id="resend-otp" type="button" disabled>ارسال مجدد</button><span id="otp-countdown"></span></div>${debugOtp ? `<p class="mock-note">محیط توسعه (سرویس پیامک تنظیم نشده): کد ${esc(toPersianDigits(debugOtp))}</p>` : '<p class="mock-note">کد تأیید ارسال‌شده به شماره موبایل را وارد کنید.</p>'}`;
  const form = document.getElementById('otp-form'); const inputs = [...form.querySelectorAll('input')];
  inputs.forEach((input, index) => { input.addEventListener('input', () => { input.value = toEnglishDigits(input.value).replace(/\D/g, '').slice(-1); if (input.value) inputs[index + 1]?.focus(); }); input.addEventListener('keydown', event => { if (event.key === 'Backspace' && !input.value) inputs[index - 1]?.focus(); }); input.addEventListener('paste', event => { event.preventDefault(); const digits = toEnglishDigits(event.clipboardData.getData('text')).replace(/\D/g, '').slice(0, 5); digits.split('').forEach((digit, i) => { if (inputs[i]) inputs[i].value = digit; }); inputs[Math.min(digits.length, 4)]?.focus(); }); });
  form.addEventListener('submit', verifyOtp);
  document.getElementById('resend-otp')?.addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true; button.textContent = 'در حال ارسال...';
    try { const result = await api.requestOtp(state.otpMobile); toast('کد تازه ارسال شد.'); renderOtpStep(result.debugOtp); }
    catch (error) { document.getElementById('otp-error').textContent = error.message; button.disabled = false; button.textContent = 'ارسال مجدد'; }
  });
  inputs[0].focus(); startOtpTimer(120);
};
const startOtpTimer = seconds => { clearInterval(state.otpTimer); let remaining = seconds; const tick = () => { const output = document.getElementById('otp-countdown'); const resend = document.getElementById('resend-otp'); if (!output || !resend) return clearInterval(state.otpTimer); if (remaining <= 0) { output.textContent = 'کد منقضی شد'; resend.disabled = false; clearInterval(state.otpTimer); return; } output.textContent = `ارسال مجدد تا ${toPersianDigits(Math.floor(remaining / 60))}:${toPersianDigits(String(remaining % 60).padStart(2, '0'))}`; remaining -= 1; }; tick(); state.otpTimer = setInterval(tick, 1000); };
const safeReturnTarget = value => { const target = String(value || ''); return /^[a-z-]+(?:\?[^\s"'<>`]*)?$/.test(target) ? `./${target}` : '/'; };
const verifyOtp = async event => {
  event.preventDefault(); const form = event.currentTarget; const inputs = [...form.querySelectorAll('input')]; const code = inputs.map(input => input.value).join(''); const error = document.getElementById('otp-error'); const button = form.querySelector('button');
  if (code.length < 5) { error.textContent = 'کد پنج‌رقمی را کامل وارد کنید.'; inputs.find(input => !input.value)?.focus(); return; }
  button.disabled = true; button.textContent = 'در حال بررسی...';
  try {
    const result = await api.verifyOtp(code, state.otpMobile);
    const me = { authenticated: true, user: result.user };
    setSessionFromServer(me);
    await syncSavedWithSession(me);
    document.dispatchEvent(new CustomEvent('toto:auth-changed', { detail: me }));
    const returnTarget = new URLSearchParams(location.search).get('return') || sessionStore.get('toto-auth-return', '');
    closeOverlay(document.getElementById('login-dialog')); toast('ورود شما با موفقیت انجام شد.'); updateAccountLabels();
    if (document.body.dataset.page === 'login') setTimeout(() => { location.href = safeReturnTarget(returnTarget); }, 250);
  } catch (err) { error.textContent = err.message; inputs.forEach(input => { input.value = ''; }); inputs[0].focus(); }
  finally { button.disabled = false; button.textContent = 'ورود به حساب'; }
};

// خروج فقط پس از تأیید سرور؛ اگر سرور خطا بدهد، کاربر وارد باقی می‌ماند تا وضعیت مرورگر و سرور ناهمخوان نشود
const logout = async trigger => {
  if (trigger) trigger.disabled = true;
  try { await api.logout(); }
  catch (error) {
    if (error.status !== 401) { toast(`خروج انجام نشد: ${error.message}`, 'error'); if (trigger) trigger.disabled = false; return; }
  }
  clearLocalAccountData(); await syncSavedWithSession({ authenticated: false });
  document.dispatchEvent(new CustomEvent('toto:auth-changed')); closeOverlay(document.getElementById('login-dialog')); updateAccountLabels(); toast('از حساب خود خارج شدید.', 'info');
};

const renderProductSheet = product => {
  state.sheetProduct = product; state.selectedSize = null; state.selectedColor = 0; state.quantity = 1;
  document.getElementById('product-sheet-title').textContent = product.name;
  const sizeKey = size => (product.sizes?.length ? size : '');
  document.getElementById('product-sheet-content').innerHTML = `<div class="product-sheet__summary"><img src="${safeImage(product.image)}" alt="${esc(product.imageAlt || product.name)}" width="90" height="118"><div><h3>${esc(product.name)}</h3><p>${esc(product.stockNote || product.category)}</p><strong>${formatPrice(product.price)}</strong></div></div><span class="choice-label">رنگ</span><div class="choice-row">${(product.colors || []).map((color, index) => `<button class="choice" type="button" data-sheet-color="${index}" aria-pressed="${index === 0}"><span class="swatch" style="--swatch:${safeColor(color)}"></span><span>${esc(product.colorNames?.[index] || '')}</span></button>`).join('')}</div><span class="choice-label">سایز</span><div class="choice-row" id="sheet-sizes">${(product.sizes || []).map(size => `<button class="choice" type="button" data-sheet-size="${esc(size)}" aria-pressed="false" ${isVariantAvailable(product, 0, sizeKey(size)) ? '' : 'disabled aria-label="سایز ناموجود"'}>${esc(size)}</button>`).join('')}</div><span class="choice-label">تعداد</span><div class="quantity"><button type="button" data-action="increase-quantity" aria-label="افزایش تعداد">${icon('plus')}</button><output id="sheet-quantity">۱</output><button type="button" data-action="decrease-quantity" aria-label="کاهش تعداد">${icon('minus')}</button></div><div class="field-message field-message--error" id="sheet-error"></div><button class="button button--block" type="button" data-action="add-sheet-to-cart">افزودن به سبد خرید</button>`;
};
const refreshSheetSizes = () => {
  const product = state.sheetProduct; if (!product) return;
  document.querySelectorAll('[data-sheet-size]').forEach(button => {
    const available = isVariantAvailable(product, state.selectedColor, product.sizes?.length ? button.dataset.sheetSize : '');
    button.disabled = !available; if (!available && state.selectedSize === button.dataset.sheetSize) { state.selectedSize = null; button.setAttribute('aria-pressed', 'false'); }
  });
};
const addToCart = ({ product, size, colorIndex = 0, quantity = 1 }) => {
  try { addCartItem({ productId: product.id, size, colorIndex, quantity }); }
  catch (error) { toast(error.message, 'error'); return false; }
  updateCounters(); announce(`${product.name} به سبد خرید اضافه شد.`); toast(`${product.name} به سبد خرید اضافه شد.`); return true;
};
const updateSaveButtons = (id, saved) => document.querySelectorAll(`[data-action="toggle-save"][data-id="${CSS.escape(id)}"]`).forEach(button => {
  button.setAttribute('aria-pressed', String(saved)); button.setAttribute('aria-label', saved ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'); button.innerHTML = icon(saved ? 'heart-filled' : 'heart');
});

const handleAction = async (action, trigger) => {
  if (action === 'dismiss-announcement') { sessionStore.set('toto-announcement-dismissed', true); document.getElementById('announcement-bar')?.remove(); }
  if (action === 'reload-page') location.reload();
  if (action === 'open-drawer') openOverlay(document.getElementById('mobile-drawer'), '[data-action="close-drawer"]');
  if (action === 'close-drawer') closeOverlay(document.getElementById('mobile-drawer'));
  if (action === 'open-search') { renderSearchIdle(); openOverlay(document.getElementById('search-overlay'), '#site-search'); }
  if (action === 'close-search') closeOverlay(document.getElementById('search-overlay'));
  // کاربر واردشده مستقیماً به حساب می‌رود؛ پنجره ورود فقط برای مهمان است
  if (action === 'open-login') { if (getSession()) { location.href = './account'; return; } sessionStore.set('toto-auth-return', `${location.pathname.split('/').pop()}${location.search}`); renderMobileStep(); openOverlay(document.getElementById('login-dialog'), '#login-mobile'); }
  if (action === 'close-login') closeOverlay(document.getElementById('login-dialog'));
  if (action === 'change-mobile') renderMobileStep();
  if (action === 'logout') await logout(trigger);
  if (action === 'clear-search-history') { state.recentSearches = []; localStore.set('toto-recent-searches', []); renderSearchIdle(); }
  if (action === 'cart-summary') location.href = './cart';
  if (action === 'show-support') toast('پشتیبانی خرید: شنبه تا پنجشنبه، ساعت ۹ تا ۱۸.', 'info');
  if (action === 'toggle-save') {
    const id = trigger.dataset.id; trigger.disabled = true;
    try { const saved = await toggleSaved(id); updateSaveButtons(id, saved); toast(saved ? 'به علاقه‌مندی‌ها اضافه شد.' : 'از علاقه‌مندی‌ها حذف شد.', 'info'); }
    catch (error) { toast(error.message, 'error'); }
    finally { trigger.disabled = false; }
  }
  if (action === 'quick-add') { const product = products.find(item => item.id === trigger.dataset.id); if (product) addToCart({ product, size: trigger.dataset.size }); }
  if (action === 'open-product-sheet') { const product = products.find(item => item.id === trigger.dataset.id); if (!product) return; renderProductSheet(product); openOverlay(document.getElementById('product-sheet'), '[data-sheet-size]:not([disabled])'); }
  if (action === 'close-product-sheet') closeOverlay(document.getElementById('product-sheet'));
  if (action === 'increase-quantity') { state.quantity = Math.min(5, state.quantity + 1); document.getElementById('sheet-quantity').textContent = toPersianDigits(state.quantity); }
  if (action === 'decrease-quantity') { state.quantity = Math.max(1, state.quantity - 1); document.getElementById('sheet-quantity').textContent = toPersianDigits(state.quantity); }
  if (action === 'add-sheet-to-cart') { const error = document.getElementById('sheet-error'); if (state.sheetProduct?.sizes?.length && !state.selectedSize) { error.textContent = 'لطفاً یک سایز انتخاب کنید.'; document.querySelector('[data-sheet-size]:not([disabled])')?.focus(); return; } if (addToCart({ product: state.sheetProduct, size: state.selectedSize || '', colorIndex: state.selectedColor, quantity: state.quantity })) closeOverlay(document.getElementById('product-sheet')); }
};

const bindNewsletter = () => {
  document.getElementById('newsletter-form')?.addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const input = form.querySelector('input'); const message = document.getElementById('newsletter-message'); const button = form.querySelector('button');
    const mobile = toEnglishDigits(input.value).replace(/\s/g, '');
    if (!/^09\d{9}$/.test(mobile)) { message.textContent = 'شماره موبایل را به‌صورت کامل وارد کنید.'; message.classList.add('field-message--error'); input.focus(); return; }
    button.disabled = true; message.textContent = '';
    try { const result = await api.subscribeNewsletter(mobile); message.textContent = result.alreadySubscribed ? 'این شماره قبلاً در خبرنامه عضو شده است.' : 'عضویت شما در خبرنامه ثبت شد.'; message.classList.remove('field-message--error'); input.value = ''; }
    catch (error) { message.textContent = error.message; message.classList.add('field-message--error'); }
    finally { button.disabled = false; }
  });
};

const bindEvents = () => {
  document.addEventListener('click', event => {
    const actionTarget = event.target.closest('[data-action]'); if (actionTarget) handleAction(actionTarget.dataset.action, actionTarget);
    const searchTerm = event.target.closest('[data-search-term]'); if (searchTerm && !event.target.closest('[data-remove-search]')) { const input = document.getElementById('site-search'); input.value = searchTerm.dataset.searchTerm; input.focus(); runSearch(input.value); }
    const removeTerm = event.target.closest('[data-remove-search]'); if (removeTerm) { event.preventDefault(); event.stopPropagation(); state.recentSearches = state.recentSearches.filter(term => term !== removeTerm.dataset.removeSearch); localStore.set('toto-recent-searches', state.recentSearches); renderSearchIdle(); }
    const sizeChoice = event.target.closest('[data-sheet-size]'); if (sizeChoice && !sizeChoice.disabled) { document.querySelectorAll('[data-sheet-size]').forEach(button => button.setAttribute('aria-pressed', 'false')); sizeChoice.setAttribute('aria-pressed', 'true'); state.selectedSize = sizeChoice.dataset.sheetSize; document.getElementById('sheet-error').textContent = ''; }
    const colorChoice = event.target.closest('[data-sheet-color]'); if (colorChoice) { document.querySelectorAll('[data-sheet-color]').forEach(button => button.setAttribute('aria-pressed', 'false')); colorChoice.setAttribute('aria-pressed', 'true'); state.selectedColor = Number(colorChoice.dataset.sheetColor); refreshSheetSizes(); }
    const swatch = event.target.closest('.product-card__swatches .swatch'); if (swatch) {
      swatch.parentElement.querySelectorAll('.swatch').forEach(button => button.setAttribute('aria-pressed', 'false'));
      swatch.setAttribute('aria-pressed', 'true');
      const card = swatch.closest('.product-card');
      const primary = card?.querySelector('[data-card-image="primary"]');
      const secondary = card?.querySelector('[data-card-image="secondary"]');
      card?.classList.add('is-color-changing');
      if (primary) primary.src = swatch.dataset.primaryImage;
      if (secondary) secondary.src = swatch.dataset.secondaryImage;
      card?.setAttribute('data-color-index', swatch.dataset.cardColor);
      window.setTimeout(() => card?.classList.remove('is-color-changing'), 220);
    }
  });
  document.addEventListener('input', event => { if (event.target.id === 'site-search') runSearch(event.target.value); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && state.activeOverlay) closeOverlay(state.activeOverlay); if (state.activeOverlay) trapFocus(event, state.activeOverlay); if (document.activeElement?.id === 'site-search' && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) { if (event.key === 'Enter' && !state.searchResults.length) { event.preventDefault(); saveSearch(document.activeElement.value); location.href = `./search?q=${encodeParam(document.activeElement.value.slice(0, 64))}`; return; } if (!state.searchResults.length) return; event.preventDefault(); if (event.key === 'ArrowDown') state.searchIndex = (state.searchIndex + 1) % state.searchResults.length; if (event.key === 'ArrowUp') state.searchIndex = (state.searchIndex - 1 + state.searchResults.length) % state.searchResults.length; if (event.key === 'Enter') { const chosen = state.searchResults[Math.max(0, state.searchIndex)]; saveSearch(chosen.name); location.href = `./product?id=${encodeParam(chosen.id)}`; return; } renderSearchResults(document.activeElement.value); document.getElementById('site-search')?.focus(); } });
  document.addEventListener('toto:cart-updated', updateCounters);
  // اگر سرور نشست مشتری را نامعتبر اعلام کند، وضعیت مرورگر هم پاک می‌شود
  document.addEventListener('toto:unauthorized', event => {
    const path = event.detail?.path || '';
    if (!getSession() || !/^\/api\/(?:account|gallery\/mine|gallery$|products\/[^/]+\/(?:reviews|questions))/.test(path)) return;
    clearLocalAccountData(); updateAccountLabels(); toast('نشست شما منقضی شده است؛ دوباره وارد شوید.', 'info'); document.dispatchEvent(new CustomEvent('toto:auth-changed'));
  });
  bindNewsletter();
};

// صفحه ۴۰۴: قالب کامل + پیشنهاد محصولات پرفروش (در صورت در دسترس بودن)
const initNotFound = () => {
  const root = document.getElementById('not-found-root'); if (!root) return;
  const breadcrumbs = root.querySelector('.breadcrumbs')?.outerHTML || '';
  root.innerHTML = breadcrumbs + notFoundTemplate(document.body.dataset.notFound || 'page');
  const picks = [...products].sort((a, b) => Number(b.bestSeller) - Number(a.bestSeller) || b.popularity - a.popularity).filter(p => p.availability).slice(0, 4);
  if (picks.length) { document.getElementById('not-found-products').innerHTML = picks.map(product => productCardTemplate(product)).join(''); document.getElementById('not-found-suggestions').hidden = false; }
};

const initPage = () => {
  const page = document.body.dataset.page;
  if (page === '404') initNotFound();
  if (page === 'home') initHome();
  if (page === 'shop' || page === 'search') initCatalog();
  if (page === 'product') initProduct({ toast });
  if (page === 'saved') initCollection({ toast });
  if (page === 'gallery') initCustomerGallery({ toast });
  if (page === 'size-guide') initSizeGuide();
  if (page === 'cart') initCart({ toast });
  if (page === 'checkout') initCheckout({ toast });
  if (page === 'order-review') initOrderReview({ toast });
  if (['payment-success', 'payment-failed', 'payment-pending'].includes(page)) initPayment({ toast });
  if (page === 'account') initAccount({ toast });
  if (page === 'orders') initOrders();
  if (page === 'order-details') initOrderDetails({ toast });
  if (page === 'order-tracking') initOrderTracking({ toast });
  if (page === 'return-request') initReturnRequest({ toast });
  initContentPages({ toast });
};

const init = async () => {
  mountShell(); document.body.insertAdjacentHTML('beforeend', overlaysTemplate());
  // نشست سرور، محصولات و محتوای سایت هم‌زمان دریافت می‌شوند؛ در صورت خطا داده نمونه جایگزین نمی‌شود
  const [sessionResult, productsResult, siteResult] = await Promise.allSettled([syncSession(api), api.getProducts(), api.getSiteContent()]);
  if (productsResult.status === 'fulfilled') replaceProducts(productsResult.value); else { markProductsFailed(productsResult.reason); console.warn('Product API unavailable', productsResult.reason?.message); }
  if (siteResult.status === 'fulfilled') setSiteContent(siteResult.value);
  const me = sessionResult.status === 'fulfilled' ? sessionResult.value.me : null;
  if (me) await syncSavedWithSession(me).catch(() => {});
  if (!sessionStore.get('toto-announcement-dismissed', false) && siteResult.status === 'fulfilled') renderAnnouncement(siteResult.value.site?.announcement, siteResult.value.checkout);
  updateCounters(); updateAccountLabels(); bindEvents(); initPage();
  const session = getSession();
  if (new URLSearchParams(location.search).get('auth') === 'login' || document.body.dataset.page === 'login') {
    if (session) { location.replace(document.body.dataset.page === 'login' ? safeReturnTarget(new URLSearchParams(location.search).get('return') || 'account') : './account'); return; }
    renderMobileStep(); openOverlay(document.getElementById('login-dialog'), '#login-mobile');
  }
};
init().catch(error => console.error('App init failed', error));
