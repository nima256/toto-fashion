import { products } from '../../data/mock-data.js';
import { freeShippingThreshold, standardShippingPrice, discountCodes } from '../../data/checkout-data.js';
import { localStore } from './storage.js';

const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const getProduct = productId => products.find(product => product.id === productId);

export const normalizeCart = (cart = localStore.get('toto-cart', [])) => cart.map(item => {
  const product = getProduct(item.productId);
  return {
    id: item.id || uid(),
    productId: item.productId,
    name: product?.name || item.name || 'محصول توتو',
    size: item.size || product?.sizes?.[0] || 'تک‌سایز',
    colorIndex: Number(item.colorIndex || 0),
    quantity: Math.max(1, Math.min(Number(item.quantity || 1), 5)),
    price: product?.price ?? Number(item.price || 0),
    storedPrice: Number(item.storedPrice ?? item.price ?? product?.price ?? 0),
    addedAt: item.addedAt || new Date().toISOString()
  };
});

export const getCart = () => normalizeCart();
export const saveCart = cart => {
  localStore.set('toto-cart', normalizeCart(cart));
  document.dispatchEvent(new CustomEvent('toto:cart-updated'));
};

export const addCartItem = ({ productId, size, colorIndex = 0, quantity = 1 }) => {
  const cart = getCart();
  const existing = cart.find(item => item.productId === productId && item.size === size && item.colorIndex === Number(colorIndex));
  const product = getProduct(productId);
  if (!product) throw new Error('محصول پیدا نشد.');
  if (existing) existing.quantity = Math.min(5, existing.quantity + Number(quantity || 1));
  else cart.push({ id: uid(), productId, name: product.name, size, colorIndex: Number(colorIndex), quantity: Number(quantity || 1), price: product.price, storedPrice: product.price, addedAt: new Date().toISOString() });
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

export const calculateCart = ({ cart = getCart(), shippingMethod = null, discountCode = null } = {}) => {
  const lines = cart.map(item => {
    const product = getProduct(item.productId);
    const currentPrice = product?.price ?? item.price;
    const originalPrice = product?.previousPrice ?? currentPrice;
    const quantity = item.quantity || 1;
    return {
      item,
      product,
      currentPrice,
      originalPrice,
      lineSubtotal: originalPrice * quantity,
      lineDiscount: Math.max(0, originalPrice - currentPrice) * quantity,
      lineTotal: currentPrice * quantity,
      unavailable: !product?.availability,
      priceChanged: Number(item.storedPrice || item.price) !== Number(currentPrice)
    };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.lineSubtotal, 0);
  const productDiscount = lines.reduce((sum, line) => sum + line.lineDiscount, 0);
  const merchandiseTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const methodPrice = shippingMethod?.price ?? standardShippingPrice;
  const baseShipping = merchandiseTotal >= freeShippingThreshold ? 0 : methodPrice;
  const coupon = discountCode ? discountCodes[String(discountCode).toUpperCase()] : null;
  let couponDiscount = 0;
  let shipping = baseShipping;
  let couponError = '';
  if (discountCode && !coupon) couponError = 'این کد تخفیف معتبر نیست.';
  if (coupon?.min && merchandiseTotal < coupon.min) couponError = `حداقل خرید برای این کد ${coupon.min.toLocaleString('fa-IR')} تومان است.`;
  if (!couponError && coupon?.type === 'percent') couponDiscount = Math.min(Math.round(merchandiseTotal * coupon.value / 100), coupon.max || Infinity);
  if (!couponError && coupon?.type === 'fixed') couponDiscount = Math.min(coupon.value, merchandiseTotal);
  if (!couponError && coupon?.type === 'shipping') shipping = 0;
  const total = Math.max(0, merchandiseTotal - couponDiscount + shipping);
  return { lines, subtotal, productDiscount, merchandiseTotal, shipping, coupon, couponDiscount, couponError, total, remainingForFreeShipping: Math.max(0, freeShippingThreshold - merchandiseTotal) };
};

export const makeOrderNumber = () => `TO-${new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: '2-digit', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('/', '')}-${String(Math.floor(1000 + Math.random() * 9000))}`;
export const makeTrackingCode = () => String(Math.floor(100000000000 + Math.random() * 900000000000));
