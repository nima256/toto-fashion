import { products, productsState } from '../../data/mock-data.js';
import { renderProductGrid, productsUnavailableTemplate } from '../components/product-card.js';
import { getSavedIds, setSaved } from '../core/saved-store.js';
import { getSession } from '../core/account-store.js';
import { icon, toPersianDigits } from '../core/utils.js';

export const initCollection = ({ toast } = {}) => {
  const root = document.getElementById('collection-root'); if (!root) return;

  const render = () => {
    if (productsState.error) { root.innerHTML = productsUnavailableTemplate(productsState.error); return; }
    const items = getSavedIds().map(id => products.find(product => product.id === id)).filter(Boolean);
    const note = getSession() ? '' : '<p class="mock-note">این فهرست فعلاً در همین مرورگر نگه‌داری می‌شود؛ پس از ورود، به حساب شما منتقل و روی همه دستگاه‌ها در دسترس خواهد بود.</p>';
    if (!items.length) {
      root.innerHTML = `<div class="empty-state collection-empty"><span class="empty-state__icon">${icon('bookmark', 'icon icon--lg')}</span><h2>هنوز محصولی برای بعد ذخیره نکرده‌اید</h2><p>محصولاتی را که می‌خواهید بعداً بررسی کنید، از صفحه محصول ذخیره کنید.</p><a class="button" href="./shop">مشاهده محصولات</a></div>${note}`;
      return;
    }
    root.innerHTML = `<div class="collection-summary"><strong>${toPersianDigits(items.length)} محصول</strong><a href="./shop">ادامه خرید</a></div>${note}<div class="product-grid collection-grid" id="collection-grid"></div>`;
    renderProductGrid(document.getElementById('collection-grid'), items, { saved: true });
    document.dispatchEvent(new CustomEvent('toto:products-rendered'));
  };

  root.addEventListener('click', async event => {
    const remove = event.target.closest('[data-action="remove-saved"]');
    if (!remove) return;
    remove.disabled = true;
    try { await setSaved(remove.dataset.id, false); render(); }
    catch (error) { toast?.(error.message, 'error'); remove.disabled = false; }
  });
  document.addEventListener('toto:saved-updated', render);
  document.addEventListener('toto:auth-changed', render);
  render();
};
