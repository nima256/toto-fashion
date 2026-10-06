import { provinces } from '../../data/checkout-data.js';
import { localStore } from '../core/storage.js';
import { api } from '../services/api.js';
import { cartLines, getCart } from '../core/commerce.js';
import { getSession } from '../core/account-store.js';
import { site } from '../core/site-store.js';
import { formatPrice, icon, toEnglishDigits, toPersianDigits, escapeHtml as esc, safeImage, debounce, fieldErrors } from '../core/utils.js';

const emptyRedirect = () => `<section class="commerce-empty"><span class="commerce-empty__icon">${icon('bag', 'icon icon--lg')}</span><h1>سبد خرید شما خالی است</h1><p>برای ثبت اطلاعات ارسال، ابتدا محصولی به سبد خرید اضافه کنید.</p><a class="button" href="./shop">مشاهده محصولات</a></section>`;

const stepsTemplate = active => `<ol class="checkout-steps" aria-label="مراحل ثبت سفارش">
  ${[['cart', 'سبد خرید'], ['shipping', 'اطلاعات ارسال'], ['review', 'مرور و پرداخت']].map(([key, label], index) => `<li class="${key === active ? 'is-active' : index < ['cart', 'shipping', 'review'].indexOf(active) ? 'is-done' : ''}" ${key === active ? 'aria-current="step"' : ''}><span>${index < ['cart', 'shipping', 'review'].indexOf(active) ? icon('check', 'icon icon--sm') : toPersianDigits(index + 1)}</span><strong>${label}</strong></li>`).join('')}
</ol>`;

const optionList = (items, selected) => items.map(item => `<option value="${esc(item)}" ${item === selected ? 'selected' : ''}>${esc(item)}</option>`).join('');

export const initCheckout = async ({ toast }) => {
  const root = document.getElementById('checkout-root');
  if (!root) return;
  const cart = getCart();
  if (!cart.length) { root.innerHTML = emptyRedirect(); return; }

  let config = site.checkout;
  if (!config) { try { config = await api.getCheckoutConfig(); } catch (error) { root.innerHTML = `<section class="commerce-empty"><span class="commerce-empty__icon">${icon('error', 'icon icon--lg')}</span><h1>تنظیمات ارسال دریافت نشد</h1><p>${esc(error.message)}</p><button class="button" type="button" data-action="reload-page">تلاش دوباره</button></section>`; return; } }
  const shippingMethods = config.shippingMethods || [];

  const session = getSession();
  let addresses = [];
  if (session) {
    try { addresses = await api.getAddresses(); localStore.set('toto-addresses', addresses); }
    catch { addresses = []; }
  }
  const draft = localStore.get('toto-checkout-draft', {}) || {};
  const addressQuery = new URLSearchParams(location.search);
  const requestedEdit = addressQuery.get('edit');
  let selectedAddressId = addressQuery.get('address') === 'new' ? 'new' : (requestedEdit || draft.addressId || addresses.find(a => a.isDefault)?.id || addresses[0]?.id || 'new');
  if (selectedAddressId !== 'new' && !addresses.some(address => address.id === selectedAddressId)) selectedAddressId = addresses[0]?.id || 'new';
  let selectedShipping = shippingMethods.some(m => m.id === draft.shippingMethod) ? draft.shippingMethod : 'standard';
  let formData = selectedAddressId === 'new' ? (addressQuery.get('address') === 'new' ? {} : (draft.address || {})) : { ...(addresses.find(address => address.id === selectedAddressId) || {}) };
  let editingId = selectedAddressId !== 'new' ? selectedAddressId : null;
  let quote = null; let quoteError = '';
  const isPickup = () => selectedShipping === 'pickup';

  const provinceCities = province => provinces.find(item => item.name === province)?.cities || [];
  const methodAvailable = method => !method.province || (formData.province === method.province && formData.city === method.city);
  const availableMethods = () => shippingMethods.filter(methodAvailable);

  const addressCards = () => `<div class="address-cards" role="radiogroup" aria-label="آدرس‌های ذخیره‌شده" ${isPickup() ? 'hidden' : ''}>
    ${addresses.map(address => `<label class="address-card ${selectedAddressId === address.id ? 'is-selected' : ''}"><input type="radio" name="saved-address" value="${esc(address.id)}" ${selectedAddressId === address.id ? 'checked' : ''}><span class="address-card__head"><strong>${esc(address.title || 'آدرس من')}</strong><button class="text-button" type="button" data-checkout-action="edit-address" data-id="${esc(address.id)}">ویرایش</button></span><span>${esc(address.firstName)} ${esc(address.lastName)}</span><span>${esc(address.province)}، ${esc(address.city)}، ${esc(address.address)}</span><span>${esc(toPersianDigits(address.mobile))}</span></label>`).join('')}
    <label class="address-card address-card--new ${selectedAddressId === 'new' ? 'is-selected' : ''}"><input type="radio" name="saved-address" value="new" ${selectedAddressId === 'new' ? 'checked' : ''}><span>${icon('plus')}<strong>افزودن آدرس جدید</strong></span></label>
  </div>`;

  const field = (name, label, attrs = '', deliveryOnly = false) => `<div class="field" ${deliveryOnly && isPickup() ? 'hidden' : ''}><label for="${name}">${label}</label><input class="input" id="${name}" name="${name}" value="${esc(formData[name] || '')}" ${attrs} aria-describedby="${name}-error"><div class="field-message field-message--error" id="${name}-error"></div></div>`;

  const formTemplate = () => `<div class="address-form" id="address-form">
    ${isPickup() ? `<div class="page-notice page-notice--info">${icon('info')}<div><strong>تحویل حضوری از فروشگاه</strong><p>برای تحویل حضوری فقط نام گیرنده و شماره موبایل لازم است؛ زمان آماده‌شدن سفارش پیامک می‌شود.</p></div></div>` : ''}
    <div class="form-grid form-grid--2">${field('firstName', 'نام', 'autocomplete="given-name" maxlength="60"')}${field('lastName', 'نام خانوادگی', 'autocomplete="family-name" maxlength="60"')}</div>
    ${field('mobile', 'شماره موبایل', 'inputmode="numeric" autocomplete="tel" maxlength="11" placeholder="۰۹۱۲۱۲۳۴۵۶۷"')}
    <div class="form-grid form-grid--2" ${isPickup() ? 'hidden' : ''}><div class="field"><label for="province">استان</label><select class="input" id="province" name="province" aria-describedby="province-error"><option value="">انتخاب استان</option>${optionList(provinces.map(item => item.name), formData.province)}</select><div class="field-message field-message--error" id="province-error"></div></div><div class="field"><label for="city">شهر</label><select class="input" id="city" name="city" aria-describedby="city-error" ${formData.province ? '' : 'disabled'}><option value="">انتخاب شهر</option>${optionList(provinceCities(formData.province), formData.city)}</select><div class="field-message field-message--error" id="city-error"></div></div></div>
    ${field('postalCode', 'کد پستی ده‌رقمی', 'inputmode="numeric" autocomplete="postal-code" maxlength="10"', true)}
    <div class="form-grid form-grid--2" ${isPickup() ? 'hidden' : ''}>${field('buildingNumber', 'پلاک', 'inputmode="numeric" maxlength="20"')}${field('unit', 'واحد (اختیاری)', 'inputmode="numeric" maxlength="20"')}</div>
    <div class="field" ${isPickup() ? 'hidden' : ''}><label for="address">نشانی کامل</label><textarea class="input input--textarea" id="address" name="address" rows="3" maxlength="400" autocomplete="street-address" aria-describedby="address-error">${esc(formData.address || '')}</textarea><div class="field-message field-message--error" id="address-error"></div></div>
    <div class="field"><label for="notes">توضیحات سفارش (اختیاری)</label><textarea class="input input--textarea" id="notes" name="notes" rows="2" maxlength="500" placeholder="مثلاً زمان مناسب تماس با گیرنده">${esc(draft.notes || formData.notes || '')}</textarea><div class="field-message">اطلاعات حساس یا رمز در این بخش وارد نکنید.</div></div>
    ${session && !isPickup() ? '<label class="check-row"><input type="checkbox" id="save-address" checked><span>این آدرس در حساب من ذخیره شود</span></label>' : ''}
  </div>`;

  const optionPrice = method => { const fromQuote = quote?.shippingOptions?.find(item => item.id === method.id); return fromQuote ? fromQuote.effectivePrice : null; };
  const shippingTemplate = () => `<fieldset class="shipping-methods"><legend>روش ارسال</legend>${availableMethods().map(method => {
    const price = optionPrice(method);
    return `<label class="shipping-option ${selectedShipping === method.id ? 'is-selected' : ''}"><input type="radio" name="shipping-method" value="${esc(method.id)}" ${selectedShipping === method.id ? 'checked' : ''}><span class="shipping-option__mark">${icon('truck')}</span><span><strong>${esc(method.title)}</strong><small>${esc(method.description)}</small></span><b>${price === null ? '…' : price === 0 ? 'رایگان' : formatPrice(price)}</b></label>`;
  }).join('')}</fieldset>`;

  const summaryTemplate = () => {
    const lines = cartLines(cart);
    return `<aside class="order-summary checkout-summary" aria-labelledby="checkout-summary-title"><h2 id="checkout-summary-title">خلاصه سفارش</h2><div class="summary-products">${lines.map(line => `<div><img src="${safeImage(line.product?.image)}" alt="" width="54" height="72"><span><strong>${esc(line.product?.name || line.item.name)}</strong><small>سایز ${esc(line.item.size)} · تعداد ${toPersianDigits(line.item.quantity)}</small></span><b>${formatPrice(line.lineTotal)}</b></div>`).join('')}</div>${quote ? `<dl class="price-list"><div><dt>جمع محصولات</dt><dd>${formatPrice(quote.amounts.merchandiseSubtotal)}</dd></div><div><dt>ارسال</dt><dd>${quote.amounts.shipping ? formatPrice(quote.amounts.shipping) : 'رایگان'}</dd></div></dl><div class="price-total"><span>مبلغ فعلی سفارش</span><strong>${formatPrice(quote.amounts.total)}</strong></div>` : `<p class="field-message ${quoteError ? 'field-message--error' : ''}">${esc(quoteError || 'در حال محاسبه مبلغ از سرور...')}</p>`}${quote?.problems?.length ? `<div class="field-message field-message--error">${esc(quote.problems[0].message)}</div>` : ''}<button class="button button--block" type="submit" form="checkout-form-shell" ${quote?.problems?.length ? 'disabled' : ''}>ادامه به مرور سفارش</button><a class="button button--ghost button--block" href="./cart">بازگشت به سبد خرید</a></aside>`;
  };

  const render = () => {
    if (!availableMethods().some(method => method.id === selectedShipping)) selectedShipping = 'standard';
    root.innerHTML = `${stepsTemplate('shipping')}<header class="commerce-header"><div><p class="eyebrow">مرحله دوم از سه مرحله</p><h1>اطلاعات ارسال</h1><p>روش تحویل و اطلاعات گیرنده را بررسی کنید.</p></div></header><form id="checkout-form-shell" novalidate><div class="checkout-layout"><div class="checkout-content"><section class="checkout-section"><div class="checkout-section__head"><span>۱</span><div><h2>شیوه ارسال</h2><p>هزینه ارسال توسط سرور و پیش از پرداخت نهایی محاسبه می‌شود.</p></div></div>${shippingTemplate()}</section><section class="checkout-section"><div class="checkout-section__head"><span>۲</span><div><h2>${isPickup() ? 'اطلاعات تحویل‌گیرنده' : 'آدرس تحویل'}</h2><p>${isPickup() ? 'سفارش با همین نام و شماره موبایل تحویل داده می‌شود.' : 'نشانی دقیق به تحویل سریع‌تر سفارش کمک می‌کند.'}</p></div></div>${session ? addressCards() : ''}${formTemplate()}</section></div>${summaryTemplate()}</div></form>`;
    bindFormState();
  };

  const readForm = () => {
    const form = document.getElementById('checkout-form-shell');
    if (!form) return formData;
    const raw = Object.fromEntries(new FormData(form).entries());
    formData = { firstName: raw.firstName || '', lastName: raw.lastName || '', mobile: raw.mobile || '', province: raw.province ?? formData.province ?? '', city: raw.city ?? formData.city ?? '', postalCode: raw.postalCode || '', buildingNumber: raw.buildingNumber || '', unit: raw.unit || '', address: raw.address || '', notes: raw.notes || '' };
    return formData;
  };

  const refreshQuote = debounce(async () => {
    try {
      const address = isPickup() ? undefined : { province: formData.province || undefined, city: formData.city || undefined };
      quote = await api.quote(cart, { shippingMethodId: selectedShipping, address: address?.province && address?.city ? address : undefined }); quoteError = '';
    } catch (error) { quote = null; quoteError = error.message; }
    const summary = document.querySelector('.checkout-summary'); if (summary) summary.outerHTML = summaryTemplate();
    const methods = document.querySelector('.shipping-methods'); if (methods) methods.outerHTML = shippingTemplate();
  }, 200);

  const clearErrors = form => { form.querySelectorAll('[aria-invalid="true"]').forEach(input => input.removeAttribute('aria-invalid')); form.querySelectorAll('.field-message--error').forEach(output => { output.textContent = ''; }); };
  const setError = (name, message) => {
    const input = document.getElementById(name); const output = document.getElementById(`${name}-error`);
    input?.setAttribute('aria-invalid', 'true'); if (output) output.textContent = message;
  };

  // در تحویل حضوری فقط نام و موبایل لازم است؛ فیلدهای نشانی فقط برای ارسال پستی بررسی می‌شوند
  const validate = () => {
    const form = document.getElementById('address-form');
    clearErrors(form);
    const data = readForm();
    const errors = {};
    if (data.firstName.trim().length < 2) errors.firstName = 'نام را حداقل با دو حرف وارد کنید.';
    if (data.lastName.trim().length < 2) errors.lastName = 'نام خانوادگی را کامل وارد کنید.';
    if (!/^09\d{9}$/.test(toEnglishDigits(data.mobile).trim())) errors.mobile = 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.';
    if (!isPickup()) {
      if (!data.province) errors.province = 'استان را انتخاب کنید.';
      if (!data.city) errors.city = 'شهر را انتخاب کنید.';
      if (!/^\d{10}$/.test(toEnglishDigits(data.postalCode).trim())) errors.postalCode = 'کد پستی باید دقیقاً ۱۰ رقم باشد.';
      if (!data.buildingNumber.trim()) errors.buildingNumber = 'پلاک را وارد کنید.';
      if (data.address.trim().length < 10) errors.address = 'نشانی کامل را با نام خیابان و کوچه وارد کنید.';
    }
    Object.entries(errors).forEach(([name, message]) => setError(name, message));
    const first = Object.keys(errors)[0];
    if (first) { document.getElementById(first)?.focus(); document.getElementById(first)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
    return true;
  };

  const persistDraft = () => {
    const data = readForm();
    localStore.set('toto-checkout-draft', { addressId: selectedAddressId, address: data, shippingMethod: selectedShipping, notes: data.notes || '' });
  };

  const bindFormState = () => {
    document.getElementById('address-form')?.addEventListener('input', persistDraft);
    document.getElementById('province')?.addEventListener('change', event => {
      formData = readForm(); formData.province = event.target.value; formData.city = ''; render(); refreshQuote(); document.getElementById('city')?.focus();
    });
  };

  root.addEventListener('change', event => {
    if (event.target.name === 'saved-address') {
      selectedAddressId = event.target.value;
      editingId = selectedAddressId === 'new' ? null : selectedAddressId;
      formData = selectedAddressId === 'new' ? {} : { ...addresses.find(address => address.id === selectedAddressId) };
      render(); refreshQuote();
    }
    if (event.target.name === 'shipping-method') { formData = readForm(); selectedShipping = event.target.value; persistDraft(); render(); refreshQuote(); }
    if (event.target.id === 'city') { formData = readForm(); persistDraft(); render(); refreshQuote(); }
  });

  root.addEventListener('click', event => {
    const trigger = event.target.closest('[data-checkout-action="edit-address"]');
    if (!trigger) return;
    event.preventDefault(); selectedAddressId = trigger.dataset.id; editingId = trigger.dataset.id; formData = { ...addresses.find(address => address.id === selectedAddressId) }; render(); document.getElementById('firstName')?.focus();
  });

  root.addEventListener('submit', async event => {
    if (event.target.id !== 'checkout-form-shell') return;
    event.preventDefault();
    if (!validate()) { toast('لطفاً خطاهای فرم را برطرف کنید.', 'error'); return; }
    const data = readForm();
    data.mobile = toEnglishDigits(data.mobile).trim(); data.postalCode = toEnglishDigits(data.postalCode).trim();
    const address = isPickup() ? { firstName: data.firstName.trim(), lastName: data.lastName.trim(), mobile: data.mobile } : { firstName: data.firstName.trim(), lastName: data.lastName.trim(), mobile: data.mobile, province: data.province, city: data.city, postalCode: data.postalCode, buildingNumber: data.buildingNumber.trim(), unit: data.unit.trim(), address: data.address.trim() };
    if (!isPickup() && session && document.getElementById('save-address')?.checked) {
      const payload = { ...address, title: editingId ? (addresses.find(item => item.id === editingId)?.title || 'آدرس من') : 'آدرس جدید' };
      try { const saved = editingId ? await api.updateAddress(editingId, payload) : await api.createAddress(payload); addresses = editingId ? addresses.map(item => item.id === editingId ? saved : item) : [...addresses, saved]; selectedAddressId = saved.id; editingId = saved.id; localStore.set('toto-addresses', addresses); }
      catch (error) { const errors = fieldErrors(error); Object.entries(errors).forEach(([name, message]) => setError(name, message)); toast(error.message || 'ذخیره آدرس در حساب انجام نشد.', 'error'); return; }
    }
    const shippingMethod = shippingMethods.find(method => method.id === selectedShipping) || shippingMethods[0];
    localStore.set('toto-checkout', { addressId: selectedAddressId, address, shippingMethodId: shippingMethod.id, shippingMethod: { id: shippingMethod.id, title: shippingMethod.title, description: shippingMethod.description }, notes: data.notes || '', savedAt: new Date().toISOString() });
    localStore.set('toto-checkout-draft', { addressId: selectedAddressId, address: data, shippingMethod: selectedShipping, notes: data.notes || '' });
    location.href = './order-review';
  });

  render();
  refreshQuote();
};
