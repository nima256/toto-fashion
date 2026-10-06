import { products } from '../../data/mock-data.js';
import { productCardTemplate } from '../components/product-card.js';
import { localStore } from '../core/storage.js';
import { icon, formatPrice, toPersianDigits, announce, escapeHtml as esc, safeImage, safeColor } from '../core/utils.js';
import { addCartItem, isVariantAvailable, variantFor } from '../core/commerce.js';
import { getSession } from '../core/account-store.js';
import { setSaved, isSaved } from '../core/saved-store.js';
import { api } from '../services/api.js';
import { notFoundTemplate } from '../components/not-found.js';

const safeReturn = value => value && /^(shop|search)(?:\?[^\s"'<>`]*)?$/.test(value) ? `./${value}` : './shop';
const accordion = (title, content, open = false) => { const id = `accordion-${Math.random().toString(36).slice(2)}`; return `<section class="accordion"><h3><button class="accordion__button" type="button" aria-expanded="${open}" aria-controls="${id}"><span>${esc(title)}</span>${icon('plus')}</button></h3><div class="accordion__panel" id="${id}" ${open ? '' : 'hidden'}>${content}</div></section>`; };

const errorTemplate = message => `<section class="commerce-empty"><span class="commerce-empty__icon">${icon('error', 'icon icon--lg')}</span><h1>دریافت اطلاعات محصول انجام نشد</h1><p>${esc(message)}</p><button class="button" type="button" data-action="reload-page">تلاش دوباره</button></section>`;
const loadingTemplate = () => `<div class="account-loading" aria-label="در حال دریافت اطلاعات محصول"><span class="skeleton skeleton--line"></span><span class="skeleton skeleton--box"></span></div>`;

const reviewItem = review => `<article class="review"><div><strong>${esc(review.displayName)}</strong><span>${review.verified ? 'خریدار تأییدشده · ' : ''}${esc(review.createdAt)} · ${'★'.repeat(Math.max(1, Math.min(5, Number(review.rating) || 1)))}</span></div><p>${esc(review.body)}</p></article>`;
const questionItem = item => `<article><strong>${esc(item.question)}</strong><p>${esc(item.answer)}</p><small>${esc(item.displayName)} · ${esc(item.createdAt)}</small></article>`;
const reviewFormTemplate = () => `<form class="account-form" id="review-form" novalidate><div class="field"><label for="review-rating">امتیاز شما</label><select class="input" id="review-rating" name="rating" required><option value="">انتخاب امتیاز</option>${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${toPersianDigits(n)} از ۵</option>`).join('')}</select></div><div class="field"><label for="review-body">متن دیدگاه</label><textarea class="input input--textarea" id="review-body" name="body" rows="4" maxlength="1000" required></textarea><small class="field-message" id="review-message"></small></div><button class="button" type="submit">ارسال دیدگاه</button></form>`;
const questionFormTemplate = () => `<form class="account-form" id="question-form" novalidate><div class="field"><label for="question-body">پرسش شما</label><textarea class="input input--textarea" id="question-body" name="question" rows="3" maxlength="500" required></textarea><small class="field-message" id="question-message"></small></div><button class="button" type="submit">ارسال پرسش</button></form>`;

const productTemplate = (product, returnHref, recentProducts) => {
  const gallery = [product.image, product.secondaryImage || product.image];
  const name = esc(product.name);
  const sizes = product.sizes || [];
  const sizeKey = size => (sizes.length ? size : '');
  return `<nav class="breadcrumbs" aria-label="مسیر صفحه"><a href="/">خانه</a><a href="${esc(returnHref)}">فروشگاه</a><span>${name}</span></nav>
  <div class="product-detail">
    <section class="product-gallery" aria-label="گالری تصاویر ${name}">
      <div class="product-gallery__desktop">
        <div class="product-thumbnails" aria-label="انتخاب تصویر">${gallery.map((image, index) => `<button type="button" data-gallery-index="${index}" aria-pressed="${index === 0}" aria-label="تصویر ${toPersianDigits(index + 1)} از ${name}"><img src="${safeImage(image)}" alt="" width="90" height="120"></button>`).join('')}</div>
        <div class="product-gallery__main"><img id="product-main-image" src="${safeImage(gallery[0])}" alt="${esc(product.imageAlt || product.name)}" width="720" height="960" fetchpriority="high"><span>${icon('zoom', 'icon icon--sm')} برای دیدن جزئیات، تصویر را انتخاب کنید</span></div>
      </div>
      <div class="product-gallery__mobile-track">${gallery.map((image, index) => `<button type="button" aria-label="تصویر ${toPersianDigits(index + 1)} از ${name}"><img src="${safeImage(image)}" alt="${index === 0 ? esc(product.imageAlt || product.name) : ''}" width="720" height="960" ${index ? 'loading="lazy"' : ''}></button>`).join('')}</div>
      <div class="mobile-gallery-dots" aria-hidden="true">${gallery.map(() => '<span></span>').join('')}</div>
    </section>
    <section class="product-info" aria-labelledby="product-name">
      <div class="product-info__top"><div><p>${esc(product.category)}</p><h1 id="product-name">${name}</h1><span>کد محصول: ${esc(product.sku)}</span></div></div>
      <div class="product-rating" id="product-rating"><span>${icon('star')} —</span><a href="#reviews">دیدگاه خریداران</a></div>
      <div class="product-price"><strong>${formatPrice(product.price)}</strong>${product.previousPrice ? `<del>${formatPrice(product.previousPrice)}</del><span>${esc(Number(product.discount) || 0)}٪ تخفیف</span>` : ''}</div>
      <div class="payment-note">امکان پرداخت از طریق درگاه‌های بانکی معتبر ایران</div>
      ${(product.colors || []).length ? `<fieldset class="product-choice"><legend><span>رنگ</span><strong id="selected-color-name">${esc(product.colorNames?.[0] || '')}</strong></legend><div class="color-choices">${product.colors.map((color, index) => `<button type="button" data-product-color="${index}" aria-pressed="${index === 0}" aria-label="${esc(product.colorNames?.[index] || `رنگ ${index + 1}`)}"><span class="swatch" style="--swatch:${safeColor(color)}"></span><em>${esc(product.colorNames?.[index] || '')}</em></button>`).join('')}</div></fieldset>` : ''}
      ${sizes.length ? `<fieldset class="product-choice"><legend><span>سایز</span><a href="./size-guide">${icon('ruler', 'icon icon--sm')} راهنمای سایز</a></legend><div class="size-choices" id="size-choices">${sizes.map(size => { const available = isVariantAvailable(product, 0, sizeKey(size)); return `<button type="button" data-product-size="${esc(size)}" aria-pressed="false" class="${available ? '' : 'is-unavailable'}" ${available ? '' : 'aria-disabled="true" aria-label="سایز ' + esc(size) + ' ناموجود؛ برای ثبت هشدار موجودی انتخاب کنید"'}>${esc(size)}</button>`; }).join('')}</div><p class="fit-note">${esc(product.fit)}؛ ${String(product.fit || '').includes('جذب') ? 'اگر بین دو سایز هستید، سایز بزرگ‌تر را انتخاب کنید.' : 'سایز همیشگی خود را انتخاب کنید.'}</p><p class="stock-note" id="variant-note" aria-live="polite"></p><button class="text-button notify-size" type="button" data-product-action="notify-stock">${icon('bell', 'icon icon--sm')} اطلاع از موجود شدن سایز ناموجود</button></fieldset>` : ''}
      <div class="purchase-row"><div class="quantity"><button type="button" data-product-action="increase" aria-label="افزایش تعداد">${icon('plus')}</button><output id="product-quantity">۱</output><button type="button" data-product-action="decrease" aria-label="کاهش تعداد">${icon('minus')}</button></div><button class="button purchase-button" type="button" data-product-action="add-cart" ${!product.availability ? 'disabled' : ''}>${product.availability ? 'افزودن به سبد خرید' : 'در حال حاضر ناموجود'}</button></div>
      <div class="field-message field-message--error" id="product-choice-error" role="alert"></div>
      <button class="save-later-button" type="button" data-product-action="save-later">${isSaved(product.id) ? `${icon('bookmark-filled')} در فهرست ذخیره‌شده` : `${icon('bookmark')} ذخیره برای بعد`}</button>
      <div class="delivery-notes"><div>${icon('truck')}<span><strong>زمان تقریبی ارسال</strong><small>تهران ۱ تا ۳ و سایر شهرها ۳ تا ۶ روز کاری</small></span></div><div>${icon('refresh')}<span><strong>تعویض سایز</strong><small>مطابق شرایط تعویض پس از دریافت سفارش</small></span></div></div>
      <dl class="product-facts"><div><dt>فرم لباس</dt><dd>${esc(product.fit)}</dd></div><div><dt>پارچه</dt><dd>${esc(product.fabric)}</dd></div><div><dt>فصل مناسب</dt><dd>${esc(product.season)}</dd></div><div><dt>موقعیت استفاده</dt><dd>${esc(product.occasion)}</dd></div></dl>
    </section>
  </div>
  <section class="product-lower"><div class="product-accordions">
    ${accordion('شرح محصول', product.description ? String(product.description).split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join('') : `<p>${name} با تمرکز بر تناسب، راحتی و امکان ترکیب با لباس‌های پایه طراحی شده است. پارچه ${esc(product.fabric)} ظاهر محصول را در استفاده روزمره حفظ می‌کند.</p>`, true)}
    ${accordion('مشخصات و نگهداری', `<ul><li>نوع پارچه: ${esc(product.fabric)}</li><li>مناسب فصل: ${esc(product.season)}</li><li>موقعیت استفاده: ${esc(product.occasion)}</li><li>شست‌وشو: دستی یا برنامه ملایم ماشین، حداکثر ۳۰ درجه</li></ul>`)}
    ${accordion('سایزبندی', `<p>${esc(product.fit)}. اندازه‌های دقیق در جدول سایز ثبت شده‌اند.</p><a class="inline-link" href="./size-guide">مشاهده جدول کامل سایز</a>`)}
    ${accordion('ارسال و بازگشت', '<p>هزینه ارسال پیش از پرداخت نمایش داده می‌شود. کالا باید در وضعیت اولیه، همراه با تگ و بسته‌بندی بازگردانده شود.</p>')}
  </div>
  <section class="reviews-block" id="reviews"><div class="section-heading"><div><h2>دیدگاه خریداران</h2><p id="reviews-summary">در حال دریافت دیدگاه‌ها...</p></div><button class="button button--outline" type="button" data-product-action="review">ثبت دیدگاه</button></div><div id="review-form-slot"></div><div id="reviews-list"></div></section>
  <section class="qa-block" aria-labelledby="qa-title"><div class="section-heading"><div><h2 id="qa-title">پرسش و پاسخ</h2><p>پرسش‌های کاربردی درباره سایز، جنس و نگهداری</p></div><button class="button button--outline" type="button" data-product-action="question">ثبت پرسش</button></div><div id="question-form-slot"></div><div id="questions-list"></div></section>
  </section>
  <section class="section related-section" aria-labelledby="similar-title"><div class="section-heading"><div><h2 id="similar-title">محصولات مشابه</h2><p>انتخاب‌هایی با فرم و کاربرد نزدیک</p></div></div><div class="product-grid related-grid">${products.filter(item => item.id !== product.id && (item.category === product.category || item.style === product.style)).slice(0, 4).map(item => productCardTemplate(item)).join('') || '<div class="recent-empty">محصول مشابهی موجود نیست.</div>'}</div></section>
  <section class="section related-section" aria-labelledby="recent-title"><div class="section-heading"><div><h2 id="recent-title">بازدیدهای اخیر</h2><p>محصولاتی که پیش‌تر بررسی کرده‌اید</p></div></div>${recentProducts.length ? `<div class="product-row">${recentProducts.map(item => productCardTemplate(item)).join('')}</div>` : '<div class="recent-empty">هنوز محصول دیگری را مشاهده نکرده‌اید.</div>'}</section>
  <div class="mobile-purchase-bar"><div><small>قیمت</small><strong>${formatPrice(product.price)}</strong></div><button class="button" type="button" data-product-action="add-cart" ${!product.availability ? 'disabled' : ''}>افزودن به سبد</button></div>`;
};

const renderFeedback = async product => {
  try {
    const data = await api.getProductFeedback(product.id);
    const { summary } = data;
    document.getElementById('reviews-summary').textContent = summary.count ? `میانگین امتیاز ${toPersianDigits(summary.average)} از ۵ بر اساس ${toPersianDigits(summary.count)} دیدگاه` : 'هنوز دیدگاهی برای این محصول منتشر نشده است.';
    document.getElementById('product-rating').innerHTML = summary.count ? `<span>${icon('star')} ${esc(toPersianDigits(summary.average))}</span><a href="#reviews">${esc(toPersianDigits(summary.count))} دیدگاه خریداران</a>` : `<span>${icon('star')} —</span><a href="#reviews">بدون دیدگاه</a>`;
    document.getElementById('reviews-list').innerHTML = data.reviews.map(reviewItem).join('');
    document.getElementById('questions-list').innerHTML = data.questions.length ? data.questions.map(questionItem).join('') : '<p class="recent-empty">هنوز پرسش پاسخ‌داده‌شده‌ای وجود ندارد.</p>';
  } catch (error) {
    document.getElementById('reviews-summary').textContent = `دریافت دیدگاه‌ها انجام نشد: ${error.message}`;
  }
};

export const initProduct = async ({ toast }) => {
  const root = document.getElementById('product-root'); if (!root) return;
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';
  const markMissing = () => { document.title = 'محصول پیدا نشد | توتو فشن'; const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex'; document.head.append(robots); root.innerHTML = notFoundTemplate('product'); };
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) { markMissing(); return; }
  root.innerHTML = loadingTemplate();
  let product;
  try { product = await api.getProduct(id); }
  catch (error) { if (error.status === 404 || error.status === 400) markMissing(); else root.innerHTML = errorTemplate(error.message); return; }
  // نسخه تازه سرور جایگزین نسخه فهرست می‌شود تا سبد خرید با موجودی به‌روز کار کند
  const index = products.findIndex(item => item.id === product.id);
  if (index >= 0) products[index] = product; else products.push(product);

  const returnHref = safeReturn(params.get('return'));
  const previousViewedIds = (localStore.get('toto-recently-viewed', []) || []).filter(item => typeof item === 'string' && item !== product.id);
  const recentProducts = previousViewedIds.map(item => products.find(p => p.id === item)).filter(Boolean).slice(0, 5);
  const gallery = [product.image, product.secondaryImage || product.image];
  const sizes = product.sizes || [];
  const sizeKey = size => (sizes.length ? size : '');
  let selectedSize = sizes.length ? null : ''; let selectedColor = 0; let quantity = 1;

  document.title = `${product.seoTitle || product.name} | توتو فشن`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', `${product.name}، ${product.fabric} با ${product.fit}. مشاهده رنگ‌ها، سایزها و شرایط ارسال و تعویض.`);
  const schema = document.createElement('script'); schema.type = 'application/ld+json'; schema.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: product.name, sku: product.sku, brand: { '@type': 'Brand', name: 'TOTO Fashion' }, image: gallery, offers: { '@type': 'Offer', priceCurrency: 'IRR', price: product.price * 10, availability: product.availability ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } }); document.head.append(schema);

  root.innerHTML = productTemplate(product, returnHref, recentProducts);

  const refreshVariantState = () => {
    root.querySelectorAll('[data-product-size]').forEach(button => {
      const available = isVariantAvailable(product, selectedColor, sizeKey(button.dataset.productSize));
      button.classList.toggle('is-unavailable', !available);
      if (available) { button.removeAttribute('aria-disabled'); button.removeAttribute('aria-label'); }
      else { button.setAttribute('aria-disabled', 'true'); button.setAttribute('aria-label', `سایز ${button.dataset.productSize} ناموجود؛ برای ثبت هشدار موجودی انتخاب کنید`); }
    });
    const note = document.getElementById('variant-note');
    if (!note) return;
    if (selectedSize === null) { note.textContent = ''; return; }
    const variant = variantFor(product, selectedColor, sizeKey(selectedSize));
    note.textContent = !isVariantAvailable(product, selectedColor, sizeKey(selectedSize)) ? 'این ترکیب رنگ و سایز ناموجود است؛ می‌توانید هشدار موجودی ثبت کنید.' : variant?.lowStock ? 'تنها چند عدد از این ترکیب باقی مانده است.' : '';
  };
  refreshVariantState();

  root.addEventListener('click', event => {
    const thumbnail = event.target.closest('[data-gallery-index]');
    if (!thumbnail) return;
    const index = Number(thumbnail.dataset.galleryIndex);
    root.querySelectorAll('[data-gallery-index]').forEach(button => button.setAttribute('aria-pressed', String(button === thumbnail)));
    const mainImage = document.getElementById('product-main-image');
    if (mainImage) { mainImage.src = safeImage(gallery[index]).replace(/&amp;/g, '&'); mainImage.alt = index === 0 ? (product.imageAlt || product.name) : `نمای نزدیک ${product.name}`; }
  });

  root.addEventListener('click', async event => {
    const trigger = event.target.closest('[data-product-action]'); const action = trigger?.dataset.productAction; if (!action) return;
    if (action === 'increase') { quantity = Math.min(5, quantity + 1); document.getElementById('product-quantity').textContent = toPersianDigits(quantity); }
    if (action === 'decrease') { quantity = Math.max(1, quantity - 1); document.getElementById('product-quantity').textContent = toPersianDigits(quantity); }
    if (action === 'add-cart') {
      const error = document.getElementById('product-choice-error');
      if (selectedSize === null) { error.textContent = 'لطفاً پیش از افزودن به سبد، یک سایز انتخاب کنید.'; root.querySelector('[data-product-size]:not(.is-unavailable)')?.focus(); return; }
      if (!isVariantAvailable(product, selectedColor, sizeKey(selectedSize))) { error.textContent = 'این ترکیب رنگ و سایز موجود نیست. سایز یا رنگ دیگری انتخاب کنید یا هشدار موجودی ثبت کنید.'; return; }
      error.textContent = '';
      try { addCartItem({ productId: product.id, size: selectedSize, colorIndex: selectedColor, quantity }); }
      catch (addError) { error.textContent = addError.message; return; }
      announce(`${product.name} به سبد خرید اضافه شد.`); toast('محصول به سبد خرید اضافه شد.');
    }
    if (action === 'save-later') {
      trigger.disabled = true;
      try { await setSaved(product.id, true); trigger.innerHTML = `${icon('bookmark-filled')} در فهرست ذخیره‌شده`; toast(getSession() ? 'محصول در حساب شما ذخیره شد.' : 'محصول در این مرورگر ذخیره شد؛ پس از ورود به حساب شما منتقل می‌شود.'); }
      catch (error) { toast(error.message, 'error'); }
      finally { trigger.disabled = false; }
    }
    if (action === 'notify-stock') {
      if (!getSession()) { toast('برای ثبت هشدار موجودی، ابتدا وارد حساب خود شوید.', 'info'); document.querySelector('[data-action="open-login"]')?.click(); return; }
      const targetSize = selectedSize !== null && !isVariantAvailable(product, selectedColor, sizeKey(selectedSize)) ? selectedSize : sizes.find(size => !isVariantAvailable(product, selectedColor, sizeKey(size)));
      if (targetSize === undefined) { toast('همهٔ سایزهای این رنگ موجود هستند.', 'info'); return; }
      trigger.disabled = true;
      try { const result = await api.createStockAlert({ productId: product.id, colorIndex: selectedColor, size: targetSize }); toast(result.alreadyExists ? 'این هشدار قبلاً در حساب شما ثبت شده است.' : `هشدار موجودی برای ${product.colorNames?.[selectedColor] || ''} سایز ${targetSize} ثبت شد.`, result.alreadyExists ? 'info' : 'success'); }
      catch (error) { toast(error.message, 'error'); }
      finally { trigger.disabled = false; }
    }
    if (action === 'review' || action === 'question') {
      if (!getSession()) { toast(action === 'review' ? 'برای ثبت دیدگاه ابتدا وارد حساب خود شوید.' : 'برای ثبت پرسش ابتدا وارد حساب خود شوید.', 'info'); document.querySelector('[data-action="open-login"]')?.click(); return; }
      const slot = document.getElementById(action === 'review' ? 'review-form-slot' : 'question-form-slot');
      if (!slot.innerHTML) slot.innerHTML = action === 'review' ? reviewFormTemplate() : questionFormTemplate();
      slot.querySelector('select, textarea')?.focus();
    }
  });

  root.addEventListener('submit', async event => {
    const form = event.target; if (!['review-form', 'question-form'].includes(form.id)) return;
    event.preventDefault();
    const isReview = form.id === 'review-form'; const message = document.getElementById(isReview ? 'review-message' : 'question-message'); const button = form.querySelector('button[type="submit"]');
    message.textContent = ''; message.classList.remove('field-message--error'); button.disabled = true;
    try {
      const result = isReview ? await api.createReview(product.id, { rating: Number(form.elements.rating.value), body: form.elements.body.value }) : await api.askQuestion(product.id, form.elements.question.value);
      form.replaceWith(Object.assign(document.createElement('p'), { className: 'page-notice page-notice--info', textContent: result.message }));
    } catch (error) { message.textContent = error.details?.[0]?.message || error.message; message.classList.add('field-message--error'); button.disabled = false; }
  });

  root.addEventListener('click', event => {
    const size = event.target.closest('[data-product-size]');
    if (size) { root.querySelectorAll('[data-product-size]').forEach(button => button.setAttribute('aria-pressed', 'false')); size.setAttribute('aria-pressed', 'true'); selectedSize = size.dataset.productSize; document.getElementById('product-choice-error').textContent = ''; refreshVariantState(); }
    const color = event.target.closest('[data-product-color]');
    if (color) { root.querySelectorAll('[data-product-color]').forEach(button => button.setAttribute('aria-pressed', 'false')); color.setAttribute('aria-pressed', 'true'); selectedColor = Number(color.dataset.productColor); document.getElementById('selected-color-name').textContent = product.colorNames?.[selectedColor] || ''; refreshVariantState(); }
  });
  root.querySelectorAll('.accordion__button').forEach(button => button.addEventListener('click', () => { const panel = document.getElementById(button.getAttribute('aria-controls')); const open = button.getAttribute('aria-expanded') === 'true'; button.setAttribute('aria-expanded', String(!open)); panel.hidden = open; }));
  localStore.set('toto-recently-viewed', [product.id, ...previousViewedIds].slice(0, 8));
  document.dispatchEvent(new CustomEvent('toto:products-rendered'));
  renderFeedback(product);
};
