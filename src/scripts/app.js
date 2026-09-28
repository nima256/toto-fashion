import { products, popularSearches, defaultRecentSearches, replaceProducts } from '../data/mock-data.js';
import { mountShell } from './components/shell.js?v=3';
import { api } from './services/api.js';
import { localStore, sessionStore } from './core/storage.js';
import { icon, formatPrice, toEnglishDigits, toPersianDigits, debounce, trapFocus, getFocusable, announce } from './core/utils.js';
import { initHome } from './pages/home.js?v=3';
import { initCatalog } from './pages/catalog.js?v=3';
import { initProduct } from './pages/product.js?v=3';
import { initCollection } from './pages/collection.js?v=3';
import { initSizeGuide } from './pages/size-guide.js';
import { initCart } from './pages/cart.js';
import { initCheckout } from './pages/checkout.js';
import { initOrderReview } from './pages/order-review.js';
import { initPayment } from './pages/payment.js';
import { initAccount } from './pages/account.js';
import { initOrders } from './pages/orders.js';
import { initOrderDetails } from './pages/order-details.js';
import { initOrderTracking } from './pages/order-tracking.js';
import { initReturnRequest } from './pages/return-request.js';
import { initCustomerGallery } from './pages/customer-gallery.js';
import { initContentPages } from './pages/content.js';
import { addCartItem } from './core/commerce.js';

const state = {
  lastFocused: null, activeOverlay: null,
  cart: localStore.get('toto-cart', []),
  recentSearches: localStore.get('toto-recent-searches', defaultRecentSearches),
  searchResults: [], searchIndex: -1, otpMobile: '', otpTimer: null,
  quantity: 1, sheetProduct: null, selectedSize: null, selectedColor: 0
};

const overlaysTemplate = () => `
  <div class="search-overlay" id="search-overlay" aria-hidden="true"><section class="search-panel" role="dialog" aria-modal="true" aria-label="جست‌وجوی محصولات"><div class="search-panel__bar"><div class="container search-panel__bar-inner"><button class="icon-button" type="button" data-action="close-search" aria-label="بستن جست‌وجو">${icon('close')}</button><div class="input-wrap"><label class="visually-hidden" for="site-search">جست‌وجوی محصولات</label><input class="search-input" id="site-search" type="search" placeholder="جست‌وجوی محصول، دسته‌بندی یا استایل" autocomplete="off" aria-controls="search-results" aria-autocomplete="list"></div><span aria-hidden="true">${icon('search')}</span></div></div><div class="container search-panel__content" id="search-content"></div></section></div>
  <div class="dialog-overlay" id="login-dialog" aria-hidden="true"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="login-title"><div class="dialog__head"><h2 id="login-title">ورود به حساب توتو</h2><button class="icon-button" type="button" data-action="close-login" aria-label="بستن پنجره ورود">${icon('close')}</button></div><div class="dialog__body" id="login-content"></div></section></div>
  <div class="dialog-overlay" id="product-sheet" aria-hidden="true"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="product-sheet-title"><div class="dialog__head"><h2 id="product-sheet-title">انتخاب محصول</h2><button class="icon-button" type="button" data-action="close-product-sheet" aria-label="بستن انتخاب محصول">${icon('close')}</button></div><div class="dialog__body" id="product-sheet-content"></div></section></div>
  <div class="toast-region" id="toast-region" aria-live="polite" aria-atomic="true"></div>`;

const updateCounters = () => {
  state.cart = localStore.get('toto-cart', []);
  const cartCount = state.cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  document.querySelectorAll('[data-cart-count]').forEach(item => { item.textContent = toPersianDigits(cartCount); });
};

export const toast = (message, type = 'success', options = {}) => {
  const region = document.getElementById('toast-region'); if (!region) return;
  const element = document.createElement('div'); element.className = `toast toast--${type}`;
  element.innerHTML = `${icon(type === 'error' ? 'error' : type === 'info' ? 'info' : 'check')}<p>${message}</p>${options.label ? `<button class="toast__action" type="button">${options.label}</button>` : ''}<button class="icon-button toast__close" type="button" aria-label="بستن پیام">${icon('close', 'icon icon--sm')}</button>`;
  region.append(element); const remove = () => element.remove(); element.querySelector('.toast__close')?.addEventListener('click', remove); element.querySelector('.toast__action')?.addEventListener('click', () => { options.onAction?.(); remove(); }); setTimeout(remove, options.label ? 6500 : 4300);
};

const openOverlay = (element, focusSelector) => {
  if (!element) return; state.lastFocused = document.activeElement; state.activeOverlay = element; element.classList.add('is-open'); element.setAttribute('aria-hidden', 'false'); document.body.classList.add('is-locked'); requestAnimationFrame(() => (element.querySelector(focusSelector) || getFocusable(element)[0])?.focus());
};
const closeOverlay = element => {
  if (!element) return; element.classList.remove('is-open'); element.setAttribute('aria-hidden', 'true'); if (state.activeOverlay === element) state.activeOverlay = null; document.body.classList.toggle('is-locked', Boolean(document.querySelector('.overlay.is-open,.dialog-overlay.is-open,.search-overlay.is-open'))); state.lastFocused?.focus?.();
};

const renderSearchIdle = () => {
  const recent = state.recentSearches.map(term => `<button class="chip" type="button" data-search-term="${term}">${icon('clock', 'icon icon--sm')}<span>${term}</span><span data-remove-search="${term}" role="button" tabindex="0" aria-label="حذف ${term} از تاریخچه">${icon('close', 'icon icon--sm')}</span></button>`).join('');
  document.getElementById('search-content').innerHTML = `<div class="search-grid search-grid--compact"><section class="search-group"><div class="search-group__head"><h2>جست‌وجوهای اخیر</h2>${recent ? '<button class="text-button" type="button" data-action="clear-search-history">پاک کردن</button>' : ''}</div><div class="search-chips">${recent || '<p>هنوز جست‌وجویی ذخیره نشده است.</p>'}</div></section><section class="search-group"><h2>جست‌وجوهای محبوب</h2><div class="search-chips">${popularSearches.map(term => `<button class="chip" type="button" data-search-term="${term}">${term}</button>`).join('')}</div></section></div>`;
};
const renderSearchLoading = () => { document.getElementById('search-content').innerHTML = `<div class="search-group"><h2>در حال جست‌وجو</h2>${[1,2,3].map(() => `<div class="search-result"><span class="skeleton" style="width:64px;height:76px"></span><span><span class="skeleton" style="display:block;height:17px;width:58%;margin-bottom:9px"></span><span class="skeleton" style="display:block;height:13px;width:38%"></span></span></div>`).join('')}</div>`; };
const renderSearchResults = query => {
  const content = document.getElementById('search-content');
  if (!state.searchResults.length) { content.innerHTML = `<div class="search-empty"><div class="state-card__icon">${icon('search', 'icon icon--lg')}</div><h2>نتیجه‌ای برای «${query}» پیدا نشد</h2><p>عبارت کوتاه‌تری امتحان کنید یا پیشنهادهای زیر را ببینید.</p><div class="search-chips" style="justify-content:center">${popularSearches.slice(0,3).map(term => `<button class="chip" data-search-term="${term}">${term}</button>`).join('')}</div><a class="button button--outline" href="./shop">مشاهده همه محصولات</a></div>`; return; }
  content.innerHTML = `<section class="search-group"><div class="search-group__head"><h2>نتایج پیشنهادی</h2><a href="./search?q=${encodeURIComponent(query)}">مشاهده همه نتایج</a></div><div id="search-results" role="listbox">${state.searchResults.slice(0,6).map((product, index) => `<a class="search-result ${index === state.searchIndex ? 'is-active' : ''}" href="./product?id=${product.id}" role="option" aria-selected="${index === state.searchIndex}" data-search-index="${index}"><img src="${product.image}" alt="" width="64" height="76"><span><strong>${product.name}</strong><small>${product.category}</small></span><strong>${formatPrice(product.price)}</strong></a>`).join('')}</div></section>`;
};
const runSearch = debounce(async query => { const clean = query.trim(); if (!clean) { state.searchResults = []; state.searchIndex = -1; renderSearchIdle(); return; } renderSearchLoading(); state.searchResults = await api.search(clean); state.searchIndex = -1; renderSearchResults(clean); }, 220);
const saveSearch = term => { const clean = term.trim(); if (!clean) return; state.recentSearches = [clean, ...state.recentSearches.filter(item => item !== clean)].slice(0, 5); localStore.set('toto-recent-searches', state.recentSearches); };

const renderMobileStep = () => {
  document.getElementById('login-content').innerHTML = `<div class="dialog__intro"><h3>خوش آمدید</h3><p>برای ورود یا ساخت حساب، شماره موبایل خود را وارد کنید.</p></div><form id="mobile-form" novalidate><div class="field"><label for="login-mobile">شماره موبایل</label><input class="input" id="login-mobile" name="mobile" inputmode="numeric" autocomplete="tel" placeholder="۰۹۱۲۱۲۳۴۵۶۷" maxlength="11" aria-describedby="mobile-error"><div class="field-message field-message--error" id="mobile-error"></div></div><button class="button button--block" style="margin-top:18px" type="submit">دریافت کد تأیید</button></form><p class="dialog-legal">با ادامه، قوانین استفاده و حریم خصوصی توتو را می‌پذیرید.</p>`;
  document.getElementById('mobile-form').addEventListener('submit', requestOtp);
};
const requestOtp = async event => {
  event.preventDefault(); const form = event.currentTarget; const input = form.elements.mobile; const error = document.getElementById('mobile-error'); const button = form.querySelector('button[type="submit"]'); error.textContent = ''; button.disabled = true; button.textContent = 'در حال ارسال...';
  try { const result = await api.requestOtp(input.value); state.otpMobile = result.normalizedMobile; renderOtpStep(); } catch (err) { input.setAttribute('aria-invalid', 'true'); error.textContent = err.message; input.focus(); } finally { button.disabled = false; button.textContent = 'دریافت کد تأیید'; }
};
const renderOtpStep = () => {
  document.getElementById('login-content').innerHTML = `<div class="dialog__intro"><h3>کد تأیید را وارد کنید</h3><p>کد پنج‌رقمی برای ${state.otpMobile} ارسال شد.</p><button class="text-button" type="button" data-action="change-mobile">تغییر شماره</button></div><form id="otp-form" novalidate><div class="otp-inputs" dir="ltr">${Array.from({length:5}, (_, i) => `<input inputmode="numeric" autocomplete="${i === 0 ? 'one-time-code' : 'off'}" maxlength="1" aria-label="رقم ${i + 1} کد تأیید">`).join('')}</div><div class="field-message field-message--error" id="otp-error"></div><button class="button button--block" type="submit">ورود به حساب</button></form><div class="otp-resend"><button class="text-button" id="resend-otp" type="button" disabled>ارسال مجدد</button><span id="otp-countdown"></span></div><p class="mock-note">کد تأیید ارسال‌شده به شماره موبایل را وارد کنید.</p>`;
  const form = document.getElementById('otp-form'); const inputs = [...form.querySelectorAll('input')];
  inputs.forEach((input, index) => { input.addEventListener('input', () => { input.value = toEnglishDigits(input.value).replace(/\D/g, '').slice(-1); if (input.value) inputs[index + 1]?.focus(); }); input.addEventListener('keydown', event => { if (event.key === 'Backspace' && !input.value) inputs[index - 1]?.focus(); }); input.addEventListener('paste', event => { event.preventDefault(); const digits = toEnglishDigits(event.clipboardData.getData('text')).replace(/\D/g, '').slice(0,5); digits.split('').forEach((digit, i) => { if (inputs[i]) inputs[i].value = digit; }); inputs[Math.min(digits.length,4)]?.focus(); }); });
  form.addEventListener('submit', verifyOtp);
  document.getElementById('resend-otp')?.addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true; button.textContent = 'در حال ارسال...';
    try { await api.requestOtp(state.otpMobile); toast('کد تازه ارسال شد.'); renderOtpStep(); }
    catch (error) { document.getElementById('otp-error').textContent = error.message; button.disabled = false; button.textContent = 'ارسال مجدد'; }
  });
  inputs[0].focus(); startOtpTimer(120);
};
const startOtpTimer = seconds => { clearInterval(state.otpTimer); let remaining = seconds; const tick = () => { const output = document.getElementById('otp-countdown'); const resend = document.getElementById('resend-otp'); if (!output || !resend) return clearInterval(state.otpTimer); if (remaining <= 0) { output.textContent = 'کد منقضی شد'; resend.disabled = false; clearInterval(state.otpTimer); return; } output.textContent = `ارسال مجدد تا ${toPersianDigits(Math.floor(remaining/60))}:${toPersianDigits(String(remaining%60).padStart(2,'0'))}`; remaining -= 1; }; tick(); state.otpTimer = setInterval(tick, 1000); };
const renderAccountStep = () => {
  const session = localStore.get('toto-session', null);
  document.getElementById('login-content').innerHTML = `<div class="dialog__intro"><h3>شما وارد حساب شده‌اید</h3><p>${session?.customer?.firstName || 'کاربر توتو'}، شماره ${toPersianDigits(session?.customer?.mobile || state.otpMobile || '')}</p></div><a class="button button--block" href="./account">ورود به حساب من</a><button class="button button--outline button--block" style="margin-top:10px" type="button" data-action="logout">خروج از حساب</button>`;
};
const verifyOtp = async event => { event.preventDefault(); const form = event.currentTarget; const inputs = [...form.querySelectorAll('input')]; const code = inputs.map(input => input.value).join(''); const error = document.getElementById('otp-error'); const button = form.querySelector('button'); if (code.length < 5) { error.textContent = 'کد پنج‌رقمی را کامل وارد کنید.'; inputs.find(input => !input.value)?.focus(); return; } button.disabled = true; button.textContent = 'در حال بررسی...'; try { const result = await api.verifyOtp(code); result.customer.mobile = toEnglishDigits(state.otpMobile); localStore.set('toto-session', result); document.dispatchEvent(new CustomEvent('toto:auth-changed', { detail: result })); const returnTarget = new URLSearchParams(location.search).get('return') || sessionStore.get('toto-auth-return', ''); closeOverlay(document.getElementById('login-dialog')); toast('ورود شما با موفقیت انجام شد.'); if (document.body.dataset.page === 'login') { const safeTarget = returnTarget && !returnTarget.includes('://') && !returnTarget.startsWith('//') ? returnTarget : '/'; setTimeout(() => { location.href = safeTarget.startsWith('.') ? safeTarget : `./${safeTarget}`; }, 250); } document.querySelectorAll('[data-action="open-login"] span').forEach(span => { if (span.textContent === 'ورود') span.textContent = 'حساب من'; }); } catch (err) { error.textContent = err.message; inputs.forEach(input => { input.value = ''; }); inputs[0].focus(); } finally { button.disabled = false; button.textContent = 'ورود به حساب'; } };

const renderProductSheet = product => {
  state.sheetProduct = product; state.selectedSize = null; state.selectedColor = 0; state.quantity = 1;
  document.getElementById('product-sheet-title').textContent = product.name;
  document.getElementById('product-sheet-content').innerHTML = `<div class="product-sheet__summary"><img src="${product.image}" alt="${product.imageAlt}" width="90" height="118"><div><h3>${product.name}</h3><p>${product.stockNote || product.category}</p><strong>${formatPrice(product.price)}</strong></div></div><span class="choice-label">رنگ</span><div class="choice-row">${product.colors.map((color,index) => `<button class="choice" type="button" data-sheet-color="${index}" aria-pressed="${index === 0}"><span class="swatch" style="--swatch:${color}"></span><span>${product.colorNames[index]}</span></button>`).join('')}</div><span class="choice-label">سایز</span><div class="choice-row">${product.sizes.map(size => `<button class="choice" type="button" data-sheet-size="${size}" aria-pressed="false">${size}</button>`).join('')}</div><span class="choice-label">تعداد</span><div class="quantity"><button type="button" data-action="increase-quantity" aria-label="افزایش تعداد">${icon('plus')}</button><output id="sheet-quantity">۱</output><button type="button" data-action="decrease-quantity" aria-label="کاهش تعداد">${icon('minus')}</button></div><div class="field-message field-message--error" id="sheet-error"></div><button class="button button--block" type="button" data-action="add-sheet-to-cart">افزودن به سبد خرید</button>`;
};
const addToCart = async ({ product, size, colorIndex = 0, quantity = 1 }) => { await api.addToCart({ productId: product.id, name: product.name, size, colorIndex, quantity, price: product.price }); addCartItem({ productId: product.id, size, colorIndex, quantity }); updateCounters(); announce(`${product.name} به سبد خرید اضافه شد.`); toast(`${product.name} به سبد خرید اضافه شد.`); };

const handleAction = async (action, trigger) => {
  if (action === 'dismiss-announcement') { sessionStore.set('toto-announcement-dismissed', true); document.getElementById('announcement-bar')?.remove(); }
  if (action === 'open-drawer') openOverlay(document.getElementById('mobile-drawer'), '[data-action="close-drawer"]');
  if (action === 'close-drawer') closeOverlay(document.getElementById('mobile-drawer'));
  if (action === 'open-search') { renderSearchIdle(); openOverlay(document.getElementById('search-overlay'), '#site-search'); }
  if (action === 'close-search') closeOverlay(document.getElementById('search-overlay'));
  if (action === 'open-login') { sessionStore.set('toto-auth-return', `${location.pathname.split('/').pop()}${location.search}${location.hash}`); localStore.get('toto-session', null) ? renderAccountStep() : renderMobileStep(); openOverlay(document.getElementById('login-dialog'), localStore.get('toto-session', null) ? '[data-action=\"logout\"]' : '#login-mobile'); }
  if (action === 'close-login') closeOverlay(document.getElementById('login-dialog'));
  if (action === 'change-mobile') renderMobileStep();
  if (action === 'logout') { try { await api.logout(); } catch {} localStore.remove('toto-session'); document.dispatchEvent(new CustomEvent('toto:auth-changed')); closeOverlay(document.getElementById('login-dialog')); renderMobileStep(); toast('از حساب خود خارج شدید.', 'info'); }
  if (action === 'clear-search-history') { state.recentSearches = []; localStore.set('toto-recent-searches', []); renderSearchIdle(); }
  if (action === 'cart-summary') location.href = './cart';
  if (action === 'show-support') toast('پشتیبانی خرید: شنبه تا پنجشنبه، ساعت ۹ تا ۱۸.', 'info');
  if (action === 'toggle-save') {
    const id = trigger.dataset.id;
    const saved = localStore.get('toto-saved', []);
    const isSaved = saved.includes(id);
    localStore.set('toto-saved', isSaved ? saved.filter(item => item !== id) : [...saved, id]);
    document.querySelectorAll(`[data-action="toggle-save"][data-id="${id}"]`).forEach(button => {
      button.setAttribute('aria-pressed', String(!isSaved));
      button.setAttribute('aria-label', isSaved ? 'افزودن به علاقه‌مندی‌ها' : 'حذف از علاقه‌مندی‌ها');
      button.innerHTML = icon(isSaved ? 'heart' : 'heart-filled');
    });
    toast(isSaved ? 'از علاقه‌مندی‌ها حذف شد.' : 'به علاقه‌مندی‌ها اضافه شد.', 'info');
  }
  if (action === 'quick-add') { const product = products.find(item => item.id === trigger.dataset.id); await addToCart({ product, size: trigger.dataset.size }); }
  if (action === 'open-product-sheet') { const product = products.find(item => item.id === trigger.dataset.id); renderProductSheet(product); openOverlay(document.getElementById('product-sheet'), '[data-sheet-size]'); }
  if (action === 'close-product-sheet') closeOverlay(document.getElementById('product-sheet'));
  if (action === 'increase-quantity') { state.quantity = Math.min(5, state.quantity + 1); document.getElementById('sheet-quantity').textContent = toPersianDigits(state.quantity); }
  if (action === 'decrease-quantity') { state.quantity = Math.max(1, state.quantity - 1); document.getElementById('sheet-quantity').textContent = toPersianDigits(state.quantity); }
  if (action === 'add-sheet-to-cart') { const error = document.getElementById('sheet-error'); if (!state.selectedSize) { error.textContent = 'لطفاً یک سایز انتخاب کنید.'; document.querySelector('[data-sheet-size]')?.focus(); return; } trigger.disabled = true; trigger.textContent = 'در حال افزودن...'; await addToCart({ product: state.sheetProduct, size: state.selectedSize, colorIndex: state.selectedColor, quantity: state.quantity }); closeOverlay(document.getElementById('product-sheet')); }
};

const bindEvents = () => {
  document.addEventListener('click', event => {
    const actionTarget = event.target.closest('[data-action]'); if (actionTarget) handleAction(actionTarget.dataset.action, actionTarget);
    const searchTerm = event.target.closest('[data-search-term]'); if (searchTerm && !event.target.closest('[data-remove-search]')) { const input = document.getElementById('site-search'); input.value = searchTerm.dataset.searchTerm; input.focus(); runSearch(input.value); }
    const removeTerm = event.target.closest('[data-remove-search]'); if (removeTerm) { event.preventDefault(); event.stopPropagation(); state.recentSearches = state.recentSearches.filter(term => term !== removeTerm.dataset.removeSearch); localStore.set('toto-recent-searches', state.recentSearches); renderSearchIdle(); }
    const sizeChoice = event.target.closest('[data-sheet-size]'); if (sizeChoice) { document.querySelectorAll('[data-sheet-size]').forEach(button => button.setAttribute('aria-pressed','false')); sizeChoice.setAttribute('aria-pressed','true'); state.selectedSize = sizeChoice.dataset.sheetSize; }
    const colorChoice = event.target.closest('[data-sheet-color]'); if (colorChoice) { document.querySelectorAll('[data-sheet-color]').forEach(button => button.setAttribute('aria-pressed','false')); colorChoice.setAttribute('aria-pressed','true'); state.selectedColor = Number(colorChoice.dataset.sheetColor); }
    const swatch = event.target.closest('.product-card__swatches .swatch'); if (swatch) {
      swatch.parentElement.querySelectorAll('.swatch').forEach(button => button.setAttribute('aria-pressed','false'));
      swatch.setAttribute('aria-pressed','true');
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
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && state.activeOverlay) closeOverlay(state.activeOverlay); if (state.activeOverlay) trapFocus(event, state.activeOverlay); if (document.activeElement?.id === 'site-search' && ['ArrowDown','ArrowUp','Enter'].includes(event.key)) { if (event.key === 'Enter' && !state.searchResults.length) { event.preventDefault(); saveSearch(document.activeElement.value); location.href = `./search?q=${encodeURIComponent(document.activeElement.value)}`; return; } if (!state.searchResults.length) return; event.preventDefault(); if (event.key === 'ArrowDown') state.searchIndex = (state.searchIndex + 1) % state.searchResults.length; if (event.key === 'ArrowUp') state.searchIndex = (state.searchIndex - 1 + state.searchResults.length) % state.searchResults.length; if (event.key === 'Enter') { const chosen = state.searchResults[Math.max(0,state.searchIndex)]; saveSearch(chosen.name); location.href = `./product?id=${chosen.id}`; return; } renderSearchResults(document.activeElement.value); document.getElementById('site-search')?.focus(); } });
  document.addEventListener('toto:cart-updated', updateCounters);
  document.getElementById('newsletter-form')?.addEventListener('submit', event => { event.preventDefault(); const input = event.currentTarget.querySelector('input'); const message = document.getElementById('newsletter-message'); if (!/^09\d{9}$/.test(toEnglishDigits(input.value))) { message.textContent = 'شماره موبایل را به‌صورت کامل وارد کنید.'; message.classList.add('field-message--error'); input.focus(); return; } message.textContent = 'عضویت شما ثبت شد.'; message.classList.remove('field-message--error'); input.value = ''; });
};

const initPage = () => {
  const page = document.body.dataset.page;
  if (page === 'home') initHome();
  if (page === 'shop' || page === 'search') initCatalog();
  if (page === 'product') initProduct({ toast });
  if (page === 'saved') initCollection();
  if (page === 'gallery') initCustomerGallery({ toast });
  if (page === 'size-guide') initSizeGuide();
  if (page === 'cart') initCart({ toast });
  if (page === 'checkout') initCheckout({ toast });
  if (page === 'order-review') initOrderReview({ toast });
  if (['payment-success','payment-failed','payment-pending'].includes(page)) initPayment({ toast });
  if (page === 'account') initAccount({ toast });
  if (page === 'orders') initOrders();
  if (page === 'order-details') initOrderDetails({ toast });
  if (page === 'order-tracking') initOrderTracking({ toast });
  if (page === 'return-request') initReturnRequest({ toast });
  initContentPages({ toast });
};

const init = async () => {
  mountShell(); document.body.insertAdjacentHTML('beforeend', overlaysTemplate());
  if (sessionStore.get('toto-announcement-dismissed', false)) document.getElementById('announcement-bar')?.remove();
  try { replaceProducts(await api.getProducts()); } catch (error) { console.warn('Product API unavailable; using bundled data.', error); }
  updateCounters(); bindEvents(); initPage();
  const session = localStore.get('toto-session', null);
  if (session) document.querySelectorAll('[data-action="open-login"] span').forEach(span => { if (span.textContent === 'ورود') span.textContent = 'حساب من'; });
  if (new URLSearchParams(location.search).get('auth') === 'login' || document.body.dataset.page === 'login') { session ? renderAccountStep() : renderMobileStep(); openOverlay(document.getElementById('login-dialog'), session ? '[data-action="logout"]' : '#login-mobile'); }
};
init().catch(error => console.error('App init failed', error));
