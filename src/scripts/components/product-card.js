import { icon, formatPrice, escapeHtml as esc, safeImage, safeColor, encodeParam } from '../core/utils.js';
import { isSaved } from '../core/saved-store.js';
import { isVariantAvailable } from '../core/commerce.js';

const BADGE_TYPES = new Set(['new', 'warning', 'sale']);
const productHref = product => {
  const params = new URLSearchParams({ id: product.id });
  if (typeof window !== 'undefined' && /\/(?:shop|search)$/.test(location.pathname)) params.set('return', `${location.pathname.split('/').pop()}${location.search}`);
  return `./product?${params}`;
};

// همه مقادیر محصول (نام، نشان، دسته، alt، سایز و...) escape می‌شوند؛ رنگ فقط با الگوی hex پذیرفته می‌شود
export const productCardTemplate = (product, options = {}) => {
  const saved = isSaved(product.id);
  const colors = Array.isArray(product.colors) && product.colors.length ? product.colors : [''];
  const colorMedia = colors.map((_, index) => index % 2
    ? { primary: product.secondaryImage || product.image, secondary: product.image }
    : { primary: product.image, secondary: product.secondaryImage || product.image });
  const href = esc(productHref(product));
  const name = esc(product.name);
  const quickSizes = (product.sizes || []).filter(size => isVariantAvailable(product, 0, size));
  return `
  <article class="product-card" data-product-id="${esc(product.id)}">
    <div class="product-card__media">
      <a href="${href}" aria-label="مشاهده ${name}">
        <img class="product-card__image product-card__image--primary" data-card-image="primary" src="${safeImage(colorMedia[0].primary)}" alt="${esc(product.imageAlt || product.name)}" width="720" height="960" loading="lazy" decoding="async">
        <img class="product-card__image product-card__image--secondary" data-card-image="secondary" src="${safeImage(colorMedia[0].secondary)}" alt="" width="720" height="960" loading="lazy" decoding="async">
      </a>
      <div class="product-card__badges">
        ${product.badge ? `<span class="badge ${BADGE_TYPES.has(product.badgeType) ? `badge--${product.badgeType}` : ''}">${esc(product.badge)}</span>` : ''}
        ${product.discount ? `<span class="badge badge--sale">${esc(Number(product.discount))}٪ تخفیف</span>` : ''}
        ${!product.availability ? '<span class="badge badge--muted">ناموجود</span>' : ''}
      </div>
      <button class="icon-button product-card__favorite" type="button" data-action="toggle-save" data-id="${esc(product.id)}" aria-label="${saved ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}" aria-pressed="${saved}">${icon(saved ? 'heart-filled' : 'heart')}</button>
      ${product.availability && quickSizes.length ? `<div class="product-card__quick" aria-label="انتخاب سریع سایز"><div class="quick-sizes">${quickSizes.map(size => `<button class="quick-size" type="button" data-action="quick-add" data-id="${esc(product.id)}" data-size="${esc(size)}" aria-label="افزودن سایز ${esc(size)} از ${name}">${esc(size)}</button>`).join('')}</div></div><button class="icon-button mobile-quick-add" type="button" data-action="open-product-sheet" data-id="${esc(product.id)}" aria-label="انتخاب سریع ${name}">${icon('plus')}</button>` : ''}
    </div>
    <div class="product-card__body">
      <p class="product-card__category">${esc(product.category)}</p>
      <h3 class="product-card__title"><a href="${href}">${name}</a></h3>
      <div class="product-card__price"><strong>${formatPrice(product.price)}</strong>${product.previousPrice ? `<del>${formatPrice(product.previousPrice)}</del>` : ''}</div>
      <div class="product-card__swatches" aria-label="رنگ‌های موجود">${(product.colors || []).map((color, index) => `<button class="swatch" type="button" data-card-color="${index}" data-primary-image="${safeImage(colorMedia[index].primary)}" data-secondary-image="${safeImage(colorMedia[index].secondary)}" style="--swatch:${safeColor(color)}" aria-label="${esc(product.colorNames?.[index] || `رنگ ${index + 1}`)}" aria-pressed="${index === 0}"></button>`).join('')}</div>
      ${options.saved ? `<button class="text-button" type="button" data-action="remove-saved" data-id="${esc(product.id)}">${icon('trash', 'icon icon--sm')} حذف از ذخیره‌شده‌ها</button>` : ''}
    </div>
  </article>`;
};

export const renderProductGrid = (container, items, options = {}) => {
  if (!container) return;
  container.innerHTML = items.map(product => productCardTemplate(product, options)).join('');
};

export const productsUnavailableTemplate = (message = 'دریافت محصولات از سرور انجام نشد.') => `<div class="empty-state"><span class="empty-state__icon">${icon('error', 'icon icon--lg')}</span><h2>محصولات در دسترس نیست</h2><p>${esc(message)} لطفاً چند لحظه بعد صفحه را دوباره بارگذاری کنید.</p><button class="button button--outline" type="button" data-action="reload-page">تلاش دوباره</button></div>`;
export const noProductsTemplate = () => `<div class="empty-state"><span class="empty-state__icon">${icon('bag', 'icon icon--lg')}</span><h2>هنوز محصولی منتشر نشده است</h2><p>به‌زودی محصولات تازه توتو در این بخش قرار می‌گیرند.</p></div>`;
export const productHrefFor = id => `./product?id=${encodeParam(id)}`;
