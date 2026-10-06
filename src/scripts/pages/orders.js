import { getAccountData, getOrders, getSession, setOrders } from '../core/account-store.js';
import { api } from '../services/api.js';
import { formatPrice, icon, toPersianDigits, toEnglishDigits, escapeHtml as esc, safeImage, encodeParam } from '../core/utils.js';
import { accountSidebarTemplate, accountMobileNavTemplate, authGateTemplate, statusBadge } from '../components/account-shell.js';

const filterLabels = [
  ['all', 'همه'], ['active', 'در جریان'], ['delivered', 'تحویل‌شده'], ['cancelled', 'لغوشده'], ['returned', 'مرجوع‌شده']
];

const orderCard = order => `<article class="orders-card" data-order-card data-status="${esc(order.status)}" data-search="${esc(order.orderNumber)}">
  <header><div><span>شماره سفارش</span><strong dir="ltr">${esc(order.orderNumber)}</strong><small>${esc(order.placedAt)}</small></div>${statusBadge(order.status, order.statusLabel)}</header>
  <div class="orders-card__products">${order.items.map(item => `<div><img src="${safeImage(item.image)}" alt="${esc(item.name)}" width="72" height="96" loading="lazy"><span><strong>${esc(item.name)}</strong><small>${esc(item.color)} · سایز ${esc(item.size)} · ${toPersianDigits(item.quantity)} عدد</small></span></div>`).join('')}</div>
  <footer><div><span>مبلغ سفارش</span><strong>${formatPrice(order.total)}</strong></div><div class="orders-card__actions"><a class="button button--outline button--small" href="./order-details?id=${encodeParam(order.id)}">جزئیات و پیگیری</a>${order.status === 'delivered' ? `<a class="text-button" href="./return-request?order=${encodeParam(order.id)}">درخواست تعویض یا مرجوعی</a>` : ''}</div></footer>
</article>`;

const emptyTemplate = () => `<div class="account-empty"><span>${icon('package', 'icon icon--lg')}</span><h2>سفارشی در این بخش نیست</h2><p>با تغییر فیلتر یا جست‌وجوی شماره سفارش، نتیجه دیگری را بررسی کنید.</p><a class="button button--outline" href="./shop">مشاهده محصولات</a></div>`;

const pageTemplate = (session, account, orders) => `<div class="account-page-shell">
  ${accountSidebarTemplate({ active: 'orders', session, account })}
  <div class="account-content">${accountMobileNavTemplate('orders')}
    <header class="account-welcome account-welcome--compact"><div><p class="eyebrow">تاریخچه خرید</p><h1>سفارش‌های من</h1><p>${toPersianDigits(orders.length)} سفارش در حساب شما ثبت شده است.</p></div><a class="button button--outline" href="./order-tracking">پیگیری با شماره سفارش</a></header>
    <div class="orders-toolbar"><div class="order-filter-tabs" role="tablist" aria-label="فیلتر سفارش‌ها">${filterLabels.map(([key,label], index) => `<button type="button" role="tab" data-order-filter="${key}" aria-selected="${index === 0}">${label}</button>`).join('')}</div><label class="orders-search"><span class="visually-hidden">جست‌وجوی شماره سفارش</span>${icon('search')}<input class="input" id="orders-search" type="search" dir="ltr" maxlength="32" placeholder="TO-261005-1234"></label></div>
    <div class="orders-list" id="orders-list">${orders.map(orderCard).join('')}</div>
    <div id="orders-empty" ${orders.length ? 'hidden' : ''}>${emptyTemplate()}</div>
  </div>
</div>`;

const matchesFilter = (status, filter) => {
  if (filter === 'all') return true;
  if (filter === 'active') return ['registered','awaiting-payment','paid','processing','ready','shipped'].includes(status);
  return status === filter;
};

const bindFilters = () => {
  let activeFilter = 'all';
  const search = document.getElementById('orders-search');
  const update = () => {
    const term = toEnglishDigits(search.value).toUpperCase().replace(/\s/g, '');
    let visible = 0;
    document.querySelectorAll('[data-order-card]').forEach(card => {
      const show = matchesFilter(card.dataset.status, activeFilter) && (!term || card.dataset.search.includes(term));
      card.hidden = !show; if (show) visible += 1;
    });
    document.getElementById('orders-empty').hidden = visible > 0;
  };
  document.querySelectorAll('[data-order-filter]').forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.orderFilter;
    document.querySelectorAll('[data-order-filter]').forEach(item => item.setAttribute('aria-selected', String(item === button)));
    update();
  }));
  search?.addEventListener('input', update);
};

const render = async () => {
  const root = document.getElementById('orders-page-root');
  const session = getSession();
  if (!session) { root.innerHTML = authGateTemplate({ title: 'سفارش‌ها فقط در حساب شما نمایش داده می‌شوند', message: 'برای دیدن تاریخچه خرید و جزئیات ارسال، با شماره موبایل وارد شوید.' }); return; }
  const account = getAccountData();
  let orders = getOrders();
  try { orders = setOrders(await api.getOrders()); }
  catch (error) {
    if (error.status === 401) { root.innerHTML = authGateTemplate({ title:'نشست شما منقضی شده است', message:'برای مشاهده سفارش‌ها دوباره وارد حساب شوید.' }); return; }
    root.innerHTML = `<section class="account-auth-gate"><span class="account-auth-gate__icon">${icon('error')}</span><h1>دریافت سفارش‌ها انجام نشد</h1><p>${esc(error.message)}</p><button class="button" type="button" data-action="reload-page">تلاش دوباره</button></section>`; return;
  }
  root.innerHTML = pageTemplate(session, account, orders); bindFilters();
};

export const initOrders = () => { render(); document.addEventListener('toto:auth-changed', render); };
