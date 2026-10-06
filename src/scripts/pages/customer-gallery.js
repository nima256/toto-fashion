import { products } from '../../data/mock-data.js';
import { galleryStatusLabel } from '../../data/customer-gallery-data.js';
import { getSession } from '../core/account-store.js';
import { api } from '../services/api.js';
import { icon, toPersianDigits, escapeHtml as esc, safeImage } from '../core/utils.js';

const MAX_SIZE = 8 * 1024 * 1024; const MAX_FILES = 6; const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// هر تصویر تأییدشده یک کارت در گالری عمومی است
const galleryCards = post => post.images.map((image, index) => `<article class="customer-gallery-card"><img src="${safeImage(image.url)}" alt="${esc(post.productName)} به انتخاب ${esc(post.customerName)}${post.images.length > 1 ? ` (تصویر ${toPersianDigits(index + 1)})` : ''}" width="900" height="1100" loading="lazy"><div><span>${icon('user', 'icon icon--sm')} ${esc(post.customerName)}</span><h3>${esc(post.productName)}</h3><p>${esc(post.caption)}</p><small>${esc(post.createdAt)}</small></div></article>`).join('');
const statusClass = status => (['pending', 'approved', 'rejected'].includes(status) ? status : 'pending');
const myUploadsTemplate = uploads => `<section class="gallery-my-uploads" id="my-gallery" aria-labelledby="my-gallery-title"><div class="section-heading"><div><p class="eyebrow">حساب مشتری</p><h2 id="my-gallery-title">عکس‌های ارسالی من</h2><p>وضعیت بررسی هر عکس به‌صورت جداگانه نمایش داده می‌شود.</p></div></div>${uploads.length ? `<div class="gallery-submission-list">${uploads.map(item => `<article class="gallery-submission"><div class="gallery-submission__head"><div><strong>${esc(item.productName)}</strong><span>${esc(item.createdAt)} · ${toPersianDigits(item.images.length)} عکس</span><p>${esc(item.caption)}</p></div>${item.status !== 'approved' ? `<button class="text-button" type="button" data-delete-gallery="${esc(item.id)}">${icon('trash', 'icon icon--sm')} حذف ارسال</button>` : ''}</div><div class="gallery-submission__images">${item.images.map(image => `<figure><img src="${safeImage(image.url)}" alt="" width="90" height="110" loading="lazy"><figcaption class="gallery-status gallery-status--${statusClass(image.status)}">${esc(galleryStatusLabel(image.status))}</figcaption>${image.status === 'rejected' && image.rejectionReason ? `<small>${esc(image.rejectionReason)}</small>` : ''}</figure>`).join('')}</div></article>`).join('')}</div>` : '<div class="mini-empty"><p>هنوز عکسی برای گالری نفرستاده‌اید.</p></div>'}</section>`;

const shareTemplate = session => session ? `<form class="gallery-upload-form" id="gallery-upload-form" novalidate><div class="form-grid form-grid--2"><label class="field"><span>نام نمایشی</span><input class="input" name="customerName" maxlength="32" required value="${esc(session.customer.firstName === 'کاربر توتو' ? '' : session.customer.firstName || '')}"><small class="field-message"></small></label><label class="field"><span>محصول توتو</span><select class="input" name="productId" required><option value="">انتخاب محصول</option>${products.map(product => `<option value="${esc(product.id)}">${esc(product.name)}</option>`).join('')}</select><small class="field-message"></small></label></div><label class="field"><span>داستان کوتاه استایل</span><textarea class="input" name="caption" rows="4" maxlength="220" placeholder="مثلاً این مانتو را برای یک روز کاری با شلوار روشن ست کردم..." required></textarea><small class="field-message"></small></label><label class="gallery-file-field" for="gallery-image"><span>${icon('image', 'icon icon--lg')}<strong>انتخاب عکس‌ها</strong><small>تا ${toPersianDigits(MAX_FILES)} عکس JPG، PNG یا WebP؛ هر عکس حداکثر ۸ مگابایت</small></span><input id="gallery-image" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><div class="gallery-preview-grid" id="gallery-preview" aria-live="polite"></div><label class="gallery-consent"><input type="checkbox" name="consent" required><span>اجازه می‌دهم این عکس با نام نمایشی من در گالری توتو منتشر شود.</span></label><div class="field-message field-message--error" id="gallery-form-error"></div><button class="button button--block" type="submit">ارسال برای بررسی</button></form>`
  : `<div class="account-auth-gate"><span class="account-auth-gate__icon">${icon('user')}</span><h3>برای ارسال عکس وارد حساب شوید</h3><p>عکس‌ها پس از بررسی تیم محتوا منتشر می‌شوند و وضعیت آن را در حساب خود می‌بینید.</p><button class="button" type="button" data-action="open-login">ورود با شماره موبایل</button></div>`;

export const initCustomerGallery = ({ toast }) => {
  const root = document.getElementById('customer-gallery-root'); if (!root) return;
  let selected = [];
  const render = async () => {
    const session = getSession();
    let approved = []; let mine = []; let loadError = '';
    try { [approved, mine] = await Promise.all([api.getGallery(), session ? api.getMyGallery() : Promise.resolve([])]); }
    catch (error) { loadError = error.message; }
    root.innerHTML = `<section class="gallery-hero"><div><p class="eyebrow">توتو به سبک شما</p><h1>گالری مشتریان</h1><p>استایل واقعی مشتریان توتو؛ عکس خودتان را هم بفرستید تا بعد از بررسی در این گالری منتشر شود.</p><a class="button" href="#share-look">ارسال عکس من</a></div><div class="gallery-hero__collage">${approved.flatMap(post => post.images).slice(0, 3).map(image => `<img src="${safeImage(image.url)}" alt="" width="500" height="620">`).join('')}</div></section><section class="section gallery-showcase" aria-labelledby="gallery-showcase-title"><div class="section-heading"><div><p class="eyebrow">انتخاب‌های واقعی</p><h2 id="gallery-showcase-title">شما چطور توتو را می‌پوشید؟</h2></div><span class="soft-badge">${toPersianDigits(approved.reduce((n, post) => n + post.images.length, 0))} عکس منتشرشده</span></div>${loadError ? `<div class="page-notice page-notice--error">${icon('error')}<div><strong>دریافت گالری انجام نشد</strong><p>${esc(loadError)}</p></div></div>` : approved.length ? `<div class="customer-gallery-grid">${approved.map(galleryCards).join('')}</div>` : '<div class="mini-empty"><p>هنوز عکسی در گالری منتشر نشده است؛ اولین نفر باشید.</p></div>'}</section><section class="section gallery-share" id="share-look" aria-labelledby="share-look-title"><div class="gallery-share__intro"><p class="eyebrow">سهم شما در گالری</p><h2 id="share-look-title">عکس استایلتان را بفرستید</h2><p>یک عکس روشن و واضح انتخاب کنید، محصول توتو را مشخص کنید و چند کلمه دربارهٔ استایلتان بنویسید.</p><ul><li>تا ${toPersianDigits(MAX_FILES)} عکس در هر ارسال، هر کدام حداکثر ۸ مگابایت</li><li>فرمت JPG، PNG یا WebP</li><li>انتشار فقط پس از تأیید تیم محتوا</li></ul></div>${shareTemplate(session)}</section>${session ? myUploadsTemplate(mine) : ''}`;
    bind();
  };
  // فهرست عکس‌های انتخاب‌شده با پیش‌نمایش و امکان حذف تکی پیش از ارسال
  const renderPreviews = () => {
    const grid = document.getElementById('gallery-preview'); if (!grid) return;
    grid.innerHTML = selected.map((item, index) => `<figure><img src="${esc(item.url)}" alt="پیش‌نمایش عکس ${toPersianDigits(index + 1)}"><figcaption>${esc(item.file.name)}</figcaption><button class="icon-button" type="button" data-remove-preview="${index}" aria-label="حذف عکس ${toPersianDigits(index + 1)}">${icon('close', 'icon icon--sm')}</button></figure>`).join('');
  };
  const clearSelected = () => { selected.forEach(item => URL.revokeObjectURL(item.url)); selected = []; };
  const bind = () => {
    const form = document.getElementById('gallery-upload-form'); const fileInput = document.getElementById('gallery-image');
    fileInput?.addEventListener('change', () => {
      const error = document.getElementById('gallery-form-error'); error.textContent = ''; const problems = [];
      for (const file of [...fileInput.files]) {
        if (selected.length >= MAX_FILES) { problems.push(`حداکثر ${toPersianDigits(MAX_FILES)} عکس در هر ارسال مجاز است.`); break; }
        if (!TYPES.includes(file.type)) { problems.push(`«${file.name}» فرمت مجاز (JPG، PNG یا WebP) ندارد.`); continue; }
        if (file.size > MAX_SIZE) { problems.push(`حجم «${file.name}» بیشتر از ۸ مگابایت است.`); continue; }
        if (selected.some(item => item.file.name === file.name && item.file.size === file.size)) continue;
        selected.push({ file, url: URL.createObjectURL(file) });
      }
      fileInput.value = ''; error.textContent = problems.join(' '); renderPreviews();
    });
    document.getElementById('gallery-preview')?.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-preview]'); if (!button) return;
      const [removed] = selected.splice(Number(button.dataset.removePreview), 1); if (removed) URL.revokeObjectURL(removed.url); renderPreviews();
    });
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(form); const error = document.getElementById('gallery-form-error'); error.textContent = '';
      if (!String(data.get('customerName') || '').trim() || !data.get('productId') || String(data.get('caption') || '').trim().length < 5) { error.textContent = 'نام، محصول و توضیح استایل را کامل کنید.'; return; }
      if (!selected.length) { error.textContent = 'لطفاً دست‌کم یک عکس انتخاب کنید.'; return; }
      if (!form.elements.consent.checked) { error.textContent = 'برای ارسال عکس، اجازهٔ انتشار را تأیید کنید.'; return; }
      selected.forEach(item => data.append('images', item.file, item.file.name));
      const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = `در حال بارگذاری ${toPersianDigits(selected.length)} عکس...`;
      try { await api.submitGallery(data); clearSelected(); toast('عکس‌های شما ثبت شد و پس از بررسی در گالری نمایش داده می‌شوند.'); await render(); document.getElementById('my-gallery')?.scrollIntoView({ behavior: 'smooth' }); }
      catch (submitError) { error.textContent = submitError.details?.[0]?.message || submitError.message; button.disabled = false; button.textContent = 'ارسال برای بررسی'; }
    });
    root.querySelectorAll('[data-delete-gallery]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try { await api.deleteGallery(button.dataset.deleteGallery); toast('ارسال شما حذف شد.', 'info'); render(); }
      catch (error) { toast(error.message, 'error'); button.disabled = false; }
    }));
  };
  render().then(() => { if (new URLSearchParams(location.search).get('mine') === '1') requestAnimationFrame(() => document.getElementById('my-gallery')?.scrollIntoView()); });
  document.addEventListener('toto:auth-changed', render);
};
