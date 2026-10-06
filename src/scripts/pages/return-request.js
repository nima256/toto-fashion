import { api } from '../services/api.js';
import { getAccountData, getSession, setOrders } from '../core/account-store.js';
import { products } from '../../data/mock-data.js';
import { icon, toPersianDigits, escapeHtml as esc } from '../core/utils.js';
import { returnRequestsListTemplate } from '../components/return-requests.js';
import { accountSidebarTemplate, accountMobileNavTemplate, authGateTemplate } from '../components/account-shell.js';

const MAX_FILES = 3; const MAX_SIZE = 5 * 1024 * 1024; const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const eligibleOrders = orders => orders.filter(order => order.status === 'delivered' && order.items.some(item => item.returnEligible));
const itemLabel = item => `${item.name} · ${item.color} · سایز ${item.size}`;
const exchangeSizesFor = productId => products.find(product => product.id === productId)?.sizes || [];

const formTemplate = (orders, selectedOrderId, selectedProductId) => {
  const selectedOrder = orders.find(order => order.id === selectedOrderId) || orders[0];
  const items = selectedOrder?.items.filter(item => item.returnEligible) || [];
  const selectedItem = items.find(item => item.productId === selectedProductId) || items[0];
  return `<form class="return-form account-panel" id="return-form" novalidate>
    <div class="account-panel__head"><div><p class="eyebrow">درخواست آنلاین</p><h2>اطلاعات مرجوعی یا تعویض</h2></div></div>
    <div class="form-grid form-grid--2"><label class="field"><span>سفارش</span><select class="input" name="orderId" id="return-order" required>${orders.map(order => `<option value="${esc(order.id)}" ${order.id === selectedOrder?.id ? 'selected' : ''}>سفارش ${esc(order.orderNumber)} · ${esc(order.placedAt)}</option>`).join('')}</select><small class="field-message" data-error-for="orderId"></small></label><label class="field"><span>محصول</span><select class="input" name="productId" id="return-product" required>${items.map(item => `<option value="${esc(item.productId)}" ${item.productId === selectedItem?.productId ? 'selected' : ''}>${esc(itemLabel(item))}</option>`).join('')}</select><small class="field-message" data-error-for="productId"></small></label></div>
    <fieldset class="return-choice"><legend>نوع درخواست</legend><label><input type="radio" name="type" value="exchange" checked><span>${icon('refresh')}<strong>تعویض سایز</strong><small>جایگزینی با سایز موجود</small></span></label><label><input type="radio" name="type" value="return"><span>${icon('package')}<strong>مرجوعی محصول</strong><small>بررسی و بازپرداخت وجه</small></span></label><label><input type="radio" name="type" value="damaged"><span>${icon('error')}<strong>گزارش آسیب‌دیدگی</strong><small>ایراد یا مغایرت محصول</small></span></label></fieldset>
    <div class="form-grid form-grid--2"><label class="field"><span>دلیل درخواست</span><select class="input" name="reason" required><option value="">انتخاب کنید</option><option value="size">سایز مناسب نیست</option><option value="different">محصول با تصویر یا توضیحات متفاوت است</option><option value="quality">ایراد دوخت یا پارچه</option><option value="damaged">محصول آسیب‌دیده تحویل شده</option><option value="changed-mind">انصراف از خرید</option><option value="other">دلیل دیگر</option></select><small class="field-message" data-error-for="reason"></small></label><label class="field" id="exchange-size-field"><span>سایز جایگزین</span><select class="input" name="exchangeSize" id="exchange-size">${sizeOptions(selectedItem)}</select><small class="field-message" data-error-for="exchangeSize"></small></label></div>
    <label class="field"><span>توضیحات</span><textarea class="input input--textarea" name="description" rows="4" maxlength="1000" placeholder="برای بررسی دقیق‌تر، وضعیت محصول و بسته‌بندی را توضیح دهید." required></textarea><small class="field-message" data-error-for="description"></small></label>
    <label class="upload-field"><input type="file" name="images" id="return-images" accept="image/jpeg,image/png,image/webp" multiple><span>${icon('upload')}<strong>افزودن تصویر</strong><small>حداکثر ۳ تصویر JPG، PNG یا WebP؛ هر فایل تا ۵ مگابایت</small></span></label><div class="upload-preview" id="upload-preview" aria-live="polite"></div><div class="field-message field-message--error" id="upload-error"></div>
    <fieldset class="resolution-options"><legend>روش موردنظر برای رسیدگی</legend><label><input type="radio" name="resolution" value="exchange" checked><span>تعویض کالا یا سایز</span></label><label><input type="radio" name="resolution" value="wallet"><span>بازگشت اعتبار به کیف پول توتو</span></label><label><input type="radio" name="resolution" value="refund"><span>بازپرداخت وجه پس از تأیید</span></label><small class="field-message" data-error-for="resolution"></small></fieldset>
    <label class="check-row"><input type="checkbox" name="confirm" required><span>شرایط مرجوعی را مطالعه کرده‌ام و محصول استفاده‌نشده، دارای برچسب و بسته‌بندی اولیه است.</span></label><div class="field-message field-message--error" id="confirm-error" data-error-for="confirm"></div>
    <div class="page-notice page-notice--info">${icon('info')}<div><strong>بررسی اولیه تا ۲۴ ساعت کاری</strong><p>پس از تأیید، راهنمای ارسال محصول از طریق پیامک اطلاع‌رسانی می‌شود.</p></div></div>
    <button class="button button--block" type="submit">ثبت درخواست</button>
  </form>`;
};
function sizeOptions(item) { const sizes = item ? exchangeSizesFor(item.productId).filter(size => size !== item.size) : []; return `<option value="">انتخاب سایز</option>${sizes.map(size => `<option value="${esc(size)}">${esc(size)}</option>`).join('')}`; }

const successTemplate = request => `<section class="return-success"><span>${icon('check', 'icon icon--lg')}</span><p class="eyebrow">درخواست ثبت شد</p><h1>درخواست شما در صف بررسی است</h1><p>کد درخواست <strong dir="ltr">${esc(request.id)}</strong> است. نوع درخواست: ${esc(request.typeLabel)} · روش رسیدگی: ${esc(request.resolutionLabel)}${request.exchangeSize ? ` · سایز جایگزین: ${esc(request.exchangeSize)}` : ''}${request.images?.length ? ` · ${toPersianDigits(request.images.length)} تصویر پیوست شد` : ''}.</p><div class="return-success__steps"><div><b>۱</b><span><strong>بررسی درخواست</strong><small>حداکثر تا ۲۴ ساعت کاری</small></span></div><div><b>۲</b><span><strong>دریافت راهنمای ارسال</strong><small>پس از تأیید اولیه</small></span></div><div><b>۳</b><span><strong>کنترل محصول و نتیجه نهایی</strong><small>پس از رسیدن بسته به توتو</small></span></div></div><div class="payment-actions"><a class="button" href="./return-request#return-history">مشاهده درخواست‌ها</a><a class="button button--outline" href="./return-request#new-return">ثبت درخواست دیگر</a></div></section>`;
const noEligibleTemplate = () => `<section class="account-auth-gate"><span class="account-auth-gate__icon">${icon('refresh')}</span><h1>سفارش واجد شرایطی ندارید</h1><p>در حال حاضر محصول تحویل‌شده‌ای که در بازه مجاز تعویض یا مرجوعی باشد پیدا نشد.</p><a class="button" href="./orders">مشاهده سفارش‌ها</a><a class="button button--outline" href="./shipping-returns">شرایط مرجوعی</a></section>`;
const historySection = returns => `<section class="returns-page-section account-panel" id="return-history" aria-labelledby="return-history-title"><div class="account-panel__head"><div><p class="eyebrow">سابقه</p><h2 id="return-history-title">درخواست‌های قبلی من</h2></div><a class="inline-link" href="#new-return">درخواست جدید</a></div>${returnRequestsListTemplate(returns)}</section>`;
const newRequestSection = content => `<section class="returns-page-section" id="new-return" aria-label="ثبت درخواست جدید">${content}</section>`;

const layoutTemplate = (session, account, content) => `<div class="account-page-shell">${accountSidebarTemplate({ active: 'returns', session, account })}<div class="account-content">${accountMobileNavTemplate('returns')}<header class="account-welcome account-welcome--compact"><div><p class="eyebrow">خدمات پس از خرید</p><h1>تعویض سایز و مرجوعی</h1><p>درخواست خود را مرحله‌به‌مرحله ثبت کنید تا تیم پشتیبانی بررسی کند.</p></div><a class="button button--outline" href="./shipping-returns">مشاهده شرایط</a></header>${content}</div></div>`;

const showError = (form, name, message) => { const node = form.querySelector(`[data-error-for="${name}"]`); if (node) { node.textContent = message; node.classList.add('field-message--error'); } };
const validate = form => {
  form.querySelectorAll('.field-message').forEach(node => { node.textContent = ''; node.classList.remove('field-message--error'); });
  const data = new FormData(form); let first = null;
  for (const name of ['orderId', 'productId', 'reason']) if (!String(data.get(name) || '').trim()) { showError(form, name, 'این فیلد را کامل کنید.'); first ||= form.elements[name]; }
  if (String(data.get('description') || '').trim().length < 10) { showError(form, 'description', 'توضیحات را حداقل با ۱۰ نویسه بنویسید.'); first ||= form.elements.description; }
  if (data.get('type') === 'exchange' && !data.get('exchangeSize')) { showError(form, 'exchangeSize', 'سایز جایگزین را انتخاب کنید.'); first ||= form.elements.exchangeSize; }
  if (data.get('type') === 'exchange' && data.get('resolution') !== 'exchange') { showError(form, 'resolution', 'برای تعویض سایز، روش رسیدگی را «تعویض کالا» انتخاب کنید.'); first ||= form.querySelector('[name="resolution"]'); }
  if (!form.elements.confirm.checked) { showError(form, 'confirm', 'برای ثبت درخواست، تأیید شرایط لازم است.'); first ||= form.elements.confirm; }
  const files = [...(form.elements.images.files || [])];
  if (files.length > MAX_FILES || files.some(file => file.size > MAX_SIZE || !TYPES.includes(file.type))) { document.getElementById('upload-error').textContent = 'حداکثر ۳ تصویر JPG، PNG یا WebP و هر فایل تا ۵ مگابایت مجاز است.'; first ||= form.elements.images; }
  first?.focus(); return first ? null : data;
};

const bind = (orders, toast) => {
  const form = document.getElementById('return-form');
  const refreshItems = () => {
    const order = orders.find(item => item.id === form.elements.orderId.value);
    const items = order?.items.filter(item => item.returnEligible) || [];
    form.elements.productId.innerHTML = items.map(item => `<option value="${esc(item.productId)}">${esc(itemLabel(item))}</option>`).join('');
    refreshSizes();
  };
  const refreshSizes = () => { const order = orders.find(item => item.id === form.elements.orderId.value); const item = order?.items.find(entry => entry.productId === form.elements.productId.value); form.elements.exchangeSize.innerHTML = sizeOptions(item); };
  form.elements.orderId.addEventListener('change', refreshItems);
  form.elements.productId.addEventListener('change', refreshSizes);
  form.addEventListener('change', event => { if (event.target.name === 'type') { const exchange = event.target.value === 'exchange'; document.getElementById('exchange-size-field').hidden = !exchange; if (exchange) form.querySelector('[name="resolution"][value="exchange"]').checked = true; } });
  form.elements.images.addEventListener('change', event => {
    const files = [...event.target.files]; const error = document.getElementById('upload-error'); error.textContent = '';
    if (files.length > MAX_FILES || files.some(file => file.size > MAX_SIZE || !TYPES.includes(file.type))) { error.textContent = 'حداکثر ۳ تصویر JPG، PNG یا WebP و هر فایل تا ۵ مگابایت مجاز است.'; event.target.value = ''; document.getElementById('upload-preview').innerHTML = ''; return; }
    document.getElementById('upload-preview').innerHTML = files.map(file => `<span>${icon('image', 'icon icon--sm')}<strong>${esc(file.name)}</strong><small>${toPersianDigits(Math.ceil(file.size / 1024))} کیلوبایت</small></span>`).join('');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); const data = validate(form); if (!data) return;
    if (data.get('type') !== 'exchange') data.delete('exchangeSize');
    if (!(data.get('images') instanceof File) || !data.get('images').size) data.delete('images');
    const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'در حال ثبت و بارگذاری...';
    // multipart/form-data: تصاویر واقعاً بارگذاری و همه گزینه‌ها در سرور ذخیره می‌شوند
    try { const request = await api.createReturnRequest(data); toast('درخواست شما با موفقیت ثبت شد.'); await render(toast, { success: request }); }
    catch (error) { (error.details || []).forEach(item => showError(form, String(item.path).split('.').pop(), item.message)); toast(error.message, 'error'); button.disabled = false; button.textContent = 'ثبت درخواست'; }
  });
};

// صفحه هم سابقه درخواست‌ها و هم فرم درخواست جدید را نمایش می‌دهد
const render = async (toast, { success = null } = {}) => {
  const root = document.getElementById('return-request-root'); const session = getSession();
  if (!session) { root.innerHTML = authGateTemplate({ title: 'برای ثبت درخواست وارد شوید', message: 'تعویض و مرجوعی فقط برای سفارش‌های ثبت‌شده در حساب مشتری در دسترس است.' }); return; }
  const account = getAccountData();
  let orders; let returns;
  try { [orders, returns] = await Promise.all([api.getOrders(), api.getReturns()]); setOrders(orders); }
  catch (error) { root.innerHTML = error.status === 401 ? authGateTemplate({ title: 'نشست شما منقضی شده است' }) : `<section class="account-auth-gate"><span class="account-auth-gate__icon">${icon('error')}</span><h1>دریافت اطلاعات انجام نشد</h1><p>${esc(error.message)}</p></section>`; return; }
  const eligible = eligibleOrders(orders);
  const params = new URLSearchParams(location.search);
  const form = eligible.length ? formTemplate(eligible, params.get('order'), params.get('product')) : noEligibleTemplate();
  root.innerHTML = layoutTemplate(session, account, `${success ? successTemplate(success) : ''}${historySection(returns)}${newRequestSection(form)}`);
  if (eligible.length) bind(eligible, toast, root, session, account);
  if (success) root.querySelector('.return-success')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else if (location.hash) document.querySelector(location.hash.replace(/[^#a-z-]/g, ''))?.scrollIntoView();
};

export const initReturnRequest = ({ toast }) => { render(toast); document.addEventListener('toto:auth-changed', () => render(toast)); };
