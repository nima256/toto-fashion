import { escapeHtml as esc, safeImage, formatPrice, toPersianDigits, encodeParam } from '../core/utils.js';

// فهرست اقلام سفارش: تصویر، نام، رنگ، سایز و تعداد؛ قیمت فقط وقتی showPrices (صاحب سفارش) فعال باشد
export const orderItemsTemplate = (items = [], { showPrices = false, linkProducts = true, extra = null } = {}) => {
  if (!items.length) return '<p class="recent-empty">قلمی برای این سفارش ثبت نشده است.</p>';
  return `<ul class="order-items-list" role="list">${items.map(item => {
    const name = esc(item.name || 'محصول توتو');
    const title = linkProducts && item.productId ? `<a href="./product?id=${encodeParam(item.productId)}">${name}</a>` : name;
    const chips = [item.color ? `رنگ: ${esc(item.color)}` : '', item.size ? `سایز: ${esc(item.size)}` : '', `تعداد: ${toPersianDigits(item.quantity || 1)}`].filter(Boolean);
    return `<li class="order-item-row"><img src="${safeImage(item.image)}" alt="" width="64" height="84" loading="lazy"><div class="order-item-row__info"><strong>${title}</strong><div class="order-item-row__chips">${chips.map(chip => `<span>${chip}</span>`).join('')}</div>${showPrices ? `<small>قیمت واحد: ${formatPrice(item.price)}</small>` : ''}${extra ? extra(item) : ''}</div>${showPrices ? `<b class="order-item-row__total">${formatPrice(item.lineTotal ?? item.price * item.quantity)}</b>` : ''}</li>`;
  }).join('')}</ul>`;
};
