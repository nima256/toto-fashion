import { heroSlides, products, articles } from '../../data/mock-data.js';
import { productCardTemplate } from '../components/product-card.js?v=3';
import { icon, toPersianDigits } from '../core/utils.js';

export const initHome = () => {
  const collectionRoot = document.getElementById('toto-collection-products');
  if (collectionRoot) collectionRoot.innerHTML = [...products.filter(item => item.isNew), ...products.filter(item => !item.isNew)].slice(0, 4).map(productCardTemplate).join('');
  const offerRoot = document.getElementById('offer-products');
  if (offerRoot) offerRoot.innerHTML = products.filter(item => item.discount).slice(0, 4).map(productCardTemplate).join('');
  const bestSellerRoot = document.getElementById('best-seller-products');
  if (bestSellerRoot) bestSellerRoot.innerHTML = [...products].sort((a, b) => Number(b.bestSeller) - Number(a.bestSeller) || b.popularity - a.popularity).slice(0, 4).map(productCardTemplate).join('');
  const articleRoot = document.getElementById('article-grid');
  if (articleRoot) articleRoot.innerHTML = articles.map(article => `<article class="article-card"><a href="./article?id=${article.id}"><img src="${article.image}" alt="تصویر مقاله ${article.title}" width="1000" height="700" loading="lazy"><div class="article-card__body"><p>${article.category}</p><h3>${article.title}</h3><span>${article.date} · ${article.readingTime}</span><em>${article.excerpt}</em></div></a></article>`).join('');

  initHero();
  initCountdown();
};

const initHero = () => {
  const track = document.getElementById('hero-track');
  const controls = document.getElementById('hero-controls');
  const slider = document.getElementById('hero-slider');
  if (!track || !controls || !slider) return;
  let active = 0;
  let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer;
  let touchStart = 0;

  track.innerHTML = heroSlides.map((slide, index) => `<article class="hero-slide ${index === 0 ? 'hero-slide--lead is-active' : ''}" aria-hidden="${index !== 0}"><img src="${slide.image}" alt="" width="1600" height="1000" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}><div class="hero-slide__shade"></div><div class="hero-slide__content"><p>${slide.eyebrow}</p><h1>${slide.title}</h1><span>${slide.text}</span><div><a class="button button--light" href="${slide.href}">${slide.cta}</a><a class="hero-link" href="./shop?sort=bestseller">دیدن پرفروش‌ترین‌ها</a></div></div></article>`).join('');
  controls.innerHTML = `<div class="hero-arrows"><button class="icon-button icon-button--light" type="button" data-hero="prev" aria-label="اسلاید قبلی">${icon('chevron-right')}</button><button class="icon-button icon-button--light" type="button" data-hero="next" aria-label="اسلاید بعدی">${icon('chevron-left')}</button></div><div class="hero-dots">${heroSlides.map((_, index) => `<button type="button" data-hero-index="${index}" aria-label="رفتن به اسلاید ${toPersianDigits(index + 1)}" aria-current="${index === 0}"></button>`).join('')}</div><button class="icon-button icon-button--light" type="button" data-hero="pause" aria-label="توقف حرکت خودکار">${icon(paused ? 'play' : 'pause')}</button>`;

  const render = index => {
    active = (index + heroSlides.length) % heroSlides.length;
    track.querySelectorAll('.hero-slide').forEach((slide, i) => { slide.classList.toggle('is-active', i === active); slide.setAttribute('aria-hidden', String(i !== active)); });
    controls.querySelectorAll('[data-hero-index]').forEach((dot, i) => dot.setAttribute('aria-current', String(i === active)));
  };
  const resetTimer = () => { clearInterval(timer); if (!paused) timer = setInterval(() => render(active + 1), 6500); };

  controls.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.hero === 'prev') render(active - 1);
    if (button.dataset.hero === 'next') render(active + 1);
    if (button.dataset.heroIndex) render(Number(button.dataset.heroIndex));
    if (button.dataset.hero === 'pause') { paused = !paused; button.innerHTML = icon(paused ? 'play' : 'pause'); button.setAttribute('aria-label', paused ? 'ادامه حرکت خودکار' : 'توقف حرکت خودکار'); }
    resetTimer();
  });
  slider.addEventListener('keydown', event => { if (event.key === 'ArrowLeft') render(active + 1); if (event.key === 'ArrowRight') render(active - 1); });
  slider.addEventListener('touchstart', event => { touchStart = event.changedTouches[0].clientX; }, { passive: true });
  slider.addEventListener('touchend', event => { const delta = event.changedTouches[0].clientX - touchStart; if (Math.abs(delta) > 50) render(active + (delta < 0 ? 1 : -1)); }, { passive: true });
  resetTimer();
};

const initCountdown = () => {
  const root = document.getElementById('offer-countdown');
  if (!root) return;
  const end = new Date(root.dataset.end).getTime();
  const tick = () => {
    const remaining = end - Date.now();
    if (remaining <= 0) { root.classList.add('is-expired'); root.innerHTML = '<strong>این آفر به پایان رسیده است</strong><span>پیشنهادهای تازه را در بخش تخفیف‌ها ببینید.</span>'; return false; }
    const days = Math.floor(remaining / 86400000); const hours = Math.floor((remaining % 86400000) / 3600000); const minutes = Math.floor((remaining % 3600000) / 60000); const seconds = Math.floor((remaining % 60000) / 1000);
    root.innerHTML = [['روز', days], ['ساعت', hours], ['دقیقه', minutes], ['ثانیه', seconds]].map(([label, value]) => `<span><strong>${toPersianDigits(String(value).padStart(2, '0'))}</strong><small>${label}</small></span>`).join('');
    return true;
  };
  tick(); const timer = setInterval(() => { if (!tick()) clearInterval(timer); }, 1000);
};
