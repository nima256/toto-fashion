import { api } from '../services/api.js';
import { getAccountData, getSession, ensureDemoSession } from '../core/account-store.js';
import { icon, toEnglishDigits, toPersianDigits } from '../core/utils.js';
import { accountSidebarTemplate, accountMobileNavTemplate, statusBadge } from '../components/account-shell.js';

const resultTemplate = order => `<section class="tracking-result" aria-labelledby="tracking-result-title">
  <header><div><p class="eyebrow">سفارش ${order.orderNumber}</p><h2 id="tracking-result-title">${order.statusLabel}</h2><p>ثبت‌شده در ${order.placedAt}</p></div>${statusBadge(order.status, order.statusLabel)}</header>
  <ol class="tracking-timeline">${order.timeline.map((step,index) => `<li class="is-complete"><span>${index === order.timeline.length - 1 ? icon('location') : icon('check')}</span><div><strong>${step.label}</strong><small>${step.date}</small><p>${step.detail}</p></div></li>`).join('')}</ol>
  ${order.trackingCode ? `<div class="tracking-code-box"><span>${icon('truck')}</span><div><small>${order.carrier}</small><strong>${order.trackingCode}</strong></div><button class="text-button" type="button" data-copy-tracking="${order.trackingCode}">کپی کد</button></div>` : ''}
  <div class="tracking-result__actions"><a class="button" href="./order-details?id=${encodeURIComponent(order.id)}">مشاهده جزئیات کامل</a><a class="button button--outline" href="./shop">ادامه خرید</a></div>
</section>`;

const trackingContent = session => `<div class="tracking-page-content">
  <header class="tracking-page-head"><p class="eyebrow">پیگیری مرسوله</p><h1>سفارش شما کجاست؟</h1><p>شماره سفارش و همان شماره موبایلی را وارد کنید که هنگام خرید ثبت شده است.</p></header>
  <form class="tracking-form" id="tracking-form" novalidate>
    <label class="field"><span>شماره سفارش</span><input class="input" name="orderNumber" inputmode="numeric" autocomplete="off" placeholder="برای نمونه: ۱۴۰۵۱۰۴۸۲" required><small class="field-message"></small></label>
    <label class="field"><span>شماره موبایل</span><input class="input" name="mobile" inputmode="numeric" autocomplete="tel" placeholder="۰۹۱۲۱۲۳۴۵۶۷" value="${session?.customer?.mobile ? toPersianDigits(session.customer.mobile) : ''}" required><small class="field-message"></small></label>
    <button class="button button--block" type="submit">نمایش وضعیت سفارش</button>
    <p class="mock-note">اطلاعات نمونه: سفارش ۱۴۰۵۱۰۴۸۲ و موبایل ۰۹۱۲۱۲۳۴۵۶۷</p>
  </form>
  <div id="tracking-result"></div>
  <section class="tracking-help"><span>${icon('support')}</span><div><strong>شماره سفارش را در دسترس ندارید؟</strong><p>پیامک ثبت سفارش یا بخش سفارش‌های حساب خود را بررسی کنید.</p></div><a class="inline-link" href="${session ? './orders' : './login?return=orders'}">${session ? 'مشاهده سفارش‌های من' : 'ورود به حساب'}</a></section>
</div>`;

const layoutTemplate = (session, account) => session ? `<div class="account-page-shell">${accountSidebarTemplate({ active:'tracking', session, account })}<div class="account-content">${accountMobileNavTemplate('tracking')}${trackingContent(session)}</div></div>` : trackingContent(null);

const validate = form => {
  form.querySelectorAll('.field-message').forEach(node => { node.textContent=''; node.classList.remove('field-message--error'); });
  const orderNumber = toEnglishDigits(form.elements.orderNumber.value).replace(/\D/g,'');
  const mobile = toEnglishDigits(form.elements.mobile.value).replace(/\s/g,'');
  let first = null;
  if (orderNumber.length < 6) { const field=form.elements.orderNumber; const msg=field.closest('.field').querySelector('.field-message'); msg.textContent='شماره سفارش را کامل وارد کنید.'; msg.classList.add('field-message--error'); first ||= field; }
  if (!/^09\d{9}$/.test(mobile)) { const field=form.elements.mobile; const msg=field.closest('.field').querySelector('.field-message'); msg.textContent='شماره موبایل باید ۱۱ رقم و با ۰۹ آغاز شود.'; msg.classList.add('field-message--error'); first ||= field; }
  first?.focus(); return first ? null : { orderNumber, mobile };
};

const bind = toast => {
  const form=document.getElementById('tracking-form'); const result=document.getElementById('tracking-result');
  form?.addEventListener('submit', async event => {
    event.preventDefault(); const values=validate(form); if(!values) return;
    const button=form.querySelector('button[type="submit"]'); button.disabled=true; button.textContent='در حال استعلام...';
    result.innerHTML='<div class="tracking-loading"><span class="skeleton skeleton--line"></span><span class="skeleton skeleton--box"></span></div>';
    try { const order=await api.trackOrder(values.orderNumber, values.mobile); result.innerHTML=resultTemplate(order); result.scrollIntoView({behavior:'smooth',block:'start'}); document.querySelector('[data-copy-tracking]')?.addEventListener('click', async event => { try { await navigator.clipboard.writeText(event.currentTarget.dataset.copyTracking); toast('کد رهگیری کپی شد.'); } catch { toast(`کد رهگیری: ${event.currentTarget.dataset.copyTracking}`,'info'); } }); }
    catch(error){ result.innerHTML=`<div class="page-notice page-notice--error">${icon('error')}<div><strong>پیگیری سفارش انجام نشد</strong><p>${error.message}</p></div></div>`; }
    finally { button.disabled=false; button.textContent='نمایش وضعیت سفارش'; }
  });
};

export const initOrderTracking = ({toast}) => { ensureDemoSession(); const session=getSession(); const root=document.getElementById('order-tracking-root'); root.innerHTML=layoutTemplate(session, session ? getAccountData() : null); bind(toast); };
