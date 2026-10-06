import { localStore, sessionStore } from '../core/storage.js';
import { formatPrice, icon, toPersianDigits, escapeHtml as esc, normalizeOrderNumber, encodeParam } from '../core/utils.js';
import { clearCart } from '../core/commerce.js';
import { api } from '../services/api.js';

const missing = () => `<section class="payment-state"><span class="payment-state__icon payment-state__icon--neutral">${icon('info', 'icon icon--lg')}</span><h1>اطلاعات سفارش پیدا نشد</h1><p>شماره سفارش برای استعلام در دسترس نیست. از بخش پیگیری سفارش وضعیت خرید را بررسی کنید.</p><a class="button" href="./order-tracking">پیگیری سفارش</a></section>`;
const trackingHref = orderNumber => `./order-tracking?order=${encodeParam(orderNumber)}`;

// جزئیات کامل فقط برای سازنده سفارش (همین نشست) یا مالک حساب؛ دیگران فقط وضعیت عمومی را می‌بینند
const detailsTemplate = (order, full) => `<dl class="payment-details"><div><dt>شماره سفارش</dt><dd dir="ltr">${esc(order.orderNumber)}</dd></div>${full ? `<div><dt>مبلغ سفارش</dt><dd>${formatPrice(order.total)}</dd></div>` : ''}<div><dt>روش ارسال</dt><dd>${esc(full ? order.carrier || order.shippingMethod?.title : order.shippingMethod)}</dd></div>${full ? `<div><dt>${order.isPickup ? 'تحویل' : 'نشانی'}</dt><dd>${esc(order.address)}</dd></div>` : ''}</dl>`;

export const initPayment = async ({ toast }) => {
  const root = document.getElementById('payment-root'); if (!root) return;
  const page = document.body.dataset.page;
  const lastOrder = localStore.get('toto-last-order', null);
  const orderNumber = normalizeOrderNumber(new URLSearchParams(location.search).get('order') || lastOrder?.orderNumber || '');
  if (page === 'payment-failed' || page === 'payment-success') sessionStore.remove('toto-order-key');
  if (!orderNumber) { root.innerHTML = page === 'payment-failed' ? `<section class="payment-state"><span class="payment-state__icon payment-state__icon--error">${icon('error', 'icon icon--lg')}</span><h1>تراکنش ناموفق بود</h1><p>اطلاعات سفارش در دسترس نیست. اگر وجهی کسر شده باشد، مطابق روال بانکی بازگردانده می‌شود.</p><a class="button" href="./cart">بازگشت به سبد خرید</a></section>` : missing(); return; }
  root.innerHTML = '<div class="account-loading" aria-label="در حال استعلام پرداخت"><span class="skeleton skeleton--line"></span><span class="skeleton skeleton--box"></span></div>';
  let result;
  try { result = await api.verifyPayment(orderNumber); }
  catch (error) { root.innerHTML = `<section class="payment-state"><span class="payment-state__icon payment-state__icon--neutral">${icon('info', 'icon icon--lg')}</span><h1>استعلام سفارش انجام نشد</h1><p>${esc(error.message)}</p><a class="button" href="${trackingHref(orderNumber)}">پیگیری سفارش</a></section>`; return; }
  const order = result.order; const full = result.access === 'full';
  const paid = result.status === 'paid';

  if (page === 'payment-success') {
    if (!paid) { root.innerHTML = `<section class="payment-state"><span class="payment-state__icon payment-state__icon--pending">${icon('clock', 'icon icon--lg')}</span><h1>پرداخت هنوز تأیید نشده است</h1><p>نتیجه تراکنش از سرور تأیید نشده؛ دوباره وضعیت را بررسی کنید.</p>${detailsTemplate(order, full)}<a class="button" href="./payment-pending?order=${encodeParam(order.orderNumber)}">بررسی وضعیت</a></section>`; return; }
    if (full) { clearCart(); ['toto-checkout', 'toto-checkout-draft', 'toto-discount-code'].forEach(key => localStore.remove(key)); }
    root.innerHTML = `<section class="payment-state"><span class="payment-state__icon payment-state__icon--success">${icon('check', 'icon icon--lg')}</span><p class="eyebrow">پرداخت تأیید شد</p><h1>سفارش شما با موفقیت ثبت شد</h1><p>تأیید سفارش و مراحل آماده‌سازی از طریق پیامک اطلاع‌رسانی می‌شود.</p>${detailsTemplate(order, full)}${full && result.trackingCode ? `<div class="payment-tracking"><span>کد پیگیری پرداخت</span><strong dir="ltr">${esc(toPersianDigits(result.trackingCode))}</strong></div>` : ''}<div class="payment-actions"><a class="button" href="${trackingHref(order.orderNumber)}">پیگیری سفارش</a><a class="button button--outline" href="./shop">ادامه خرید</a></div>${order.deliveryEstimate ? `<p class="secure-note">زمان تقریبی تحویل: ${esc(order.deliveryEstimate)}</p>` : ''}</section>`;
    return;
  }
  if (page === 'payment-failed') {
    if (paid) { location.replace(`./payment-success?order=${encodeParam(order.orderNumber)}`); return; }
    root.innerHTML = `<section class="payment-state"><span class="payment-state__icon payment-state__icon--error">${icon('error', 'icon icon--lg')}</span><p class="eyebrow">پرداخت انجام نشد</p><h1>تراکنش ناموفق بود</h1><p>پرداخت توسط درگاه تأیید نشده است. اگر وجهی کسر شده باشد، مطابق روال بانکی تعیین تکلیف می‌شود.</p>${detailsTemplate(order, full)}<div class="payment-actions"><a class="button" href="./order-review">تلاش دوباره برای پرداخت</a><a class="button button--outline" href="./cart">بازگشت به سبد خرید</a></div><a class="inline-link" href="./contact">ارتباط با پشتیبانی خرید</a></section>`;
    return;
  }
  if (page === 'payment-pending') {
    if (paid) { location.replace(`./payment-success?order=${encodeParam(order.orderNumber)}`); return; }
    if (result.status === 'failed') { location.replace(`./payment-failed?order=${encodeParam(order.orderNumber)}`); return; }
    const renderPending = message => {
      root.innerHTML = `<section class="payment-state"><span class="payment-state__icon payment-state__icon--pending">${icon('clock', 'icon icon--lg')}</span><p class="eyebrow">در حال بررسی پرداخت</p><h1>نتیجه تراکنش هنوز قطعی نیست</h1><p>برای جلوگیری از پرداخت تکراری، تا دریافت نتیجه نهایی دوباره سفارش را ثبت نکنید.</p>${detailsTemplate(order, full)}<div class="page-notice page-notice--info">${icon('info')}<div><strong>وضعیت فعلی</strong><p>${esc(message || 'در انتظار پاسخ نهایی درگاه پرداخت')}</p></div></div><div class="payment-actions"><button class="button" id="refresh-payment" type="button">بررسی دوباره وضعیت</button><a class="button button--outline" href="${trackingHref(order.orderNumber)}">پیگیری سفارش</a></div></section>`;
      document.getElementById('refresh-payment')?.addEventListener('click', async event => {
        event.currentTarget.disabled = true; event.currentTarget.textContent = 'در حال استعلام...';
        try { const next = await api.verifyPayment(order.orderNumber); if (next.status === 'paid') { location.href = `./payment-success?order=${encodeParam(order.orderNumber)}`; return; } if (next.status === 'failed') { location.href = `./payment-failed?order=${encodeParam(order.orderNumber)}`; return; } renderPending('درگاه هنوز نتیجه نهایی را تأیید نکرده است.'); }
        catch (error) { renderPending('ارتباط با سرویس پرداخت برقرار نشد.'); toast(error.message, 'error'); }
      });
    };
    renderPending();
  }
};
