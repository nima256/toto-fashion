import { products } from '../../data/mock-data.js';
import { freeShippingThreshold } from '../../data/checkout-data.js';
import { localStore } from '../core/storage.js';
import { calculateCart, getCart, getProduct, removeCartItem, saveCart, updateCartQuantity } from '../core/commerce.js';
import { formatPrice, icon, toPersianDigits, announce } from '../core/utils.js';

const emptyTemplate = () => `
  <section class="commerce-empty" aria-labelledby="empty-cart-title">
    <span class="commerce-empty__icon">${icon('bag', 'icon icon--lg')}</span>
    <h1 id="empty-cart-title">سبد خرید شما خالی است</h1>
    <p>محصولات منتخب خود را اضافه کنید تا اینجا نگه‌داری شوند.</p>
    <a class="button" href="./shop">مشاهده محصولات</a>
  </section>`;

const progressTemplate = summary => {
  const percent = Math.min(100, Math.round(summary.merchandiseTotal / freeShippingThreshold * 100));
  return `<section class="shipping-progress" aria-label="وضعیت ارسال رایگان">
    <div class="shipping-progress__text">${summary.remainingForFreeShipping > 0
      ? `<span>تا ارسال رایگان فقط <strong>${formatPrice(summary.remainingForFreeShipping)}</strong> باقی مانده است.</span>`
      : `<span><strong>ارسال استاندارد سفارش شما رایگان شد.</strong></span>`}
      ${icon('truck')}
    </div>
    <div class="shipping-progress__track" aria-hidden="true"><span style="width:${percent}%"></span></div>
  </section>`;
};

const lineTemplate = line => {
  const { item, product, priceChanged, unavailable } = line;
  const color = product?.colorNames?.[item.colorIndex] || 'رنگ انتخابی';
  return `<article class="cart-line ${unavailable ? 'cart-line--unavailable' : ''}" data-cart-id="${item.id}">
    <a class="cart-line__image" href="./product?id=${item.productId}"><img src="${product?.image || './src/assets/images/product-1.webp'}" alt="${product?.imageAlt || item.name}" width="180" height="240"></a>
    <div class="cart-line__content">
      <div class="cart-line__top">
        <div><p class="cart-line__category">${product?.category || 'محصول توتو'}</p><h2><a href="./product?id=${item.productId}">${product?.name || item.name}</a></h2><p class="cart-line__variant">رنگ: ${color} <span aria-hidden="true">·</span> سایز: ${item.size}</p></div>
        <button class="icon-button" type="button" data-cart-action="remove" data-id="${item.id}" aria-label="حذف ${product?.name || item.name}">${icon('trash')}</button>
      </div>
      ${unavailable ? `<div class="inline-notice inline-notice--error">${icon('error')}<span>این محصول در حال حاضر ناموجود است. برای ادامه خرید آن را حذف یا ذخیره کنید.</span></div>` : ''}
      ${priceChanged ? `<div class="inline-notice inline-notice--info">${icon('info')}<span>قیمت این محصول به‌روزرسانی شده است و قیمت جدید در مجموع سفارش محاسبه می‌شود.</span></div>` : ''}
      ${product?.stockNote ? `<p class="stock-note">${product.stockNote}</p>` : ''}
      <div class="cart-line__bottom">
        <div class="quantity quantity--compact" aria-label="تعداد ${product?.name || item.name}">
          <button type="button" data-cart-action="increase" data-id="${item.id}" aria-label="افزایش تعداد" ${item.quantity >= 5 ? 'disabled' : ''}>${icon('plus')}</button>
          <output>${toPersianDigits(item.quantity)}</output>
          <button type="button" data-cart-action="decrease" data-id="${item.id}" aria-label="کاهش تعداد" ${item.quantity <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
        </div>
        <div class="cart-line__price"><strong>${formatPrice(line.lineTotal)}</strong>${product?.previousPrice ? `<del>${formatPrice(product.previousPrice * item.quantity)}</del>` : ''}</div>
      </div>
      <div class="cart-line__links">
        <button class="text-button" type="button" data-cart-action="save" data-id="${item.id}">${icon('bookmark', 'icon icon--sm')} ذخیره برای بعد</button>
      </div>
    </div>
  </article>`;
};

const summaryTemplate = summary => `
  <aside class="order-summary" aria-labelledby="cart-summary-title">
    <h2 id="cart-summary-title">خلاصه سفارش</h2>
    <dl class="price-list">
      <div><dt>جمع قیمت محصولات</dt><dd>${formatPrice(summary.subtotal)}</dd></div>
      <div class="price-list__discount"><dt>تخفیف محصولات</dt><dd>− ${formatPrice(summary.productDiscount)}</dd></div>
      <div><dt>هزینه ارسال تقریبی</dt><dd>${summary.shipping === 0 ? 'رایگان' : formatPrice(summary.shipping)}</dd></div>
    </dl>
    <div class="price-total"><span>مبلغ قابل پرداخت</span><strong>${formatPrice(summary.total)}</strong></div>
    ${summary.lines.some(line => line.unavailable) ? `<div class="field-message field-message--error">برای ادامه، محصولات ناموجود را از سبد حذف کنید.</div>` : ''}
    <a class="button button--block ${summary.lines.some(line => line.unavailable) ? 'is-disabled' : ''}" ${summary.lines.some(line => line.unavailable) ? 'aria-disabled="true" tabindex="-1"' : 'href="./checkout"'}>ادامه و ثبت اطلاعات ارسال</a>
    <p class="secure-note">${icon('shield', 'icon icon--sm')} اطلاعات خرید شما در مرحله پرداخت دوباره بررسی می‌شود.</p>
  </aside>`;

export const initCart = ({ toast }) => {
  const root = document.getElementById('cart-root');
  if (!root) return;
  let undoItem = null;
  let undoTimer = null;

  const render = () => {
    const cart = getCart();
    if (!cart.length) { root.innerHTML = emptyTemplate(); return; }
    const summary = calculateCart({ cart });
    root.innerHTML = `<nav class="breadcrumb" aria-label="مسیر صفحه"><a href="/">خانه</a><span>/</span><span aria-current="page">سبد خرید</span></nav>
      <header class="commerce-header"><div><p class="eyebrow">مرحله اول از سه مرحله</p><h1>سبد خرید</h1><p>${toPersianDigits(cart.reduce((sum, item) => sum + item.quantity, 0))} محصول در سبد شماست.</p></div><a class="inline-link" href="./shop">ادامه خرید</a></header>
      ${progressTemplate(summary)}
      <div class="cart-layout"><section class="cart-lines" aria-label="محصولات سبد خرید">${summary.lines.map(lineTemplate).join('')}</section>${summaryTemplate(summary)}</div>`;
  };

  const remove = id => {
    undoItem = removeCartItem(id);
    clearTimeout(undoTimer);
    render();
    toast('محصول از سبد حذف شد. برای بازگرداندن از دکمه زیر استفاده کنید.', 'info', {
      label: 'بازگرداندن', onAction: () => { if (!undoItem) return; const cart = getCart(); cart.push(undoItem); saveCart(cart); undoItem = null; render(); announce('محصول به سبد بازگردانده شد.'); }
    });
    undoTimer = setTimeout(() => { undoItem = null; }, 6000);
  };

  root.addEventListener('click', event => {
    const trigger = event.target.closest('[data-cart-action]');
    if (!trigger) return;
    const id = trigger.dataset.id;
    const cart = getCart();
    const item = cart.find(entry => entry.id === id);
    if (!item) return;
    if (trigger.dataset.cartAction === 'increase') {
      if (item.quantity >= 5) { toast('حداکثر تعداد مجاز برای این محصول ۵ عدد است.', 'error'); return; }
      updateCartQuantity(id, item.quantity + 1); render();
    }
    if (trigger.dataset.cartAction === 'decrease') updateCartQuantity(id, item.quantity - 1), render();
    if (trigger.dataset.cartAction === 'remove') remove(id);
    if (trigger.dataset.cartAction === 'save') {
      const saved = localStore.get('toto-saved', []);
      if (!saved.includes(item.productId)) saved.push(item.productId);
      localStore.set('toto-saved', saved); removeCartItem(id); render(); toast('محصول برای بعد ذخیره شد.');
    }
  });

  if (!getCart().length && new URLSearchParams(location.search).get('demo') === '1') {
    saveCart([
      { id: 'demo-cart-1', productId: products[0].id, name: products[0].name, size: '۳۸', colorIndex: 0, quantity: 1, price: products[0].price },
      { id: 'demo-cart-2', productId: products[2].id, name: products[2].name, size: '۴۰', colorIndex: 0, quantity: 1, price: products[2].price }
    ]);
  }
  render();
};
