import { categories, megaMenuColumns } from '../../data/mock-data.js?v=3';
import { icon } from '../core/utils.js';

const currentPage = () => document.body.dataset.page || 'home';
const brand = () => `
  <a class="brand" href="/" aria-label="توتو فشن، صفحه اصلی">
    <img class="brand__logo" src="./src/assets/images/toto-fashion-logo.png" alt="TOTO Fashion" width="560" height="168">
  </a>`;

const megaMenu = () => `
  <div class="mega-menu" aria-label="زیرمنوی مانتو و کت">
    <div class="container mega-menu__grid">
      ${megaMenuColumns.map(column => `<section><h3>${column.title}</h3><ul>${column.items.map(item => `<li><a href="./shop?q=${encodeURIComponent(item)}">${item}</a></li>`).join('')}</ul></section>`).join('')}
      <a class="mega-menu__editorial" href="./shop?category=مانتو%20و%20کت"><p>ویرایش تازه</p><strong>کت‌های سبک برای روزهای آرام</strong></a>
    </div>
  </div>`;

export const announcementTemplate = () => `
  <div class="announcement" id="announcement-bar">
    <div class="container announcement__inner">
      <p>خریدهای بالای ۲ میلیون تومان، ارسال رایگان دارند</p>
      <a href="./shop?discount=1">مشاهده تخفیف‌ها</a>
      <button class="icon-button announcement__close" type="button" data-action="dismiss-announcement" aria-label="بستن پیام اطلاع‌رسانی">${icon('close', 'icon icon--sm')}</button>
    </div>
  </div>`;

export const desktopHeaderTemplate = () => `
  <header class="desktop-header" aria-label="سربرگ اصلی">
    <div class="container desktop-header__top">
      ${brand()}
      <div class="header-search"><button class="header-search__button" type="button" data-action="open-search" aria-haspopup="dialog">${icon('search')}<span>جست‌وجوی محصول، دسته‌بندی یا استایل</span></button></div>
      <div class="header-actions">
        <button class="header-action" type="button" data-action="open-login">${icon('user')}<span>ورود</span></button>
        <a class="header-action" href="./saved-for-later">${icon('heart')}<span>علاقه‌مندی‌ها</span></a>
        <a class="header-action" href="./cart">${icon('bag')}<span>سبد خرید</span><span class="counter-badge" data-cart-count>۰</span></a>
      </div>
    </div>
    <nav class="desktop-nav" aria-label="دسته‌بندی محصولات"><ul class="container desktop-nav__list">
      ${categories.filter(category => !['bag','shoe','gallery'].includes(category.key)).map(category => `<li class="${category.mega ? 'has-mega' : ''}"><a class="desktop-nav__link ${category.sale ? 'desktop-nav__link--sale' : ''}" href="${category.href}">${category.label}</a>${category.mega ? megaMenu() : ''}</li>`).join('')}
    </ul></nav>
  </header>`;

export const mobileHeaderTemplate = () => `
  <header class="mobile-header" aria-label="سربرگ موبایل"><div class="container mobile-header__inner">
    <div class="mobile-header__right"><button class="icon-button" type="button" data-action="open-drawer" aria-label="باز کردن منوی اصلی">${icon('menu')}</button></div>
    ${brand()}
    <div class="mobile-header__left"><button class="icon-button" type="button" data-action="open-search" aria-label="جست‌وجو">${icon('search')}</button><a class="icon-button" href="./cart" aria-label="سبد خرید">${icon('bag')}<span class="counter-badge" data-cart-count>۰</span></a></div>
  </div></header>`;

export const drawerTemplate = () => `
  <div class="overlay" id="mobile-drawer" aria-hidden="true"><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
    <div class="drawer__head"><strong id="drawer-title">منوی توتو</strong><button class="icon-button" type="button" data-action="close-drawer" aria-label="بستن منو">${icon('close')}</button></div>
    <div class="drawer__content"><nav class="drawer__nav" aria-label="منوی موبایل">${categories.map(category => `<a href="${category.href}"><span>${category.label}</span>${icon('chevron-left', 'icon icon--sm')}</a>`).join('')}</nav>
      <div class="drawer__support"><p>برای انتخاب سایز یا پیگیری خرید به راهنمایی نیاز دارید؟</p><button class="button button--secondary button--block" type="button" data-action="show-support">پشتیبانی خرید</button></div>
    </div>
  </aside></div>`;

export const bottomNavTemplate = () => {
  const page = currentPage();
  const item = (href, iconName, label, key) => `<a href="${href}" ${page === key ? 'aria-current="page"' : ''}>${icon(iconName)}<span>${label}</span></a>`;
  return `<nav class="mobile-bottom-nav" aria-label="ناوبری اصلی موبایل">
    ${item('/', 'home', 'خانه', 'home')}
    <button type="button" data-action="open-drawer">${icon('grid')}<span>دسته‌بندی</span></button>
    <button type="button" data-action="open-search">${icon('search')}<span>جست‌وجو</span></button>
    ${item('./gallery', 'image', 'گالری', 'gallery')}
    ${item('./account', 'user', 'حساب', 'account')}
  </nav>`;
};

export const footerTemplate = () => `
  <footer class="site-footer"><div class="container">
    <div class="footer-grid">
      <section class="footer-brand">${brand()}<p>توتو فشن، مجموعه‌ای آرام و دقیق از پوشاک زنانه برای ساختن استایل‌های ماندگار و ساده است.</p><div class="footer-contact"><a href="mailto:hello@totofashion.ir">hello@totofashion.ir</a><span>پشتیبانی خرید · شنبه تا پنجشنبه، ساعت ۹ تا ۱۸</span><span>ارسال سفارش به سراسر ایران</span></div></section>
      <section><h2 class="footer-title">محصولات</h2><ul class="footer-links"><li><a href="./shop?category=مانتو%20و%20کت">مانتو و کت</a></li><li><a href="./shop?category=پیراهن">پیراهن</a></li><li><a href="./shop?category=شومیز">شومیز</a></li><li><a href="./shop?new=1">کالکشن جدید</a></li></ul></section>
      <section><h2 class="footer-title">راهنمای خرید</h2><ul class="footer-links"><li><a href="./size-guide">راهنمای سایز</a></li><li><a href="./shipping-returns">ارسال و تعویض</a></li><li><a href="./faq">سوالات متداول</a></li><li><a href="./order-tracking">پیگیری سفارش</a></li><li><a href="./saved-for-later">ذخیره‌شده‌ها</a></li></ul></section>
      <section><h2 class="footer-title">درباره توتو</h2><ul class="footer-links"><li><a href="./about">داستان و فلسفه برند</a></li><li><a href="./gallery">گالری مشتریان</a></li><li><a href="./blog">مجله توتو</a></li><li><a href="./contact">تماس با ما</a></li><li><a href="./privacy">حریم خصوصی</a></li><li><a href="./terms">قوانین و مقررات</a></li></ul></section>
      <section><h2 class="footer-title">همراه توتو بمانید</h2><form class="newsletter" id="newsletter-form" novalidate><label for="newsletter-mobile">شماره موبایل برای دریافت خبر کالکشن‌ها</label><div class="newsletter__row"><input class="input" id="newsletter-mobile" inputmode="numeric" autocomplete="tel" placeholder="۰۹۱۲۱۲۳۴۵۶۷"><button class="button button--secondary" type="submit">عضویت</button></div><div class="field-message" id="newsletter-message"></div></form><div class="footer-social" aria-label="شبکه‌های اجتماعی"><a href="#" aria-label="اینستاگرام توتو">اینستاگرام</a><a href="#" aria-label="تلگرام توتو">تلگرام</a><a href="#" aria-label="پینترست توتو">پینترست</a></div><div class="footer-trust" aria-label="مزیت‌های خرید"><span>${icon('shield', 'icon icon--sm')} پرداخت امن</span><span>${icon('refresh', 'icon icon--sm')} تعویض سایز</span></div></section>
    </div>
    <div class="footer-bottom"><span>© ۱۴۰۵ توتو فشن. همه حقوق محفوظ است.</span><span><a href="./privacy">حریم خصوصی</a> · <a href="./terms">قوانین و مقررات</a></span></div>
  </div></footer>`;

export const mountShell = () => {
  const slots = {
    announcement: announcementTemplate(), 'desktop-header': desktopHeaderTemplate(), 'mobile-header': mobileHeaderTemplate(), drawer: drawerTemplate(), footer: footerTemplate(), 'bottom-nav': bottomNavTemplate()
  };
  Object.entries(slots).forEach(([name, html]) => { const slot = document.querySelector(`[data-slot="${name}"]`); if (slot) slot.innerHTML = html; });
};
