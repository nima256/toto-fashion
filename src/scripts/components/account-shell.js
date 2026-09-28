import { icon, toPersianDigits } from '../core/utils.js';

const accountLinks = [
  { key: 'account', href: './account', icon: 'home', label: 'نمای کلی' },
  { key: 'orders', href: './orders', icon: 'package', label: 'سفارش‌های من' },
  { key: 'tracking', href: './order-tracking', icon: 'location', label: 'پیگیری سفارش' },
  { key: 'gallery', href: './gallery?mine=1', icon: 'image', label: 'عکس‌های من' },
  { key: 'saved', href: './saved-for-later', icon: 'bookmark', label: 'ذخیره برای بعد' },
  { key: 'returns', href: './return-request', icon: 'refresh', label: 'مرجوعی و تعویض' }
];

export const authGateTemplate = ({ title = 'برای مشاهده حساب وارد شوید', message = 'با شماره موبایل خود وارد شوید تا سفارش‌ها، امتیازها و پاداش‌های توتو را ببینید.' } = {}) => `
  <section class="account-auth-gate" aria-labelledby="auth-gate-title">
    <span class="account-auth-gate__icon">${icon('user', 'icon icon--lg')}</span>
    <p class="eyebrow">حساب توتو</p>
    <h1 id="auth-gate-title">${title}</h1>
    <p>${message}</p>
    <div class="account-auth-benefits" aria-label="مزایای حساب توتو">
      <span>${icon('package')}<b>پیگیری سریع سفارش</b></span>
      <span>${icon('gift')}<b>پاداش و امتیاز خرید</b></span>
      <span>${icon('heart')}<b>ذخیره انتخاب‌ها</b></span>
    </div>
    <div class="account-auth-actions"><button class="button" type="button" data-action="open-login">ورود با شماره موبایل</button><a class="button button--outline" href="./order-tracking">پیگیری سفارش بدون ورود</a></div>
  </section>`;

export const accountSidebarTemplate = ({ active = 'account', session, account }) => `
  <aside class="account-sidebar" aria-label="منوی حساب مشتری">
    <div class="account-person">
      <span class="account-person__avatar" aria-hidden="true">${(account?.profile?.firstName || session?.customer?.firstName || 'ت').slice(0, 1)}</span>
      <div><strong>${account?.profile?.firstName || session?.customer?.firstName || 'کاربر'} ${account?.profile?.lastName || ''}</strong><span>${toPersianDigits(account?.profile?.mobile || session?.customer?.mobile || '')}</span></div>
    </div>
    <nav class="account-nav">
      ${accountLinks.map(link => `<a href="${link.href}" ${active === link.key ? 'aria-current="page"' : ''}>${icon(link.icon)}<span>${link.label}</span>${icon('chevron-left', 'icon icon--sm')}</a>`).join('')}
    </nav>
    <button class="account-logout" type="button" data-action="logout">${icon('logout')}<span>خروج از حساب</span></button>
  </aside>`;

export const accountMobileNavTemplate = active => `<nav class="account-mobile-nav" aria-label="بخش‌های حساب">
  ${accountLinks.slice(0, 6).map(link => `<a href="${link.href}" ${active === link.key ? 'aria-current="page"' : ''}>${link.label}</a>`).join('')}
</nav>`;

export const statusBadge = (status, label) => `<span class="order-status order-status--${status}"><span aria-hidden="true"></span>${label}</span>`;
