// بررسی سریع یکپارچگی فرانت‌اند: داده نمونه در زمان اجرا وجود ندارد و قوانین قیمت فقط در سرور است
import { products, replaceProducts, productsState } from '../src/data/mock-data.js';
import fs from 'node:fs';

if (products.length !== 0) throw new Error('Runtime product list must start empty (no mock products)');
replaceProducts([]);
if (!productsState.loaded || products.length !== 0) throw new Error('Empty backend response must produce an empty storefront');
const checkoutData = fs.readFileSync(new URL('../src/data/checkout-data.js', import.meta.url), 'utf8');
if (/discountCodes|freeShippingThreshold|standardShippingPrice/.test(checkoutData)) throw new Error('Pricing rules must not be duplicated in the frontend');
const apiSource = fs.readFileSync(new URL('../src/scripts/services/api.js', import.meta.url), 'utf8');
for (const required of ['/api/auth/me', '/api/orders/quote', '/api/products/${enc(id)}', '/api/admin/dashboard', '/api/account/orders', '/api/gallery', '/api/content/articles'])
  if (!apiSource.includes(required)) throw new Error(`Missing API integration: ${required}`);
console.log('Frontend integration smoke test passed.');
