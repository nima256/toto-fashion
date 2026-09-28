import { products } from '../../data/mock-data.js';
import { productCardTemplate } from '../components/product-card.js?v=3';
import { localStore } from '../core/storage.js';
import { icon, formatPrice, toPersianDigits, announce } from '../core/utils.js';
import { addCartItem } from '../core/commerce.js';
import { getSession, updateAccount } from '../core/account-store.js';

const safeReturn = value => value && /^(shop|search)(?:\?|$)/.test(value) ? `./${value}` : './shop';

export const initProduct = ({ toast }) => {
  const root = document.getElementById('product-root'); if (!root) return;
  const params = new URLSearchParams(location.search);
  const product = products.find(item => item.id === params.get('id')) || products[0];
  const returnHref = safeReturn(params.get('return'));
  const gallery = [product.image, product.secondaryImage];
  const previousViewedIds = localStore.get('toto-recently-viewed', []).filter(id => id !== product.id);
  const recentProducts = previousViewedIds.map(id => products.find(item => item.id === id)).filter(Boolean).slice(0, 5);
  let selectedSize = null; let selectedColor = 0; let quantity = 1;

  document.title = `${product.name} | توتو فشن`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', `${product.name}، ${product.fabric} با ${product.fit}. مشاهده رنگ‌ها، سایزها و شرایط ارسال و تعویض.`);
  const schema = document.createElement('script'); schema.type = 'application/ld+json'; schema.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: product.name, sku: product.sku, brand: { '@type': 'Brand', name: 'TOTO Fashion' }, image: gallery, offers: { '@type': 'Offer', priceCurrency: 'IRR', price: product.price * 10, availability: product.availability ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } }); document.head.append(schema);

  root.innerHTML = `<nav class="breadcrumbs" aria-label="مسیر صفحه"><a href="/">خانه</a><a href="${returnHref}">فروشگاه</a><span>${product.name}</span></nav>
  <div class="product-detail">
    <section class="product-gallery" aria-label="گالری تصاویر ${product.name}">
      <div class="product-gallery__desktop">
        <div class="product-thumbnails" aria-label="انتخاب تصویر">${gallery.map((image, index) => `<button type="button" data-gallery-index="${index}" aria-pressed="${index === 0}" aria-label="تصویر ${toPersianDigits(index + 1)} از ${product.name}"><img src="${image}" alt="" width="90" height="120"></button>`).join('')}</div>
        <div class="product-gallery__main"><img id="product-main-image" src="${gallery[0]}" alt="${product.imageAlt}" width="720" height="960" fetchpriority="high"><span>${icon('zoom', 'icon icon--sm')} برای دیدن جزئیات، تصویر را انتخاب کنید</span></div>
      </div>
      <div class="product-gallery__mobile-track">${gallery.map((image, index) => `<button type="button" aria-label="تصویر ${toPersianDigits(index + 1)} از ${product.name}"><img src="${image}" alt="${index === 0 ? product.imageAlt : ''}" width="720" height="960" ${index ? 'loading="lazy"' : ''}></button>`).join('')}</div>
      <div class="mobile-gallery-dots" aria-hidden="true">${gallery.map(() => '<span></span>').join('')}</div>
    </section>
    <section class="product-info" aria-labelledby="product-name">
      <div class="product-info__top"><div><p>${product.category}</p><h1 id="product-name">${product.name}</h1><span>کد محصول: ${product.sku}</span></div></div>
      <div class="product-rating"><span>${icon('star')} ${toPersianDigits(product.rating)}</span><a href="#reviews">${toPersianDigits(product.reviewCount)} دیدگاه خریداران</a></div>
      <div class="product-price"><strong>${formatPrice(product.price)}</strong>${product.previousPrice ? `<del>${formatPrice(product.previousPrice)}</del><span>${product.discount}٪ تخفیف</span>` : ''}</div>
      <div class="payment-note">امکان پرداخت از طریق درگاه‌های بانکی معتبر ایران</div>
      <fieldset class="product-choice"><legend><span>رنگ</span><strong id="selected-color-name">${product.colorNames[0]}</strong></legend><div class="color-choices">${product.colors.map((color, index) => `<button type="button" data-product-color="${index}" aria-pressed="${index === 0}" aria-label="${product.colorNames[index]}"><span class="swatch" style="--swatch:${color}"></span><em>${product.colorNames[index]}</em></button>`).join('')}</div></fieldset>
      <fieldset class="product-choice"><legend><span>سایز</span><a href="./size-guide">${icon('ruler', 'icon icon--sm')} راهنمای سایز</a></legend><div class="size-choices">${[...product.sizes, ...product.unavailableSizes.filter(size => !product.sizes.includes(size))].map(size => `<button type="button" data-product-size="${size}" aria-pressed="false" ${product.unavailableSizes.includes(size) ? 'disabled aria-label="سایز ناموجود"' : ''}>${size}</button>`).join('')}</div><p class="fit-note">${product.fit}؛ ${product.fit.includes('جذب') ? 'اگر بین دو سایز هستید، سایز بزرگ‌تر را انتخاب کنید.' : 'سایز همیشگی خود را انتخاب کنید.'}</p><button class="text-button notify-size" type="button" data-product-action="notify-stock">${icon('bell', 'icon icon--sm')} اطلاع از موجود شدن سایزهای ناموجود</button></fieldset>
      <div class="purchase-row"><div class="quantity"><button type="button" data-product-action="increase" aria-label="افزایش تعداد">${icon('plus')}</button><output id="product-quantity">۱</output><button type="button" data-product-action="decrease" aria-label="کاهش تعداد">${icon('minus')}</button></div><button class="button purchase-button" type="button" data-product-action="add-cart" ${!product.availability ? 'disabled' : ''}>${product.availability ? 'افزودن به سبد خرید' : 'در حال حاضر ناموجود'}</button></div>
      <div class="field-message field-message--error" id="product-choice-error" role="alert"></div>
      <button class="save-later-button" type="button" data-product-action="save-later">${icon('bookmark')} ذخیره برای بعد</button>
      <div class="delivery-notes"><div>${icon('truck')}<span><strong>زمان تقریبی ارسال</strong><small>تهران ۱ تا ۳ و سایر شهرها ۳ تا ۶ روز کاری</small></span></div><div>${icon('refresh')}<span><strong>تعویض سایز</strong><small>تا ۷ روز پس از دریافت، مطابق شرایط تعویض</small></span></div></div>
      <dl class="product-facts"><div><dt>قد مدل</dt><dd>۱۷۴ سانتی‌متر</dd></div><div><dt>سایز مدل</dt><dd>۳۸</dd></div><div><dt>فرم لباس</dt><dd>${product.fit}</dd></div><div><dt>پارچه</dt><dd>${product.fabric}</dd></div><div><dt>کشش پارچه</dt><dd>کم</dd></div><div><dt>فصل مناسب</dt><dd>${product.season}</dd></div></dl>
    </section>
  </div>
  <section class="product-lower"><div class="product-accordions">
    ${accordion('شرح محصول', `<p>${product.name} با تمرکز بر تناسب، راحتی و امکان ترکیب با لباس‌های پایه طراحی شده است. جزئیات دوخت تمیز و پارچه ${product.fabric}، ظاهر محصول را در استفاده روزمره حفظ می‌کند.</p><p>برای حفظ فرم و رنگ، شست‌وشو با آب سرد و شوینده ملایم پیشنهاد می‌شود.</p>`, true)}
    ${accordion('مشخصات و نگهداری', `<ul><li>نوع پارچه: ${product.fabric}</li><li>مناسب فصل: ${product.season}</li><li>موقعیت استفاده: ${product.occasion}</li><li>شست‌وشو: دستی یا برنامه ملایم ماشین، حداکثر ۳۰ درجه</li><li>اتوکشی: دمای پایین از پشت پارچه</li></ul>`)}
    ${accordion('سایزبندی', `<p>${product.fit}. اندازه‌های دقیق هر محصول در جدول سایز ثبت شده‌اند.</p><a class="inline-link" href="./size-guide">مشاهده جدول کامل سایز</a>`)}
    ${accordion('ارسال و بازگشت', '<p>هزینه ارسال پیش از پرداخت نمایش داده می‌شود. کالا باید در وضعیت اولیه، همراه با تگ و بسته‌بندی بازگردانده شود.</p>')}
  </div>
  <section class="reviews-block" id="reviews"><div class="section-heading"><div><h2>دیدگاه خریداران</h2><p>میانگین امتیاز ${toPersianDigits(product.rating)} از ۵</p></div><button class="button button--outline" type="button" data-product-action="review">ثبت دیدگاه</button></div><article class="review"><div><strong>سارا</strong><span>خریدار تأییدشده · ۸ مرداد ۱۴۰۵</span></div><p>فرم لباس دقیقاً مطابق توضیحات بود و پارچه در استفاده روزانه حس خوبی دارد. برای انتخاب سایز از جدول اندازه‌ها استفاده کردم.</p></article><article class="review"><div><strong>مریم</strong><span>خریدار تأییدشده · ۲ مرداد ۱۴۰۵</span></div><p>بسته‌بندی مرتب بود و رنگ محصول با تصویر تفاوت محسوسی نداشت.</p></article></section><section class="qa-block" aria-labelledby="qa-title"><div class="section-heading"><div><h2 id="qa-title">پرسش و پاسخ</h2><p>پرسش‌های کاربردی درباره سایز، جنس و نگهداری</p></div><button class="button button--outline" type="button" data-product-action="question">ثبت پرسش</button></div><article><strong>آیا پارچه بعد از شست‌وشو آبرفت دارد؟</strong><p>در صورت رعایت دمای پیشنهادی شست‌وشو، تغییر محسوسی در ابعاد پارچه ایجاد نمی‌شود.</p></article></section>
  </section>
  <section class="section related-section" aria-labelledby="similar-title"><div class="section-heading"><div><h2 id="similar-title">محصولات مشابه</h2><p>انتخاب‌هایی با فرم و کاربرد نزدیک</p></div></div><div class="product-grid related-grid">${products.filter(item => item.id !== product.id && (item.category === product.category || item.style === product.style)).slice(0, 4).map(productCardTemplate).join('')}</div></section>
  <section class="section related-section" aria-labelledby="complete-title"><div class="section-heading"><div><h2 id="complete-title">تکمیل استایل</h2><p>پیشنهاد توتو برای یک ترکیب کامل</p></div></div><div class="product-row">${products.filter(item => item.id !== product.id && item.category !== product.category).slice(0, 5).map(productCardTemplate).join('')}</div></section>
  <section class="section related-section" aria-labelledby="recent-title"><div class="section-heading"><div><h2 id="recent-title">بازدیدهای اخیر</h2><p>محصولاتی که پیش‌تر بررسی کرده‌اید</p></div></div>${recentProducts.length ? `<div class="product-row">${recentProducts.map(productCardTemplate).join('')}</div>` : `<div class="recent-empty">هنوز محصول دیگری را مشاهده نکرده‌اید.</div>`}</section>
  <div class="mobile-purchase-bar"><div><small>قیمت</small><strong>${formatPrice(product.price)}</strong></div><button class="button" type="button" data-product-action="add-cart">افزودن به سبد</button></div>`;

  root.addEventListener('click', event => {
    const thumbnail = event.target.closest('[data-gallery-index]');
    if (!thumbnail) return;
    const index = Number(thumbnail.dataset.galleryIndex);
    root.querySelectorAll('[data-gallery-index]').forEach(button => button.setAttribute('aria-pressed', String(button === thumbnail)));
    const mainImage = document.getElementById('product-main-image');
    if (mainImage) { mainImage.src = gallery[index]; mainImage.alt = index === 0 ? product.imageAlt : `نمای نزدیک ${product.name}`; }
  });

  root.addEventListener('click', async event => {
    const action = event.target.closest('[data-product-action]')?.dataset.productAction; if (!action) return;
    if (action === 'increase') { quantity = Math.min(5, quantity + 1); document.getElementById('product-quantity').textContent = toPersianDigits(quantity); }
    if (action === 'decrease') { quantity = Math.max(1, quantity - 1); document.getElementById('product-quantity').textContent = toPersianDigits(quantity); }
    if (action === 'add-cart') {
      const error = document.getElementById('product-choice-error');
      if (!selectedSize) { error.textContent = 'لطفاً پیش از افزودن به سبد، یک سایز انتخاب کنید.'; root.querySelector('[data-product-size]:not([disabled])')?.focus(); return; }
      error.textContent = '';
      addCartItem({ productId: product.id, size: selectedSize, colorIndex: selectedColor, quantity }); document.dispatchEvent(new CustomEvent('toto:cart-updated')); announce(`${product.name} به سبد خرید اضافه شد.`); toast('محصول به سبد خرید اضافه شد.');
    }
    if (action === 'save-later') { const saved = localStore.get('toto-saved', []); if (!saved.includes(product.id)) saved.push(product.id); localStore.set('toto-saved', saved); event.target.closest('button').innerHTML = `${icon('bookmark-filled')} در فهرست ذخیره‌شده`; toast('محصول برای بعد ذخیره شد.'); }
    if (action === 'notify-stock') {
      if (!getSession()) { toast('برای ثبت هشدار موجودی، ابتدا وارد حساب خود شوید.', 'info'); return; }
      const targetSize = product.unavailableSizes[0];
      if (!targetSize) { toast('همهٔ سایزهای این محصول موجود هستند.', 'info'); return; }
      let alreadyExists = false;
      updateAccount(account => {
        alreadyExists = account.availabilityAlerts.some(item => item.productId === product.id && item.variant.includes(targetSize));
        if (!alreadyExists) account.availabilityAlerts.unshift({ id: `alert-${Date.now()}`, productId: product.id, productName: product.name, image: product.image, variant: `${product.colorNames[selectedColor]}، سایز ${targetSize}`, createdAt: new Intl.DateTimeFormat('fa-IR').format(new Date()), status: 'waiting' });
        return account;
      });
      toast(alreadyExists ? 'این هشدار قبلاً در حساب شما ثبت شده است.' : 'هشدار موجودی در حساب شما ثبت شد.', alreadyExists ? 'info' : 'success');
    }
    if (action === 'review') toast('ثبت دیدگاه پس از ورود و تحویل سفارش فعال می‌شود.');
    if (action === 'question') toast('برای ثبت پرسش، ابتدا وارد حساب خود شوید.');
  });
  root.addEventListener('click', event => { const size = event.target.closest('[data-product-size]'); if (size && !size.disabled) { root.querySelectorAll('[data-product-size]').forEach(button => button.setAttribute('aria-pressed', 'false')); size.setAttribute('aria-pressed', 'true'); selectedSize = size.dataset.productSize; document.getElementById('product-choice-error').textContent = ''; } const color = event.target.closest('[data-product-color]'); if (color) { root.querySelectorAll('[data-product-color]').forEach(button => button.setAttribute('aria-pressed', 'false')); color.setAttribute('aria-pressed', 'true'); selectedColor = Number(color.dataset.productColor); document.getElementById('selected-color-name').textContent = product.colorNames[selectedColor]; } });
  root.querySelectorAll('.accordion__button').forEach(button => button.addEventListener('click', () => { const panel = document.getElementById(button.getAttribute('aria-controls')); const open = button.getAttribute('aria-expanded') === 'true'; button.setAttribute('aria-expanded', String(!open)); panel.hidden = open; }));
  localStore.set('toto-recently-viewed', [product.id, ...previousViewedIds].slice(0, 8));
  document.dispatchEvent(new CustomEvent('toto:products-rendered'));
};

const accordion = (title, content, open = false) => { const id = `accordion-${Math.random().toString(36).slice(2)}`; return `<section class="accordion"><h3><button class="accordion__button" type="button" aria-expanded="${open}" aria-controls="${id}"><span>${title}</span>${icon('plus')}</button></h3><div class="accordion__panel" id="${id}" ${open ? '' : 'hidden'}>${content}</div></section>`; };
