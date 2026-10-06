// سبد خرید در مرورگر فقط انتخاب‌های کاربر را نگه می‌دارد؛ قیمت نهایی، ارسال و تخفیف همیشه از /api/orders/quote می‌آید.
import { products } from '../../data/mock-data.js';
import { localStore } from './storage.js';
import { uid } from './utils.js';

const ONE_SIZE = 'تک‌سایز';
export const getProduct = productId => products.find(product => product.id === productId);

// وضعیت یک ترکیب رنگ/سایز بر اساس داده سرور
export const variantFor = (product, colorIndex = 0, size = '') => {
  if (!product) return null;
  const color = product.colorNames?.[colorIndex] || '';
  const normalizedSize = product.sizes?.length ? size : '';
  return (product.variants || []).find(v => (v.color || '') === color && (v.size || '') === normalizedSize) || null;
};
export const isVariantAvailable = (product, colorIndex = 0, size = '') => {
  if (!product?.availability) return false;
  if (!(product.variants || []).length) return !product.unavailableSizes?.includes(size);
  return Boolean(variantFor(product, colorIndex, size)?.available);
};

export const normalizeCart = (cart = localStore.get('toto-cart', [])) => (Array.isArray(cart) ? cart : []).filter(item => item && typeof item.productId === 'string').map(item => {
  const product = getProduct(item.productId);
  return {
    id: typeof item.id === 'string' ? item.id : uid(),
    productId: item.productId,
    name: product?.name || String(item.name || 'محصول توتو'),
    size: String(item.size || (product?.sizes?.length ? product.sizes[0] : ONE_SIZE)),
    colorIndex: Math.max(0, Number(item.colorIndex || 0)),
    quantity: Math.max(1, Math.min(Number(item.quantity || 1), 5)),
    storedPrice: Number(item.storedPrice ?? item.price ?? product?.price ?? 0),
    addedAt: item.addedAt || new Date().toISOString()
  };
});

export const getCart = () => normalizeCart();
export const saveCart = cart => {
  localStore.set('toto-cart', normalizeCart(cart));
  document.dispatchEvent(new CustomEvent('toto:cart-updated'));
};
export const clearCart = () => saveCart([]);

export const addCartItem = ({ productId, size, colorIndex = 0, quantity = 1 }) => {
  const product = getProduct(productId);
  if (!product) throw new Error('محصول پیدا نشد.');
  const normalizedSize = product.sizes?.length ? size : ONE_SIZE;
  if (product.sizes?.length && !product.sizes.includes(size)) throw new Error('سایز انتخاب‌شده معتبر نیست.');
  if (!isVariantAvailable(product, Number(colorIndex), product.sizes?.length ? size : '')) throw new Error('این ترکیب رنگ و سایز در حال حاضر موجود نیست.');
  const cart = getCart();
  const existing = cart.find(item => item.productId === productId && item.size === normalizedSize && item.colorIndex === Number(colorIndex));
  if (existing) existing.quantity = Math.min(5, existing.quantity + Number(quantity || 1));
  else cart.push({ id: uid(), productId, name: product.name, size: normalizedSize, colorIndex: Number(colorIndex), quantity: Math.min(5, Number(quantity || 1)), storedPrice: product.price, addedAt: new Date().toISOString() });
  saveCart(cart);
  return cart;
};

export const removeCartItem = id => {
  const cart = getCart();
  const item = cart.find(entry => entry.id === id);
  saveCart(cart.filter(entry => entry.id !== id));
  return item;
};

export const updateCartQuantity = (id, quantity) => {
  const cart = getCart();
  const item = cart.find(entry => entry.id === id);
  if (!item) return cart;
  item.quantity = Math.max(1, Math.min(Number(quantity || 1), 5));
  saveCart(cart);
  return cart;
};

// فقط برای نمایش ردیف‌ها؛ هیچ قانون ارسال یا تخفیفی اینجا محاسبه نمی‌شود
export const cartLines = (cart = getCart()) => cart.map(item => {
  const product = getProduct(item.productId);
  const currentPrice = product?.price ?? item.storedPrice;
  const sizeKey = product?.sizes?.length ? item.size : '';
  return {
    item, product, currentPrice,
    originalPrice: product?.previousPrice ?? currentPrice,
    lineTotal: currentPrice * item.quantity,
    unavailable: !product || !isVariantAvailable(product, item.colorIndex, sizeKey),
    priceChanged: Boolean(product) && Number(item.storedPrice) !== Number(currentPrice)
  };
});
