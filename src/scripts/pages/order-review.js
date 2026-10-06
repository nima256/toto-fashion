import { localStore, sessionStore } from '../core/storage.js';
import { cartLines, getCart } from '../core/commerce.js';
import { api } from '../services/api.js';
import { formatPrice, icon, toPersianDigits, escapeHtml as esc, safeImage, uid } from '../core/utils.js';

const stepsTemplate = () => `<ol class="checkout-steps" aria-label="مراحل ثبت سفارش"><li class="is-done"><span>${icon('check', 'icon icon--sm')}</span><strong>سبد خرید</strong></li><li class="is-done"><span>${icon('check', 'icon icon--sm')}</span><strong>اطلاعات ارسال</strong></li><li class="is-active" aria-current="step"><span>۳</span><strong>مرور و پرداخت</strong></li></ol>`;
const missingTemplate = (title, text, href, action) => `<section class="commerce-empty"><span class="commerce-empty__icon">${icon('error', 'icon icon--lg')}</span><h1>${esc(title)}</h1><p>${esc(text)}</p><a class="button" href="${esc(href)}">${esc(action)}</a></section>`;

export const initOrderReview = ({ toast }) => {
  const root = document.getElementById('order-review-root');
  if (!root) return;
  const cart = getCart();
  const checkout = localStore.get('toto-checkout', null);
  if (!cart.length) { root.innerHTML = missingTemplate('سبد خرید خالی است', 'پیش از مرور سفارش، محصولی به سبد اضافه کنید.', './shop', 'مشاهده محصولات'); return; }
  if (!checkout?.address || !checkout?.shippingMethodId) { root.innerHTML = missingTemplate('اطلاعات ارسال کامل نیست', 'نشانی و روش ارسال را ثبت کنید.', './checkout', 'تکمیل اطلاعات ارسال'); return; }
  const pickup = checkout.shippingMethodId === 'pickup';
  let discountCode = localStore.get('toto-discount-code', '') || '';
  let isSubmitting = false; let quote = null; let quoteError = '';
  // یک کلید ثابت برای این تلاش پرداخت؛ کلیک دوباره یا ارسال مجدد سفارش تکراری نمی‌سازد
  let idempotencyKey = sessionStore.get('toto-order-key', '') || uid();
  sessionStore.set('toto-order-key', idempotencyKey);

  const productsTemplate = () => cartLines(cart).map(line => `<article class="review-product"><img src="${safeImage(line.product?.image)}" alt="${esc(line.product?.imageAlt || line.item.name)}" width="96" height="128"><div><h3>${esc(line.product?.name || line.item.name)}</h3><p>رنگ ${esc(line.product?.colorNames?.[line.item.colorIndex] || 'انتخابی')} · سایز ${esc(line.item.size)} · تعداد ${toPersianDigits(line.item.quantity)}</p>${line.unavailable ? '<span class="status-text status-text--error">ناموجود</span>' : ''}${line.priceChanged ? '<span class="status-text status-text--info">قیمت به‌روزرسانی شده</span>' : ''}</div><strong>${formatPrice(line.lineTotal)}</strong></article>`).join('');
  const address = checkout.address;
  const addressBlock = pickup
    ? `<address class="review-address"><strong>${esc(address.firstName)} ${esc(address.lastName)}</strong><p>تحویل حضوری از فروشگاه توتو</p><span>شماره تماس: ${esc(toPersianDigits(address.mobile))}</span></address>`
    : `<address class="review-address"><strong>${esc(address.firstName)} ${esc(address.lastName)}</strong><p>${esc(address.province)}، ${esc(address.city)}، ${esc(address.address)}، پلاک ${esc(address.buildingNumber)}${address.unit ? `، واحد ${esc(address.unit)}` : ''}</p><span>کد پستی: ${esc(toPersianDigits(address.postalCode))}</span><span>شماره تماس: ${esc(toPersianDigits(address.mobile))}</span></address>`;
  const quoteArgs = () => ({ shippingMethodId: checkout.shippingMethodId, address: pickup ? undefined : { province: address.province, city: address.city }, discountCode });

  const render = () => {
    const problems = quote?.problems || [];
    const blocked = !quote || problems.length > 0;
    root.innerHTML = `${stepsTemplate()}<header class="commerce-header"><div><p class="eyebrow">مرحله نهایی</p><h1>مرور سفارش و پرداخت</h1><p>پیش از انتقال به درگاه، محصولات و اطلاعات تحویل را بررسی کنید.</p></div></header>
      <div class="review-layout"><div class="review-content">
        <section class="review-section"><div class="review-section__head"><div><span>۱</span><h2>محصولات</h2></div><a class="text-button" href="./cart">ویرایش سبد</a></div><div class="review-products">${productsTemplate()}</div></section>
        <section class="review-section"><div class="review-section__head"><div><span>۲</span><h2>${pickup ? 'تحویل‌گیرنده' : 'نشانی تحویل'}</h2></div><a class="text-button" href="./checkout">ویرایش</a></div>${addressBlock}</section>
        <section class="review-section"><div class="review-section__head"><div><span>۳</span><h2>شیوه ارسال</h2></div><a class="text-button" href="./checkout">ویرایش</a></div><div class="selected-shipping">${icon('truck')}<span><strong>${esc(quote?.shippingMethod?.title || checkout.shippingMethod?.title || '')}</strong><small>${esc(quote?.shippingMethod?.description || checkout.shippingMethod?.description || '')}</small></span><b>${quote ? (quote.amounts.shipping ? formatPrice(quote.amounts.shipping) : 'رایگان') : '…'}</b></div></section>
        ${checkout.notes ? `<section class="review-section"><div class="review-section__head"><div><span>۴</span><h2>توضیحات</h2></div></div><p>${esc(checkout.notes)}</p></section>` : ''}
      </div>
      <aside class="order-summary review-summary"><h2>جزئیات پرداخت</h2><form class="discount-form" id="discount-form" novalidate><label for="discount-code">کد تخفیف</label><div><input class="input" id="discount-code" value="${esc(discountCode)}" maxlength="40" placeholder="مثلاً TOTO10" autocomplete="off"><button class="button button--outline" type="submit">اعمال</button></div><p class="field-message ${quote?.couponError ? 'field-message--error' : ''}" id="discount-message">${esc(quote?.couponError || quote?.coupon?.label || '')}</p></form>
      ${quote ? `<dl class="price-list"><div><dt>جمع قیمت محصولات</dt><dd>${formatPrice(quote.amounts.subtotal)}</dd></div><div class="price-list__discount"><dt>تخفیف محصولات</dt><dd>− ${formatPrice(quote.amounts.productDiscount)}</dd></div>${quote.amounts.couponDiscount ? `<div class="price-list__discount"><dt>کد تخفیف</dt><dd>− ${formatPrice(quote.amounts.couponDiscount)}</dd></div>` : ''}<div><dt>هزینه ارسال</dt><dd>${quote.amounts.shipping ? formatPrice(quote.amounts.shipping) : 'رایگان'}</dd></div></dl><div class="price-total"><span>مبلغ قابل پرداخت</span><strong>${formatPrice(quote.amounts.total)}</strong></div>` : `<p class="field-message ${quoteError ? 'field-message--error' : ''}">${esc(quoteError || 'در حال محاسبه مبلغ نهایی از سرور...')}</p>`}
      ${problems.length ? `<div class="field-message field-message--error">${esc(problems[0].message)} برای اصلاح به سبد خرید برگردید.</div>` : ''}
      <button class="button button--block payment-button" id="final-payment" type="button" ${blocked ? 'disabled' : ''}>${quote ? `پرداخت ${formatPrice(quote.amounts.total)}` : 'پرداخت'}</button><p class="secure-note">${icon('shield', 'icon icon--sm')} با انتخاب پرداخت، موجودی و مبلغ دوباره در سرور بررسی می‌شود.</p><p class="mock-note">نتیجه تراکنش فقط پس از تأیید سرور و درگاه پرداخت ثبت می‌شود.</p></aside></div>`;

    document.getElementById('discount-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      discountCode = document.getElementById('discount-code').value.trim().toUpperCase();
      await loadQuote();
      if (quote?.couponError) { toast(quote.couponError, 'error'); localStore.remove('toto-discount-code'); }
      else if (discountCode && quote?.coupon) { localStore.set('toto-discount-code', discountCode); toast('کد تخفیف با موفقیت اعمال شد.'); }
      else localStore.remove('toto-discount-code');
    });
    document.getElementById('final-payment')?.addEventListener('click', submitOrder);
  };

  const loadQuote = async () => {
    try { quote = await api.quote(cart, quoteArgs()); quoteError = ''; }
    catch (error) { quote = null; quoteError = error.message; }
    render();
  };

  const submitOrder = async event => {
    if (isSubmitting) return;
    isSubmitting = true;
    const button = event.currentTarget; button.disabled = true; button.textContent = 'در حال ثبت سفارش...';
    try {
      // اگر کد تخفیف نامعتبر باشد سفارش با آن ثبت نمی‌شود
      const code = quote?.couponError ? '' : discountCode;
      const result = await api.createOrder({ cart, shippingMethodId: checkout.shippingMethodId, address, discountCode: code, notes: checkout.notes || '', idempotencyKey });
      const order = result.order || {};
      localStore.set('toto-last-order', { orderNumber: order.orderNumber, mobile: address.mobile, createdAt: new Date().toISOString() });
      button.textContent = 'در حال انتقال به درگاه...';
      location.href = result.redirectUrl || `./payment-pending?order=${encodeURIComponent(order.orderNumber)}`;
    } catch (error) {
      isSubmitting = false; button.disabled = false; button.textContent = 'تلاش دوباره برای پرداخت';
      // فقط در قطع ارتباط (نتیجه نامشخص) همان کلید نگه داشته می‌شود تا تلاش دوباره به همان سفارش برسد؛
      // در پاسخ قطعی سرور، تلاش بعدی با کلید تازه انجام می‌شود
      if (error.status !== 0) { idempotencyKey = uid(); sessionStore.set('toto-order-key', idempotencyKey); }
      toast(error.message || 'اتصال به درگاه انجام نشد. دوباره تلاش کنید.', 'error');
      if (error.status === 409) loadQuote();
    }
  };

  render();
  loadQuote();
};
