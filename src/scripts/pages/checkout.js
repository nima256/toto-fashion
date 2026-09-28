import { provinces, shippingMethods, mockSavedAddresses, freeShippingThreshold } from '../../data/checkout-data.js';
import { localStore } from '../core/storage.js';
import { api } from '../services/api.js';
import { calculateCart, getCart } from '../core/commerce.js';
import { formatPrice, icon, toEnglishDigits, toPersianDigits } from '../core/utils.js';

const emptyRedirect = () => `<section class="commerce-empty"><span class="commerce-empty__icon">${icon('bag','icon icon--lg')}</span><h1>سبد خرید شما خالی است</h1><p>برای ثبت اطلاعات ارسال، ابتدا محصولی به سبد خرید اضافه کنید.</p><a class="button" href="./shop">مشاهده محصولات</a></section>`;

const stepsTemplate = active => `<ol class="checkout-steps" aria-label="مراحل ثبت سفارش">
  ${[['cart','سبد خرید'],['shipping','اطلاعات ارسال'],['review','مرور و پرداخت']].map(([key,label], index) => `<li class="${key === active ? 'is-active' : index < ['cart','shipping','review'].indexOf(active) ? 'is-done' : ''}" ${key === active ? 'aria-current="step"' : ''}><span>${index < ['cart','shipping','review'].indexOf(active) ? icon('check','icon icon--sm') : toPersianDigits(index + 1)}</span><strong>${label}</strong></li>`).join('')}
</ol>`;

const optionList = items => items.map(item => `<option value="${item}">${item}</option>`).join('');

export const initCheckout = async ({ toast }) => {
  const root = document.getElementById('checkout-root');
  if (!root) return;
  const cart = getCart();
  if (!cart.length) { root.innerHTML = emptyRedirect(); return; }

  const session = localStore.get('toto-session', null);
  let addresses = localStore.get('toto-addresses', []);
  if (session) {
    try { addresses = await api.getAddresses(); localStore.set('toto-addresses', addresses); }
    catch { if (!addresses.length) addresses = []; }
  }
  const draft = localStore.get('toto-checkout-draft', {});
  const addressQuery = new URLSearchParams(location.search);
  const requestedEdit = addressQuery.get('edit');
  let selectedAddressId = addressQuery.get('address') === 'new' ? 'new' : (requestedEdit || draft.addressId || addresses[0]?.id || 'new');
  if (selectedAddressId !== 'new' && !addresses.some(address => address.id === selectedAddressId)) selectedAddressId = addresses[0]?.id || 'new';
  let selectedShipping = draft.shippingMethod || 'standard';
  let formData = selectedAddressId === 'new' ? (addressQuery.get('address') === 'new' ? {} : (draft.address || {})) : (addresses.find(address => address.id === selectedAddressId) || {});
  let editingId = selectedAddressId !== 'new' ? selectedAddressId : null;

  const provinceCities = province => provinces.find(item => item.name === province)?.cities || [];
  const methodAvailable = method => !method.province || (formData.province === method.province && formData.city === method.city);
  const availableMethods = () => shippingMethods.filter(methodAvailable);

  const addressCards = () => `<div class="address-cards" role="radiogroup" aria-label="آدرس‌های ذخیره‌شده">
    ${addresses.map(address => `<label class="address-card ${selectedAddressId === address.id ? 'is-selected' : ''}"><input type="radio" name="saved-address" value="${address.id}" ${selectedAddressId === address.id ? 'checked' : ''}><span class="address-card__head"><strong>${address.title || 'آدرس من'}</strong><button class="text-button" type="button" data-checkout-action="edit-address" data-id="${address.id}">ویرایش</button></span><span>${address.firstName} ${address.lastName}</span><span>${address.province}، ${address.city}، ${address.address}</span><span>${toPersianDigits(address.mobile)}</span></label>`).join('')}
    <label class="address-card address-card--new ${selectedAddressId === 'new' ? 'is-selected' : ''}"><input type="radio" name="saved-address" value="new" ${selectedAddressId === 'new' ? 'checked' : ''}><span>${icon('plus')}<strong>افزودن آدرس جدید</strong></span></label>
  </div>`;

  const field = (name, label, attrs = '') => `<div class="field"><label for="${name}">${label}</label><input class="input" id="${name}" name="${name}" value="${formData[name] || ''}" ${attrs} aria-describedby="${name}-error"><div class="field-message field-message--error" id="${name}-error"></div></div>`;

  const formTemplate = () => `<div class="address-form" id="address-form">
    <div class="form-grid form-grid--2">${field('firstName','نام','autocomplete="given-name"')}${field('lastName','نام خانوادگی','autocomplete="family-name"')}</div>
    ${field('mobile','شماره موبایل','inputmode="numeric" autocomplete="tel" maxlength="11" placeholder="۰۹۱۲۱۲۳۴۵۶۷"')}
    <div class="form-grid form-grid--2"><div class="field"><label for="province">استان</label><select class="input" id="province" name="province" aria-describedby="province-error"><option value="">انتخاب استان</option>${provinces.map(item => `<option value="${item.name}" ${formData.province === item.name ? 'selected' : ''}>${item.name}</option>`).join('')}</select><div class="field-message field-message--error" id="province-error"></div></div><div class="field"><label for="city">شهر</label><select class="input" id="city" name="city" aria-describedby="city-error" ${formData.province ? '' : 'disabled'}><option value="">انتخاب شهر</option>${optionList(provinceCities(formData.province)).replace(`value="${formData.city}"`, `value="${formData.city}" selected`)}</select><div class="field-message field-message--error" id="city-error"></div></div></div>
    ${field('postalCode','کد پستی ده‌رقمی','inputmode="numeric" autocomplete="postal-code" maxlength="10"')}
    <div class="form-grid form-grid--2">${field('buildingNumber','پلاک','inputmode="numeric"')}${field('unit','واحد (اختیاری)','inputmode="numeric"')}</div>
    <div class="field"><label for="address">نشانی کامل</label><textarea class="input input--textarea" id="address" name="address" rows="3" autocomplete="street-address" aria-describedby="address-error">${formData.address || ''}</textarea><div class="field-message field-message--error" id="address-error"></div></div>
    <div class="field"><label for="notes">توضیحات سفارش (اختیاری)</label><textarea class="input input--textarea" id="notes" name="notes" rows="2" placeholder="مثلاً زمان مناسب تماس با گیرنده">${draft.notes || formData.notes || ''}</textarea><div class="field-message">اطلاعات حساس یا رمز در این بخش وارد نکنید.</div></div>
    <label class="check-row"><input type="checkbox" id="save-address" ${session ? 'checked' : ''}><span>این آدرس در حساب من ذخیره شود</span></label>
  </div>`;

  const shippingTemplate = () => `<fieldset class="shipping-methods"><legend>روش ارسال</legend>${availableMethods().map(method => {
    const effectivePrice = method.id === 'standard' && calculateCart({ cart }).merchandiseTotal >= freeShippingThreshold ? 0 : method.price;
    return `<label class="shipping-option ${selectedShipping === method.id ? 'is-selected' : ''}"><input type="radio" name="shipping-method" value="${method.id}" ${selectedShipping === method.id ? 'checked' : ''}><span class="shipping-option__mark">${icon('truck')}</span><span><strong>${method.title}</strong><small>${method.description}</small></span><b>${effectivePrice === 0 ? 'رایگان' : formatPrice(effectivePrice)}</b></label>`;
  }).join('')}</fieldset>`;

  const summaryTemplate = () => {
    const method = shippingMethods.find(item => item.id === selectedShipping) || shippingMethods[0];
    const summary = calculateCart({ cart, shippingMethod: method });
    return `<aside class="order-summary checkout-summary" aria-labelledby="checkout-summary-title"><h2 id="checkout-summary-title">خلاصه سفارش</h2><div class="summary-products">${summary.lines.map(line => `<div><img src="${line.product.image}" alt="" width="54" height="72"><span><strong>${line.product.name}</strong><small>سایز ${line.item.size} · تعداد ${toPersianDigits(line.item.quantity)}</small></span><b>${formatPrice(line.lineTotal)}</b></div>`).join('')}</div><dl class="price-list"><div><dt>جمع محصولات</dt><dd>${formatPrice(summary.merchandiseTotal)}</dd></div><div><dt>ارسال</dt><dd>${summary.shipping ? formatPrice(summary.shipping) : 'رایگان'}</dd></div></dl><div class="price-total"><span>مبلغ فعلی سفارش</span><strong>${formatPrice(summary.total)}</strong></div><button class="button button--block" type="submit" form="checkout-form-shell">ادامه به مرور سفارش</button><a class="button button--ghost button--block" href="./cart">بازگشت به سبد خرید</a></aside>`;
  };

  const render = () => {
    if (!availableMethods().some(method => method.id === selectedShipping)) selectedShipping = 'standard';
    root.innerHTML = `${stepsTemplate('shipping')}<header class="commerce-header"><div><p class="eyebrow">مرحله دوم از سه مرحله</p><h1>اطلاعات ارسال</h1><p>نشانی گیرنده و روش تحویل سفارش را بررسی کنید.</p></div></header><form id="checkout-form-shell" novalidate><div class="checkout-layout"><div class="checkout-content"><section class="checkout-section"><div class="checkout-section__head"><span>۱</span><div><h2>آدرس تحویل</h2><p>نشانی دقیق به تحویل سریع‌تر سفارش کمک می‌کند.</p></div></div>${addressCards()}${formTemplate()}</section><section class="checkout-section"><div class="checkout-section__head"><span>۲</span><div><h2>شیوه ارسال</h2><p>زمان و هزینه تحویل پیش از پرداخت نهایی نمایش داده می‌شود.</p></div></div>${shippingTemplate()}</section></div>${summaryTemplate()}</div></form>`;
    bindFormState();
  };

  const readForm = () => {
    const form = document.getElementById('checkout-form-shell');
    if (!form) return formData;
    const raw = Object.fromEntries(new FormData(form).entries());
    formData = { firstName: raw.firstName || '', lastName: raw.lastName || '', mobile: raw.mobile || '', province: raw.province || '', city: raw.city || '', postalCode: raw.postalCode || '', buildingNumber: raw.buildingNumber || '', unit: raw.unit || '', address: raw.address || '', notes: raw.notes || '' };
    return formData;
  };

  const clearErrors = form => form.querySelectorAll('[aria-invalid="true"]').forEach(input => input.removeAttribute('aria-invalid'));
  const setError = (name, message) => {
    const input = document.getElementById(name);
    const output = document.getElementById(`${name}-error`);
    input?.setAttribute('aria-invalid','true');
    if (output) output.textContent = message;
  };

  const validate = () => {
    const form = document.getElementById('address-form');
    clearErrors(form);
    form.querySelectorAll('.field-message--error').forEach(output => { output.textContent = ''; });
    const data = readForm();
    const errors = {};
    if (data.firstName.trim().length < 2) errors.firstName = 'نام را حداقل با دو حرف وارد کنید.';
    if (data.lastName.trim().length < 2) errors.lastName = 'نام خانوادگی را کامل وارد کنید.';
    if (!/^09\d{9}$/.test(toEnglishDigits(data.mobile))) errors.mobile = 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.';
    if (!data.province) errors.province = 'استان را انتخاب کنید.';
    if (!data.city) errors.city = 'شهر را انتخاب کنید.';
    if (!/^\d{10}$/.test(toEnglishDigits(data.postalCode))) errors.postalCode = 'کد پستی باید دقیقاً ۱۰ رقم باشد.';
    if (!data.buildingNumber.trim()) errors.buildingNumber = 'پلاک را وارد کنید.';
    if (data.address.trim().length < 10) errors.address = 'نشانی کامل را با نام خیابان و کوچه وارد کنید.';
    Object.entries(errors).forEach(([name,message]) => setError(name,message));
    const first = Object.keys(errors)[0];
    if (first) { document.getElementById(first)?.focus(); document.getElementById(first)?.scrollIntoView({ behavior:'smooth', block:'center' }); return false; }
    return true;
  };

  const persistDraft = () => {
    const data = readForm();
    localStore.set('toto-checkout-draft', { addressId: selectedAddressId, address: data, shippingMethod: selectedShipping, notes: data.notes || '' });
  };

  const bindFormState = () => {
    const form = document.getElementById('address-form');
    form?.addEventListener('input', persistDraft);
    document.getElementById('province')?.addEventListener('change', event => {
      formData = readForm(); formData.province = event.target.value; formData.city = ''; selectedShipping = 'standard'; render(); document.getElementById('city')?.focus();
    });
  };

  root.addEventListener('change', event => {
    if (event.target.name === 'saved-address') {
      selectedAddressId = event.target.value;
      editingId = selectedAddressId === 'new' ? null : selectedAddressId;
      formData = selectedAddressId === 'new' ? {} : { ...addresses.find(address => address.id === selectedAddressId) };
      selectedShipping = 'standard'; render();
    }
    if (event.target.name === 'shipping-method') { selectedShipping = event.target.value; persistDraft(); render(); }
    if (event.target.id === 'city') { formData = readForm(); selectedShipping = 'standard'; persistDraft(); render(); }
  });

  root.addEventListener('click', event => {
    const trigger = event.target.closest('[data-checkout-action="edit-address"]');
    if (!trigger) return;
    event.preventDefault(); selectedAddressId = trigger.dataset.id; editingId = trigger.dataset.id; formData = { ...addresses.find(address => address.id === selectedAddressId) }; render(); document.getElementById('firstName')?.focus();
  });

  root.addEventListener('submit', async event => {
    if (event.target.id !== 'checkout-form-shell') return;
    event.preventDefault();
    if (!validate()) { toast('لطفاً خطاهای فرم ارسال را برطرف کنید.', 'error'); return; }
    const data = readForm();
    data.mobile = toEnglishDigits(data.mobile); data.postalCode = toEnglishDigits(data.postalCode);
    if (document.getElementById('save-address')?.checked) {
      let address = { ...data, id: editingId || `addr-${Date.now()}`, title: editingId ? (addresses.find(item => item.id === editingId)?.title || 'آدرس من') : 'آدرس جدید' };
      if (session) {
        try { address = editingId ? await api.updateAddress(editingId,address) : await api.createAddress(address); }
        catch (error) { toast(error.message || 'ذخیره آدرس در حساب انجام نشد.', 'error'); return; }
      }
      addresses = editingId ? addresses.map(item => item.id === editingId ? address : item) : [...addresses, address];
      localStore.set('toto-addresses', addresses); selectedAddressId = address.id; editingId = address.id;
    }
    const shippingMethod = shippingMethods.find(method => method.id === selectedShipping) || shippingMethods[0];
    localStore.set('toto-checkout', { addressId: selectedAddressId, address: data, shippingMethod, notes: data.notes || '', savedAt: new Date().toISOString() });
    localStore.set('toto-checkout-draft', { addressId: selectedAddressId, address: data, shippingMethod: selectedShipping, notes: data.notes || '' });
    location.href = './order-review';
  });

  render();
};
