import { icon, formatPrice } from '../core/utils.js';
import { localStore } from '../core/storage.js';

const productHref = product => {
  const params = new URLSearchParams({ id: product.id });
  if (typeof window !== 'undefined' && /\/(?:shop|search)$/.test(location.pathname)) params.set('return', `${location.pathname.split('/').pop()}${location.search}`);
  return `./product?${params}`;
};

export const productCardTemplate = (product, options = {}) => {
  const isSaved = localStore.get('toto-saved', []).includes(product.id);
  const colorMedia = product.colors.map((_, index) => index % 2
    ? { primary: product.secondaryImage, secondary: product.image }
    : { primary: product.image, secondary: product.secondaryImage });
  return `
  <article class="product-card" data-product-id="${product.id}">
    <div class="product-card__media">
      <a href="${productHref(product)}" aria-label="مشاهده ${product.name}">
        <img class="product-card__image product-card__image--primary" data-card-image="primary" src="${colorMedia[0].primary}" alt="${product.imageAlt}" width="720" height="960" loading="lazy" decoding="async">
        <img class="product-card__image product-card__image--secondary" data-card-image="secondary" src="${colorMedia[0].secondary}" alt="" width="720" height="960" loading="lazy" decoding="async">
      </a>
      <div class="product-card__badges">
        ${product.badge ? `<span class="badge ${product.badgeType ? `badge--${product.badgeType}` : ''}">${product.badge}</span>` : ''}
        ${product.discount ? `<span class="badge badge--sale">${product.discount}٪ تخفیف</span>` : ''}
        ${!product.availability ? '<span class="badge badge--muted">ناموجود</span>' : ''}
      </div>
      <button class="icon-button product-card__favorite" type="button" data-action="toggle-save" data-id="${product.id}" aria-label="${isSaved ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}" aria-pressed="${isSaved}">${icon(isSaved ? 'heart-filled' : 'heart')}</button>
      ${product.availability ? `<div class="product-card__quick" aria-label="انتخاب سریع سایز"><div class="quick-sizes">${product.sizes.map(size => `<button class="quick-size" type="button" data-action="quick-add" data-id="${product.id}" data-size="${size}" aria-label="افزودن سایز ${size} از ${product.name}">${size}</button>`).join('')}</div></div><button class="icon-button mobile-quick-add" type="button" data-action="open-product-sheet" data-id="${product.id}" aria-label="انتخاب سریع ${product.name}">${icon('plus')}</button>` : ''}
    </div>
    <div class="product-card__body">
      <p class="product-card__category">${product.category}</p>
      <h3 class="product-card__title"><a href="${productHref(product)}">${product.name}</a></h3>
      <div class="product-card__price"><strong>${formatPrice(product.price)}</strong>${product.previousPrice ? `<del>${formatPrice(product.previousPrice)}</del>` : ''}</div>
      <div class="product-card__swatches" aria-label="رنگ‌های موجود">${product.colors.map((color, index) => `<button class="swatch" type="button" data-card-color="${index}" data-primary-image="${colorMedia[index].primary}" data-secondary-image="${colorMedia[index].secondary}" style="--swatch:${color}" aria-label="${product.colorNames?.[index] || `رنگ ${index + 1}`}" aria-pressed="${index === 0}"></button>`).join('')}</div>
      ${options.saved ? `<button class="text-button" type="button" data-action="remove-saved" data-id="${product.id}">${icon('trash', 'icon icon--sm')} حذف از ذخیره‌شده‌ها</button>` : ''}
    </div>
  </article>`;
};

export const renderProductGrid = (container, items, options = {}) => {
  if (!container) return;
  container.innerHTML = items.map(product => productCardTemplate(product, options)).join('');
};
