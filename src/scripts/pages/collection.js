import { products } from '../../data/mock-data.js';
import { renderProductGrid } from '../components/product-card.js?v=3';
import { localStore } from '../core/storage.js';
import { icon, toPersianDigits } from '../core/utils.js';

export const initCollection = () => {
  const root = document.getElementById('collection-root'); if (!root) return;
  const key = 'toto-saved';

  const render = () => {
    const ids = localStore.get(key, []);
    const items = ids.map(id => products.find(product => product.id === id)).filter(Boolean);
    if (!items.length) {
      root.innerHTML = `<div class="empty-state collection-empty"><span class="empty-state__icon">${icon('bookmark', 'icon icon--lg')}</span><h2>هنوز محصولی برای بعد ذخیره نکرده‌اید</h2><p>محصولاتی را که می‌خواهید بعداً بررسی کنید، از صفحه محصول ذخیره کنید.</p><a class="button" href="./shop">مشاهده محصولات</a></div>`;
      return;
    }
    root.innerHTML = `<div class="collection-summary"><strong>${toPersianDigits(items.length)} محصول</strong><a href="./shop">ادامه خرید</a></div><div class="product-grid collection-grid" id="collection-grid"></div>`;
    renderProductGrid(document.getElementById('collection-grid'), items, { saved: true });
    document.dispatchEvent(new CustomEvent('toto:products-rendered'));
  };

  root.addEventListener('click', event => {
    const remove = event.target.closest('[data-action="remove-saved"]');
    if (!remove) return;
    const ids = localStore.get(key, []).filter(id => id !== remove.dataset.id); localStore.set(key, ids); render();
  });
  render();
};
