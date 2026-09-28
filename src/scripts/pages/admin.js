import { adminKpis, salesSeries, categoryRevenue, adminProducts as initialProducts, adminOrders as initialOrders, adminCustomers, adminActivities, adminRoles } from '../../data/admin-data.js';
import { localStore } from '../core/storage.js';
import { api } from '../services/api.js';
import { icon, formatPrice, toPersianDigits, toEnglishDigits, debounce } from '../core/utils.js';

const DEBUG_ENABLED = true;
const DEBUG_PREFIX = '[TOTO-DEBUG][ADMIN]';
const debug = (...args) => { if (DEBUG_ENABLED) console.log(DEBUG_PREFIX, ...args); };
const debugWarn = (...args) => { if (DEBUG_ENABLED) console.warn(DEBUG_PREFIX, ...args); };
const debugError = (...args) => { if (DEBUG_ENABLED) console.error(DEBUG_PREFIX, ...args); };
const errorSnapshot = error => ({
  name: error?.name,
  message: error?.message,
  code: error?.code,
  status: error?.status,
  stack: error?.stack
});

window.addEventListener('error', event => {
  debugError('window:error', {
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    column: event.colno,
    error: errorSnapshot(event.error)
  });
});
window.addEventListener('unhandledrejection', event => {
  debugError('window:unhandledrejection', errorSnapshot(event.reason));
});

debug('admin.js loaded', { href: location.href, readyState: document.readyState, timestamp: new Date().toISOString() });

const sections = [
  { id: 'dashboard', label: 'نمای کلی', icon: 'grid', group: 'داشبورد' },
  { id: 'products', label: 'محصولات', icon: 'bag', group: 'فروشگاه', count: initialProducts.length },
  { id: 'inventory', label: 'موجودی و تنوع', icon: 'package', group: 'فروشگاه', count: 9 },
  { id: 'orders', label: 'سفارش‌ها', icon: 'truck', group: 'فروشگاه', count: 17 },
  { id: 'customers', label: 'مشتریان', icon: 'user', group: 'مشتریان' },
  { id: 'gallery', label: 'گالری مشتریان', icon: 'image', group: 'مشتریان' },
  { id: 'content', label: 'محتوا و مجله', icon: 'edit', group: 'رشد' },
  { id: 'marketing', label: 'بازاریابی و وفاداری', icon: 'gift', group: 'رشد' },
  { id: 'roles', label: 'نقش‌ها و امنیت', icon: 'shield', group: 'سیستم' },
  { id: 'reports', label: 'گزارش و خروجی', icon: 'sort', group: 'سیستم' }
];

const state = {
  section: location.hash.replace('#', '') || 'dashboard',
  range: '30d',
  products: [...initialProducts],
  orders: [...initialOrders],
  productQuery: '', productStatus: 'all', orderQuery: '', orderStatus: 'all',
  drawer: null
};

const root = document.getElementById('admin-root');
const live = document.getElementById('admin-live-region');
const announce = message => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = message; }); };
const statusLabel = status => ({ active:'فعال', draft:'پیش‌نویس', 'out-of-stock':'ناموجود', shipped:'ارسال‌شده', delivered:'تحویل‌شده', cancelled:'لغوشده', returned:'مرجوع‌شده', processing:'در حال پردازش', paid:'پرداخت‌شده', ready:'آماده ارسال' }[status] || status);
const number = value => new Intl.NumberFormat('fa-IR').format(value);
const compactPrice = value => `${new Intl.NumberFormat('fa-IR', { notation:'compact', maximumFractionDigits:1 }).format(value)} تومان`;

const navTemplate = () => {
  const groups = [...new Set(sections.map(item => item.group))];
  return groups.map(group => `<div class="admin-nav__group"><span>${group}</span>${sections.filter(item => item.group === group).map(item => `<button type="button" class="${state.section === item.id ? 'is-active' : ''}" data-admin-nav="${item.id}" aria-current="${state.section === item.id ? 'page' : 'false'}">${icon(item.icon)}<span>${item.label}</span>${item.count ? `<small>${toPersianDigits(item.count)}</small>` : ''}</button>`).join('')}</div>`).join('');
};

const shellTemplate = () => `<div class="admin-shell">
  <aside class="admin-sidebar" id="admin-sidebar" aria-label="ناوبری مدیریت">
    <div class="admin-sidebar__head"><a class="admin-sidebar__brand" href="./admin"><strong>TOTO</strong><small>مرکز مدیریت فروشگاه</small></a><button class="icon-button admin-sidebar__close" type="button" data-admin-action="close-sidebar" aria-label="بستن منو">${icon('close')}</button></div>
    <nav class="admin-nav" id="admin-nav">${navTemplate()}</nav>
    <div class="admin-sidebar__profile"><span>${icon('user')}</span><div><strong>مدیر فروشگاه</strong><small>نقش: مدیر کل</small></div></div>
  </aside>
  <div class="admin-overlay" id="admin-overlay" data-admin-action="close-sidebar"></div>
  <div class="admin-main">
    <header class="admin-topbar"><div class="admin-topbar__start"><button class="icon-button admin-topbar__menu" type="button" data-admin-action="open-sidebar" aria-label="بازکردن منو">${icon('menu')}</button><div class="admin-topbar__title"><strong id="admin-top-title">مدیریت توتو فشن</strong><small>ذخیره‌سازی تغییرات مدیریت فعال است</small></div></div><div class="admin-topbar__end"><label class="admin-search"><span class="visually-hidden">جست‌وجوی سراسری مدیریت</span>${icon('search')}<input class="input" id="admin-global-search" type="search" placeholder="جست‌وجوی سفارش، محصول یا مشتری"></label><a class="icon-button" href="/" target="_blank" aria-label="مشاهده فروشگاه">${icon('home')}</a><button class="icon-button" type="button" data-admin-action="notifications" aria-label="اعلان‌های مدیریت">${icon('bell')}<span class="counter-badge">۳</span></button><button class="admin-user-button" type="button" data-admin-action="admin-profile"><span>${icon('user')}</span><span><strong>سارا مدیر</strong><small>آخرین ورود امروز، ۱۷:۴۰</small></span></button></div></header>
    <main class="admin-content" id="admin-content" tabindex="-1"></main>
  </div>
  <aside class="admin-drawer" id="admin-drawer" aria-hidden="true"></aside>
  <div class="admin-toast-region" id="admin-toast-region" aria-live="polite"></div>
</div>`;

const toast = (message, type = 'success') => {
  const region = document.getElementById('admin-toast-region');
  const node = document.createElement('div'); node.className = `admin-toast admin-toast--${type}`; node.textContent = message; region.append(node); setTimeout(() => node.remove(), 3800);
};

const pageHead = (eyebrow, title, description, actions = '') => `<header class="admin-page-head"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div>${actions ? `<div class="admin-page-actions">${actions}</div>` : ''}</header>`;
const dateFilter = () => `<div class="admin-date-filter" aria-label="بازه زمانی">${[['today','امروز'],['7d','۷ روز اخیر'],['30d','۳۰ روز اخیر'],['custom','بازه دلخواه']].map(([id,label]) => `<button type="button" class="${state.range === id ? 'is-active' : ''}" data-admin-range="${id}">${label}</button>`).join('')}</div>`;
const kpiTemplate = kpi => `<article class="admin-kpi"><span>${kpi.label}</span><strong title="${kpi.type === 'currency' ? formatPrice(kpi.value) : number(kpi.value)}">${kpi.type === 'currency' ? compactPrice(kpi.value) : number(kpi.value)}</strong><small>${kpi.delta ? `<b class="${kpi.delta < 0 ? 'is-negative' : ''}">${kpi.delta > 0 ? '+' : ''}${toPersianDigits(kpi.delta)}٪</b>` : '<b>بدون تغییر</b>'}${kpi.note}</small></article>`;

const lineChart = () => {
  const width = 720, height = 260, pad = 34, max = 65;
  const x = i => pad + i * ((width - pad * 2) / (salesSeries.length - 1));
  const y = value => height - pad - (value / max) * (height - pad * 2);
  const path = key => salesSeries.map((item, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(item[key])}`).join(' ');
  return `<svg class="admin-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="نمودار فروش و سفارش‌های هفت روز اخیر">${[0,20,40,60].map(value => `<line class="grid-line" x1="${pad}" x2="${width-pad}" y1="${y(value)}" y2="${y(value)}"></line><text x="${width-pad+7}" y="${y(value)+3}">${toPersianDigits(value)}</text>`).join('')}<path class="sales-line" d="${path('sales')}"></path><path class="orders-line" d="${path('orders')}"></path>${salesSeries.map((item,index) => `<circle cx="${x(index)}" cy="${y(item.sales)}" r="4"></circle><text text-anchor="middle" x="${x(index)}" y="${height-8}">${item.label}</text>`).join('')}</svg>`;
};

const dashboardTemplate = () => `${pageHead('داشبورد مدیریتی','نمای کلی فروشگاه','فروش، سفارش‌ها، مشتریان و عملیات امروز در یک نگاه.', `<button class="button button--outline" type="button" data-admin-action="print">${icon('image','icon icon--sm')} چاپ گزارش</button>${dateFilter()}`)}
  <div class="admin-print-only"><h2>گزارش مدیریتی توتو فشن</h2><p>تاریخ تهیه: ${new Intl.DateTimeFormat('fa-IR').format(new Date())}</p></div>
  <section class="admin-kpi-grid" aria-label="شاخص‌های کلیدی">${adminKpis.map(kpiTemplate).join('')}</section>
  <section class="admin-chart-grid"><article class="admin-panel"><div class="admin-panel__head"><div><h2>فروش و تعداد سفارش</h2><p>میلیون تومان و تعداد سفارش در هفت روز اخیر</p></div><span class="badge">به‌روزرسانی لحظه‌ای</span></div>${lineChart()}<div style="display:flex;gap:16px;font-size:12px"><span style="display:flex;align-items:center;gap:5px"><i style="width:18px;height:3px;background:#111"></i> فروش</span><span style="display:flex;align-items:center;gap:5px"><i style="width:18px;height:3px;background:var(--color-accent-strong)"></i> سفارش</span></div></article><article class="admin-panel"><div class="admin-panel__head"><div><h2>درآمد بر اساس دسته</h2><p>سهم از فروش ماهانه</p></div></div><div class="admin-bar-list">${categoryRevenue.map(item => `<div class="admin-bar-row"><span>${item.label}</span><div class="admin-bar-track"><span style="--bar-value:${item.value}%"></span></div><b>${toPersianDigits(item.value)}٪</b></div>`).join('')}</div></article></section>
  <section class="admin-analytics-grid">
    <article class="admin-panel"><div class="admin-panel__head"><div><h2>پرفروش‌ترین محصولات</h2><p>بر اساس تعداد فروش این ماه</p></div></div><div class="admin-best-sellers">${state.products.slice(0,4).map((product,index)=>`<div><img src="${product.image}" alt="" width="38" height="50"><span><strong>${product.name}</strong><small>${toPersianDigits(84-index*13)} فروش</small></span><b>${compactPrice(product.price*(84-index*13))}</b></div>`).join('')}</div></article>
    <article class="admin-panel"><div class="admin-panel__head"><div><h2>روش‌های پرداخت</h2><p>سهم از سفارش‌های موفق</p></div></div><div class="admin-bar-list">${[['درگاه آنلاین',72],['کیف پول و درگاه',18],['پرداخت لینک پشتیبانی',7],['سایر',3]].map(([label,value])=>`<div class="admin-bar-row"><span>${label}</span><div class="admin-bar-track"><span style="--bar-value:${value}%"></span></div><b>${toPersianDigits(value)}٪</b></div>`).join('')}</div></article>
    <article class="admin-panel admin-compact-chart"><div class="admin-panel__head"><div><h2>رشد مشتریان</h2><p>عضو تازه در ۳۰ روز</p></div><strong>+${toPersianDigits(62)}</strong></div><svg viewBox="0 0 240 80" role="img" aria-label="روند رشد مشتریان"><polyline points="0,68 35,60 70,62 105,44 140,48 175,26 210,30 240,12"></polyline></svg></article>
    <article class="admin-panel"><div class="admin-panel__head"><div><h2>نرخ مرجوعی</h2><p>از سفارش‌های تحویل‌شده</p></div><strong>۳٫۲٪</strong></div><div class="admin-rate-meter"><span style="--rate:32%"></span></div><p style="font-size:12px;margin:10px 0 0">هدف ماهانه کمتر از ۴٪؛ بیشترین دلیل: انتخاب سایز.</p></article>
    <article class="admin-panel"><div class="admin-panel__head"><div><h2>دستگاه خرید</h2><p>موبایل در برابر دسکتاپ</p></div></div><div class="admin-device-split"><span style="--device:76%">موبایل ۷۶٪</span><span>دسکتاپ ۲۴٪</span></div><p style="font-size:12px;margin:12px 0 0">نرخ تبدیل موبایل: ۴٫۸٪</p></article>
  </section>
  <section class="admin-quick-grid"><article class="admin-panel"><div class="admin-panel__head"><div><h2>فعالیت‌های اخیر مدیران</h2><p>لاگ عملیاتی قابل حسابرسی</p></div><button class="text-button" type="button" data-admin-nav="roles">همه فعالیت‌ها</button></div><div class="admin-activity-list">${adminActivities.map(item => `<article><span>${icon('user','icon icon--sm')}</span><div><p><strong>${item.person}</strong> ${item.action}</p><small>${item.time}</small></div></article>`).join('')}</div></article><article class="admin-panel"><div class="admin-panel__head"><div><h2>کارهای نیازمند توجه</h2><p>اولویت‌های عملیاتی امروز</p></div></div><div class="admin-task-list"><a href="#orders" data-admin-nav="orders">${icon('clock')}<span>سفارش‌های در انتظار تأیید</span><b>۱۷</b></a><a href="#inventory" data-admin-nav="inventory">${icon('package')}<span>تنوع‌های با موجودی کمتر از ۵</span><b>۹</b></a><a href="#orders" data-admin-nav="orders">${icon('refresh')}<span>درخواست‌های مرجوعی باز</span><b>۶</b></a><a href="#marketing" data-admin-nav="marketing">${icon('gift')}<span>پاداش‌های در آستانه انقضا</span><b>۲۴</b></a></div></article></section>`;

const productRows = () => {
  const query = state.productQuery.trim().toLowerCase();
  return state.products.filter(product => (!query || `${product.name} ${product.sku}`.toLowerCase().includes(query)) && (state.productStatus === 'all' || product.status === state.productStatus));
};
const productTable = rows => rows.length ? `<div class="admin-data-table-wrap"><table class="admin-data-table"><thead><tr><th>محصول</th><th>وضعیت</th><th>قیمت</th><th>تنوع</th><th>موجودی</th><th>بازدید</th><th>نرخ تبدیل</th><th>عملیات</th></tr></thead><tbody>${rows.map(product => `<tr><td><div class="admin-table-product"><img src="${product.image}" alt="" width="48" height="64"><div><strong>${product.name}</strong><small>${product.sku}</small></div></div></td><td><span class="admin-status admin-status--${product.status}">${statusLabel(product.status)}</span></td><td>${formatPrice(product.price)}</td><td>${toPersianDigits(product.variants)}</td><td>${toPersianDigits(product.inventory)}</td><td>${number(product.views)}</td><td>${toPersianDigits(product.conversion.toFixed(1))}٪</td><td><div class="admin-table-actions"><button class="icon-button" type="button" data-edit-product="${product.id}" aria-label="ویرایش ${product.name}">${icon('edit','icon icon--sm')}</button><a class="icon-button" href="./product?id=${product.id}" target="_blank" aria-label="مشاهده محصول">${icon('search','icon icon--sm')}</a></div></td></tr>`).join('')}</tbody></table></div>` : `<div class="admin-data-table-wrap"><div class="admin-empty"><span>${icon('search')}</span><h2>محصولی پیدا نشد</h2><p>عبارت جست‌وجو یا فیلتر وضعیت را تغییر دهید.</p><button class="button button--outline" type="button" data-admin-action="clear-product-filters">پاک‌کردن فیلترها</button></div></div>`;
const productsTemplate = () => {
  const rows = productRows();
  return `${pageHead('مدیریت کاتالوگ','محصولات','قیمت، وضعیت، تصاویر، ویژگی‌ها و تنوع‌های هر محصول را مدیریت کنید.', `<button class="button button--outline" type="button" data-export="products">${icon('sort','icon icon--sm')} خروجی CSV</button><button class="button" type="button" data-new-product>${icon('plus','icon icon--sm')} محصول جدید</button>`)}<div class="admin-toolbar"><label class="input-wrap" style="min-width:min(100%,360px)"><span class="visually-hidden">جست‌وجوی محصول</span><input class="input" id="admin-product-search" type="search" value="${state.productQuery}" placeholder="نام یا کد محصول"></label><div class="admin-toolbar__filters"><select class="input" id="admin-product-status"><option value="all">همه وضعیت‌ها</option><option value="active" ${state.productStatus==='active'?'selected':''}>فعال</option><option value="draft" ${state.productStatus==='draft'?'selected':''}>پیش‌نویس</option><option value="out-of-stock" ${state.productStatus==='out-of-stock'?'selected':''}>ناموجود</option></select><button class="button button--outline" type="button" data-admin-action="bulk-inventory">ویرایش گروهی موجودی</button></div></div><p style="font-size:12px">${toPersianDigits(rows.length)} محصول مطابق فیلتر</p>${productTable(rows)}`;
};

const orderRows = () => {
  const query = toEnglishDigits(state.orderQuery.trim().toLowerCase());
  return state.orders.filter(order => (!query || toEnglishDigits(`${order.orderNumber} ${order.customer} ${order.mobile}`).toLowerCase().includes(query)) && (state.orderStatus === 'all' || order.status === state.orderStatus));
};
const orderTable = rows => rows.length ? `<div class="admin-data-table-wrap"><table class="admin-data-table"><thead><tr><th>شماره سفارش</th><th>مشتری</th><th>تاریخ</th><th>وضعیت</th><th>مبلغ</th><th>پرداخت</th><th>ارسال</th><th>عملیات</th></tr></thead><tbody>${rows.map(order => `<tr><td><strong>${order.orderNumber}</strong></td><td>${order.customer}<small style="display:block;color:var(--color-text-muted)">${toPersianDigits(order.mobile)}</small></td><td>${order.placedAt}</td><td><span class="admin-status admin-status--${order.status}">${order.statusLabel}</span></td><td>${formatPrice(order.total)}</td><td>${order.paymentMethod}</td><td>${order.trackingCode || 'ثبت نشده'}</td><td><div class="admin-table-actions"><button class="icon-button" type="button" data-edit-order="${order.id}" aria-label="مدیریت سفارش ${order.orderNumber}">${icon('edit','icon icon--sm')}</button><a class="icon-button" href="./order-details?id=${encodeURIComponent(order.id)}" target="_blank" aria-label="مشاهده سفارش">${icon('search','icon icon--sm')}</a></div></td></tr>`).join('')}</tbody></table></div>` : `<div class="admin-data-table-wrap"><div class="admin-empty"><span>${icon('package')}</span><h2>سفارشی پیدا نشد</h2><p>شماره سفارش، موبایل یا فیلتر وضعیت را بررسی کنید.</p></div></div>`;
const ordersTemplate = () => { const rows=orderRows(); return `${pageHead('عملیات فروش','سفارش‌ها','پرداخت، ارسال، لغو، مرجوعی و تاریخچه هر سفارش را مدیریت کنید.', `<button class="button button--outline" type="button" data-export="orders">${icon('sort','icon icon--sm')} خروجی سفارش‌ها</button><button class="button button--outline" type="button" data-admin-action="print">چاپ گزارش</button>`)}<div class="admin-toolbar"><input class="input" id="admin-order-search" type="search" value="${state.orderQuery}" placeholder="شماره سفارش، نام یا موبایل"><div class="admin-toolbar__filters"><select class="input" id="admin-order-status"><option value="all">همه وضعیت‌ها</option>${['paid','processing','ready','shipped','delivered','cancelled','returned'].map(status => `<option value="${status}" ${state.orderStatus===status?'selected':''}>${statusLabel(status)}</option>`).join('')}</select></div></div><p style="font-size:12px">${toPersianDigits(rows.length)} سفارش مطابق فیلتر</p>${orderTable(rows)}`; };

const inventoryTemplate = () => {
  const low = state.products.filter(product => product.inventory < 10).sort((a,b)=>a.inventory-b.inventory);
  return `${pageHead('کنترل کالا','موجودی و تنوع','موجودی هر محصول، رنگ‌ها و سایزهای فعال را از همین بخش مدیریت کنید.', `<button class="button" type="button" data-admin-action="bulk-inventory">ثبت موجودی گروهی</button>`)}<article class="admin-panel"><div class="admin-panel__head"><div><h2>هشدار موجودی پایین</h2><p>محصولاتی که کمتر از ۱۰ عدد موجودی تجمیعی دارند</p></div><span class="badge badge--warning">${toPersianDigits(low.length)} هشدار</span></div><div class="admin-data-table-wrap"><table class="admin-data-table"><thead><tr><th>محصول</th><th>رنگ‌های فعال</th><th>سایزهای فعال</th><th>موجودی کل</th><th>پیشنهاد تأمین</th><th>عملیات</th></tr></thead><tbody>${low.map(product => `<tr><td><div class="admin-table-product"><img src="${product.image}" alt=""><div><strong>${product.name}</strong><small>${product.sku}</small></div></div></td><td>${toPersianDigits(product.colors.length)}</td><td>${toPersianDigits(product.sizes.length)}</td><td><strong style="color:${product.inventory<4?'var(--color-error)':'inherit'}">${toPersianDigits(product.inventory)}</strong></td><td>${toPersianDigits(Math.max(12, 24-product.inventory))} عدد</td><td><button class="button button--outline" type="button" data-edit-product="${product.id}">ویرایش موجودی</button></td></tr>`).join('')}</tbody></table></div></article>`;
};

const customersTemplate = () => `${pageHead('مدیریت ارتباط با مشتری','مشتریان','سابقه خرید، سطح وفاداری، امتیاز، آدرس‌ها و ترجیحات اطلاع‌رسانی.', `<button class="button button--outline" type="button" data-export="customers">${icon('sort','icon icon--sm')} خروجی مشتریان</button>`)}<div class="admin-data-table-wrap"><table class="admin-data-table"><thead><tr><th>مشتری</th><th>موبایل</th><th>سطح</th><th>سفارش</th><th>مجموع خرید</th><th>عضویت</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>${adminCustomers.map(customer => `<tr><td><strong>${customer.name}</strong><small style="display:block;color:var(--color-text-muted)">${customer.id}</small></td><td>${customer.mobile}</td><td><span class="badge">${customer.level}</span></td><td>${toPersianDigits(customer.orders)}</td><td>${formatPrice(customer.spent)}</td><td>${customer.joined}</td><td><span class="admin-status admin-status--active">${customer.status==='vip'?'مشتری ویژه':'فعال'}</span></td><td><button class="icon-button" type="button" data-customer-detail="${customer.id}" aria-label="مشاهده مشتری">${icon('search','icon icon--sm')}</button></td></tr>`).join('')}</tbody></table></div>`;

const galleryTemplate=()=>{const entries=localStore.get('toto-customer-gallery',[]),label=status=>({pending:'در انتظار بررسی',approved:'منتشرشده',rejected:'نیازمند ویرایش'}[status]||status);return `${pageHead('محتوای ارسالی مشتریان','گالری مشتریان','عکس‌ها را بررسی، تأیید یا برای ویرایش برگردانید.',`<a class="button button--outline" href="./gallery" target="_blank">${icon('search','icon icon--sm')} مشاهده گالری</a>`)}${entries.length?`<div class="admin-gallery-grid">${entries.map(item=>`<article class="admin-gallery-card"><img src="${item.image}" alt="" width="280" height="340"><div><span class="admin-status admin-status--${item.status==='approved'?'active':item.status==='rejected'?'out-of-stock':'draft'}">${label(item.status)}</span><h2>${item.customerName}</h2><strong>${item.productName}</strong><p>${item.caption}</p><small>${item.createdAt}</small></div><div class="admin-gallery-actions"><button class="button" type="button" data-gallery-status="approved" data-gallery-id="${item.id}" ${item.status==='approved'?'disabled':''}>تأیید و انتشار</button><button class="button button--outline" type="button" data-gallery-status="rejected" data-gallery-id="${item.id}">برگشت برای ویرایش</button><button class="text-button" type="button" data-gallery-status="delete" data-gallery-id="${item.id}">${icon('trash','icon icon--sm')} حذف</button></div></article>`).join('')}</div>`:`<div class="admin-panel admin-empty"><span>${icon('image')}</span><h2>عکسی برای بررسی وجود ندارد</h2><p>ارسال‌های تازهٔ مشتریان در این بخش نمایش داده می‌شوند.</p><a class="button button--outline" href="./gallery#share-look" target="_blank">آزمایش فرم ارسال عکس</a></div>`}`;};

const managementCard = (iconName,title,text,count,action='مدیریت') => `<article class="admin-management-card"><div class="admin-management-card__head"><span>${icon(iconName)}</span><b>${count}</b></div><h2>${title}</h2><p>${text}</p><button class="button button--outline button--block" type="button" data-management-action="${title}">${action}</button></article>`;
const contentTemplate = () => `${pageHead('مدیریت محتوا','محتوا و مجله','اسلایدها، بنرها، منو، صفحات برند و مقاله‌ها را بدون تغییر کد مدیریت کنید.', `<button class="button" type="button" data-management-action="مقاله جدید">${icon('plus','icon icon--sm')} مقاله جدید</button>`)}<div class="admin-section-cards">${managementCard('image','اسلایدهای صفحه اصلی','تصویر، متن، لینک، ترتیب و زمان انتشار اسلایدهای Hero.',3)}${managementCard('grid','بنرها و پیشنهادها','بنرهای کالکشن، آفر تایم و بخش‌های Editorial.',8)}${managementCard('image','گالری مشتریان','بررسی عکس‌های ارسالی و مدیریت انتشار.',localStore.get('toto-customer-gallery',[]).length,'مشاهده صف بررسی')}${managementCard('edit','مجله توتو','مقاله‌ها، دسته‌بندی، نویسنده، SEO و محصولات مرتبط.',24)}${managementCard('menu','منو و دسته‌بندی','ساختار ناوبری، مگامنو و لینک‌های فوتر.',16)}${managementCard('info','صفحات اطلاعاتی','درباره ما، تماس، FAQ، ارسال، حریم خصوصی و قوانین.',7)}${managementCard('search','تنظیمات SEO','عنوان، توضیحات، Canonical، Schema و مسیرهای Sitemap.',31)}</div>`;
const marketingTemplate = () => `${pageHead('رشد و وفاداری','بازاریابی و باشگاه مشتریان','کمپین‌ها، کدهای تخفیف، پاداش‌ها و پیام‌های هدفمند را مدیریت کنید.', `<button class="button" type="button" data-management-action="کمپین جدید">${icon('plus','icon icon--sm')} کمپین جدید</button>`)}<div class="admin-section-cards">${managementCard('gift','کدهای تخفیف','شرایط استفاده، سقف تخفیف، تاریخ انقضا و محدودیت مشتری.',18)}${managementCard('clock','کمپین آفر تایم','تاریخ شروع و پایان واقعی، محصولات و حالت انقضا.',2)}${managementCard('trophy','سطوح وفاداری','آستانه امتیاز، مزایا و قوانین عضو، نقره‌ای، طلایی و ویژه.',4)}${managementCard('refresh','چرخونه شانس','جایزه‌ها، احتمال، محدودیت روزانه و اعتبار پاداش.',7)}${managementCard('phone','کمپین پیامکی','گروه مخاطب، رضایت ارتباطی، زمان ارسال و گزارش نتیجه.',5)}${managementCard('bell','هشدار موجودی','صف انتظار، اطلاع‌رسانی و نرخ تبدیل بازگشت موجودی.',43)}</div>`;
const rolesTemplate = () => `${pageHead('کنترل دسترسی','نقش‌ها و امنیت','اصل حداقل دسترسی، تاریخچه اقدامات و مدیریت نشست‌های ادمین.', `<button class="button" type="button" data-management-action="نقش جدید">${icon('plus','icon icon--sm')} نقش جدید</button>`)}<div class="admin-role-grid">${adminRoles.map(role => `<article class="admin-role-card"><div><strong>${role.label}</strong><small>${role.id}</small></div><span class="badge">${toPersianDigits(role.users)} کاربر</span><p>${role.permissions}</p><button class="button button--outline" type="button" data-role="${role.id}">مدیریت مجوزها</button></article>`).join('')}</div><section class="admin-panel" style="margin-top:14px"><div class="admin-panel__head"><div><h2>نشست‌ها و گزارش امنیتی</h2><p>نشست‌های فعال و آخرین اقدامات حساس</p></div><span class="admin-status admin-status--active">همه سرویس‌ها فعال</span></div><div class="admin-task-list"><a href="#"><span>${icon('shield')}</span><span>نشست فعال مدیر کل — تهران، Chrome</span><b>اکنون</b></a><a href="#"><span>${icon('clock')}</span><span>آخرین تغییر مجوز — نقش پشتیبانی مشتری</span><b>دیروز</b></a><a href="#"><span>${icon('error')}</span><span>تلاش ورود ناموفق در ۳۰ روز اخیر</span><b>۲</b></a></div></section>`;
const reportsTemplate = () => `${pageHead('تحلیل و خروجی','گزارش‌ها','گزارش‌های قابل دانلود برای فروش، سفارش، محصول، موجودی، مشتری، تخفیف، مرجوعی و امتیاز.', `<button class="button button--outline" type="button" data-admin-action="print">چاپ نمای فعلی</button>`)}<div class="admin-section-cards">${[['فروش','جمع فروش، تخفیف، مالیات و روش پرداخت','orders'],['سفارش‌ها','وضعیت‌ها، زمان پردازش و ارسال','orders'],['محصولات','فروش، بازدید، تبدیل و حاشیه سود','products'],['موجودی','تنوع‌های رنگ و سایز و نقطه سفارش','products'],['مشتریان','ارزش طول عمر، سطح و رضایت ارتباطی','customers'],['مرجوعی‌ها','دلیل، محصول، زمان حل و مبلغ بازپرداخت','orders'],['تخفیف‌ها','مصرف کد، درآمد ایجادشده و سوءاستفاده','orders'],['امتیاز وفاداری','کسب، مصرف، انقضا و تعهد امتیاز','customers']].map(([title,text,type]) => managementCard('sort',`گزارش ${title}`,text,'CSV / Excel',`<span data-export="${type}">دریافت گزارش</span>`)).join('')}</div>`;

const sectionTemplate = () => ({ dashboard:dashboardTemplate, products:productsTemplate, inventory:inventoryTemplate, orders:ordersTemplate, customers:customersTemplate, gallery:galleryTemplate, content:contentTemplate, marketing:marketingTemplate, roles:rolesTemplate, reports:reportsTemplate }[state.section] || dashboardTemplate)();

const adminLoginTemplate = error => `<div class="admin-panel" style="max-width:520px;margin:8vh auto"><div class="admin-panel__head"><div><p class="eyebrow">ورود امن</p><h1>ورود به پنل مدیریت</h1><p>با حساب مدیر تعریف‌شده در فایل .env وارد شوید.</p></div></div>${error?`<div class="field-message field-message--error" style="margin-bottom:12px">${error}</div>`:''}<form id="admin-login-form"><div class="field"><label for="admin-login-email">ایمیل مدیر</label><input class="input" id="admin-login-email" name="email" type="email" autocomplete="username" required></div><div class="field"><label for="admin-login-password">رمز عبور</label><input class="input" id="admin-login-password" name="password" type="password" autocomplete="current-password" required></div><button class="button button--block" type="submit">ورود به مدیریت</button></form></div>`;
const applyDashboardData = data => {
  if (Array.isArray(data.kpis)) adminKpis.splice(0, adminKpis.length, ...data.kpis);
  if (Array.isArray(data.salesSeries)) salesSeries.splice(0, salesSeries.length, ...data.salesSeries);
  if (Array.isArray(data.categoryRevenue)) categoryRevenue.splice(0, categoryRevenue.length, ...data.categoryRevenue);
  if (Array.isArray(data.products)) state.products = data.products;
  if (Array.isArray(data.orders)) state.orders = data.orders;
  if (Array.isArray(data.customers)) adminCustomers.splice(0, adminCustomers.length, ...data.customers);
  if (Array.isArray(data.activities)) adminActivities.splice(0, adminActivities.length, ...data.activities);
  if (data.settings && typeof data.settings === 'object') {
    const management={}, roles={};
    Object.entries(data.settings).forEach(([key,value])=>{ if(key.startsWith('management:'))management[key.slice(11)]=value; if(key.startsWith('role:'))roles[key.slice(5)]=value?.permissions||[]; });
    localStore.set('toto-admin-management',management); localStore.set('toto-admin-role-permissions',roles);
  }
};
const renderSection = async () => {
  const content = document.getElementById('admin-content');
  content.innerHTML = `<div class="admin-skeleton-grid" aria-label="در حال دریافت اطلاعات"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div>`;
  try { const data=await api.getAdminDashboard(state.range); applyDashboardData(data); content.innerHTML = sectionTemplate(); bindSectionInputs(); document.getElementById('admin-top-title').textContent = sections.find(item => item.id === state.section)?.label || 'مدیریت توتو'; }
  catch (error) { content.innerHTML = error.status===401 ? adminLoginTemplate() : `<div class="admin-panel admin-empty"><span>${icon('error')}</span><h1>دریافت اطلاعات انجام نشد</h1><p>${error.message}</p><button class="button" type="button" data-admin-action="retry">تلاش دوباره</button></div>`; }
  document.getElementById('admin-nav').innerHTML = navTemplate();
};

const openSidebar = () => { document.getElementById('admin-sidebar').classList.add('is-open'); document.getElementById('admin-overlay').classList.add('is-open'); document.body.classList.add('is-locked'); };
const closeSidebar = () => { document.getElementById('admin-sidebar').classList.remove('is-open'); document.getElementById('admin-overlay').classList.remove('is-open'); document.body.classList.remove('is-locked'); };
const openDrawer = html => { const drawer=document.getElementById('admin-drawer'); drawer.innerHTML=html; drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden','false'); document.getElementById('admin-overlay').classList.add('is-open'); document.body.classList.add('is-locked'); requestAnimationFrame(()=>drawer.querySelector('input,select,button')?.focus()); };
const closeDrawer = () => { const drawer=document.getElementById('admin-drawer'); drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden','true'); document.getElementById('admin-overlay').classList.remove('is-open'); document.body.classList.remove('is-locked'); };

const productDrawer=product=>`<div class="admin-drawer__head"><div><p class="eyebrow">${product?'ویرایش محصول':'محصول جدید'}</p><h2>${product?.name||'ایجاد محصول'}</h2></div><button class="icon-button" type="button" data-admin-action="close-drawer" aria-label="بستن">${icon('close')}</button></div><form class="admin-drawer__body" id="admin-product-form"><input type="hidden" name="id" value="${product?.id||''}"><div class="field"><label for="admin-product-name">نام محصول</label><input class="input" id="admin-product-name" name="name" required value="${product?.name||''}"></div><div class="form-row"><div class="field"><label for="admin-product-price">قیمت به تومان</label><input class="input" id="admin-product-price" name="price" inputmode="numeric" required value="${product?.price||''}"></div><div class="field"><label for="admin-product-stock">موجودی کل</label><input class="input" id="admin-product-stock" name="inventory" inputmode="numeric" required value="${product?.inventory??0}"></div></div><div class="form-row"><div class="field"><label for="admin-product-category">دسته‌بندی</label><select class="input" id="admin-product-category" name="category">${['مانتو و کت','پیراهن','شومیز','شلوار','دامن','کیف','کفش','اکسسوری'].map(category=>`<option ${product?.category===category?'selected':''}>${category}</option>`).join('')}</select></div><div class="field"><label for="admin-product-sizes">سایزهای فعال</label><input class="input" id="admin-product-sizes" name="sizes" value="${product?.sizes?.join('، ')||'۳۶، ۳۸، ۴۰'}"><small>با ویرگول جدا کنید</small></div></div><div class="form-row"><div class="field"><label for="admin-product-status-field">وضعیت</label><select class="input" id="admin-product-status-field" name="status"><option value="active" ${product?.status==='active'?'selected':''}>فعال</option><option value="draft" ${product?.status==='draft'?'selected':''}>پیش‌نویس</option><option value="out-of-stock" ${product?.status==='out-of-stock'?'selected':''}>ناموجود</option></select></div><div class="field"><label for="admin-product-fit">یادداشت قالب</label><input class="input" id="admin-product-fit" name="fit" value="${product?.fit||'قالب استاندارد'}"></div></div><div class="field"><label for="admin-product-colors">نام رنگ‌ها</label><input class="input" id="admin-product-colors" name="colorNames" value="${product?.colorNames?.join('، ')||'مشکی، کرم'}"><small>نام رنگ‌ها را با ویرگول جدا کنید</small></div><div class="field"><label for="admin-product-seo">عنوان SEO</label><input class="input" id="admin-product-seo" name="seoTitle" maxlength="60" value="${product?.name?`${product.name} | توتو فشن`:''}"></div><div class="field"><label for="admin-product-image">تصویر محصول</label><input class="input" id="admin-product-image" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp"><small>در صورت انتخاب، تصویر فعلی جایگزین می‌شود.</small></div><div class="admin-form-actions">${product?`<button class="text-button" type="button" data-delete-product="${product.id}">${icon('trash','icon icon--sm')} حذف محصول</button>`:''}<button class="button button--outline" type="button" data-admin-action="close-drawer">انصراف</button><button class="button" type="submit">ذخیره محصول</button></div></form>`;

const orderDrawer = order => `<div class="admin-drawer__head"><div><p class="eyebrow">مدیریت سفارش</p><h2>سفارش ${order.orderNumber}</h2></div><button class="icon-button" type="button" data-admin-action="close-drawer" aria-label="بستن">${icon('close')}</button></div><form class="admin-drawer__body" id="admin-order-form"><input type="hidden" name="id" value="${order.id}"><div class="admin-panel" style="padding:12px"><strong>${order.customer}</strong><p style="margin:3px 0">${toPersianDigits(order.mobile)} · ${formatPrice(order.total)}</p><small>${order.paymentMethod}</small></div><div class="field"><label for="admin-order-status-field">وضعیت سفارش</label><select class="input" id="admin-order-status-field" name="status">${['paid','processing','ready','shipped','delivered','cancelled','returned'].map(status => `<option value="${status}" ${order.status===status?'selected':''}>${statusLabel(status)}</option>`).join('')}</select></div><div class="field"><label for="admin-tracking-code">کد رهگیری ارسال</label><input class="input" id="admin-tracking-code" name="trackingCode" value="${order.trackingCode || ''}"></div><div class="field"><label for="admin-order-note">یادداشت داخلی</label><textarea class="input" id="admin-order-note" name="note" rows="4" placeholder="فقط برای مدیران قابل مشاهده است"></textarea></div><div class="admin-form-actions"><button class="button button--outline" type="button" data-admin-action="close-drawer">انصراف</button><button class="button" type="submit">ذخیره تغییرات</button></div></form>`;

const customerDrawer=customer=>{const saved={status:customer.status==='inactive'?'restricted':'active',note:customer.note||''};return `<div class="admin-drawer__head"><div><p class="eyebrow">پروفایل مشتری</p><h2>${customer.name}</h2></div><button class="icon-button" type="button" data-admin-action="close-drawer">${icon('close')}</button></div><form class="admin-drawer__body" id="admin-customer-form"><input type="hidden" name="id" value="${customer.id}"><div class="admin-kpi-grid"><article class="admin-kpi"><span>تعداد سفارش</span><strong>${toPersianDigits(customer.orders)}</strong></article><article class="admin-kpi"><span>مجموع خرید</span><strong>${compactPrice(customer.spent)}</strong></article></div><div class="admin-panel"><h3>اطلاعات حساب</h3><p>${customer.mobile}</p><p>سطح وفاداری: ${customer.level}</p><p>تاریخ عضویت: ${customer.joined}</p></div><div class="field"><label for="admin-customer-status">وضعیت حساب</label><select class="input" id="admin-customer-status" name="status"><option value="active" ${saved.status!=='restricted'?'selected':''}>فعال</option><option value="restricted" ${saved.status==='restricted'?'selected':''}>محدودشده</option></select></div><div class="field"><label for="admin-customer-note">یادداشت مشتری</label><textarea class="input" id="admin-customer-note" name="note" rows="5">${saved.note||''}</textarea></div><div class="admin-form-actions"><button class="button button--outline" type="button" data-admin-action="close-drawer">انصراف</button><button class="button" type="submit">ذخیره پرونده مشتری</button></div></form>`;};

const managementDrawer=title=>{const saved=localStore.get('toto-admin-management',{})[title]||{};return `<div class="admin-drawer__head"><div><p class="eyebrow">ویرایش بخش</p><h2>${title}</h2></div><button class="icon-button" type="button" data-admin-action="close-drawer">${icon('close')}</button></div><form class="admin-drawer__body" id="admin-management-form"><input type="hidden" name="key" value="${title}"><div class="field"><label for="management-title">عنوان نمایشی</label><input class="input" id="management-title" name="title" required value="${saved.title||title}"></div><div class="field"><label for="management-description">توضیحات</label><textarea class="input" id="management-description" name="description" rows="5">${saved.description||''}</textarea></div><div class="form-row"><div class="field"><label for="management-status">وضعیت</label><select class="input" id="management-status" name="status"><option value="published" ${saved.status!=='draft'?'selected':''}>منتشرشده</option><option value="draft" ${saved.status==='draft'?'selected':''}>پیش‌نویس</option></select></div><div class="field"><label for="management-publish">زمان انتشار</label><input class="input" id="management-publish" name="publishAt" type="datetime-local" value="${saved.publishAt||''}"></div></div><div class="admin-form-actions"><button class="button button--outline" type="button" data-admin-action="close-drawer">انصراف</button><button class="button" type="submit">ذخیره تنظیمات</button></div></form>`;};
const roleDrawer=role=>{const saved=localStore.get('toto-admin-role-permissions',{})[role.id]||['products','orders'],permissions=[['products','مدیریت محصولات'],['orders','مدیریت سفارش‌ها'],['customers','مشاهده مشتریان'],['content','مدیریت محتوا'],['reports','دریافت گزارش'],['gallery','تأیید گالری مشتریان']];return `<div class="admin-drawer__head"><div><p class="eyebrow">کنترل دسترسی</p><h2>${role.label}</h2></div><button class="icon-button" type="button" data-admin-action="close-drawer">${icon('close')}</button></div><form class="admin-drawer__body" id="admin-role-form"><input type="hidden" name="id" value="${role.id}"><div class="preference-list">${permissions.map(([value,label])=>`<label class="preference-row"><span><strong>${label}</strong><small>فعال‌سازی این دسترسی برای کاربران نقش</small></span><input class="switch" type="checkbox" name="permission" value="${value}" ${saved.includes(value)?'checked':''}><span class="switch-ui"></span></label>`).join('')}</div><div class="admin-form-actions"><button class="button button--outline" type="button" data-admin-action="close-drawer">انصراف</button><button class="button" type="submit">ذخیره مجوزها</button></div></form>`;};
const inventoryDrawer=()=>`<div class="admin-drawer__head"><div><p class="eyebrow">ویرایش سریع</p><h2>ثبت موجودی گروهی</h2></div><button class="icon-button" type="button" data-admin-action="close-drawer">${icon('close')}</button></div><form class="admin-drawer__body" id="admin-inventory-form"><div class="field"><label for="inventory-product">محصول</label><select class="input" id="inventory-product" name="id">${state.products.map(product=>`<option value="${product.id}">${product.name} — موجودی ${toPersianDigits(product.inventory)}</option>`).join('')}</select></div><div class="field"><label for="inventory-amount">موجودی جدید</label><input class="input" id="inventory-amount" name="inventory" type="number" min="0" required></div><div class="admin-form-actions"><button class="button button--outline" type="button" data-admin-action="close-drawer">انصراف</button><button class="button" type="submit">ثبت موجودی</button></div></form>`;
const notificationsDrawer=()=>`<div class="admin-drawer__head"><div><p class="eyebrow">مرکز اعلان‌ها</p><h2>کارهای نیازمند توجه</h2></div><button class="icon-button" type="button" data-admin-action="close-drawer">${icon('close')}</button></div><div class="admin-drawer__body"><div class="admin-task-list"><button type="button" data-admin-nav="orders">${icon('clock')}<span>۱۷ سفارش در انتظار بررسی</span></button><button type="button" data-admin-nav="inventory">${icon('package')}<span>۹ هشدار موجودی پایین</span></button><button type="button" data-admin-nav="gallery">${icon('image')}<span>${toPersianDigits(localStore.get('toto-customer-gallery',[]).filter(item=>item.status==='pending').length)} عکس در صف گالری</span></button></div></div>`;

const csvEscape = value => `"${String(value ?? '').replaceAll('"','""')}"`;
const exportCsv = async type => {
  let rows, headers;
  if (type === 'products') { headers=['کد','نام','وضعیت','قیمت','موجودی']; rows=state.products.map(p=>[p.sku,p.name,statusLabel(p.status),p.price,p.inventory]); }
  else if (type === 'customers') { headers=['کد','نام','موبایل','سطح','سفارش','مجموع خرید']; rows=adminCustomers.map(c=>[c.id,c.name,c.mobile,c.level,c.orders,c.spent]); }
  else { headers=['شماره سفارش','مشتری','وضعیت','مبلغ','تاریخ']; rows=state.orders.map(o=>[o.orderNumber,o.customer,o.statusLabel,o.total,o.placedAt]); }
  await api.exportAdminReport(type, rows);
  const csv='\ufeff'+[headers,...rows].map(row=>row.map(csvEscape).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=`toto-${type}-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url); toast('فایل CSV آماده شد.');
};

const bindSectionInputs = () => {
  document.getElementById('admin-product-search')?.addEventListener('input', debounce(event => { state.productQuery=event.target.value; document.querySelector('.admin-data-table-wrap')?.replaceWith(new DOMParser().parseFromString(productTable(productRows()),'text/html').body.firstElementChild); },180));
  document.getElementById('admin-product-status')?.addEventListener('change', event => { state.productStatus=event.target.value; renderSection(); });
  document.getElementById('admin-order-search')?.addEventListener('input', debounce(event => { state.orderQuery=event.target.value; document.querySelector('.admin-data-table-wrap')?.replaceWith(new DOMParser().parseFromString(orderTable(orderRows()),'text/html').body.firstElementChild); },180));
  document.getElementById('admin-order-status')?.addEventListener('change', event => { state.orderStatus=event.target.value; renderSection(); });
};

const navigate = id => { if (!sections.some(item=>item.id===id)) return; state.section=id; location.hash=id; closeSidebar(); closeDrawer(); renderSection(); document.getElementById('admin-content')?.focus(); };

root.innerHTML = shellTemplate();
renderSection();
debug('admin shell rendered', { rootFound: Boolean(root), section: state.section });
document.getElementById('admin-global-search')?.addEventListener('keydown',event=>{if(event.key!=='Enter')return;const query=event.currentTarget.value.trim();if(!query)return;if(state.products.some(product=>`${product.name} ${product.sku}`.includes(query))){state.productQuery=query;navigate('products');}else if(state.orders.some(order=>`${order.orderNumber} ${order.customer} ${order.mobile}`.includes(query))){state.orderQuery=query;navigate('orders');}else if(adminCustomers.some(customer=>`${customer.name} ${customer.mobile}`.includes(query)))navigate('customers');else toast('نتیجه‌ای در محصولات، سفارش‌ها یا مشتریان پیدا نشد.','info');});

root.addEventListener('click', event => {
  const submitButton = event.target.closest('#admin-product-form [type="submit"]');
  if (submitButton) {
    const form = submitButton.closest('form');
    const invalidFields = form ? [...form.elements].filter(field => typeof field.checkValidity === 'function' && !field.checkValidity()).map(field => ({ name: field.name, id: field.id, value: field.type === 'file' ? `[files:${field.files?.length || 0}]` : field.value, validationMessage: field.validationMessage })) : [];
    debug('product save button:click', {
      formFound: Boolean(form),
      formId: form?.getAttribute?.('id') || '',
      checkValidity: form?.checkValidity?.(),
      invalidFields,
      disabled: submitButton.disabled
    });
  }
}, true);

root.addEventListener('invalid', event => {
  const field = event.target;
  if (field?.closest?.('#admin-product-form')) {
    debugWarn('product form:invalid-field', { name: field.name, id: field.id, value: field.type === 'file' ? `[files:${field.files?.length || 0}]` : field.value, validationMessage: field.validationMessage });
  }
}, true);

root.addEventListener('click', event => {
  const nav=event.target.closest('[data-admin-nav]'); if(nav){ event.preventDefault(); navigate(nav.dataset.adminNav); return; }
  const action=event.target.closest('[data-admin-action]')?.dataset.adminAction;
  if(action==='open-sidebar') openSidebar(); if(action==='close-sidebar') { closeSidebar(); closeDrawer(); } if(action==='close-drawer') closeDrawer(); if(action==='retry') renderSection(); if(action==='print') window.print(); if(action==='admin-logout'){api.adminLogout().finally(()=>{closeDrawer();renderSection();});}
  if(action==='clear-product-filters'){ state.productQuery=''; state.productStatus='all'; renderSection(); }
  if(action==='bulk-inventory') openDrawer(inventoryDrawer());
  if(action==='notifications') openDrawer(notificationsDrawer());
  if(action==='admin-profile') openDrawer(`<div class="admin-drawer__head"><div><p class="eyebrow">حساب مدیر</p><h2>سارا مدیر</h2></div><button class="icon-button" type="button" data-admin-action="close-drawer">${icon('close')}</button></div><div class="admin-drawer__body"><div class="admin-panel"><strong>مدیر کل فروشگاه</strong><p>دسترسی کامل به فروشگاه، مشتریان، محتوا و گزارش‌ها</p></div><div class="field"><label>ایمیل کاری</label><input class="input" value="حساب متصل به سرور" readonly></div><button class="button button--outline button--block" type="button" data-admin-action="admin-logout">خروج از پنل</button><button class="button button--outline" type="button" data-admin-action="close-drawer">بستن</button></div>`);
  const range=event.target.closest('[data-admin-range]'); if(range){ state.range=range.dataset.adminRange; renderSection(); }
  const editProduct=event.target.closest('[data-edit-product]'); if(editProduct){ openDrawer(productDrawer(state.products.find(p=>p.id===editProduct.dataset.editProduct))); }
  const deleteProduct=event.target.closest('[data-delete-product]'); if(deleteProduct){ if(confirm('این محصول از دیتابیس حذف شود؟')) api.deleteAdminProduct(deleteProduct.dataset.deleteProduct).then(()=>{closeDrawer();renderSection();toast('محصول حذف شد.','info');}).catch(error=>toast(error.message,'error')); return; }
  if(event.target.closest('[data-new-product]')) openDrawer(productDrawer(null));
  const editOrder=event.target.closest('[data-edit-order]'); if(editOrder){ openDrawer(orderDrawer(state.orders.find(o=>o.id===editOrder.dataset.editOrder))); }
  const customerButton=event.target.closest('[data-customer-detail]'); if(customerButton){ openDrawer(customerDrawer(adminCustomers.find(c=>c.id===customerButton.dataset.customerDetail))); }
  const exportButton=event.target.closest('[data-export]'); if(exportButton){exportCsv(exportButton.dataset.export);return;}
  const management=event.target.closest('[data-management-action]');if(management){const title=management.dataset.managementAction;if(title==='گالری مشتریان')navigate('gallery');else openDrawer(managementDrawer(title));}
  const role=event.target.closest('[data-role]');if(role)openDrawer(roleDrawer(adminRoles.find(item=>item.id===role.dataset.role)));
  const galleryAction=event.target.closest('[data-gallery-status]');if(galleryAction){const entries=localStore.get('toto-customer-gallery',[]),id=galleryAction.dataset.galleryId,next=galleryAction.dataset.galleryStatus==='delete'?entries.filter(item=>item.id!==id):entries.map(item=>item.id===id?{...item,status:galleryAction.dataset.galleryStatus}:item);localStore.set('toto-customer-gallery',next);renderSection();toast(galleryAction.dataset.galleryStatus==='approved'?'عکس در گالری منتشر شد.':galleryAction.dataset.galleryStatus==='delete'?'عکس حذف شد.':'عکس برای ویرایش به مشتری برگشت.','info');}
});

root.addEventListener('submit', async event => {
  const submittedForm = event.target;
  const submittedFormId = submittedForm?.getAttribute?.('id') || '';
  debug('submit event:caught', { formId: submittedFormId, target: submittedForm?.tagName, defaultPrevented: event.defaultPrevented });
  if(submittedFormId==='admin-login-form'){
    event.preventDefault();const form=event.target;const values=Object.fromEntries(new FormData(form));const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='در حال ورود...';try{await api.adminLogin(values.email,values.password);toast('ورود مدیر انجام شد.');renderSection();}catch(error){document.getElementById('admin-content').innerHTML=adminLoginTemplate(error.message);}return;
  }
  if(submittedFormId==='admin-product-form'){
    event.preventDefault();
    const form=event.target;
    const rawFormData = new FormData(form);
    const values=Object.fromEntries(rawFormData);
    const button=form.querySelector('[type="submit"]');
    debug('product form:submit:start', {
      id: values.id,
      name: values.name,
      priceRaw: values.price,
      inventoryRaw: values.inventory,
      category: values.category,
      sizesRaw: values.sizes,
      colorNamesRaw: values.colorNames,
      status: values.status,
      hasImage: Boolean(form.querySelector('[name="imageFile"]')?.files?.[0]),
      formValidity: form.checkValidity()
    });
    button.disabled=true; button.textContent='در حال ذخیره...';
    try {
      const sizes=String(values.sizes||'').split(/[،,]/).map(item=>item.trim()).filter(Boolean);
      const colorNames=String(values.colorNames||'').split(/[،,]/).map(item=>item.trim()).filter(Boolean);
      const changes={name:String(values.name||'').trim(),price:Number(toEnglishDigits(values.price)),inventory:Number(toEnglishDigits(values.inventory)),category:values.category,sizes,colorNames,colors:colorNames.map((_,index)=>['#111111','#d9d0c3','#7899aa','#b7a78e'][index%4]),status:values.status,fit:values.fit,seoTitle:values.seoTitle};
      debug('product form:payload-built', { id: values.id, isEdit: Boolean(values.id), changes, priceIsFinite: Number.isFinite(changes.price), inventoryIsFinite: Number.isFinite(changes.inventory) });
      if(!changes.name||!changes.price||!sizes.length){
        debugWarn('product form:client-validation-failed', { hasName: Boolean(changes.name), price: changes.price, sizes });
        throw new Error('نام، قیمت و دست‌کم یک سایز را کامل کنید.');
      }
      const imageFile=form.querySelector('[name="imageFile"]')?.files?.[0];
      if(imageFile){
        debug('product image:upload:start', { name: imageFile.name, type: imageFile.type, size: imageFile.size });
        const uploaded=await api.uploadAdminProductImage(imageFile);
        debug('product image:upload:success', uploaded);
        changes.image=uploaded.url;changes.secondaryImage=uploaded.url;
      }
      debug('product api:save:start', { operation: values.id ? 'PATCH existing product' : 'POST new product', productId: values.id || null, changes });
      const savedProduct=values.id?await api.updateAdminProduct(values.id,changes):await api.createAdminProduct(changes);
      debug('product api:save:success', { savedProduct });
      if(values.id)state.products=state.products.map(product=>product.id===values.id?savedProduct:product);else state.products.unshift(savedProduct);
      closeDrawer();renderSection();toast('اطلاعات محصول در دیتابیس ذخیره شد.');announce('محصول ذخیره شد.');
      debug('product form:submit:done', { id: savedProduct?.id, name: savedProduct?.name });
    }
    catch(error){
      debugError('product form:submit:error', errorSnapshot(error));
      toast(error.message,'error'); button.disabled=false; button.textContent='ذخیره محصول';
    }
  }
  if(submittedFormId==='admin-order-form'){
    event.preventDefault(); const form=event.target; const values=Object.fromEntries(new FormData(form)); const button=form.querySelector('[type="submit"]'); button.disabled=true;
    try { const result=await api.updateAdminOrder(values.id,{status:values.status,trackingCode:values.trackingCode,note:values.note}); state.orders=state.orders.map(order=>order.id===values.id?result:order); closeDrawer(); renderSection(); toast('وضعیت سفارش در دیتابیس به‌روزرسانی شد.'); }
    catch(error){ toast(error.message,'error'); button.disabled=false; }
  }
  if(submittedFormId==='admin-inventory-form'){event.preventDefault();const values=Object.fromEntries(new FormData(event.target)),inventory=Math.max(0,Number(toEnglishDigits(values.inventory)));try{const product=await api.updateAdminInventory(values.id,inventory);state.products=state.products.map(item=>item.id===values.id?product:item);closeDrawer();renderSection();toast('موجودی محصول در دیتابیس به‌روزرسانی شد.');}catch(error){toast(error.message,'error');}}
  if(submittedFormId==='admin-customer-form'){event.preventDefault();const values=Object.fromEntries(new FormData(event.target));try{const customer=await api.updateAdminCustomer(values.id,{status:values.status==='restricted'?'inactive':'active',note:String(values.note||'').trim()});const index=adminCustomers.findIndex(item=>item.id===values.id);if(index>=0)adminCustomers[index]=customer;closeDrawer();renderSection();toast('پرونده مشتری ذخیره شد.');}catch(error){toast(error.message,'error');}}
  if(submittedFormId==='admin-management-form'){event.preventDefault();const values=Object.fromEntries(new FormData(event.target));try{const value={title:String(values.title||'').trim(),description:String(values.description||'').trim(),status:values.status,publishAt:values.publishAt};await api.saveAdminSetting(`management:${values.key}`,value);const saved=localStore.get('toto-admin-management',{});saved[values.key]=value;localStore.set('toto-admin-management',saved);closeDrawer();toast('تنظیمات بخش در دیتابیس ذخیره شد.');}catch(error){toast(error.message,'error');}}
  if(submittedFormId==='admin-role-form'){event.preventDefault();const data=new FormData(event.target);try{const permissions=data.getAll('permission');await api.saveAdminSetting(`role:${data.get('id')}`,{permissions});const saved=localStore.get('toto-admin-role-permissions',{});saved[data.get('id')]=permissions;localStore.set('toto-admin-role-permissions',saved);closeDrawer();toast('مجوزهای نقش ذخیره شد.');}catch(error){toast(error.message,'error');}}
});

document.addEventListener('keydown', event => { if(event.key==='Escape'){ closeDrawer(); closeSidebar(); } });
window.addEventListener('hashchange', () => { const next=location.hash.replace('#',''); if(next&&next!==state.section) navigate(next); });
