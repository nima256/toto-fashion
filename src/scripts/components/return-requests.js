import { icon, escapeHtml as esc, safeImage, toPersianDigits, encodeParam } from '../core/utils.js';

const STATUS_TONE = { received: 'pending', reviewing: 'pending', approved: 'progress', 'awaiting-item': 'progress', 'replacement-processing': 'progress', refunded: 'done', completed: 'done', rejected: 'error' };
const statusBadge = request => `<span class="return-status return-status--${STATUS_TONE[request.status] || 'pending'}">${esc(request.statusLabel)}</span>`;

// کارت جزئیات یک درخواست مرجوعی/تعویض برای صاحب حساب
export const returnRequestCard = request => `<article class="return-card" id="return-${esc(request.id)}">
  <header class="return-card__head"><div><small>کد درخواست</small><strong dir="ltr">${esc(request.id)}</strong></div>${statusBadge(request)}</header>
  <div class="return-card__product"><img src="${safeImage(request.image)}" alt="" width="56" height="74" loading="lazy"><div><strong>${esc(request.productName)}</strong><span>${[request.color, request.size ? `سایز ${request.size}` : '', request.quantity > 1 ? `${toPersianDigits(request.quantity)} عدد` : ''].filter(Boolean).map(esc).join(' · ')}</span><a class="inline-link" href="./order-details?id=${encodeParam(request.orderId)}" dir="auto">سفارش ${esc(request.orderNumber)}</a></div></div>
  <dl class="return-card__meta">
    <div><dt>نوع درخواست</dt><dd>${esc(request.typeLabel)}</dd></div>
    <div><dt>دلیل</dt><dd>${esc(request.reason)}</dd></div>
    ${request.exchangeSize || request.exchangeColor ? `<div><dt>جایگزین درخواستی</dt><dd>${[request.exchangeColor ? `رنگ ${request.exchangeColor}` : '', request.exchangeSize ? `سایز ${request.exchangeSize}` : ''].filter(Boolean).map(esc).join('، ')}</dd></div>` : ''}
    <div><dt>روش رسیدگی</dt><dd>${esc(request.resolutionLabel)}</dd></div>
    <div><dt>تاریخ ثبت</dt><dd>${esc(request.createdAt)}</dd></div>
    ${request.updatedAt ? `<div><dt>آخرین به‌روزرسانی</dt><dd>${esc(request.updatedAt)}</dd></div>` : ''}
  </dl>
  ${request.note ? `<p class="return-card__note"><strong>توضیحات شما:</strong> ${esc(request.note)}</p>` : ''}
  ${request.customerMessage ? `<div class="page-notice page-notice--info">${icon('support')}<div><strong>پاسخ پشتیبانی</strong><p>${esc(request.customerMessage)}</p></div></div>` : ''}
  ${request.images?.length ? `<div class="return-card__images" aria-label="تصاویر پیوست">${request.images.map((img, index) => `<a href="${esc(img.url)}" target="_blank" rel="noopener"><img src="${esc(img.url)}" alt="تصویر پیوست ${toPersianDigits(index + 1)}" width="72" height="72" loading="lazy"></a>`).join('')}</div>` : ''}
  ${request.history?.length > 1 ? `<details class="account-details"><summary>روند رسیدگی ${icon('chevron-left', 'icon icon--sm')}</summary><ol class="return-card__history">${request.history.map(step => `<li><strong>${esc(step.statusLabel)}</strong><small>${esc(step.at)}</small></li>`).join('')}</ol></details>` : ''}
</article>`;

export const returnRequestsListTemplate = (requests = [], { emptyText = 'هنوز درخواست مرجوعی یا تعویضی ثبت نکرده‌اید.' } = {}) => requests.length
  ? `<div class="return-card-list">${requests.map(returnRequestCard).join('')}</div>`
  : `<div class="mini-empty"><p>${esc(emptyText)}</p></div>`;
