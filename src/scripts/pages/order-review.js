import { discountCodes } from '../../data/checkout-data.js';
import { localStore, sessionStore } from '../core/storage.js';
import { calculateCart, getCart, makeOrderNumber } from '../core/commerce.js';
import { api } from '../services/api.js';
import { formatPrice, icon, toPersianDigits } from '../core/utils.js';

const stepsTemplate = () => `<ol class="checkout-steps" aria-label="مراحل ثبت سفارش"><li class="is-done"><span>${icon('check','icon icon--sm')}</span><strong>سبد خرید</strong></li><li class="is-done"><span>${icon('check','icon icon--sm')}</span><strong>اطلاعات ارسال</strong></li><li class="is-active" aria-current="step"><span>۳</span><strong>مرور و پرداخت</strong></li></ol>`;

const missingTemplate = (title, text, href, action) => `<section class="commerce-empty"><span class="commerce-empty__icon">${icon('error','icon icon--lg')}</span><h1>${title}</h1><p>${text}</p><a class="button" href="${href}">${action}</a></section>`;

export const initOrderReview = ({ toast }) => {
  const root = document.getElementById('order-review-root');
  if (!root) return;
  const cart = getCart();
  const checkout = localStore.get('toto-checkout', null);
  if (!cart.length) { root.innerHTML = missingTemplate('سبد خرید خالی است','پیش از مرور سفارش، محصولی به سبد اضافه کنید.','./shop','مشاهده محصولات'); return; }
  if (!checkout?.address || !checkout?.shippingMethod) { root.innerHTML = missingTemplate('اطلاعات ارسال کامل نیست','نشانی و روش ارسال را ثبت کنید.','./checkout','تکمیل اطلاعات ارسال'); return; }

  let discountCode = localStore.get('toto-discount-code', '');
  let isSubmitting = false;

  const renderProducts = summary => summary.lines.map(line => `<article class="review-product"><img src="${line.product.image}" alt="${line.product.imageAlt}" width="96" height="128"><div><h3>${line.product.name}</h3><p>رنگ ${line.product.colorNames[line.item.colorIndex] || 'انتخابی'} · سایز ${line.item.size} · تعداد ${toPersianDigits(line.item.quantity)}</p>${line.unavailable ? `<span class="status-text status-text--error">ناموجود</span>` : ''}${line.priceChanged ? `<span class="status-text status-text--info">قیمت به‌روزرسانی شده</span>` : ''}</div><strong>${formatPrice(line.lineTotal)}</strong></article>`).join('');

  const render = () => {
    const summary = calculateCart({ cart, shippingMethod: checkout.shippingMethod, discountCode });
    const address = checkout.address;
    root.innerHTML = `${stepsTemplate()}<header class="commerce-header"><div><p class="eyebrow">مرحله نهایی</p><h1>مرور سفارش و پرداخت</h1><p>پیش از انتقال به درگاه، محصولات و اطلاعات تحویل را بررسی کنید.</p></div></header>
      ${summary.lines.some(line => line.priceChanged) ? `<div class="page-notice page-notice--info">${icon('info')}<div><strong>قیمت یک یا چند محصول تغییر کرده است</strong><p>مبلغ نهایی بر اساس آخرین قیمت موجود محاسبه شده است.</p></div></div>` : ''}
      <div class="review-layout"><div class="review-content">
        <section class="review-section"><div class="review-section__head"><div><span>۱</span><h2>محصولات</h2></div><a class="text-button" href="./cart">ویرایش سبد</a></div><div class="review-products">${renderProducts(summary)}</div></section>
        <section class="review-section"><div class="review-section__head"><div><span>۲</span><h2>نشانی تحویل</h2></div><a class="text-button" href="./checkout">ویرایش</a></div><address class="review-address"><strong>${address.firstName} ${address.lastName}</strong><p>${address.province}، ${address.city}، ${address.address}، پلاک ${address.buildingNumber}${address.unit ? `، واحد ${address.unit}` : ''}</p><span>کد پستی: ${toPersianDigits(address.postalCode)}</span><span>شماره تماس: ${toPersianDigits(address.mobile)}</span></address></section>
        <section class="review-section"><div class="review-section__head"><div><span>۳</span><h2>شیوه ارسال</h2></div><a class="text-button" href="./checkout">ویرایش</a></div><div class="selected-shipping">${icon('truck')}<span><strong>${checkout.shippingMethod.title}</strong><small>${checkout.shippingMethod.description}</small></span><b>${summary.shipping ? formatPrice(summary.shipping) : 'رایگان'}</b></div></section>
        <section class="review-section"><div class="review-section__head"><div><span>۴</span><h2>اطلاعات مشتری</h2></div><a class="text-button" href="./checkout">ویرایش</a></div><dl class="customer-summary"><div><dt>نام گیرنده</dt><dd>${address.firstName} ${address.lastName}</dd></div><div><dt>شماره موبایل</dt><dd>${toPersianDigits(address.mobile)}</dd></div>${checkout.notes ? `<div><dt>توضیحات</dt><dd>${checkout.notes}</dd></div>` : ''}</dl></section>
      </div>
      <aside class="order-summary review-summary"><h2>جزئیات پرداخت</h2><form class="discount-form" id="discount-form" novalidate><label for="discount-code">کد تخفیف</label><div><input class="input" id="discount-code" value="${discountCode}" placeholder="مثلاً TOTO10" autocomplete="off"><button class="button button--outline" type="submit">اعمال</button></div><p class="field-message ${summary.couponError ? 'field-message--error' : ''}" id="discount-message">${summary.couponError || (summary.coupon ? summary.coupon.label : '')}</p></form><dl class="price-list"><div><dt>جمع قیمت محصولات</dt><dd>${formatPrice(summary.subtotal)}</dd></div><div class="price-list__discount"><dt>تخفیف محصولات</dt><dd>− ${formatPrice(summary.productDiscount)}</dd></div>${summary.couponDiscount ? `<div class="price-list__discount"><dt>کد تخفیف</dt><dd>− ${formatPrice(summary.couponDiscount)}</dd></div>` : ''}<div><dt>هزینه ارسال</dt><dd>${summary.shipping ? formatPrice(summary.shipping) : 'رایگان'}</dd></div></dl><div class="price-total"><span>مبلغ قابل پرداخت</span><strong>${formatPrice(summary.total)}</strong></div>${summary.lines.some(line => line.unavailable) ? `<div class="field-message field-message--error">یکی از محصولات ناموجود شده است. برای اصلاح به سبد خرید برگردید.</div>` : ''}${sessionStore.get('toto-order-submitting', false) ? `<a class="button button--secondary button--block" href="./payment-pending">مشاهده وضعیت پرداخت در حال بررسی</a>` : `<button class="button button--block payment-button" id="final-payment" type="button" ${summary.lines.some(line => line.unavailable) ? 'disabled' : ''}>پرداخت ${formatPrice(summary.total)}</button>`}<p class="secure-note">${icon('shield','icon icon--sm')} با انتخاب پرداخت، موجودی کالا دوباره بررسی می‌شود.</p><p class="mock-note">پس از پرداخت، نتیجه تراکنش از سرور و درگاه تأیید می‌شود.</p></aside></div>`;

    document.getElementById('discount-form')?.addEventListener('submit', event => {
      event.preventDefault();
      const code = document.getElementById('discount-code').value.trim().toUpperCase();
      discountCode = code;
      const check = calculateCart({ cart, shippingMethod: checkout.shippingMethod, discountCode });
      if (check.couponError) { toast(check.couponError, 'error'); }
      else if (code) { localStore.set('toto-discount-code', code); toast('کد تخفیف با موفقیت اعمال شد.'); }
      else localStore.remove('toto-discount-code');
      render();
    });

    document.getElementById('final-payment')?.addEventListener('click', submitOrder);
  };

  const submitOrder = async event => {
    if (isSubmitting || sessionStore.get('toto-order-submitting', false)) return;
    isSubmitting = true; sessionStore.set('toto-order-submitting', true);
    const button = event.currentTarget; button.disabled = true; button.textContent = 'در حال بررسی موجودی...';
    try {
      const stockResult = await api.validateCart(cart, checkout, discountCode);
      if (!stockResult.ok) { toast(stockResult.message, 'error'); location.href = './cart'; return; }
      const summary = calculateCart({ cart, shippingMethod: checkout.shippingMethod, discountCode });
      const order = {
        orderNumber: makeOrderNumber(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        items: cart,
        checkout,
        discountCode,
        amounts: { subtotal: summary.subtotal, productDiscount: summary.productDiscount, couponDiscount: summary.couponDiscount, shipping: summary.shipping, total: summary.total },
        payment: { status: 'pending', trackingCode: null, gateway: 'درگاه پرداخت ایرانی - نمونه' }
      };
      button.textContent = 'در حال انتقال به درگاه...';
      const result = await api.createPayment(order);
      const serverOrder = result.order || {};
      const savedOrder = {
        ...order,
        id: serverOrder.id || order.id,
        orderNumber: serverOrder.orderNumber || order.orderNumber,
        status: serverOrder.status || order.status,
        amounts: { subtotal: serverOrder.subtotal ?? order.amounts.subtotal, productDiscount: order.amounts.productDiscount, couponDiscount: order.amounts.couponDiscount, shipping: serverOrder.shipping ?? order.amounts.shipping, total: serverOrder.total ?? order.amounts.total },
        payment: { ...order.payment, status: serverOrder.paymentStatus || 'pending', trackingCode: serverOrder.paymentTrackingCode || null }
      };
      localStore.set('toto-last-order', savedOrder);
      const orders = localStore.get('toto-orders', []);
      localStore.set('toto-orders', [savedOrder, ...orders.filter(item => item.orderNumber !== savedOrder.orderNumber)]);
      location.href = result.redirectUrl || `./payment-pending?order=${encodeURIComponent(savedOrder.orderNumber)}`;
    } catch (error) {
      sessionStore.remove('toto-order-submitting'); isSubmitting = false; button.disabled = false; button.textContent = 'تلاش دوباره برای پرداخت'; toast(error.message || 'اتصال به درگاه انجام نشد. دوباره تلاش کنید.', 'error');
    }
  };

  render();
};
