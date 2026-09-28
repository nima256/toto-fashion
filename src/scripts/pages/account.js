import { loyaltyLevels, wheelRewards } from '../../data/account-data.js';
import { api } from '../services/api.js';
import { getAccountData, getOrders, getSession, ensureDemoSession, hydrateAccountFromServer, updateAccount } from '../core/account-store.js';
import { localStore } from '../core/storage.js';
import { formatPrice, icon, toEnglishDigits, toPersianDigits, announce } from '../core/utils.js';
import { accountSidebarTemplate, accountMobileNavTemplate, authGateTemplate, statusBadge } from '../components/account-shell.js';

const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
const addDays = (date, days) => { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; };
const formatPersianDate = date => new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);

const getLevel = loyalty => loyaltyLevels.find(level => level.id === loyalty.level) || loyaltyLevels[0];
const getNextLevel = loyalty => {
  const index = loyaltyLevels.findIndex(level => level.id === loyalty.level);
  return loyaltyLevels[index + 1] || null;
};

const metricCard = (iconName, value, label, href) => `<a class="account-metric" href="${href}"><span>${icon(iconName)}</span><strong>${value}</strong><small>${label}</small>${icon('chevron-left', 'icon icon--sm')}</a>`;

const orderMiniCard = order => `<article class="account-order-card">
  <div class="account-order-card__head"><div><span>سفارش ${order.orderNumber}</span><small>${order.placedAt}</small></div>${statusBadge(order.status, order.statusLabel)}</div>
  <div class="account-order-card__images">${order.items.slice(0, 3).map(item => `<img src="${item.image}" alt="${item.name}" width="64" height="84" loading="lazy">`).join('')}</div>
  <div class="account-order-card__foot"><strong>${formatPrice(order.total)}</strong><a class="inline-link" href="./order-details?id=${encodeURIComponent(order.id)}">جزئیات سفارش</a></div>
</article>`;

const loyaltyTemplate = account => {
  const level = getLevel(account.loyalty);
  const next = getNextLevel(account.loyalty);
  const start = level.min;
  const end = next?.min || account.loyalty.points;
  const progress = next ? Math.min(100, Math.max(0, ((account.loyalty.points - start) / (end - start)) * 100)) : 100;
  const remaining = next ? Math.max(0, next.min - account.loyalty.points) : 0;
  return `<section class="account-panel loyalty-panel" id="loyalty" aria-labelledby="loyalty-title">
    <div class="account-panel__head"><div><p class="eyebrow">باشگاه مشتریان توتو</p><h2 id="loyalty-title">سطح ${level.label}</h2></div><span class="loyalty-level-badge">${icon('trophy')} ${level.label}</span></div>
    <div class="loyalty-balance"><div><span>امتیاز قابل استفاده</span><strong>${toPersianDigits(account.loyalty.points)}</strong><small>امتیاز توتو</small></div><div><span>مجموع امتیاز کسب‌شده</span><strong>${toPersianDigits(account.loyalty.lifetimePoints)}</strong><small>از زمان عضویت</small></div></div>
    <div class="loyalty-progress" aria-label="پیشرفت تا سطح بعد"><div><span>${level.label}</span><span>${next ? next.label : 'بالاترین سطح'}</span></div><div class="progress-track"><span style="--progress:${progress}%"></span></div><p>${next ? `با کسب ${toPersianDigits(remaining)} امتیاز دیگر به سطح ${next.label} می‌رسید.` : 'شما در بالاترین سطح باشگاه توتو هستید.'}</p></div>
    <div class="loyalty-expiry">${icon('clock')}<div><strong>${toPersianDigits(account.loyalty.expiringPoints)} امتیاز در آستانه انقضا</strong><span>مهلت استفاده تا ${account.loyalty.expiryDate}</span></div></div>
    <details class="account-details"><summary>مشاهده گردش امتیازها ${icon('chevron-left', 'icon icon--sm')}</summary><div class="points-history">${account.loyalty.transactions.map(item => `<div><span><strong>${item.title}</strong><small>${item.date}</small></span><b class="${item.type === 'earn' ? 'is-positive' : 'is-negative'}">${item.points > 0 ? '+' : ''}${toPersianDigits(item.points)}</b></div>`).join('')}</div></details>
  </section>`;
};

const rewardCode = reward => reward.code ? `<button class="reward-code" type="button" data-copy="${reward.code}" aria-label="کپی کد ${reward.code}"><code>${reward.code}</code>${icon('copy', 'icon icon--sm')}</button>` : '';

const rewardsTemplate = account => `<section class="account-panel" id="rewards" aria-labelledby="rewards-title">
  <div class="account-panel__head"><div><p class="eyebrow">پاداش‌ها و تخفیف‌ها</p><h2 id="rewards-title">پاداش‌های قابل استفاده</h2></div></div>
  <div class="reward-grid">
    ${[...account.rewards, ...account.discounts].map(reward => `<article class="reward-card"><span class="reward-card__icon">${icon(reward.source ? 'gift' : 'wallet')}</span><div><strong>${reward.title}</strong><p>${reward.condition}</p><small>اعتبار تا ${reward.expiresAt}</small>${rewardCode(reward)}</div></article>`).join('') || '<div class="mini-empty"><p>در حال حاضر پاداش فعالی ندارید.</p></div>'}
  </div>
</section>`;

const alertsTemplate = account => `<section class="account-panel" id="alerts" aria-labelledby="alerts-title"><div class="account-panel__head"><div><p class="eyebrow">اطلاع‌رسانی محصول</p><h2 id="alerts-title">هشدارهای موجودی</h2></div></div><div class="account-list">${account.availabilityAlerts.map(alert => `<div class="availability-row"><img src="${alert.image}" alt="${alert.productName}" width="62" height="82" loading="lazy"><div><strong>${alert.productName}</strong><span>${alert.variant}</span><small>ثبت در ${alert.createdAt}</small></div><span class="soft-badge">در انتظار موجودی</span><button class="text-button" type="button" data-remove-alert="${alert.id}">لغو هشدار</button></div>`).join('') || '<div class="mini-empty"><p>هشدار موجودی فعالی ندارید.</p><a href="./shop">مشاهده محصولات</a></div>'}</div></section>`;

const profileTemplate = account => `<section class="account-panel" id="profile" aria-labelledby="profile-title">
  <div class="account-panel__head"><div><p class="eyebrow">اطلاعات شخصی</p><h2 id="profile-title">پروفایل من</h2></div><span class="profile-completion">${toPersianDigits(account.profile.completed)}٪ تکمیل</span></div>
  <form class="account-form" id="profile-form" novalidate>
    <div class="form-grid form-grid--2"><label class="field"><span>نام</span><input class="input" name="firstName" value="${account.profile.firstName}" autocomplete="given-name" required><small class="field-message"></small></label><label class="field"><span>نام خانوادگی</span><input class="input" name="lastName" value="${account.profile.lastName}" autocomplete="family-name" required><small class="field-message"></small></label></div>
    <div class="form-grid form-grid--2"><label class="field"><span>شماره موبایل</span><input class="input" name="mobile" value="${toPersianDigits(account.profile.mobile)}" inputmode="numeric" autocomplete="tel" disabled><small>برای تغییر شماره با پشتیبانی تماس بگیرید.</small></label><label class="field"><span>ایمیل</span><input class="input" type="email" name="email" value="${account.profile.email}" autocomplete="email"><small class="field-message"></small></label></div>
    <label class="field"><span>تاریخ تولد</span><input class="input" name="birthday" value="${account.profile.birthday}" inputmode="numeric" placeholder="۱۳۷۰/۰۱/۰۱"><small>برای دریافت هدیه تولد، تاریخ را به شمسی وارد کنید.</small></label>
    <div class="form-actions"><button class="button" type="submit">ذخیره تغییرات</button></div>
  </form>
</section>`;

const notificationTemplate = account => {
  const item = (name, title, detail) => `<label class="preference-row"><span><strong>${title}</strong><small>${detail}</small></span><input class="switch" type="checkbox" name="${name}" ${account.notifications[name] ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span></label>`;
  return `<section class="account-panel" id="notifications" aria-labelledby="notifications-title"><div class="account-panel__head"><div><p class="eyebrow">تنظیمات ارتباطی</p><h2 id="notifications-title">ترجیحات اطلاع‌رسانی</h2></div></div><form id="notification-form" class="preference-list">${item('orderSms','پیامک وضعیت سفارش','ثبت، ارسال و تحویل سفارش')}${item('stockSms','پیامک موجودشدن محصول','برای رنگ و سایزهای درخواستی')}${item('campaignSms','پیشنهادها و کمپین‌ها','تخفیف‌ها و کالکشن‌های منتخب')}${item('loyaltySms','باشگاه مشتریان','امتیاز، سطح و انقضای پاداش‌ها')}${item('emailMagazine','مجله توتو با ایمیل','مقاله‌ها و راهنمای استایل')}</form></section>`;
};

const wheelTemplate = (session, account) => {
  const state = localStore.get('toto-wheel-state', {});
  const record = state[session.customer.mobile];
  const usedToday = record?.date === todayKey();
  return `<section class="account-panel wheel-panel" id="daily-wheel" aria-labelledby="wheel-title">
    <div class="wheel-copy"><p class="eyebrow">جایزه روزانه</p><h2 id="wheel-title">چرخونه شانس توتو</h2><p>هر روز یک‌بار بچرخانید. جایزه معتبر مستقیماً به حساب شما افزوده می‌شود.</p><ul><li>هر حساب در هر روز یک شانس دارد.</li><li>شرایط و تاریخ انقضا بلافاصله پس از دریافت نمایش داده می‌شود.</li></ul><div id="wheel-message" class="wheel-message" aria-live="polite">${usedToday ? `<strong>${record.reward.title}</strong><span>${record.reward.condition}</span>` : '<span>شانس امروز شما آماده است.</span>'}</div><button class="button" type="button" id="spin-wheel" ${usedToday ? 'disabled' : ''}>${usedToday ? 'شانس امروز استفاده شده' : 'چرخاندن چرخونه'}</button><p class="wheel-countdown" id="wheel-countdown"></p></div>
    <div class="wheel-stage" aria-hidden="true"><div class="wheel-pointer"></div><div class="reward-wheel" id="reward-wheel">${wheelRewards.map((reward,index) => `<span style="--i:${index}">${reward.short}</span>`).join('')}<i>TOTO</i></div></div>
  </section>`;
};

const addressTemplate = account => `<section class="account-panel" id="addresses" aria-labelledby="address-title"><div class="account-panel__head"><div><p class="eyebrow">نشانی‌های من</p><h2 id="address-title">آدرس‌های ذخیره‌شده</h2></div><a class="inline-link" href="./checkout?address=new">افزودن آدرس</a></div>${(account.addresses||[]).length?(account.addresses||[]).map(address=>`<div class="saved-address"><span class="saved-address__icon">${icon('location')}</span><div><strong>${address.title||'آدرس من'}</strong><p>${address.province}، ${address.city}، ${address.address}${address.buildingNumber?`، پلاک ${address.buildingNumber}`:''}${address.unit?`، واحد ${address.unit}`:''}</p><span>${address.firstName} ${address.lastName} · ${toPersianDigits(address.mobile||'')}</span></div><a class="text-button" href="./checkout?edit=${encodeURIComponent(address.id)}">ویرایش</a></div>`).join(''):`<div class="account-empty"><p>هنوز آدرسی در حساب شما ذخیره نشده است.</p><a class="button button--outline" href="./checkout?address=new">افزودن آدرس</a></div>`}</section>`;

const returnsTemplate = account => `<section class="account-panel" id="return-requests" aria-labelledby="return-title"><div class="account-panel__head"><div><p class="eyebrow">خدمات پس از خرید</p><h2 id="return-title">درخواست‌های مرجوعی و تعویض</h2></div><a class="inline-link" href="./return-request">درخواست جدید</a></div><div class="account-list">${account.returns.map(item => `<a class="return-row" href="./order-details?id=${item.orderId}"><span>${icon('refresh')}</span><div><strong>${item.productName}</strong><small>${item.type} · سفارش ${item.orderNumber} · ${item.createdAt}</small></div><b>${item.statusLabel}</b>${icon('chevron-left','icon icon--sm')}</a>`).join('') || '<div class="mini-empty"><p>درخواستی ثبت نشده است.</p></div>'}</div></section>`;

const customerGalleryTemplate=()=>{const uploads=localStore.get('toto-customer-gallery',[]),status=value=>({pending:'در انتظار تأیید',approved:'منتشرشده',rejected:'نیازمند ویرایش'}[value]||value);return `<section class="account-panel account-gallery-panel" id="customer-gallery" aria-labelledby="account-gallery-title"><div class="account-panel__head"><div><p class="eyebrow">گالری مشتریان</p><h2 id="account-gallery-title">استایل‌های ارسالی من</h2></div><a class="inline-link" href="./gallery#share-look">ارسال عکس تازه</a></div>${uploads.length?`<div class="account-gallery-list">${uploads.slice(0,3).map(item=>`<a href="./gallery?mine=1#my-gallery"><img src="${item.image}" alt="" width="72" height="88"><span><strong>${item.productName}</strong><small>${item.createdAt}</small></span><b class="gallery-status gallery-status--${item.status}">${status(item.status)}</b></a>`).join('')}</div>`:`<div class="mini-empty"><p>هنوز عکسی از استایل خودتان نفرستاده‌اید.</p><a href="./gallery#share-look">اولین عکس را ارسال کنید</a></div>`}</section>`;};

const dashboardTemplate = (session, account, orders) => `<div class="account-page-shell">
  ${accountSidebarTemplate({ active: 'account', session, account })}
  <div class="account-content">
    ${accountMobileNavTemplate('account')}
    <header class="account-welcome"><div><p class="eyebrow">حساب مشتری</p><h1>${account.profile.firstName}، خوش آمدید</h1><p>سفارش‌ها، پاداش‌ها و تنظیمات حساب خود را از اینجا مدیریت کنید.</p></div><span>آخرین ورود: امروز</span></header>
    <div class="account-metrics">${metricCard('package',toPersianDigits(orders.filter(order => !['cancelled','returned'].includes(order.status)).length),'سفارش ثبت‌شده','./orders')}${metricCard('image',toPersianDigits(localStore.get('toto-customer-gallery',[]).length),'عکس ارسالی','./gallery?mine=1')}${metricCard('trophy',toPersianDigits(account.loyalty.points),'امتیاز توتو','#loyalty')}${metricCard('gift',toPersianDigits(account.rewards.length + account.discounts.length),'پاداش فعال','#rewards')}</div>
    <section class="account-panel" aria-labelledby="recent-orders-title"><div class="account-panel__head"><div><p class="eyebrow">خریدهای اخیر</p><h2 id="recent-orders-title">سفارش‌های اخیر</h2></div><a class="inline-link" href="./orders">مشاهده همه</a></div><div class="account-order-grid">${orders.slice(0,2).map(orderMiniCard).join('')}</div></section>
    ${loyaltyTemplate(account)}
    ${wheelTemplate(session, account)}
    ${rewardsTemplate(account)}
    ${alertsTemplate(account)}
    ${customerGalleryTemplate()}
    ${returnsTemplate(account)}
    ${addressTemplate(account)}
    ${profileTemplate(account)}
    ${notificationTemplate(account)}
  </div>
</div>`;

const updateWheelCountdown = session => {
  const output = document.getElementById('wheel-countdown');
  if (!output) return;
  const state = localStore.get('toto-wheel-state', {});
  const usedToday = state[session.customer.mobile]?.date === todayKey();
  if (!usedToday) { output.textContent = 'یک شانس برای امروز دارید.'; return; }
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setHours(24, 0, 0, 0);
  const remaining = Math.max(0, tomorrow - now);
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  output.textContent = `شانس بعدی تا ${toPersianDigits(hours)} ساعت و ${toPersianDigits(minutes)} دقیقه دیگر`;
};

const saveWheelReward = (session, result) => {
  const store = localStore.get('toto-wheel-state', {});
  store[session.customer.mobile] = { date: todayKey(), reward: result.reward, claimId: result.claimId, issuedAt: result.issuedAt };
  localStore.set('toto-wheel-state', store);
  if (result.reward.type === 'none') return;
  updateAccount(account => {
    if (result.reward.type === 'points') account.loyalty.points += result.reward.value;
    account.rewards.unshift({
      id: result.claimId,
      title: result.reward.title,
      source: 'چرخونه شانس روزانه',
      code: result.reward.type === 'points' || result.reward.type === 'multiplier' ? '' : `WHEEL-${String(result.claimId).slice(-5).toUpperCase()}`,
      expiresAt: formatPersianDate(addDays(new Date(), result.reward.expiresInDays)),
      condition: result.reward.condition,
      status: 'active'
    });
    return account;
  });
};

const bindWheel = (session, toast) => {
  const button = document.getElementById('spin-wheel');
  const wheel = document.getElementById('reward-wheel');
  updateWheelCountdown(session);
  const timer = setInterval(() => { if (!document.body.contains(button)) return clearInterval(timer); updateWheelCountdown(session); }, 60000);
  button?.addEventListener('click', async () => {
    button.disabled = true; button.textContent = 'در حال تعیین جایزه...';
    try {
      const result = await api.spinWheel(session.customer.mobile);
      const rewardIndex = wheelRewards.findIndex(reward => reward.id === result.reward.id);
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      wheel?.style.setProperty('--wheel-turn', `${(reduced ? 0 : 5 * 360) + (360 - rewardIndex * (360 / wheelRewards.length))}deg`);
      wheel?.classList.add('is-spinning');
      await new Promise(resolve => setTimeout(resolve, reduced ? 60 : 1500));
      saveWheelReward(session, result);
      const message = document.getElementById('wheel-message');
      message.innerHTML = `<strong>${result.reward.title}</strong><span>${result.reward.condition}</span>`;
      message.classList.add('is-won');
      button.textContent = 'شانس امروز استفاده شده';
      updateWheelCountdown(session);
      announce(`جایزه شما: ${result.reward.title}`);
      toast(result.reward.type === 'none' ? 'امروز جایزه‌ای ثبت نشد؛ فردا دوباره امتحان کنید.' : `${result.reward.title} به حساب شما اضافه شد.`, result.reward.type === 'none' ? 'info' : 'success');
    } catch (error) {
      button.disabled = false; button.textContent = 'تلاش دوباره';
      toast(error.message, 'error');
    }
  });
};

const bindProfile = toast => {
  document.getElementById('profile-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget; const button = form.querySelector('button[type="submit"]');
    const values = Object.fromEntries(new FormData(form));
    form.querySelectorAll('.field-message').forEach(node => { node.textContent = ''; node.classList.remove('field-message--error'); });
    let invalid = null;
    if (!values.firstName.trim()) invalid = form.elements.firstName;
    else if (!values.lastName.trim()) invalid = form.elements.lastName;
    else if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) invalid = form.elements.email;
    if (invalid) { const message = invalid.closest('.field').querySelector('.field-message'); message.textContent = invalid.name === 'email' ? 'ایمیل را به‌صورت صحیح وارد کنید.' : 'این فیلد را کامل کنید.'; message.classList.add('field-message--error'); invalid.focus(); return; }
    button.disabled = true; button.textContent = 'در حال ذخیره...';
    try {
      const saved = await api.saveProfile({ ...values, mobile: getAccountData().profile.mobile, completed: values.email && values.birthday ? 100 : 80 });
      updateAccount(account => { account.profile = saved; return account; });
      toast('اطلاعات پروفایل ذخیره شد.');
      document.querySelector('.profile-completion').textContent = `${toPersianDigits(saved.completed)}٪ تکمیل`;
    } catch (error) { toast(error.message, 'error'); }
    finally { button.disabled = false; button.textContent = 'ذخیره تغییرات'; }
  });
};

const bindNotifications = toast => {
  const form = document.getElementById('notification-form');
  form?.addEventListener('change', async () => {
    const preferences = Object.fromEntries([...form.elements].filter(input => input.name).map(input => [input.name, input.checked]));
    try { const saved = await api.saveNotificationPreferences(preferences); updateAccount(account => { account.notifications = saved; return account; }); toast('تنظیمات اطلاع‌رسانی ذخیره شد.'); }
    catch (error) { toast(error.message, 'error'); }
  });
};

const bindAccountActions = toast => {
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(button.dataset.copy); toast('کد تخفیف کپی شد.'); }
    catch { toast(`کد تخفیف: ${button.dataset.copy}`, 'info'); }
  }));
  document.querySelectorAll('[data-remove-alert]').forEach(button => button.addEventListener('click', () => {
    updateAccount(account => { account.availabilityAlerts = account.availabilityAlerts.filter(item => item.id !== button.dataset.removeAlert); return account; });
    button.closest('.availability-row')?.remove(); toast('هشدار موجودی لغو شد.', 'info');
  }));
};

const render = async toast => {
  ensureDemoSession();
  const root = document.getElementById('account-page-root');
  const session = getSession();
  if (!session) { root.innerHTML = authGateTemplate(); return; }
  root.innerHTML = `<div class="account-loading" aria-label="در حال دریافت اطلاعات حساب"><span class="skeleton skeleton--line"></span><span class="skeleton skeleton--box"></span><span class="skeleton skeleton--box"></span></div>`;
  try {
    const overview = await api.getAccountOverview();
    const account = hydrateAccountFromServer(overview); const orders = getOrders();
    root.innerHTML = dashboardTemplate(session, account, orders);
    bindWheel(session, toast); bindProfile(toast); bindNotifications(toast); bindAccountActions(toast);
  } catch (error) {
    root.innerHTML = `<section class="account-auth-gate"><span class="account-auth-gate__icon">${icon('error')}</span><h1>دریافت اطلاعات حساب انجام نشد</h1><p>${error.message || 'ارتباط با سرور برقرار نشد.'}</p><button class="button" type="button" data-retry-account>تلاش دوباره</button></section>`;
    document.querySelector('[data-retry-account]')?.addEventListener('click', () => render(toast));
  }
};

export const initAccount = ({ toast }) => {
  render(toast);
  document.addEventListener('toto:auth-changed', () => render(toast));
};
