import { getAccountData, getSession, setOrders } from '../core/account-store.js';
import { api } from '../services/api.js';
import { formatPrice, icon, toPersianDigits, escapeHtml as esc, safeImage, encodeParam } from '../core/utils.js';
import { orderItemsTemplate } from '../components/order-items.js';
import { accountSidebarTemplate, accountMobileNavTemplate, authGateTemplate, statusBadge } from '../components/account-shell.js';

const timelineTemplate = order => `<ol class="order-timeline" aria-label="مراحل سفارش">${order.timeline.map((step, index) => `<li class="is-complete"><span>${icon(index === order.timeline.length - 1 ? 'location' : 'check')}</span><div><strong>${esc(step.label)}</strong><small>${esc(step.date)}</small><p>${esc(step.detail)}</p></div></li>`).join('')}</ol>`;

const itemsTemplate = order => orderItemsTemplate(order.items, { showPrices: true, extra: item => item.returnEligible && order.status === 'delivered' ? `<a class="inline-link" href="./return-request?order=${encodeParam(order.id)}&product=${encodeParam(item.productId)}">درخواست تعویض یا مرجوعی</a>` : '' });

const summaryTemplate = order => `<dl class="order-price-summary"><div><dt>جمع محصولات</dt><dd>${formatPrice(order.subtotal)}</dd></div>${order.discount ? `<div><dt>تخفیف${order.couponCode ? ` (کد ${esc(order.couponCode)})` : ''}</dt><dd class="is-discount">− ${formatPrice(order.discount)}</dd></div>` : ''}<div><dt>هزینه ارسال</dt><dd>${order.shipping ? formatPrice(order.shipping) : 'رایگان'}</dd></div><div class="order-price-summary__total"><dt>مبلغ پرداخت‌شده</dt><dd>${formatPrice(order.total)}</dd></div></dl>`;

const notFoundTemplate = () => `<section class="account-auth-gate"><span class="account-auth-gate__icon">${icon('error')}</span><h1>سفارش پیدا نشد</h1><p>شماره سفارش معتبر نیست یا این سفارش به حساب شما تعلق ندارد.</p><a class="button" href="./orders">بازگشت به سفارش‌ها</a></section>`;

const pageTemplate = (session, account, order) => `<div class="account-page-shell">
  ${accountSidebarTemplate({ active: 'orders', session, account })}
  <div class="account-content">${accountMobileNavTemplate('orders')}
    <nav class="breadcrumb" aria-label="مسیر صفحه"><a href="./account">حساب من</a><span>/</span><a href="./orders">سفارش‌ها</a><span>/</span><span aria-current="page" dir="ltr">${esc(order.orderNumber)}</span></nav>
    <header class="order-detail-hero"><div><p class="eyebrow">سفارش ${esc(order.orderNumber)}</p><h1>${esc(order.statusLabel)}</h1><p>ثبت‌شده در ${esc(order.placedAt)}</p></div>${statusBadge(order.status, order.statusLabel)}</header>
    <div class="order-detail-grid"><div class="order-detail-main">
      <section class="account-panel"><div class="account-panel__head"><div><p class="eyebrow">وضعیت ارسال</p><h2>مسیر سفارش</h2></div>${order.trackingCode ? `<button class="text-button" type="button" data-copy="${esc(order.trackingCode)}">کپی کد رهگیری</button>` : ''}</div>${timelineTemplate(order)}${order.trackingCode ? `<div class="tracking-box"><span>${icon('truck')}</span><div><strong>${esc(order.carrier)}</strong><small>کد رهگیری</small><code>${esc(order.trackingCode)}</code></div></div>` : ''}</section>
      <section class="account-panel"><div class="account-panel__head"><div><p class="eyebrow">محصولات</p><h2>اقلام سفارش</h2></div></div>${itemsTemplate(order)}</section>
      <section class="account-panel"><div class="account-panel__head"><div><p class="eyebrow">تحویل سفارش</p><h2>${order.isPickup ? 'تحویل‌گیرنده و روش تحویل' : 'نشانی و روش ارسال'}</h2></div></div><div class="order-address"><span>${icon('location')}</span><div><strong>${esc(order.customerName)}</strong><p>${esc(order.address)}</p><small>${esc(toPersianDigits(order.mobile))}</small></div></div><div class="order-delivery-note"><span>${icon('truck')}</span><div><strong>${esc(order.carrier || 'روش ارسال ثبت نشده')}</strong><small>${esc(order.deliveryEstimate)}</small></div></div></section>
    </div><aside class="order-detail-side"><section class="account-panel"><div class="account-panel__head"><div><h2>خلاصه پرداخت</h2></div></div>${summaryTemplate(order)}<dl class="payment-meta"><div><dt>روش پرداخت</dt><dd>${esc(order.paymentMethod)}</dd></div>${order.paymentTrackingCode ? `<div><dt>کد پیگیری پرداخت</dt><dd dir="ltr">${esc(order.paymentTrackingCode)}</dd></div>` : ''}</dl></section><section class="support-card"><span>${icon('support')}</span><div><strong>برای این سفارش کمک می‌خواهید؟</strong><p>پشتیبانی توتو شنبه تا پنجشنبه، ساعت ۹ تا ۱۸ پاسخ‌گوست.</p><button class="text-button" type="button" data-action="show-support">ارتباط با پشتیبانی</button></div></section></aside></div>
  </div>
</div>`;

const bind = toast => {
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(button.dataset.copy); toast('کد رهگیری کپی شد.'); }
    catch { toast(`کد رهگیری: ${button.dataset.copy}`, 'info'); }
  }));
};

const render = async toast => {
  const root = document.getElementById('order-details-root');
  const session = getSession();
  if (!session) { root.innerHTML = authGateTemplate({ title: 'برای مشاهده جزئیات سفارش وارد شوید' }); return; }
  const id = new URLSearchParams(location.search).get('id');
  let order = null;
  // جزئیات فقط از سرور و فقط برای مالک سفارش؛ داده کش‌شده یا نمونه جایگزین نمی‌شود
  try { if (id) order = await api.getOrder(id); else { const orders = setOrders(await api.getOrders()); order = orders[0] || null; } }
  catch (error) { if (error.status === 401) { root.innerHTML = authGateTemplate({ title: 'نشست شما منقضی شده است' }); return; } if (error.status !== 404 && error.status !== 400) { root.innerHTML = `<section class="account-auth-gate"><span class="account-auth-gate__icon">${icon('error')}</span><h1>دریافت سفارش انجام نشد</h1><p>${esc(error.message)}</p></section>`; return; } }
  if (!order) { root.innerHTML = notFoundTemplate(); return; }
  const account = getAccountData(); root.innerHTML = pageTemplate(session, account, order); bind(toast);
};

export const initOrderDetails = ({ toast }) => { render(toast); document.addEventListener('toto:auth-changed', () => render(toast)); };
