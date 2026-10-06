import { loyaltyLevels } from '../../data/account-data.js';
import { galleryStatusLabel } from '../../data/customer-gallery-data.js';
import { api } from '../services/api.js';
import { getOrders, getSession, hydrateAccountFromServer, updateAccount } from '../core/account-store.js';
import { formatPrice, icon, toPersianDigits, toEnglishDigits, announce, escapeHtml as esc, safeImage, encodeParam } from '../core/utils.js';
import { returnRequestsListTemplate } from '../components/return-requests.js';
import { accountSidebarTemplate, accountMobileNavTemplate, authGateTemplate, statusBadge } from '../components/account-shell.js';

const getLevel = loyalty => loyaltyLevels.find(level => level.id === loyalty.level) || loyaltyLevels[0];
const getNextLevel = loyalty => loyaltyLevels[loyaltyLevels.findIndex(level => level.id === loyalty.level) + 1] || null;
const metricCard = (iconName, value, label, href) => `<a class="account-metric" href="${esc(href)}"><span>${icon(iconName)}</span><strong>${esc(value)}</strong><small>${esc(label)}</small>${icon('chevron-left', 'icon icon--sm')}</a>`;
const mini = (text, link = '') => `<div class="mini-empty"><p>${esc(text)}</p>${link}</div>`;

const orderMiniCard = order => `<article class="account-order-card">
  <div class="account-order-card__head"><div><span dir="auto">سفارش ${esc(order.orderNumber)}</span><small>${esc(order.placedAt)}</small></div>${statusBadge(order.status, order.statusLabel)}</div>
  <div class="account-order-card__images">${order.items.slice(0, 3).map(item => `<img src="${safeImage(item.image)}" alt="${esc(item.name)}" width="64" height="84" loading="lazy">`).join('')}</div>
  <div class="account-order-card__foot"><strong>${formatPrice(order.total)}</strong><a class="inline-link" href="./order-details?id=${encodeParam(order.id)}">جزئیات سفارش</a></div>
</article>`;

const loyaltyTemplate = account => {
  const level = getLevel(account.loyalty); const next = getNextLevel(account.loyalty);
  const progress = next ? Math.min(100, Math.max(0, ((account.loyalty.points - level.min) / (next.min - level.min)) * 100)) : 100;
  const remaining = next ? Math.max(0, next.min - account.loyalty.points) : 0;
  return `<section class="account-panel loyalty-panel" id="loyalty" aria-labelledby="loyalty-title">
    <div class="account-panel__head"><div><p class="eyebrow">باشگاه مشتریان توتو</p><h2 id="loyalty-title">سطح ${esc(level.label)}</h2></div><span class="loyalty-level-badge">${icon('trophy')} ${esc(level.label)}</span></div>
    <div class="loyalty-balance"><div><span>امتیاز قابل استفاده</span><strong>${toPersianDigits(account.loyalty.points)}</strong><small>امتیاز توتو</small></div><div><span>مجموع امتیاز کسب‌شده</span><strong>${toPersianDigits(account.loyalty.lifetimePoints)}</strong><small>از زمان عضویت</small></div></div>
    <div class="loyalty-progress" aria-label="پیشرفت تا سطح بعد"><div><span>${esc(level.label)}</span><span>${esc(next ? next.label : 'بالاترین سطح')}</span></div><div class="progress-track"><span style="--progress:${progress}%"></span></div><p>${next ? `با کسب ${toPersianDigits(remaining)} امتیاز دیگر به سطح ${esc(next.label)} می‌رسید.` : 'شما در بالاترین سطح باشگاه توتو هستید.'}</p></div>
    <details class="account-details"><summary>مشاهده گردش امتیازها ${icon('chevron-left', 'icon icon--sm')}</summary><div class="points-history">${account.loyalty.transactions.length ? account.loyalty.transactions.map(item => `<div><span><strong>${esc(item.title)}</strong><small>${esc(item.date)}</small></span><b class="${item.points >= 0 ? 'is-positive' : 'is-negative'}">${item.points > 0 ? '+' : ''}${toPersianDigits(item.points)}</b></div>`).join('') : mini('هنوز امتیازی ثبت نشده است. با هر خرید پرداخت‌شده امتیاز می‌گیرید.')}</div></details>
  </section>`;
};

const rewardCode = reward => reward.code ? `<button class="reward-code" type="button" data-copy="${esc(reward.code)}" aria-label="کپی کد ${esc(reward.code)}"><code dir="ltr">${esc(reward.code)}</code>${icon('copy', 'icon icon--sm')}</button>` : '';
const rewardsTemplate = account => `<section class="account-panel" id="rewards" aria-labelledby="rewards-title">
  <div class="account-panel__head"><div><p class="eyebrow">پاداش‌ها و تخفیف‌ها</p><h2 id="rewards-title">پاداش‌های قابل استفاده</h2></div></div>
  <div class="reward-grid">${account.rewards.length ? account.rewards.map(reward => `<article class="reward-card"><span class="reward-card__icon">${icon('gift')}</span><div><strong>${esc(reward.title)}</strong><p>${esc(reward.condition)}</p>${reward.expiresAtLabel ? `<small>اعتبار تا ${esc(reward.expiresAtLabel)}</small>` : ''}<small>${esc(reward.source)}</small>${rewardCode(reward)}</div></article>`).join('') : mini('در حال حاضر پاداش یا کد تخفیف فعالی ندارید.')}</div>
</section>`;

const alertsTemplate = account => `<section class="account-panel" id="alerts" aria-labelledby="alerts-title"><div class="account-panel__head"><div><p class="eyebrow">اطلاع‌رسانی محصول</p><h2 id="alerts-title">هشدارهای موجودی</h2></div></div><div class="account-list">${account.availabilityAlerts.length ? account.availabilityAlerts.map(alert => `<div class="availability-row"><img src="${safeImage(alert.image)}" alt="${esc(alert.productName)}" width="62" height="82" loading="lazy"><div><strong>${esc(alert.productName)}</strong><span>${esc(alert.variant)}</span><small>ثبت در ${esc(alert.createdAt)}</small></div><span class="soft-badge">در انتظار موجودی</span><button class="text-button" type="button" data-remove-alert="${esc(alert.id)}">لغو هشدار</button></div>`).join('') : mini('هشدار موجودی فعالی ندارید.', '<a href="./shop">مشاهده محصولات</a>')}</div></section>`;

const profileTemplate = account => `<section class="account-panel" id="profile" aria-labelledby="profile-title">
  <div class="account-panel__head"><div><p class="eyebrow">اطلاعات شخصی</p><h2 id="profile-title">پروفایل من</h2></div><span class="profile-completion">${toPersianDigits(account.profile.completed)}٪ تکمیل</span></div>
  <form class="account-form" id="profile-form" novalidate>
    <div class="form-grid form-grid--2"><label class="field"><span>نام</span><input class="input" name="firstName" maxlength="60" value="${esc(account.profile.firstName)}" autocomplete="given-name" required><small class="field-message"></small></label><label class="field"><span>نام خانوادگی</span><input class="input" name="lastName" maxlength="60" value="${esc(account.profile.lastName)}" autocomplete="family-name" required><small class="field-message"></small></label></div>
    <div class="form-grid form-grid--2"><label class="field"><span>شماره موبایل</span><input class="input" name="mobile" value="${esc(toPersianDigits(account.profile.mobile))}" inputmode="numeric" autocomplete="tel" disabled><small>برای تغییر شماره با پشتیبانی تماس بگیرید.</small></label><label class="field"><span>ایمیل</span><input class="input" type="email" name="email" maxlength="120" value="${esc(account.profile.email)}" autocomplete="email"><small class="field-message"></small></label></div>
    <label class="field"><span>تاریخ تولد</span><input class="input" name="birthday" value="${esc(account.profile.birthday)}" inputmode="numeric" placeholder="۱۳۷۰/۰۱/۰۱"><small class="field-message">برای دریافت هدیه تولد، تاریخ را به شمسی وارد کنید.</small></label>
    <div class="form-actions"><button class="button" type="submit">ذخیره تغییرات</button></div>
  </form>
</section>`;

const NOTIFICATION_KEYS = ['orderSms', 'stockSms', 'campaignSms', 'loyaltySms', 'emailMagazine'];
const notificationTemplate = account => {
  const item = (name, title, detail) => `<label class="preference-row"><span><strong>${title}</strong><small>${detail}</small></span><input class="switch" type="checkbox" name="${name}" ${account.notifications[name] ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span></label>`;
  return `<section class="account-panel" id="notifications" aria-labelledby="notifications-title"><div class="account-panel__head"><div><p class="eyebrow">تنظیمات ارتباطی</p><h2 id="notifications-title">ترجیحات اطلاع‌رسانی</h2></div></div><form id="notification-form" class="preference-list">${item('orderSms', 'پیامک وضعیت سفارش', 'ثبت، ارسال و تحویل سفارش')}${item('stockSms', 'پیامک موجودشدن محصول', 'برای رنگ و سایزهای درخواستی')}${item('campaignSms', 'پیشنهادها و کمپین‌ها', 'تخفیف‌ها و کالکشن‌های منتخب')}${item('loyaltySms', 'باشگاه مشتریان', 'امتیاز، سطح و انقضای پاداش‌ها')}${item('emailMagazine', 'مجله توتو با ایمیل', 'مقاله‌ها و راهنمای استایل')}</form></section>`;
};

// جایزه‌ها، وضعیت امروز و کد پاداش همه از سرور می‌آیند
const wheelTemplate = account => {
  const wheel = account.wheel;
  if (!wheel) return '';
  const today = wheel.today;
  return `<section class="account-panel wheel-panel" id="daily-wheel" aria-labelledby="wheel-title">
    <div class="wheel-copy"><p class="eyebrow">جایزه روزانه</p><h2 id="wheel-title">چرخونه شانس توتو</h2><p>هر روز یک‌بار بچرخانید. جایزه‌های تخفیفی به‌صورت کد شخصی در حساب شما ثبت و در تسویه حساب قابل استفاده‌اند.</p><ul><li>هر حساب در هر روز یک شانس دارد.</li><li>شرایط و تاریخ انقضا بلافاصله پس از دریافت نمایش داده می‌شود.</li></ul><div id="wheel-message" class="wheel-message" aria-live="polite">${today ? wheelResult(today) : wheel.usedToday ? '<span>شانس امروز استفاده شده است.</span>' : '<span>شانس امروز شما آماده است.</span>'}</div><button class="button" type="button" id="spin-wheel" ${wheel.usedToday ? 'disabled' : ''}>${wheel.usedToday ? 'شانس امروز استفاده شده' : 'چرخاندن چرخونه'}</button><p class="wheel-countdown" id="wheel-countdown"></p></div>
    <div class="wheel-stage" aria-hidden="true"><div class="wheel-pointer"></div><div class="reward-wheel" id="reward-wheel">${wheel.prizes.map((reward, index) => `<span style="--i:${index}">${esc(reward.short)}</span>`).join('')}<i>TOTO</i></div></div>
  </section>`;
};
function wheelResult(result) {
  return `<strong>${esc(result.reward.title)}</strong><span>${esc(result.reward.condition)}</span>${result.code ? `<span>کد شما: <button class="reward-code" type="button" data-copy="${esc(result.code)}"><code dir="ltr">${esc(result.code)}</code>${icon('copy', 'icon icon--sm')}</button></span>` : ''}${result.expiresAtLabel && result.reward.type !== 'none' ? `<small>اعتبار تا ${esc(result.expiresAtLabel)}</small>` : ''}`;
}

const addressTemplate = account => `<section class="account-panel" id="addresses" aria-labelledby="address-title"><div class="account-panel__head"><div><p class="eyebrow">نشانی‌های من</p><h2 id="address-title">آدرس‌های ذخیره‌شده</h2></div><a class="inline-link" href="./checkout?address=new">افزودن آدرس</a></div>${account.addresses.length ? account.addresses.map(address => `<div class="saved-address"><span class="saved-address__icon">${icon('location')}</span><div><strong>${esc(address.title || 'آدرس من')}</strong><p>${esc(address.province)}، ${esc(address.city)}، ${esc(address.address)}${address.buildingNumber ? `، پلاک ${esc(address.buildingNumber)}` : ''}${address.unit ? `، واحد ${esc(address.unit)}` : ''}</p><span>${esc(address.firstName)} ${esc(address.lastName)} · ${esc(toPersianDigits(address.mobile || ''))}</span></div><a class="text-button" href="./checkout?edit=${encodeParam(address.id)}">ویرایش</a></div>`).join('') : '<div class="account-empty"><p>هنوز آدرسی در حساب شما ذخیره نشده است.</p><a class="button button--outline" href="./checkout?address=new">افزودن آدرس</a></div>'}</section>`;

const returnsTemplate = account => `<section class="account-panel" id="return-requests" aria-labelledby="return-title"><div class="account-panel__head"><div><p class="eyebrow">خدمات پس از خرید</p><h2 id="return-title">درخواست‌های مرجوعی و تعویض</h2></div><a class="button button--outline button--small" href="./return-request#new-return">ثبت درخواست جدید</a></div>${returnRequestsListTemplate(account.returns.slice(0, 3))}${account.returns.length > 3 ? `<a class="inline-link" href="./return-request#return-history">مشاهده همه ${toPersianDigits(account.returns.length)} درخواست</a>` : ''}</section>`;

const customerGalleryTemplate = account => `<section class="account-panel account-gallery-panel" id="customer-gallery" aria-labelledby="account-gallery-title"><div class="account-panel__head"><div><p class="eyebrow">گالری مشتریان</p><h2 id="account-gallery-title">استایل‌های ارسالی من</h2></div><a class="inline-link" href="./gallery#share-look">ارسال عکس تازه</a></div>${account.gallery.length ? `<div class="account-gallery-list">${account.gallery.slice(0, 3).map(item => `<a href="./gallery?mine=1#my-gallery"><img src="${safeImage(item.image)}" alt="" width="72" height="88"><span><strong>${esc(item.productName)}</strong><small>${esc(item.createdAt)}</small></span><b class="gallery-status gallery-status--${['pending', 'approved', 'rejected'].includes(item.status) ? item.status : 'pending'}">${esc(galleryStatusLabel(item.status))}</b></a>`).join('')}</div>` : mini('هنوز عکسی از استایل خودتان نفرستاده‌اید.', '<a href="./gallery#share-look">اولین عکس را ارسال کنید</a>')}</section>`;

const dashboardTemplate = (session, account, orders) => `<div class="account-page-shell">
  ${accountSidebarTemplate({ active: 'account', session, account })}
  <div class="account-content">
    ${accountMobileNavTemplate('account')}
    <header class="account-welcome"><div><p class="eyebrow">حساب مشتری</p><h1>${esc(account.profile.firstName || 'کاربر توتو')}، خوش آمدید</h1><p>سفارش‌ها، پاداش‌ها و تنظیمات حساب خود را از اینجا مدیریت کنید.</p></div></header>
    <div class="account-metrics">${metricCard('package', toPersianDigits(orders.filter(order => !['cancelled', 'returned', 'payment-failed'].includes(order.status)).length), 'سفارش ثبت‌شده', './orders')}${metricCard('image', toPersianDigits(account.gallery.length), 'عکس ارسالی', './gallery?mine=1')}${metricCard('trophy', toPersianDigits(account.loyalty.points), 'امتیاز توتو', '#loyalty')}${metricCard('gift', toPersianDigits(account.rewards.length), 'پاداش فعال', '#rewards')}</div>
    <section class="account-panel" aria-labelledby="recent-orders-title"><div class="account-panel__head"><div><p class="eyebrow">خریدهای اخیر</p><h2 id="recent-orders-title">سفارش‌های اخیر</h2></div><a class="inline-link" href="./orders">مشاهده همه</a></div>${orders.length ? `<div class="account-order-grid">${orders.slice(0, 2).map(orderMiniCard).join('')}</div>` : mini('هنوز سفارشی ثبت نکرده‌اید.', '<a href="./shop">شروع خرید</a>')}</section>
    ${loyaltyTemplate(account)}
    ${wheelTemplate(account)}
    ${rewardsTemplate(account)}
    ${alertsTemplate(account)}
    ${customerGalleryTemplate(account)}
    ${returnsTemplate(account)}
    ${addressTemplate(account)}
    ${profileTemplate(account)}
    ${notificationTemplate(account)}
  </div>
</div>`;

const updateWheelCountdown = nextSpinAt => {
  const output = document.getElementById('wheel-countdown'); const button = document.getElementById('spin-wheel');
  if (!output) return;
  if (!button?.disabled) { output.textContent = 'یک شانس برای امروز دارید.'; return; }
  const remaining = Math.max(0, new Date(nextSpinAt).getTime() - Date.now());
  output.textContent = `شانس بعدی تا ${toPersianDigits(Math.floor(remaining / 3600000))} ساعت و ${toPersianDigits(Math.floor((remaining % 3600000) / 60000))} دقیقه دیگر`;
};

const bindWheel = (account, toast, rerender) => {
  const button = document.getElementById('spin-wheel'); const wheelElement = document.getElementById('reward-wheel');
  if (!button) return;
  let nextSpinAt = account.wheel.nextSpinAt;
  updateWheelCountdown(nextSpinAt);
  const timer = setInterval(() => { if (!document.body.contains(button)) return clearInterval(timer); updateWheelCountdown(nextSpinAt); }, 60000);
  button.addEventListener('click', async () => {
    button.disabled = true; button.textContent = 'در حال تعیین جایزه...';
    try {
      const result = await api.spinWheel();
      const prizes = account.wheel.prizes; const rewardIndex = Math.max(0, prizes.findIndex(reward => reward.id === result.reward.id));
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      wheelElement?.style.setProperty('--wheel-turn', `${(reduced ? 0 : 5 * 360) + (360 - rewardIndex * (360 / prizes.length))}deg`);
      wheelElement?.classList.add('is-spinning');
      await new Promise(resolve => setTimeout(resolve, reduced ? 60 : 1500));
      const message = document.getElementById('wheel-message'); message.innerHTML = wheelResult(result); message.classList.add('is-won');
      button.textContent = 'شانس امروز استفاده شده'; nextSpinAt = result.nextSpinAt; updateWheelCountdown(nextSpinAt);
      announce(`جایزه شما: ${result.reward.title}`);
      toast(result.reward.type === 'none' ? 'امروز جایزه‌ای ثبت نشد؛ فردا دوباره امتحان کنید.' : `${result.reward.title} به حساب شما اضافه شد.`, result.reward.type === 'none' ? 'info' : 'success');
      bindCopy(toast, message);
      setTimeout(rerender, 2500);
    } catch (error) {
      if (error.status === 429) { button.textContent = 'شانس امروز استفاده شده'; } else { button.disabled = false; button.textContent = 'تلاش دوباره'; }
      toast(error.message, 'error');
    }
  });
};

const bindProfile = toast => {
  document.getElementById('profile-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget; const button = form.querySelector('button[type="submit"]');
    const values = Object.fromEntries(new FormData(form));
    form.querySelectorAll('.field-message').forEach(node => node.classList.remove('field-message--error'));
    const fail = (name, message) => { const field = form.elements[name]; const node = field.closest('.field').querySelector('.field-message'); node.textContent = message; node.classList.add('field-message--error'); field.focus(); };
    if (!values.firstName.trim()) return fail('firstName', 'این فیلد را کامل کنید.');
    if (!values.lastName.trim()) return fail('lastName', 'این فیلد را کامل کنید.');
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return fail('email', 'ایمیل را به‌صورت صحیح وارد کنید.');
    button.disabled = true; button.textContent = 'در حال ذخیره...';
    try {
      const saved = await api.saveProfile({ firstName: values.firstName.trim(), lastName: values.lastName.trim(), email: values.email.trim(), birthday: toEnglishDigits(values.birthday).trim() });
      const completed = saved.email && saved.birthday && saved.firstName ? 100 : 70;
      updateAccount(account => { account.profile = { ...account.profile, ...saved, completed }; return account; });
      document.querySelector('.profile-completion').textContent = `${toPersianDigits(completed)}٪ تکمیل`;
      toast('اطلاعات پروفایل ذخیره شد.');
    } catch (error) { (error.details || []).forEach(item => { const name = String(item.path).split('.').pop(); if (form.elements[name]) fail(name, item.message); }); toast(error.message, 'error'); }
    finally { button.disabled = false; button.textContent = 'ذخیره تغییرات'; }
  });
};

// هر پنج گزینه به سرور ارسال و پاسخ سرور جایگزین وضعیت فرم می‌شود
const bindNotifications = toast => {
  const form = document.getElementById('notification-form');
  form?.addEventListener('change', async event => {
    const preferences = Object.fromEntries(NOTIFICATION_KEYS.map(key => [key, Boolean(form.elements[key]?.checked)]));
    form.querySelectorAll('input').forEach(input => { input.disabled = true; });
    try {
      const saved = await api.saveNotificationPreferences(preferences);
      NOTIFICATION_KEYS.forEach(key => { if (form.elements[key]) form.elements[key].checked = Boolean(saved[key]); });
      updateAccount(account => { account.notifications = saved; return account; });
      toast('تنظیمات اطلاع‌رسانی ذخیره شد.');
    } catch (error) { event.target.checked = !event.target.checked; toast(error.message, 'error'); }
    finally { form.querySelectorAll('input').forEach(input => { input.disabled = false; }); }
  });
};

function bindCopy(toast, scope = document) {
  scope.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(button.dataset.copy); toast('کد کپی شد.'); }
    catch { toast(`کد: ${button.dataset.copy}`, 'info'); }
  }));
}
const bindAccountActions = toast => {
  bindCopy(toast, document.getElementById('rewards') || document);
  bindCopy(toast, document.getElementById('wheel-message') || document);
  document.querySelectorAll('[data-remove-alert]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try { await api.cancelStockAlert(button.dataset.removeAlert); updateAccount(account => { account.availabilityAlerts = account.availabilityAlerts.filter(item => item.id !== button.dataset.removeAlert); return account; }); button.closest('.availability-row')?.remove(); toast('هشدار موجودی لغو شد.', 'info'); }
    catch (error) { button.disabled = false; toast(error.message, 'error'); }
  }));
};

const render = async toast => {
  const root = document.getElementById('account-page-root');
  const session = getSession();
  if (!session) { root.innerHTML = authGateTemplate(); return; }
  root.innerHTML = '<div class="account-loading" aria-label="در حال دریافت اطلاعات حساب"><span class="skeleton skeleton--line"></span><span class="skeleton skeleton--box"></span><span class="skeleton skeleton--box"></span></div>';
  try {
    const overview = await api.getAccountOverview();
    const account = hydrateAccountFromServer(overview);
    root.innerHTML = dashboardTemplate(session, account, getOrders());
    if (account.wheel) bindWheel(account, toast, () => render(toast));
    bindProfile(toast); bindNotifications(toast); bindAccountActions(toast);
    if (location.hash) document.querySelector(location.hash.replace(/[^#a-z-]/g, ''))?.scrollIntoView();
  } catch (error) {
    if (error.status === 401) { root.innerHTML = authGateTemplate({ title: 'نشست شما منقضی شده است', message: 'برای مشاهده حساب دوباره وارد شوید.' }); return; }
    root.innerHTML = `<section class="account-auth-gate"><span class="account-auth-gate__icon">${icon('error')}</span><h1>دریافت اطلاعات حساب انجام نشد</h1><p>${esc(error.message || 'ارتباط با سرور برقرار نشد.')}</p><button class="button" type="button" data-retry-account>تلاش دوباره</button></section>`;
    document.querySelector('[data-retry-account]')?.addEventListener('click', () => render(toast));
  }
};

export const initAccount = ({ toast }) => {
  render(toast);
  document.addEventListener('toto:auth-changed', () => render(toast));
};
