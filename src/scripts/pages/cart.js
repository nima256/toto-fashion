import { cartLines, getCart, removeCartItem, saveCart, updateCartQuantity } from '../core/commerce.js';
import { setSaved } from '../core/saved-store.js';
import { api } from '../services/api.js';
import { formatPrice, icon, toPersianDigits, announce, escapeHtml as esc, safeImage, encodeParam } from '../core/utils.js';

const emptyTemplate = () => `
  <section class="commerce-empty" aria-labelledby="empty-cart-title">
    <span class="commerce-empty__icon">${icon('bag', 'icon icon--lg')}</span>
    <h1 id="empty-cart-title">سبد خرید شما خالی است</h1>
    <p>محصولات منتخب خود را اضافه کنید تا اینجا نگه‌داری شوند.</p>
    <a class="button" href="./shop">مشاهده محصولات</a>
  </section>`;

// آستانه ارسال رایگان و مبلغ باقی‌مانده از پاسخ سرور می‌آید
const progressTemplate = quote => {
  if (!quote?.freeShippingThreshold) return '';
  const percent = Math.min(100, Math.round(quote.amounts.merchandiseSubtotal / quote.freeShippingThreshold * 100));
  return `<section class="shipping-progress" aria-label="وضعیت ارسال رایگان">
    <div class="shipping-progress__text">${quote.remainingForFreeShipping > 0
      ? `<span>تا ارسال رایگان فقط <strong>${formatPrice(quote.remainingForFreeShipping)}</strong> باقی مانده است.</span>`
      : '<span><strong>ارسال استاندارد سفارش شما رایگان شد.</strong></span>'}
      ${icon('truck')}
    </div>
    <div class="shipping-progress__track" aria-hidden="true"><span style="width:${percent}%"></span></div>
  </section>`;
};

const lineTemplate = (line, problem) => {
  const { item, product, priceChanged } = line;
  const unavailable = line.unavailable || Boolean(problem);
  const color = product?.colorNames?.[item.colorIndex] || 'رنگ انتخابی';
  const name = esc(product?.name || item.name);
  return `<article class="cart-line ${unavailable ? 'cart-line--unavailable' : ''}" data-cart-id="${esc(item.id)}">
    <a class="cart-line__image" href="./product?id=${encodeParam(item.productId)}"><img src="${safeImage(product?.image)}" alt="${esc(product?.imageAlt || item.name)}" width="180" height="240"></a>
    <div class="cart-line__content">
      <div class="cart-line__top">
        <div><p class="cart-line__category">${esc(product?.category || 'محصول توتو')}</p><h2><a href="./product?id=${encodeParam(item.productId)}">${name}</a></h2><p class="cart-line__variant">رنگ: ${esc(color)} <span aria-hidden="true">·</span> سایز: ${esc(item.size)}</p></div>
        <button class="icon-button" type="button" data-cart-action="remove" data-id="${esc(item.id)}" aria-label="حذف ${name}">${icon('trash')}</button>
      </div>
      ${unavailable ? `<div class="inline-notice inline-notice--error">${icon('error')}<span>${esc(problem?.message || 'این ترکیب رنگ و سایز در حال حاضر ناموجود است. برای ادامه خرید آن را حذف یا ذخیره کنید.')}</span></div>` : ''}
      ${priceChanged ? `<div class="inline-notice inline-notice--info">${icon('info')}<span>قیمت این محصول به‌روزرسانی شده است و قیمت جدید در مجموع سفارش محاسبه می‌شود.</span></div>` : ''}
      ${product?.stockNote ? `<p class="stock-note">${esc(product.stockNote)}</p>` : ''}
      <div class="cart-line__bottom">
        <div class="quantity quantity--compact" aria-label="تعداد ${name}">
          <button type="button" data-cart-action="increase" data-id="${esc(item.id)}" aria-label="افزایش تعداد" ${item.quantity >= 5 ? 'disabled' : ''}>${icon('plus')}</button>
          <output>${toPersianDigits(item.quantity)}</output>
          <button type="button" data-cart-action="decrease" data-id="${esc(item.id)}" aria-label="کاهش تعداد" ${item.quantity <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
        </div>
        <div class="cart-line__price"><strong>${formatPrice(line.lineTotal)}</strong>${product?.previousPrice ? `<del>${formatPrice(product.previousPrice * item.quantity)}</del>` : ''}</div>
      </div>
      <div class="cart-line__links">
        <button class="text-button" type="button" data-cart-action="save" data-id="${esc(item.id)}">${icon('bookmark', 'icon icon--sm')} ذخیره برای بعد</button>
      </div>
    </div>
  </article>`;
};

const summaryTemplate = (quote, blocked, error) => `
  <aside class="order-summary" aria-labelledby="cart-summary-title">
    <h2 id="cart-summary-title">خلاصه سفارش</h2>
    ${quote ? `<dl class="price-list">
      <div><dt>جمع قیمت محصولات</dt><dd>${formatPrice(quote.amounts.subtotal)}</dd></div>
      <div class="price-list__discount"><dt>تخفیف محصولات</dt><dd>− ${formatPrice(quote.amounts.productDiscount)}</dd></div>
      <div><dt>هزینه ارسال استاندارد</dt><dd>${quote.amounts.shipping === 0 ? 'رایگان' : formatPrice(quote.amounts.shipping)}</dd></div>
    </dl>
    <div class="price-total"><span>مبلغ قابل پرداخت</span><strong>${formatPrice(quote.amounts.total)}</strong></div>` : `<p class="field-message ${error ? 'field-message--error' : ''}">${esc(error || 'در حال محاسبه مبلغ از سرور...')}</p>`}
    ${blocked ? '<div class="field-message field-message--error">برای ادامه، محصولات ناموجود را از سبد حذف کنید.</div>' : ''}
    <a class="button button--block ${blocked || !quote ? 'is-disabled' : ''}" ${blocked || !quote ? 'aria-disabled="true" tabindex="-1"' : 'href="./checkout"'}>ادامه و ثبت اطلاعات ارسال</a>
    <p class="secure-note">${icon('shield', 'icon icon--sm')} قیمت، هزینه ارسال و تخفیف توسط سرور محاسبه و در مرحله پرداخت دوباره بررسی می‌شود.</p>
  </aside>`;

export const initCart = ({ toast }) => {
  const root = document.getElementById('cart-root');
  if (!root) return;
  let undoItem = null; let undoTimer = null; let quote = null; let quoteError = ''; let seq = 0;

  const problemFor = item => quote?.problems?.find(p => p.productId === item.productId && String(p.size || '') === String(item.size || '') && Number(p.colorIndex || 0) === Number(item.colorIndex || 0)) || quote?.problems?.find(p => p.productId === item.productId && !p.size);
  const render = () => {
    const cart = getCart();
    if (!cart.length) { root.innerHTML = emptyTemplate(); return; }
    const lines = cartLines(cart);
    const blocked = lines.some(line => line.unavailable || problemFor(line.item));
    root.innerHTML = `<nav class="breadcrumb" aria-label="مسیر صفحه"><a href="/">خانه</a><span>/</span><span aria-current="page">سبد خرید</span></nav>
      <header class="commerce-header"><div><p class="eyebrow">مرحله اول از سه مرحله</p><h1>سبد خرید</h1><p>${toPersianDigits(cart.reduce((sum, item) => sum + item.quantity, 0))} محصول در سبد شماست.</p></div><a class="inline-link" href="./shop">ادامه خرید</a></header>
      ${progressTemplate(quote)}
      <div class="cart-layout"><section class="cart-lines" aria-label="محصولات سبد خرید">${lines.map(line => lineTemplate(line, problemFor(line.item))).join('')}</section>${summaryTemplate(quote, blocked, quoteError)}</div>`;
  };
  const refreshQuote = async () => {
    const cart = getCart(); const current = ++seq;
    if (!cart.length) { render(); return; }
    quote = null; quoteError = ''; render();
    try { const result = await api.quote(cart); if (current !== seq) return; quote = result; }
    catch (error) { if (current !== seq) return; quoteError = error.message; }
    render();
  };

  const remove = id => {
    undoItem = removeCartItem(id);
    clearTimeout(undoTimer);
    refreshQuote();
    toast('محصول از سبد حذف شد. برای بازگرداندن از دکمه زیر استفاده کنید.', 'info', {
      label: 'بازگرداندن', onAction: () => { if (!undoItem) return; const cart = getCart(); cart.push(undoItem); saveCart(cart); undoItem = null; refreshQuote(); announce('محصول به سبد بازگردانده شد.'); }
    });
    undoTimer = setTimeout(() => { undoItem = null; }, 6000);
  };

  root.addEventListener('click', async event => {
    const trigger = event.target.closest('[data-cart-action]');
    if (!trigger) return;
    const id = trigger.dataset.id;
    const item = getCart().find(entry => entry.id === id);
    if (!item) return;
    if (trigger.dataset.cartAction === 'increase') {
      if (item.quantity >= 5) { toast('حداکثر تعداد مجاز برای این محصول ۵ عدد است.', 'error'); return; }
      updateCartQuantity(id, item.quantity + 1); refreshQuote();
    }
    if (trigger.dataset.cartAction === 'decrease') { updateCartQuantity(id, item.quantity - 1); refreshQuote(); }
    if (trigger.dataset.cartAction === 'remove') remove(id);
    if (trigger.dataset.cartAction === 'save') {
      trigger.disabled = true;
      try { await setSaved(item.productId, true); removeCartItem(id); refreshQuote(); toast('محصول برای بعد ذخیره شد.'); }
      catch (error) { toast(error.message, 'error'); trigger.disabled = false; }
    }
  });
  refreshQuote();
};
