import { localStore, sessionStore } from '../core/storage.js';
import { formatPrice, icon, toPersianDigits } from '../core/utils.js';
import { api } from '../services/api.js';

const updateOrder = order => {
  localStore.set('toto-last-order', order);
  const orders = localStore.get('toto-orders', []);
  const exists = orders.some(item => item.orderNumber === order.orderNumber);
  localStore.set('toto-orders', exists ? orders.map(item => item.orderNumber === order.orderNumber ? order : item) : [order, ...orders]);
};
const addressText = order => { const address=order?.checkout?.address; return address ? `${address.province}، ${address.city}، ${address.address}` : (order?.address || 'نشانی سفارش ثبت نشده است.'); };
const missing = () => `<section class="payment-state"><span class="payment-state__icon payment-state__icon--neutral">${icon('info','icon icon--lg')}</span><h1>اطلاعات سفارش پیدا نشد</h1><p>شماره سفارش برای استعلام در دسترس نیست. از بخش سفارش‌ها وضعیت خرید را بررسی کنید.</p><a class="button" href="./orders">مشاهده سفارش‌ها</a></section>`;
const mergeServerOrder = (local, server) => ({
  ...(local||{}), id:server.id, orderNumber:server.orderNumber, status:server.status, address:server.address,
  amounts:{subtotal:server.subtotal,productDiscount:Math.max(0,(server.discount||0)-(local?.amounts?.couponDiscount||0)),couponDiscount:local?.amounts?.couponDiscount||0,shipping:server.shipping,total:server.total},
  payment:{...(local?.payment||{}),status:server.paymentStatus,trackingCode:server.paymentTrackingCode||server.trackingCode||''}
});

export const initPayment = async ({ toast }) => {
  const root=document.getElementById('payment-root'); if(!root)return;
  const page=document.body.dataset.page, queryOrder=new URLSearchParams(location.search).get('order');
  let order=localStore.get('toto-last-order',null);
  const orderNumber=queryOrder||order?.orderNumber;
  if(!orderNumber){root.innerHTML=missing();return;}
  try{const result=await api.verifyPayment(orderNumber);if(result.order){order=mergeServerOrder(order,result.order);updateOrder(order);}}catch(error){if(!order){root.innerHTML=missing();return;}if(page==='payment-success')toast(error.message||'استعلام پرداخت انجام نشد.','error');}
  if(!order){root.innerHTML=missing();return;}
  const shippingTitle=order.checkout?.shippingMethod?.title||order.carrier||'روش ارسال';
  const eta=order.checkout?.shippingMethod?.eta||order.deliveryEstimate||'';
  const commonDetails=()=>`<dl class="payment-details"><div><dt>شماره سفارش</dt><dd dir="ltr">${order.orderNumber}</dd></div><div><dt>مبلغ سفارش</dt><dd>${formatPrice(order.amounts?.total||order.total||0)}</dd></div><div><dt>روش ارسال</dt><dd>${shippingTitle}</dd></div><div><dt>نشانی</dt><dd>${addressText(order)}</dd></div></dl>`;

  if(page==='payment-success'){
    if(order.payment?.status!=='paid'){root.innerHTML=`<section class="payment-state"><span class="payment-state__icon payment-state__icon--pending">${icon('clock','icon icon--lg')}</span><h1>پرداخت هنوز تأیید نشده است</h1><p>نتیجه تراکنش از سرور تأیید نشده؛ دوباره وضعیت را بررسی کنید.</p>${commonDetails()}<a class="button" href="./payment-pending?order=${encodeURIComponent(order.orderNumber)}">بررسی وضعیت</a></section>`;return;}
    localStore.set('toto-cart',[]);localStore.remove('toto-checkout');localStore.remove('toto-checkout-draft');localStore.remove('toto-discount-code');sessionStore.remove('toto-order-submitting');document.dispatchEvent(new CustomEvent('toto:cart-updated'));
    root.innerHTML=`<section class="payment-state"><span class="payment-state__icon payment-state__icon--success">${icon('check','icon icon--lg')}</span><p class="eyebrow">پرداخت تأیید شد</p><h1>سفارش شما با موفقیت ثبت شد</h1><p>تأیید سفارش و مراحل آماده‌سازی از طریق پیامک اطلاع‌رسانی می‌شود.</p>${commonDetails()}<div class="payment-tracking"><span>کد پیگیری پرداخت</span><strong dir="ltr">${toPersianDigits(order.payment.trackingCode||'-')}</strong></div><div class="payment-actions"><a class="button" href="./order-tracking?order=${encodeURIComponent(order.orderNumber)}">مشاهده سفارش</a><a class="button button--outline" href="./shop">ادامه خرید</a></div><p class="secure-note">زمان تقریبی تحویل: ${eta}</p></section>`;
    return;
  }
  if(page==='payment-failed'){
    sessionStore.remove('toto-order-submitting');
    root.innerHTML=`<section class="payment-state"><span class="payment-state__icon payment-state__icon--error">${icon('error','icon icon--lg')}</span><p class="eyebrow">پرداخت انجام نشد</p><h1>تراکنش ناموفق بود</h1><p>پرداخت توسط درگاه تأیید نشده است. اگر وجهی کسر شده باشد، مطابق روال بانکی تعیین تکلیف می‌شود.</p>${commonDetails()}<div class="payment-actions"><a class="button" href="./order-review">تلاش دوباره برای پرداخت</a><a class="button button--outline" href="./cart">بازگشت به سبد خرید</a></div><a class="inline-link" href="./contact">ارتباط با پشتیبانی خرید</a></section>`;return;
  }
  if(page==='payment-pending'){
    const renderPending=message=>{root.innerHTML=`<section class="payment-state"><span class="payment-state__icon payment-state__icon--pending">${icon('clock','icon icon--lg')}</span><p class="eyebrow">در حال بررسی پرداخت</p><h1>نتیجه تراکنش هنوز قطعی نیست</h1><p>برای جلوگیری از پرداخت تکراری، تا دریافت نتیجه نهایی دوباره سفارش را ثبت نکنید.</p>${commonDetails()}<div class="page-notice page-notice--info">${icon('info')}<div><strong>وضعیت فعلی</strong><p>${message||'در انتظار پاسخ نهایی درگاه پرداخت'}</p></div></div><div class="payment-actions"><button class="button" id="refresh-payment" type="button">بررسی دوباره وضعیت</button><a class="button button--outline" href="./account">بازگشت به حساب کاربری</a></div></section>`;document.getElementById('refresh-payment')?.addEventListener('click',async event=>{event.currentTarget.disabled=true;event.currentTarget.textContent='در حال استعلام...';try{const result=await api.verifyPayment(order.orderNumber);if(result.status==='paid'){order=mergeServerOrder(order,result.order);updateOrder(order);location.href=`./payment-success?order=${encodeURIComponent(order.orderNumber)}`;return;}renderPending('درگاه هنوز نتیجه نهایی را تأیید نکرده است.');}catch(error){renderPending('ارتباط با سرویس پرداخت برقرار نشد.');toast(error.message,'error');}});};
    if(order.payment?.status==='paid'){location.href=`./payment-success?order=${encodeURIComponent(order.orderNumber)}`;return;}renderPending();
  }
};
