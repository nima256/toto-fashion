import { magazineArticles, faqGroups } from '../../data/content-data.js';
import { products } from '../../data/mock-data.js';
import { productCardTemplate } from '../components/product-card.js';
import { icon, toEnglishDigits, announce } from '../core/utils.js';
import { api } from '../services/api.js';

const articleCard = article => `
  <article class="mag-card" data-article-category="${article.category}">
    <a href="./article?id=${article.id}">
      <img src="${article.image}" alt="${article.imageAlt}" width="1000" height="700" loading="lazy" decoding="async">
      <div class="mag-card__body">
        <p>${article.category}</p>
        <h3>${article.title}</h3>
        <span>${article.date} · ${article.readingTime}</span>
        <em>${article.excerpt}</em>
      </div>
    </a>
  </article>`;

const initBlog = () => {
  const grid = document.getElementById('magazine-grid');
  const filters = [...document.querySelectorAll('[data-magazine-filter]')];
  const count = document.getElementById('magazine-count');
  if (!grid) return;
  const render = category => {
    const items = category === 'همه' ? magazineArticles : magazineArticles.filter(item => item.category === category);
    grid.innerHTML = items.map(articleCard).join('');
    count.textContent = `${items.length.toLocaleString('fa-IR')} مقاله`;
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.magazineFilter === category)));
  };
  filters.forEach(button => button.addEventListener('click', () => render(button.dataset.magazineFilter)));
  render('همه');
};

const renderArticle = article => {
  const toc = article.sections.map(section => `<a href="#${section.id}">${section.title}</a>`).join('');
  const sections = article.sections.map(section => `
    <section aria-labelledby="heading-${section.id}">
      <h2 id="heading-${section.id}">${section.title}</h2>
      ${(section.paragraphs || []).map(paragraph => `<p>${paragraph}</p>`).join('')}
      ${section.note ? `<div class="article-note"><strong>نکته توتو</strong><p>${section.note}</p></div>` : ''}
      ${(section.subSections || []).map(item => `<h3>${item.title}</h3><p>${item.text}</p>`).join('')}
    </section>`).join('');
  const related = magazineArticles.filter(item => item.id !== article.id).slice(0, 3);
  return `
    <nav class="breadcrumbs"><a href="/">خانه</a><a href="./blog">مجله توتو</a><span>${article.title}</span></nav>
    <header class="article-header">
      <p class="eyebrow">${article.category}</p><h1>${article.title}</h1><p>${article.excerpt}</p>
      <div><span>${article.date}</span><span>زمان مطالعه ${article.readingTime}</span></div>
    </header>
    <img class="article-cover" src="${article.image}" alt="${article.imageAlt}" width="1200" height="840">
    <div class="article-layout">
      <aside class="article-toc" aria-label="فهرست مقاله"><strong>در این مقاله</strong>${toc}<button class="text-button article-share" type="button" data-share-article>${icon('share', 'icon icon--sm')} اشتراک‌گذاری</button></aside>
      <article class="article-content"><p class="article-lead">${article.intro}</p>${sections}<div class="article-end"><strong>این مطلب برای شما مفید بود؟</strong><p>راهنمای سایز و توضیحات هر محصول را هم پیش از خرید بررسی کنید.</p><a class="button button--outline" href="./size-guide">مشاهده راهنمای سایز</a></div></article>
    </div>
    <section class="related-reading section"><div class="section-heading"><div><p class="eyebrow">ادامه مطالعه</p><h2>مقاله‌های مرتبط</h2></div><a class="inline-link" href="./blog">همه مقاله‌ها</a></div><div class="magazine-grid magazine-grid--compact">${related.map(articleCard).join('')}</div></section>
    <section class="article-products section section--soft"><div class="section-heading"><div><p class="eyebrow">انتخاب توتو</p><h2>محصولات مرتبط با این راهنما</h2></div><a class="inline-link" href="./shop">مشاهده فروشگاه</a></div><div class="product-grid">${products.slice(0, 4).map(product => productCardTemplate(product)).join('')}</div></section>`;
};

const initArticle = ({ toast } = {}) => {
  const root = document.getElementById('article-root');
  if (!root) return;
  const id = new URLSearchParams(location.search).get('id') || 'body-shape';
  const article = magazineArticles.find(item => item.id === id) || magazineArticles[0];
  root.innerHTML = renderArticle(article);
  document.title = `${article.title} | مجله توتو`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', article.excerpt);
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://totofashion.ir/article?id=${article.id}`);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', article.title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', article.excerpt);
  document.querySelector('meta[property="og:image"]')?.setAttribute('content', `https://totofashion.ir/${article.image.replace('./','')}`);
  const schema = document.getElementById('article-schema');
  if (schema) schema.textContent = JSON.stringify({ '@context':'https://schema.org', '@type':'Article', headline:article.title, description:article.excerpt, datePublished:article.isoDate, author:{'@type':'Organization',name:'توتو فشن'}, publisher:{'@type':'Organization',name:'TOTO Fashion'}, image:`https://totofashion.ir/${article.image.replace('./','')}`, inLanguage:'fa-IR' });
  document.querySelector('[data-share-article]')?.addEventListener('click', async () => {
    const shareData = { title: article.title, text: article.excerpt, url: location.href };
    if (navigator.share) { try { await navigator.share(shareData); } catch {} return; }
    await navigator.clipboard?.writeText(location.href);
    announce('پیوند مقاله کپی شد.');
    toast?.('پیوند مقاله کپی شد.');
  });
};

const initFaq = () => {
  const root = document.getElementById('faq-groups');
  if (!root) return;
  root.innerHTML = faqGroups.map(group => `<section class="faq-group" id="${group.id}"><h2>${group.title}</h2>${group.items.map(([question, answer], index) => `<details class="content-accordion"><summary><span>${question}</span>${icon('plus')}</summary><div><p>${answer}</p></div></details>`).join('')}</section>`).join('');
  const search = document.getElementById('faq-search');
  search?.addEventListener('input', () => {
    const term = search.value.trim();
    let matches = 0;
    root.querySelectorAll('details').forEach(details => {
      const visible = !term || details.textContent.includes(term);
      details.hidden = !visible;
      if (visible) matches += 1;
    });
    root.querySelectorAll('.faq-group').forEach(group => { group.hidden = ![...group.querySelectorAll('details')].some(item => !item.hidden); });
    document.getElementById('faq-empty').hidden = matches > 0;
  });
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
    const errors = {
      fullName: values.fullName.trim().length < 3 ? 'نام و نام خانوادگی را کامل وارد کنید.' : '',
      mobile: /^09\d{9}$/.test(toEnglishDigits(values.mobile)) ? '' : 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.',
      subject: values.subject ? '' : 'موضوع پیام را انتخاب کنید.',
      message: values.message.trim().length < 15 ? 'پیام را با حداقل ۱۵ نویسه توضیح دهید.' : '',
      orderNumber: values.orderNumber && !/^\d{6,14}$/.test(toEnglishDigits(values.orderNumber)) ? 'شماره سفارش را فقط با رقم وارد کنید.' : ''
    };
    Object.entries(errors).forEach(([name, message]) => setFieldError(form, name, message));
    const firstError = Object.entries(errors).find(([, message]) => message);
    if (firstError) { form.elements[firstError[0]].focus(); return; }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true; submit.textContent = 'در حال ارسال...';
    try {
      await api.sendContactMessage(values);
    } catch (error) {
      submit.disabled = false; submit.textContent = 'ارسال پیام برای پشتیبانی';
      toast?.(error.message || 'ارسال پیام انجام نشد. دوباره تلاش کنید.', 'error');
      return;
    }
    form.hidden = true;
    document.getElementById('contact-success').hidden = false;
    toast?.('پیام شما برای پشتیبانی ثبت شد.');
  });
  form.addEventListener('input', event => { if (event.target.name) setFieldError(form, event.target.name); });
};

export const initContentPages = ({ toast } = {}) => {
  const page = document.body.dataset.page;
  if (page === 'blog') initBlog();
  if (page === 'article') initArticle({ toast });
  if (page === 'faq') initFaq();
  if (page === 'contact') initContact({ toast });
};
