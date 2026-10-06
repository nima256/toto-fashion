import { products } from '../../data/mock-data.js';
import { productCardTemplate } from '../components/product-card.js';
import { icon, toEnglishDigits, toPersianDigits, announce, escapeHtml as esc, safeImage, encodeParam, normalizeOrderNumber } from '../core/utils.js';
import { api } from '../services/api.js';
import { notFoundTemplate } from '../components/not-found.js';

// همه محتوای مجله و صفحات اطلاعاتی از سرور می‌آید و فقط به‌صورت متن ساده (escape‌شده) رندر می‌شود
const articleCard = article => `
  <article class="mag-card" data-article-category="${esc(article.category)}">
    <a href="./article?id=${encodeParam(article.slug)}">
      <img src="${safeImage(article.image)}" alt="${esc(article.imageAlt)}" width="1000" height="700" loading="lazy" decoding="async">
      <div class="mag-card__body">
        <p>${esc(article.category)}</p>
        <h3>${esc(article.title)}</h3>
        <span>${esc(article.date)} · ${esc(article.readingTime)}</span>
        <em>${esc(article.excerpt)}</em>
      </div>
    </a>
  </article>`;
const errorNotice = (title, message) => `<div class="page-notice page-notice--error">${icon('error')}<div><strong>${esc(title)}</strong><p>${esc(message)}</p></div></div>`;

const initBlog = async () => {
  const grid = document.getElementById('magazine-grid');
  const filters = [...document.querySelectorAll('[data-magazine-filter]')];
  const count = document.getElementById('magazine-count');
  if (!grid) return;
  let articles = [];
  try { articles = await api.getMagazineArticles(); }
  catch (error) { grid.innerHTML = errorNotice('دریافت مقاله‌ها انجام نشد', error.message); if (count) count.textContent = ''; return; }
  const feature = document.querySelector('.magazine-feature'); const featured = articles.find(item => item.featured) || articles[0];
  if (feature && featured) {
    feature.href = `./article?id=${encodeParam(featured.slug)}`;
    const img = feature.querySelector('img'); if (img) { img.src = safeImage(featured.image).replace(/&amp;/g, '&'); img.alt = featured.imageAlt || featured.title; }
    const content = feature.querySelector('.magazine-feature__content');
    if (content) { content.querySelector('p').textContent = `پرونده ویژه · ${featured.category}`; content.querySelector('h2').textContent = featured.title; content.querySelector('span').textContent = featured.excerpt; }
  } else if (feature) feature.hidden = true;
  const render = category => {
    const items = category === 'همه' ? articles : articles.filter(item => item.category === category);
    grid.innerHTML = items.length ? items.map(articleCard).join('') : '<p class="recent-empty">مقاله‌ای در این دسته منتشر نشده است.</p>';
    if (count) count.textContent = `${items.length.toLocaleString('fa-IR')} مقاله`;
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.magazineFilter === category)));
  };
  filters.forEach(button => button.addEventListener('click', () => render(button.dataset.magazineFilter)));
  render('همه');
};

const renderArticle = (article, related) => {
  const toc = article.sections.map(section => `<a href="#heading-${esc(section.id)}">${esc(section.title)}</a>`).join('');
  const sections = article.sections.map(section => `
    <section aria-labelledby="heading-${esc(section.id)}">
      <h2 id="heading-${esc(section.id)}">${esc(section.title)}</h2>
      ${(section.paragraphs || []).map(paragraph => `<p>${esc(paragraph)}</p>`).join('')}
      ${section.note ? `<div class="article-note"><strong>نکته توتو</strong><p>${esc(section.note)}</p></div>` : ''}
      ${(section.subSections || []).map(item => `<h3>${esc(item.title)}</h3><p>${esc(item.text)}</p>`).join('')}
    </section>`).join('');
  return `
    <nav class="breadcrumbs"><a href="/">خانه</a><a href="./blog">مجله توتو</a><span>${esc(article.title)}</span></nav>
    <header class="article-header">
      <p class="eyebrow">${esc(article.category)}</p><h1>${esc(article.title)}</h1><p>${esc(article.excerpt)}</p>
      <div><span>${esc(article.date)}</span><span>زمان مطالعه ${esc(article.readingTime)}</span></div>
    </header>
    <img class="article-cover" src="${safeImage(article.image)}" alt="${esc(article.imageAlt)}" width="1200" height="840">
    <div class="article-layout">
      <aside class="article-toc" aria-label="فهرست مقاله"><strong>در این مقاله</strong>${toc}<button class="text-button article-share" type="button" data-share-article>${icon('share', 'icon icon--sm')} اشتراک‌گذاری</button></aside>
      <article class="article-content"><p class="article-lead">${esc(article.intro)}</p>${sections}<div class="article-end"><strong>این مطلب برای شما مفید بود؟</strong><p>راهنمای سایز و توضیحات هر محصول را هم پیش از خرید بررسی کنید.</p><a class="button button--outline" href="./size-guide">مشاهده راهنمای سایز</a></div></article>
    </div>
    ${related.length ? `<section class="related-reading section"><div class="section-heading"><div><p class="eyebrow">ادامه مطالعه</p><h2>مقاله‌های مرتبط</h2></div><a class="inline-link" href="./blog">همه مقاله‌ها</a></div><div class="magazine-grid magazine-grid--compact">${related.map(articleCard).join('')}</div></section>` : ''}
    ${products.length ? `<section class="article-products section section--soft"><div class="section-heading"><div><p class="eyebrow">انتخاب توتو</p><h2>محصولات مرتبط با این راهنما</h2></div><a class="inline-link" href="./shop">مشاهده فروشگاه</a></div><div class="product-grid">${products.slice(0, 4).map(product => productCardTemplate(product)).join('')}</div></section>` : ''}`;
};

const initArticle = async ({ toast } = {}) => {
  const root = document.getElementById('article-root');
  if (!root) return;
  const slug = new URLSearchParams(location.search).get('id') || 'body-shape';
  let article; let related = [];
  try { [article, related] = await Promise.all([api.getArticle(slug), api.getMagazineArticles().catch(() => [])]); }
  catch (error) {
    root.innerHTML = error.status === 404 || error.status === 400 ? notFoundTemplate('article') : errorNotice('دریافت مقاله انجام نشد', error.message);
    document.title = 'مقاله پیدا نشد | مجله توتو'; return;
  }
  root.innerHTML = renderArticle(article, related.filter(item => item.slug !== article.slug).slice(0, 3));
  document.title = `${article.title} | مجله توتو`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', article.excerpt);
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://totofashion.ir/article?id=${encodeParam(article.slug)}`);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', article.title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', article.excerpt);
  const schema = document.getElementById('article-schema');
  if (schema) schema.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: article.excerpt, datePublished: article.isoDate, author: { '@type': 'Organization', name: 'توتو فشن' }, publisher: { '@type': 'Organization', name: 'TOTO Fashion' }, inLanguage: 'fa-IR' });
  document.querySelector('[data-share-article]')?.addEventListener('click', async () => {
    const shareData = { title: article.title, text: article.excerpt, url: location.href };
    if (navigator.share) { try { await navigator.share(shareData); } catch { /* لغو کاربر */ } return; }
    try { await navigator.clipboard?.writeText(location.href); announce('پیوند مقاله کپی شد.'); toast?.('پیوند مقاله کپی شد.'); } catch { toast?.('کپی پیوند انجام نشد.', 'error'); }
  });
};

const initFaq = async () => {
  const root = document.getElementById('faq-groups');
  if (!root) return;
  let groups = [];
  try { groups = await api.getFaq(); } catch (error) { root.innerHTML = errorNotice('دریافت سوالات متداول انجام نشد', error.message); return; }
  root.innerHTML = groups.length ? groups.map(group => `<section class="faq-group" id="${esc(group.id)}"><h2>${esc(group.title)}</h2>${(group.items || []).map(([question, answer]) => `<details class="content-accordion"><summary><span>${esc(question)}</span>${icon('plus')}</summary><div><p>${esc(answer)}</p></div></details>`).join('')}</section>`).join('') : '<p class="recent-empty">سوال متداولی منتشر نشده است.</p>';
  const search = document.getElementById('faq-search');
  search?.addEventListener('input', () => {
    const term = search.value.trim();
    let matches = 0;
    root.querySelectorAll('details').forEach(details => { const visible = !term || details.textContent.includes(term); details.hidden = !visible; if (visible) matches += 1; });
    root.querySelectorAll('.faq-group').forEach(group => { group.hidden = ![...group.querySelectorAll('details')].some(item => !item.hidden); });
    const empty = document.getElementById('faq-empty'); if (empty) empty.hidden = matches > 0;
  });
};

// صفحات اطلاعاتی: اگر نسخه منتشرشده در پنل مدیریت وجود داشته باشد، جایگزین متن پیش‌فرض قالب می‌شود
const initManagedPage = async slug => {
  const main = document.getElementById('main-content'); if (!main) return;
  let page = null;
  try { page = await api.getContentPage(slug); } catch { return; }
  if (!page) return;
  main.innerHTML = `<div class="container container--narrow"><nav class="breadcrumbs"><a href="/">خانه</a><span>${esc(page.title)}</span></nav><header class="info-page-header">${page.eyebrow ? `<p class="eyebrow">${esc(page.eyebrow)}</p>` : ''}<h1>${esc(page.title)}</h1>${page.intro ? `<p>${esc(page.intro)}</p>` : ''}</header><div class="info-layout">${page.sections.length > 1 ? `<nav class="info-side-nav" aria-label="بخش‌های صفحه">${page.sections.map(section => `<a href="#${esc(section.id)}">${esc(section.title)}</a>`).join('')}</nav>` : ''}<div class="info-content">${page.sections.map(section => `<section id="${esc(section.id)}"><h2>${esc(section.title)}</h2>${section.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}</section>`).join('')}</div></div></div>`;
  document.title = `${page.title} | توتو فشن`;
};

const setFieldError = (form, name, message = '') => {
  const input = form.elements[name];
  const error = form.querySelector(`[data-error-for="${name}"]`);
  if (!input || !error) return;
  input.setAttribute('aria-invalid', String(Boolean(message)));
  error.textContent = message;
};

const initContact = ({ toast } = {}) => {
  const form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const orderNumber = String(values.orderNumber || '').trim();
    const errors = {
      fullName: String(values.fullName || '').trim().length < 3 ? 'نام و نام خانوادگی را کامل وارد کنید.' : '',
      mobile: /^09\d{9}$/.test(toEnglishDigits(values.mobile).trim()) ? '' : 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.',
      subject: values.subject ? '' : 'موضوع پیام را انتخاب کنید.',
      message: String(values.message || '').trim().length < 15 ? 'پیام را با حداقل ۱۵ نویسه توضیح دهید.' : '',
      orderNumber: orderNumber && !normalizeOrderNumber(orderNumber) ? 'شماره سفارش را مانند TO-261005-1234 وارد کنید.' : ''
    };
    Object.entries(errors).forEach(([name, message]) => setFieldError(form, name, message));
    const firstError = Object.entries(errors).find(([, message]) => message);
    if (firstError) { form.elements[firstError[0]].focus(); return; }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true; submit.textContent = 'در حال ارسال...';
    let result;
    try { result = await api.sendContactMessage({ fullName: values.fullName, mobile: toEnglishDigits(values.mobile).trim(), subject: values.subject, message: values.message, orderNumber: orderNumber ? normalizeOrderNumber(orderNumber) : '' }); }
    catch (error) {
      (error.details || []).forEach(item => setFieldError(form, String(item.path).split('.').pop(), item.message));
      submit.disabled = false; submit.textContent = 'ارسال پیام برای پشتیبانی';
      toast?.(error.message || 'ارسال پیام انجام نشد. دوباره تلاش کنید.', 'error');
      return;
    }
    form.hidden = true;
    // کد پیگیری واقعی که سرور صادر کرده است
    const ticket = document.getElementById('contact-ticket-id'); if (ticket) ticket.textContent = result.ticketId;
    const linked = document.getElementById('contact-ticket-order'); if (linked) { linked.hidden = !result.orderNumber; linked.textContent = result.orderNumber ? `مرتبط با سفارش ${result.orderNumber}` : ''; }
    document.getElementById('contact-success').hidden = false;
    toast?.(`پیام شما با کد ${toPersianDigits(result.ticketId)} برای پشتیبانی ثبت شد.`);
  });
  form.addEventListener('input', event => { if (event.target.name) setFieldError(form, event.target.name); });
};

export const initContentPages = ({ toast } = {}) => {
  const page = document.body.dataset.page;
  if (page === 'blog') initBlog();
  if (page === 'article') initArticle({ toast });
  if (page === 'faq') initFaq();
  if (page === 'contact') initContact({ toast });
  if (['about', 'privacy', 'terms', 'shipping-returns'].includes(page)) initManagedPage(page);
};
