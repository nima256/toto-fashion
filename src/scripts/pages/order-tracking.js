import { api } from '../services/api.js';
import { getAccountData, getSession } from '../core/account-store.js';
import { localStore } from '../core/storage.js';
import { icon, toEnglishDigits, toPersianDigits, escapeHtml as esc, normalizeOrderNumber, encodeParam } from '../core/utils.js';
import { orderItemsTemplate } from '../components/order-items.js';
import { accountSidebarTemplate, accountMobileNavTemplate, statusBadge } from '../components/account-shell.js';

// نتیجه عمومی پیگیری: اقلام (نام، تصویر، رنگ، سایز، تعداد) بدون نام، نشانی، موبایل یا مبالغ
const resultTemplate = (order, detailsId) => `<section class="tracking-result" aria-labelledby="tracking-result-title">
  <header><div><p class="eyebrow" dir="auto">سفارش ${esc(order.orderNumber)}</p><h2 id="tracking-result-title">${esc(order.statusLabel)}</h2><p>ثبت‌شده در ${esc(order.placedAt)} · ${esc(toPersianDigits(order.itemCount))} کالا · ${esc(order.shippingMethod)}</p></div>${statusBadge(order.status, order.statusLabel)}</header>
  <ol class="tracking-timeline">${order.timeline.map((step, index) => `<li class="is-complete"><span>${index === order.timeline.length - 1 ? icon('location') : icon('check')}</span><div><strong>${esc(step.label)}</strong><small>${esc(step.date)}</small>${step.detail ? `<p>${esc(step.detail)}</p>` : ''}</div></li>`).join('')}</ol>
  ${order.trackingCode ? `<div class="tracking-code-box"><span>${icon('truck')}</span><div><small>${esc(order.carrier)}</small><strong dir="ltr">${esc(order.trackingCode)}</strong></div><button class="text-button" type="button" data-copy-tracking="${esc(order.trackingCode)}">کپی کد</button></div>` : ''}
  ${order.deliveryEstimate ? `<p class="secure-note">زمان تقریبی تحویل: ${esc(order.deliveryEstimate)}</p>` : ''}
  <section class="tracking-items" aria-labelledby="tracking-items-title"><h3 id="tracking-items-title">اقلام این سفارش</h3>${orderItemsTemplate(order.items || [])}</section>
  <div class="tracking-result__actions">${detailsId ? `<a class="button" href="./order-details?id=${encodeParam(detailsId)}">مشاهده جزئیات کامل</a>` : ''}<a class="button button--outline" href="./shop">ادامه خرید</a></div>
</section>`;

const trackingContent = (session, values) => `<div class="tracking-page-content">
  <header class="tracking-page-head"><p class="eyebrow">پیگیری مرسوله</p><h1>سفارش شما کجاست؟</h1><p>شماره سفارش و همان شماره موبایلی را وارد کنید که هنگام خرید ثبت شده است.</p></header>
  <form class="tracking-form" id="tracking-form" novalidate>
    <label class="field"><span>شماره سفارش</span><input class="input" name="orderNumber" dir="ltr" autocomplete="off" maxlength="32" placeholder="TO-261005-1234" value="${esc(values.orderNumber)}" required><small class="field-message"></small></label>
    <label class="field"><span>شماره موبایل</span><input class="input" name="mobile" inputmode="numeric" autocomplete="tel" maxlength="11" placeholder="۰۹۱۲۱۲۳۴۵۶۷" value="${esc(values.mobile ? toPersianDigits(values.mobile) : '')}" required><small class="field-message"></small></label>
    <button class="button button--block" type="submit">نمایش وضعیت سفارش</button>
    <p class="mock-note">شماره سفارش در پیامک ثبت سفارش و صفحه پرداخت موفق نمایش داده می‌شود (مانند TO-261005-1234).</p>
  </form>
  <div id="tracking-result" aria-live="polite"></div>
  <section class="tracking-help"><span>${icon('support')}</span><div><strong>شماره سفارش را در دسترس ندارید؟</strong><p>پیامک ثبت سفارش یا بخش سفارش‌های حساب خود را بررسی کنید.</p></div><a class="inline-link" href="${session ? './orders' : './login?return=orders'}">${session ? 'مشاهده سفارش‌های من' : 'ورود به حساب'}</a></section>
</div>`;

const layoutTemplate = (session, account, values) => session ? `<div class="account-page-shell">${accountSidebarTemplate({ active: 'tracking', session, account })}<div class="account-content">${accountMobileNavTemplate('tracking')}${trackingContent(session, values)}</div></div>` : trackingContent(null, values);

const setMessage = (field, message) => { const msg = field.closest('.field').querySelector('.field-message'); msg.textContent = message; msg.classList.add('field-message--error'); field.setAttribute('aria-invalid', 'true'); };
// شماره سفارش با همان قالب سرور (TO-YYMMDD-NNNN) ارسال می‌شود؛ حروف و خط تیره حذف نمی‌شوند
const validate = (form, { focus = true } = {}) => {
  form.querySelectorAll('.field-message').forEach(node => { node.textContent = ''; node.classList.remove('field-message--error'); });
  form.querySelectorAll('[aria-invalid]').forEach(node => node.removeAttribute('aria-invalid'));
  const orderNumber = normalizeOrderNumber(form.elements.orderNumber.value);
  const mobile = toEnglishDigits(form.elements.mobile.value).replace(/\s/g, '');
  let first = null;
  if (!orderNumber) { setMessage(form.elements.orderNumber, 'شماره سفارش را مانند TO-261005-1234 وارد کنید.'); first ||= form.elements.orderNumber; }
  if (!/^09\d{9}$/.test(mobile)) { setMessage(form.elements.mobile, 'شماره موبایل باید ۱۱ رقم و با ۰۹ آغاز شود.'); first ||= form.elements.mobile; }
  if (first && focus) first.focus();
  return first ? null : { orderNumber, mobile };
};

const bind = toast => {
  const form = document.getElementById('tracking-form'); const result = document.getElementById('tracking-result');
  const submit = async ({ silent = false } = {}) => {
    const values = validate(form, { focus: !silent }); if (!values) return;
    form.elements.orderNumber.value = values.orderNumber;
    const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'در حال استعلام...';
    result.innerHTML = '<div class="tracking-loading"><span class="skeleton skeleton--line"></span><span class="skeleton skeleton--box"></span></div>';
    try {
      const data = await api.trackOrder(values.orderNumber, values.mobile);
      result.innerHTML = resultTemplate(data.order, data.canViewDetails ? data.detailsId : null);
      if (!silent) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
      result.querySelector('[data-copy-tracking]')?.addEventListener('click', async event => { const code = event.currentTarget.dataset.copyTracking; try { await navigator.clipboard.writeText(code); toast('کد رهگیری کپی شد.'); } catch { toast(`کد رهگیری: ${code}`, 'info'); } });
    } catch (error) { result.innerHTML = `<div class="page-notice page-notice--error">${icon('error')}<div><strong>پیگیری سفارش انجام نشد</strong><p>${esc(error.message)}</p></div></div>`; }
    finally { button.disabled = false; button.textContent = 'نمایش وضعیت سفارش'; }
  };
  form?.addEventListener('submit', event => { event.preventDefault(); submit(); });
  return submit;
};

export const initOrderTracking = ({ toast }) => {
  const render = () => {
    const session = getSession(); const root = document.getElementById('order-tracking-root');
    // پارامتر ?order= از صفحه پرداخت موفق خوانده و فیلد پر می‌شود
    const orderNumber = normalizeOrderNumber(new URLSearchParams(location.search).get('order') || '');
    const lastOrder = localStore.get('toto-last-order', null);
    const mobile = session?.customer?.mobile || (orderNumber && lastOrder?.orderNumber === orderNumber ? lastOrder.mobile : '') || '';
    root.innerHTML = layoutTemplate(session, session ? getAccountData() : null, { orderNumber, mobile });
    const submit = bind(toast);
    if (orderNumber && mobile) submit({ silent: true });
  };
  render();
  document.addEventListener('toto:auth-changed', render);
};
