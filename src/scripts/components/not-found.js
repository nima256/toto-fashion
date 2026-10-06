import { icon, escapeHtml as esc } from '../core/utils.js';

// قالب مشترک «پیدا نشد» برای صفحه ۴۰۴ سرور و حالت‌های پیدا نشد سمت کاربر (محصول، مقاله)
const COPY = {
  page: { eyebrow: 'خطای ۴۰۴', title: 'این صفحه پیدا نشد', text: 'ممکن است نشانی تغییر کرده باشد، صفحه حذف شده باشد یا نشانی را اشتباه وارد کرده باشید.' },
  product: { eyebrow: 'محصول در دسترس نیست', title: 'این محصول پیدا نشد', text: 'این محصول وجود ندارد، حذف شده یا دیگر در فروشگاه منتشر نمی‌شود. محصولات مشابه را در فروشگاه ببینید.' },
  article: { eyebrow: 'مجله توتو', title: 'این مقاله پیدا نشد', text: 'این مقاله منتشر نشده یا نشانی آن تغییر کرده است. مقاله‌های دیگر مجله را ببینید.' }
};
export const QUICK_LINKS = [
  ['./shop?new=1', 'star', 'محصولات جدید', 'تازه‌ترین انتخاب‌های توتو'],
  ['./shop?discount=1', 'gift', 'تخفیف‌ها', 'پیشنهادهای ویژه این هفته'],
  ['./order-tracking', 'truck', 'پیگیری سفارش', 'با شماره سفارش و موبایل'],
  ['./blog', 'edit', 'مجله توتو', 'راهنمای استایل و سایز'],
  ['./account', 'user', 'حساب من', 'سفارش‌ها و پاداش‌ها'],
  ['./contact', 'support', 'تماس با پشتیبانی', 'شنبه تا پنجشنبه ۹ تا ۱۸']
];
const hanger = '<svg class="not-found__hanger" viewBox="0 0 220 140" aria-hidden="true" focusable="false"><path d="M110 34a14 14 0 1 1 14-14" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M110 34v12L18 108a10 10 0 0 0 6 18h172a10 10 0 0 0 6-18L110 46" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/></svg>';

export const notFoundTemplate = (kind = 'page', { headingTag = 'h1' } = {}) => {
  const copy = COPY[kind] || COPY.page;
  return `<section class="not-found" aria-labelledby="not-found-title">
    <div class="not-found__visual" aria-hidden="true"><span class="not-found__code">۴۰۴</span>${hanger}</div>
    <div class="not-found__copy">
      <p class="eyebrow">${esc(copy.eyebrow)}</p>
      <${headingTag} id="not-found-title">${esc(copy.title)}</${headingTag}>
      <p>${esc(copy.text)}</p>
      <form class="not-found__search" action="/search" method="get" role="search"><label class="visually-hidden" for="not-found-q">جست‌وجو در توتو</label><input class="input" id="not-found-q" name="q" type="search" maxlength="64" placeholder="نام محصول، دسته‌بندی یا استایل"><button class="button" type="submit">${icon('search', 'icon icon--sm')} جست‌وجو</button></form>
      <div class="not-found__actions"><a class="button" href="/">بازگشت به خانه</a><a class="button button--outline" href="./${kind === 'article' ? 'blog' : 'shop'}">${kind === 'article' ? 'مجله توتو' : 'مشاهده محصولات'}</a></div>
    </div>
  </section>
  <nav class="not-found__links" aria-label="پیوندهای پرکاربرد">${QUICK_LINKS.map(([href, iconName, title, text]) => `<a href="${href}"><span>${icon(iconName)}</span><strong>${title}</strong><small>${text}</small></a>`).join('')}</nav>
  <section class="section not-found__suggestions" id="not-found-suggestions" aria-labelledby="not-found-suggestions-title" hidden><div class="section-heading"><div><p class="eyebrow">پیشنهاد توتو</p><h2 id="not-found-suggestions-title">شاید این‌ها را بپسندید</h2></div><a class="inline-link" href="./shop">همه محصولات</a></div><div class="product-grid" id="not-found-products"></div></section>`;
};
