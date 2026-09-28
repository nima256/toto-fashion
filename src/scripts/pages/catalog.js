import { products } from '../../data/mock-data.js';
import { productCardTemplate } from '../components/product-card.js?v=3';
import { icon, formatPrice, toPersianDigits, toEnglishDigits } from '../core/utils.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const unique = key => [...new Set(products.map(item => item[key]).filter(Boolean))];
const options = {
  category: unique('category'), fabric: unique('fabric'), season: unique('season'), style: unique('style'), occasion: unique('occasion')
};
const sizesForState = state => {
  const source = state.category?.length ? products.filter(product => state.category.includes(product.category)) : products;
  return [...new Set(source.flatMap(product => product.sizes))];
};

const paramConfig = ['category', 'size', 'fabric', 'season', 'style', 'occasion'];

const readState = () => {
  const params = new URLSearchParams(location.search);
  const state = { q: params.get('q') || '', sort: params.get('sort') || 'newest', maxPrice: Number(params.get('maxPrice') || 4000000), discount: params.get('discount') === '1', availability: params.get('availability') === '1', new: params.get('new') === '1', page: Number(params.get('page') || 1) };
  paramConfig.forEach(key => { state[key] = params.get(key)?.split(',').filter(Boolean) || []; });
  return state;
};

const writeState = state => {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.sort !== 'newest') params.set('sort', state.sort);
  if (state.maxPrice < 4000000) params.set('maxPrice', state.maxPrice);
  paramConfig.forEach(key => { if (state[key]?.length) params.set(key, state[key].join(',')); });
  ['discount', 'availability', 'new'].forEach(key => { if (state[key]) params.set(key, '1'); });
  if (state.page > 1) params.set('page', state.page);
  history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`);
};

const filterSection = (title, key, values, state, prefix, attributes = '') => `<fieldset class="filter-group" ${attributes}><legend>${title}</legend><div class="filter-options">${values.map((value, index) => `<label class="check-row" for="${prefix}-${key}-${index}"><input id="${prefix}-${key}-${index}" type="checkbox" data-filter="${key}" value="${escapeHtml(value)}" ${state[key].includes(value) ? 'checked' : ''}><span>${escapeHtml(value)}</span></label>`).join('')}</div></fieldset>`;

const filterForm = (state, prefix) => `<div class="filter-panel__body">
  ${filterSection('دسته‌بندی', 'category', options.category, state, prefix)}
  ${filterSection('سایز', 'size', sizesForState(state), state, prefix, 'data-size-filter')}
  <fieldset class="filter-group"><legend>بازه قیمت</legend><label class="range-label" for="${prefix}-price"><span>تا</span><output data-price-output>${formatPrice(state.maxPrice)}</output></label><input id="${prefix}-price" class="range" type="range" min="1000000" max="4000000" step="100000" value="${state.maxPrice}" data-filter="maxPrice"></fieldset>
  ${filterSection('نوع پارچه', 'fabric', options.fabric, state, prefix)}
  ${filterSection('فصل', 'season', options.season, state, prefix)}
  ${filterSection('استایل', 'style', options.style, state, prefix)}
  ${filterSection('موقعیت استفاده', 'occasion', options.occasion, state, prefix)}
  <fieldset class="filter-group"><legend>ویژگی محصول</legend><div class="filter-options"><label class="check-row"><input type="checkbox" data-filter="discount" ${state.discount ? 'checked' : ''}><span>دارای تخفیف</span></label><label class="check-row"><input type="checkbox" data-filter="availability" ${state.availability ? 'checked' : ''}><span>فقط کالاهای موجود</span></label><label class="check-row"><input type="checkbox" data-filter="new" ${state.new ? 'checked' : ''}><span>محصولات جدید</span></label></div></fieldset>
</div>`;
const mobileFilterForm = state => `${filterForm(state, 'mobile')}<div class="filter-sheet__actions"><button class="button button--outline" type="button" data-catalog-action="clear-mobile">پاک کردن</button><button class="button" type="button" data-catalog-action="apply-mobile">نمایش <span id="mobile-result-count">۰</span> محصول</button></div>`;

const matchesQuery = (product, query) => {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  return `${product.name} ${product.category} ${product.type} ${product.style} ${product.fabric}`.toLowerCase().includes(q);
};

const getFiltered = state => products.filter(product => {
  if (!matchesQuery(product, state.q)) return false;
  if (state.category.length && !state.category.includes(product.category)) return false;
  if (state.size.length && !state.size.some(size => product.sizes.includes(size) && !product.unavailableSizes.includes(size))) return false;
  if (state.fabric.length && !state.fabric.includes(product.fabric)) return false;
  if (state.season.length && !state.season.includes(product.season)) return false;
  if (state.style.length && !state.style.includes(product.style)) return false;
  if (state.occasion.length && !state.occasion.includes(product.occasion)) return false;
  if (product.price > state.maxPrice) return false;
  if (state.discount && !product.discount) return false;
  if (state.availability && !product.availability) return false;
  if (state.new && !product.isNew) return false;
  return true;
});

const sortProducts = (items, sort) => [...items].sort((a, b) => ({
  newest: () => b.createdAt.localeCompare(a.createdAt), bestseller: () => Number(b.bestSeller) - Number(a.bestSeller) || b.popularity - a.popularity,
  popular: () => b.rating - a.rating, cheapest: () => a.price - b.price, expensive: () => b.price - a.price, discount: () => (b.discount || 0) - (a.discount || 0)
}[sort] || (() => 0))());

const activeEntries = state => {
  const entries = [];
  paramConfig.forEach(key => state[key].forEach(value => entries.push({ key, value, label: value })));
  if (state.maxPrice < 4000000) entries.push({ key: 'maxPrice', value: state.maxPrice, label: `تا ${formatPrice(state.maxPrice)}` });
  if (state.discount) entries.push({ key: 'discount', value: true, label: 'دارای تخفیف' });
  if (state.availability) entries.push({ key: 'availability', value: true, label: 'فقط موجودها' });
  if (state.new) entries.push({ key: 'new', value: true, label: 'محصولات جدید' });
  return entries;
};

export const initCatalog = () => {
  const root = document.getElementById('catalog-root'); if (!root) return;
  const isSearch = document.body.dataset.page === 'search';
  let state = readState();
  let mobileDraft = structuredClone(state);

  if (isSearch) {
    const input = document.getElementById('search-page-input'); input.value = state.q;
    document.getElementById('search-page-form').addEventListener('submit', event => { event.preventDefault(); state.q = input.value.trim(); state.page = 1; writeState(state); render(); });
  }

  root.innerHTML = `<div class="catalog-toolbar"><div><strong id="catalog-count"></strong><span id="catalog-query-label"></span></div><div class="catalog-toolbar__actions"><button class="button button--outline mobile-filter-button" type="button" data-catalog-action="open-filters">${icon('filter')} فیلترها <span data-active-filter-count></span></button><label class="sort-control"><span>${icon('sort')} مرتب‌سازی</span><select id="catalog-sort"><option value="newest">جدیدترین</option><option value="bestseller">پرفروش‌ترین</option><option value="popular">محبوب‌ترین</option><option value="cheapest">ارزان‌ترین</option><option value="expensive">گران‌ترین</option><option value="discount">بیشترین تخفیف</option></select></label></div></div><div class="active-filters" id="active-filters"></div><div class="catalog-layout"><aside class="filter-panel" aria-label="فیلتر محصولات"><div class="filter-panel__head"><h2>فیلترها</h2><button class="text-button" type="button" data-catalog-action="clear">پاک کردن همه</button></div><form id="desktop-filters">${filterForm(state, 'desktop')}</form></aside><section class="catalog-results"><div class="product-grid catalog-grid" id="catalog-grid"></div><div id="catalog-empty"></div><div class="load-more-wrap" id="load-more-wrap"></div></section></div>${isSearch ? '<div class="search-discovery" id="search-discovery"></div>' : ''}<div class="dialog-overlay filter-sheet" id="filter-sheet" aria-hidden="true"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="filter-sheet-title"><div class="dialog__head"><h2 id="filter-sheet-title">فیلتر محصولات</h2><button class="icon-button" type="button" data-catalog-action="close-filters" aria-label="بستن فیلترها">${icon('close')}</button></div><form id="mobile-filters" class="dialog__body">${mobileFilterForm(mobileDraft)}</form></section></div>`;

  const sort = document.getElementById('catalog-sort'); sort.value = state.sort;
  const applyFormToState = (form, target) => {
    paramConfig.forEach(key => { target[key] = [...form.querySelectorAll(`[data-filter="${key}"]:checked`)].map(input => input.value); });
    target.maxPrice = Number(form.querySelector('[data-filter="maxPrice"]').value);
    ['discount', 'availability', 'new'].forEach(key => { target[key] = form.querySelector(`[data-filter="${key}"]`).checked; });
    target.page = 1;
  };
  const syncPriceOutputs = form => { const range = form.querySelector('[data-filter="maxPrice"]'); form.querySelector('[data-price-output]').textContent = formatPrice(Number(range.value)); };
  const refreshSizeFilter = (form, target, prefix) => {
    const allowed = sizesForState(target); target.size = target.size.filter(size => allowed.includes(size));
    const current = form.querySelector('[data-size-filter]');
    if (current) current.outerHTML = filterSection('سایز', 'size', allowed, target, prefix, 'data-size-filter');
  };
  const estimateMobile = event => { const form = document.getElementById('mobile-filters'); applyFormToState(form, mobileDraft); if (event?.target?.dataset.filter === 'category') refreshSizeFilter(form, mobileDraft, 'mobile'); document.getElementById('mobile-result-count').textContent = toPersianDigits(getFiltered(mobileDraft).length); syncPriceOutputs(form); };
  const renderDiscovery = filtered => {
    const discovery = document.getElementById('search-discovery'); if (!discovery) return;
    if (!state.q) { discovery.innerHTML = ''; return; }
    const resultIds = new Set(filtered.map(product => product.id)); const categories = new Set(filtered.map(product => product.category));
    const suggested = [...products].filter(product => !resultIds.has(product.id)).sort((a,b) => Number(b.bestSeller) - Number(a.bestSeller) || b.rating - a.rating).slice(0,4);
    const suggestedIds = new Set(suggested.map(product => product.id));
    let related = products.filter(product => !resultIds.has(product.id) && !suggestedIds.has(product.id) && (categories.has(product.category) || filtered.some(item => item.style === product.style))).slice(0,4);
    if (related.length < 3) related = products.filter(product => !resultIds.has(product.id) && !suggestedIds.has(product.id)).sort((a,b) => b.rating - a.rating).slice(0,4);
    discovery.innerHTML = `<section class="search-discovery__section" aria-labelledby="suggested-products-title"><div class="section-heading"><div><p class="eyebrow">انتخاب‌های محبوب</p><h2 id="suggested-products-title">محصولات پیشنهادی</h2><p>پرفروش‌ترین گزینه‌هایی که ممکن است دوست داشته باشید.</p></div></div><div class="product-grid related-grid">${suggested.map(productCardTemplate).join('')}</div></section><section class="search-discovery__section search-discovery__section--blue" aria-labelledby="related-products-title"><div class="section-heading"><div><p class="eyebrow">مرتبط با جست‌وجوی شما</p><h2 id="related-products-title">محصولات مرتبط</h2><p>انتخاب‌هایی نزدیک به دسته و استایل نتایج شما.</p></div></div><div class="product-row">${related.map(productCardTemplate).join('')}</div></section>`;
  };

  const render = () => {
    writeState(state);
    const filtered = sortProducts(getFiltered(state), state.sort);
    const visible = filtered.slice(0, state.page * 8);
    document.getElementById('catalog-count').textContent = `${toPersianDigits(filtered.length)} محصول`;
    document.getElementById('catalog-query-label').textContent = state.q ? ` برای «${state.q}»` : '';
    if (isSearch) document.title = state.q ? `نتایج «${state.q}» | توتو فشن` : 'جست‌وجو | توتو فشن';
    const grid = document.getElementById('catalog-grid'); const empty = document.getElementById('catalog-empty');
    grid.innerHTML = visible.map(productCardTemplate).join('');
    grid.hidden = !visible.length;
    empty.innerHTML = visible.length ? '' : `<div class="empty-state"><span class="empty-state__icon">${icon('search', 'icon icon--lg')}</span><h2>محصولی با این انتخاب‌ها پیدا نشد</h2><p>${state.q ? `برای «${escapeHtml(state.q)}» نتیجه دقیقی نداریم. املای عبارت را بررسی کنید یا فیلترها را کمتر کنید.` : 'یک یا چند فیلتر را حذف کنید تا انتخاب‌های بیشتری ببینید.'}</p><div class="empty-state__actions"><button class="button button--outline" data-catalog-action="clear">پاک کردن فیلترها</button><a class="button" href="./shop">مشاهده همه محصولات</a></div></div>`;
    const load = document.getElementById('load-more-wrap'); load.innerHTML = visible.length < filtered.length ? `<p>نمایش ${toPersianDigits(visible.length)} از ${toPersianDigits(filtered.length)} محصول</p><button class="button button--outline" type="button" data-catalog-action="load-more">نمایش محصولات بیشتر</button>` : (filtered.length ? `<p>همه محصولات نمایش داده شد.</p>` : '');
    renderDiscovery(filtered);
    const chips = activeEntries(state); document.getElementById('active-filters').innerHTML = chips.length ? `${chips.map(entry => `<button class="filter-chip" type="button" data-remove-filter="${entry.key}" data-filter-value="${escapeHtml(entry.value)}">${escapeHtml(entry.label)} ${icon('close', 'icon icon--sm')}</button>`).join('')}<button class="text-button" type="button" data-catalog-action="clear">پاک کردن همه فیلترها</button>` : '';
    document.querySelectorAll('[data-active-filter-count]').forEach(el => { el.textContent = chips.length ? toPersianDigits(chips.length) : ''; });
    document.dispatchEvent(new CustomEvent('toto:products-rendered'));
  };

  document.getElementById('desktop-filters').addEventListener('change', event => { applyFormToState(event.currentTarget, state); if (event.target.dataset.filter === 'category') refreshSizeFilter(event.currentTarget, state, 'desktop'); syncPriceOutputs(event.currentTarget); render(); });
  document.getElementById('desktop-filters').addEventListener('input', event => { if (event.target.matches('[type="range"]')) { applyFormToState(event.currentTarget, state); syncPriceOutputs(event.currentTarget); render(); } });
  document.getElementById('mobile-filters').addEventListener('change', estimateMobile); document.getElementById('mobile-filters').addEventListener('input', estimateMobile);
  sort.addEventListener('change', () => { state.sort = sort.value; state.page = 1; render(); });

  root.addEventListener('click', event => {
    const action = event.target.closest('[data-catalog-action]')?.dataset.catalogAction;
    if (action === 'load-more') { state.page += 1; render(); }
    if (action === 'clear') { location.href = isSearch && state.q ? `./search?q=${encodeURIComponent(state.q)}` : './shop'; }
    if (action === 'open-filters') { mobileDraft = structuredClone(state); document.getElementById('mobile-filters').innerHTML = mobileFilterForm(mobileDraft); document.getElementById('filter-sheet').classList.add('is-open'); document.getElementById('filter-sheet').setAttribute('aria-hidden', 'false'); document.body.classList.add('is-locked'); estimateMobile(); }
    if (action === 'close-filters') { document.getElementById('filter-sheet').classList.remove('is-open'); document.getElementById('filter-sheet').setAttribute('aria-hidden', 'true'); document.body.classList.remove('is-locked'); }
    if (action === 'clear-mobile') { document.getElementById('mobile-filters').reset(); document.getElementById('mobile-filters').querySelector('[data-filter="maxPrice"]').value = 4000000; estimateMobile(); }
    if (action === 'apply-mobile') { state = structuredClone(mobileDraft); document.getElementById('filter-sheet').classList.remove('is-open'); document.getElementById('filter-sheet').setAttribute('aria-hidden', 'true'); document.body.classList.remove('is-locked'); writeState(state); location.reload(); }
    const remove = event.target.closest('[data-remove-filter]');
    if (remove) { const key = remove.dataset.removeFilter; const value = remove.dataset.filterValue; if (Array.isArray(state[key])) state[key] = state[key].filter(item => item !== value); else if (key === 'maxPrice') state.maxPrice = 4000000; else state[key] = false; state.page = 1; writeState(state); location.reload(); }
  });
  render();
};
