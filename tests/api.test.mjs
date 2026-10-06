// آزمون یکپارچه API روی سرور واقعی و یک دیتابیس آزمایشی جدا.
// اجرا: TEST_MONGODB_URI="mongodb://127.0.0.1:27017/toto_test" npm test
// (برای آزمون تراکنش کامل از Replica Set استفاده کنید: ...?replicaSet=rs0). دیتابیس آزمایشی در شروع پاک می‌شود.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MONGO = process.env.TEST_MONGODB_URI;
const PORT = Number(process.env.TEST_PORT || 4391);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = { email: 'admin@test.local', password: 'TestAdminPass-123' };
let server; let mongoose; let serverLog = '';

if (!MONGO) { test('TEST_MONGODB_URI not set — integration tests skipped', { skip: true }, () => {}); }
else {
  if (!/test/i.test(MONGO)) throw new Error('TEST_MONGODB_URI must point to a database whose name contains "test" (it is dropped)');

class Client {
  constructor() { this.cookie = ''; this.csrf = ''; }
  async raw(method, url, { json, form, headers = {}, redirect = 'manual', csrf = true } = {}) {
    if (method !== 'GET' && csrf && !this.csrf) await this.refreshCsrf();
    const h = { ...headers };
    if (this.cookie) h.cookie = this.cookie;
    if (method !== 'GET' && csrf) h['x-csrf-token'] = this.csrf;
    let body;
    if (json !== undefined) { h['content-type'] = 'application/json'; body = typeof json === 'string' ? json : JSON.stringify(json); }
    if (form) body = form;
    const res = await fetch(`${BASE}${url}`, { method, headers: h, body, redirect });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) { const pair = c.split(';')[0]; if (pair.startsWith('toto.sid=')) this.cookie = pair; }
    return res;
  }
  async refreshCsrf() { const r = await this.raw('GET', '/api/csrf'); this.csrf = (await r.json()).csrfToken; }
  async req(method, url, options) { const res = await this.raw(method, url, options); const text = await res.text(); let data = {}; try { data = JSON.parse(text); } catch { data = { text }; } if (data.csrfToken) this.csrf = data.csrfToken; return { status: res.status, data, res }; }
  get(url) { return this.req('GET', url); }
  post(url, json) { return this.req('POST', url, { json }); }
  patch(url, json) { return this.req('PATCH', url, { json }); }
  put(url, json) { return this.req('PUT', url, { json }); }
  del(url) { return this.req('DELETE', url); }
}
const login = async (client, mobile) => {
  const r1 = await client.post('/api/auth/otp/request', { mobile });
  assert.equal(r1.status, 200, JSON.stringify(r1.data)); assert.ok(r1.data.debugOtp, 'dev OTP should be returned when SMS key is empty');
  const r2 = await client.post('/api/auth/otp/verify', { mobile, otp: r1.data.debugOtp });
  assert.equal(r2.status, 200, JSON.stringify(r2.data));
  return r2.data.user;
};
const adminLogin = async (client, creds = ADMIN) => { const r = await client.post('/api/admin/login', creds); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data.admin; };
const delivery = { firstName: 'سارا', lastName: 'تست', mobile: '09120000001', province: 'تهران', city: 'تهران', postalCode: '1234567890', buildingNumber: '12', unit: '3', address: 'خیابان آزمایشی، کوچه نمونه' };
// PNG یک پیکسلی واقعی
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082', 'hex');
const followPayment = async (client, redirectUrl) => {
  assert.match(redirectUrl, /^\/api\/orders\/payment\/callback\?Authority=MOCK/);
  const r = await client.raw('GET', redirectUrl);
  assert.equal(r.status, 302);
  return r.headers.get('location');
};
const variantStock = async (productId, color, size) => { const p = await mongoose.connection.db.collection('products').findOne({ publicId: productId }); return p.variants.find(v => v.color === color && v.size === size).stock; };

before(async () => {
  mongoose = require(path.join(root, 'node_modules/mongoose'));
  await mongoose.connect(MONGO); await mongoose.connection.db.dropDatabase();
  server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, MONGODB_URI: MONGO, PORT: String(PORT), SITE_URL: BASE, NODE_ENV: 'development', MELIPAYAMAK_SHARED_KEY: '', MELIPAYAMAK_ORDER_BODY_ID: '', ZARINPAL_MERCHANT_ID: '', PAYMENT_MOCK: 'true', ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password, ADMIN_MOBILE: '', SESSION_SECRET: 'integration-test-secret-integration-test', SEED_ON_START: 'true', FREE_SHIPPING_THRESHOLD: '2000000', STANDARD_SHIPPING_PRICE: '120000', SESSION_STORE: 'memory' } });
  server.stdout.on('data', d => { serverLog += d; }); server.stderr.on('data', d => { serverLog += d; });
  for (let i = 0; i < 80; i++) { try { const r = await fetch(`${BASE}/api/health`); if (r.ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 250)); }
});
after(async () => { server?.kill(); await mongoose?.disconnect(); });

const customer = new Client(); const guest = new Client(); const admin = new Client(); const stranger = new Client();
let customerUser; let paidOrderNumber; let guestOrderNumber;

test('security headers and CSP are set', async () => {
  const r = await fetch(`${BASE}/`);
  const csp = r.headers.get('content-security-policy');
  assert.ok(csp && csp.includes("script-src 'self'") && csp.includes("object-src 'none'") && csp.includes("frame-ancestors 'none'"), csp);
});

test('product listing, search escaping and limits', async () => {
  const list = await guest.get('/api/products');
  assert.equal(list.status, 200); assert.ok(list.data.products.length >= 10);
  const p = list.data.products[0];
  assert.ok(Array.isArray(p.variants) && p.variants.length > 0, 'variants exposed');
  assert.equal(p.variants[0].stock, undefined, 'exact stock is not exposed to the storefront');
  for (const q of ['(', '.*', 'a+'.repeat(30), '[', '\\']) assert.equal((await guest.get(`/api/products?q=${encodeURIComponent(q)}`)).status, 200, q);
  assert.equal((await guest.get(`/api/products?q=${'x'.repeat(65)}`)).status, 400);
  const search = await guest.get(`/api/products?q=${encodeURIComponent('لینن')}`);
  assert.ok(search.data.products.every(item => /لینن/.test(`${item.name}${item.category}${item.type}${item.style}${item.fabric}`)));
});

test('product details use the real endpoint and return 404 for missing products', async () => {
  const ok = await guest.get('/api/products/toto-101');
  assert.equal(ok.status, 200); assert.equal(ok.data.product.id, 'toto-101');
  assert.equal((await guest.get('/api/products/does-not-exist')).status, 404);
  assert.equal((await guest.get('/api/products/<script>')).status, 400);
  const missingProduct = await fetch(`${BASE}/product?id=does-not-exist`);
  assert.equal(missingProduct.status, 404); assert.match(await missingProduct.text(), /data-not-found="product"/);
  const missingPage = await fetch(`${BASE}/no/such/page`);
  assert.equal(missingPage.status, 404); const html = await missingPage.text(); assert.match(html, /data-page="404"/); assert.match(html, /<base href="\/">/);
  assert.equal((await fetch(`${BASE}/article?id=no-such-article`)).status, 404);
  assert.equal((await fetch(`${BASE}/api/no-such-endpoint`)).status, 404);
  assert.equal((await fetch(`${BASE}/product?id=toto-101`)).status, 200);
});

test('CSRF is required for state-changing requests', async () => {
  const r = await guest.req('POST', '/api/newsletter', { json: { mobile: '09120000099' }, csrf: false });
  assert.equal(r.status, 403);
});

test('payload validation returns clean 400 errors', async () => {
  const bad = await guest.post('/api/orders/quote', { items: [{ productId: 'toto-101', size: '۳۸', colorIndex: 'abc', quantity: 'many' }] });
  assert.equal(bad.status, 400); assert.ok(Array.isArray(bad.data.details) && bad.data.details.length);
  assert.equal((await guest.post('/api/orders/quote', { items: [{ productId: 'toto-101', size: '۳۸', colorIndex: -1, quantity: 1 }] })).status, 400);
  assert.equal((await guest.post('/api/orders/quote', { items: [{ productId: 'toto-101', size: '۳۸', colorIndex: 0, quantity: 9 }] })).status, 400);
  assert.equal((await guest.post('/api/orders/quote', { items: 'nope' })).status, 400);
  assert.equal((await guest.req('POST', '/api/orders/quote', { json: '{bad json' })).status, 400);
});

test('server quote is authoritative for shipping and coupons', async () => {
  const cheap = await guest.post('/api/orders/quote', { items: [{ productId: 'toto-112', size: 'تک‌سایز', colorIndex: 0, quantity: 1 }], shippingMethodId: 'standard' });
  assert.equal(cheap.status, 200, JSON.stringify(cheap.data));
  assert.equal(cheap.data.quote.amounts.shipping, 120000);
  assert.equal(cheap.data.quote.freeShippingThreshold, 2000000);
  const big = await guest.post('/api/orders/quote', { items: [{ productId: 'toto-104', size: '۳۸', colorIndex: 0, quantity: 1 }], discountCode: 'TOTO10' });
  assert.equal(big.data.quote.amounts.shipping, 0, 'free shipping over threshold');
  assert.equal(big.data.quote.amounts.couponDiscount, 315000);
  const invalid = await guest.post('/api/orders/quote', { items: [{ productId: 'toto-112', size: 'تک‌سایز', colorIndex: 0, quantity: 1 }], discountCode: 'NOPE123' });
  assert.equal(invalid.data.quote.couponError, 'کد تخفیف معتبر نیست');
  const pickup = await guest.post('/api/orders/quote', { items: [{ productId: 'toto-112', size: 'تک‌سایز', colorIndex: 0, quantity: 1 }], shippingMethodId: 'pickup' });
  assert.equal(pickup.data.quote.amounts.shipping, 0);
  const config = await guest.get('/api/orders/config');
  assert.equal(config.data.config.freeShippingThreshold, 2000000);
});

test('pickup checkout needs only name and mobile; delivery requires full address', async () => {
  const items = [{ productId: 'toto-112', size: 'تک‌سایز', colorIndex: 1, quantity: 1 }];
  const missing = await guest.post('/api/orders', { items, shippingMethodId: 'standard', address: { firstName: 'مهمان', lastName: 'تست', mobile: '09120000002' } });
  assert.equal(missing.status, 400); assert.ok(missing.data.details.some(d => d.path === 'address.postalCode'));
  const pickup = await guest.post('/api/orders', { items, shippingMethodId: 'pickup', address: { firstName: 'مهمان', lastName: 'تست', mobile: '09120000002' } });
  assert.equal(pickup.status, 201, JSON.stringify(pickup.data));
  assert.equal(pickup.data.order.isPickup, true);
  guestOrderNumber = pickup.data.order.orderNumber;
  assert.match(guestOrderNumber, /^TO-\d{6}-\d{4,6}$/);
  const location = await followPayment(guest, pickup.data.redirectUrl);
  assert.match(location, /payment-success/);
});

test('guest order tracking: format normalization and minimal public data', async () => {
  const digits = guestOrderNumber.replace(/\D/g, '');
  const persian = digits.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  for (const input of [guestOrderNumber, digits, persian, guestOrderNumber.toLowerCase()]) {
    const r = await stranger.post('/api/orders/track', { orderNumber: input, mobile: '۰۹۱۲۰۰۰۰۰۰۲' });
    assert.equal(r.status, 200, `${input}: ${JSON.stringify(r.data)}`);
    const o = r.data.order;
    for (const field of ['customerName', 'customer', 'mobile', 'address', 'total', 'addressSnapshot']) assert.equal(o[field], undefined, `public tracking must not expose ${field}`);
    assert.equal(o.items.length, 1); assert.equal(o.items[0].productId, 'toto-112'); assert.ok(o.items[0].name && o.items[0].color && o.items[0].size && o.items[0].quantity === 1);
    assert.equal(o.items[0].price, undefined, 'guest tracking hides prices');
    assert.equal(o.orderNumber, guestOrderNumber); assert.equal(r.data.canViewDetails, false);
  }
  assert.equal((await stranger.post('/api/orders/track', { orderNumber: guestOrderNumber, mobile: '09129999999' })).status, 404);
  const status = await stranger.get(`/api/orders/${guestOrderNumber}/status`);
  assert.equal(status.data.access, 'public'); assert.equal(status.data.order.address, undefined);
  const own = await guest.get(`/api/orders/${guestOrderNumber}/status`);
  assert.equal(own.data.access, 'full'); assert.ok(own.data.order.address);
});

test('login, session restore and logout are server-driven', async () => {
  customerUser = await login(customer, '09121110001');
  const me = await customer.get('/api/auth/me');
  assert.equal(me.data.authenticated, true); assert.equal(me.data.user.mobile, '09121110001');
  const temp = new Client(); await login(temp, '09121110009');
  const cookieBefore = temp.cookie;
  assert.equal((await temp.post('/api/auth/logout')).status, 200);
  assert.equal((await temp.get('/api/auth/me')).data.authenticated, false);
  const replay = new Client(); replay.cookie = cookieBefore;
  assert.equal((await replay.get('/api/auth/me')).data.authenticated, false, 'old session id must not stay valid');
  assert.equal((await new Client().get('/api/account')).status, 401);
});

test('variant inventory, mock payment, duplicate callback and idempotency', async () => {
  const color = 'مشکی'; const size = '۳۸';
  const before = await variantStock('toto-101', color, size);
  const items = [{ productId: 'toto-101', size, colorIndex: 1, quantity: 2 }];
  const key = 'test-idempotency-key-0001';
  const created = await customer.post('/api/orders', { items, shippingMethodId: 'standard', address: delivery, idempotencyKey: key });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const dup = await customer.post('/api/orders', { items, shippingMethodId: 'standard', address: delivery, idempotencyKey: key });
  assert.equal(dup.data.duplicate, true); assert.equal(dup.data.order.orderNumber, created.data.order.orderNumber);
  paidOrderNumber = created.data.order.orderNumber;
  assert.equal(await variantStock('toto-101', color, size), before, 'stock untouched before payment');
  const location = await followPayment(customer, created.data.redirectUrl);
  assert.match(location, /payment-success/);
  assert.equal(await variantStock('toto-101', color, size), before - 2, 'variant stock deducted once');
  const pointsAfterFirst = (await customer.get('/api/account')).data.loyalty.points;
  // callback تکراری
  for (let i = 0; i < 3; i++) await followPayment(customer, created.data.redirectUrl);
  assert.equal(await variantStock('toto-101', color, size), before - 2, 'duplicate callbacks must not deduct again');
  assert.equal((await customer.get('/api/account')).data.loyalty.points, pointsAfterFirst, 'points awarded once');
  const status = await customer.get(`/api/orders/${paidOrderNumber}/status`);
  assert.equal(status.data.status, 'paid'); assert.equal(status.data.order.status, 'processing');
  const other = new Client(); await login(other, '09121110002');
  assert.equal((await other.get(`/api/orders/${paidOrderNumber}/status`)).status, 403, 'registered order is private to its owner');
  const tracked = await customer.post('/api/orders/track', { orderNumber: paidOrderNumber, mobile: delivery.mobile });
  assert.equal(tracked.data.canViewDetails, true);
});

test('cancelled gateway callback marks unpaid order failed but never a paid one', async () => {
  const created = await customer.post('/api/orders', { items: [{ productId: 'toto-112', size: 'تک‌سایز', colorIndex: 0, quantity: 1 }], shippingMethodId: 'pickup', address: delivery });
  const authority = new URL(created.data.redirectUrl, BASE).searchParams.get('Authority');
  const failed = await customer.raw('GET', `/api/orders/payment/callback?Authority=${authority}&Status=NOK`);
  assert.match(failed.headers.get('location'), /payment-failed/);
  const paidAuthority = (await mongoose.connection.db.collection('orders').findOne({ orderNumber: paidOrderNumber })).paymentInfo.authority;
  const late = await customer.raw('GET', `/api/orders/payment/callback?Authority=${paidAuthority}&Status=NOK`);
  assert.match(late.headers.get('location'), /payment-success/);
  const paid = await mongoose.connection.db.collection('orders').findOne({ orderNumber: paidOrderNumber });
  assert.equal(paid.paymentStatus, 'paid'); assert.notEqual(paid.status, 'payment-failed');
});

test('post-payment failure (inventory) never turns a verified payment into payment-failed', async () => {
  // سفارش ثبت می‌شود، سپس پیش از callback موجودی صفر می‌شود
  const items = [{ productId: 'toto-103', size: '۴۴', colorIndex: 2, quantity: 1 }];
  const created = await customer.post('/api/orders', { items, shippingMethodId: 'standard', address: delivery });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  await mongoose.connection.db.collection('products').updateOne({ publicId: 'toto-103' }, { $set: { 'variants.$[v].stock': 0 } }, { arrayFilters: [{ 'v.color': 'سبز خاکستری', 'v.size': '۴۴' }] });
  await followPayment(customer, created.data.redirectUrl);
  const order = await mongoose.connection.db.collection('orders').findOne({ orderNumber: created.data.order.orderNumber });
  assert.equal(order.paymentStatus, 'paid'); assert.equal(order.status, 'paid'); assert.equal(order.needsReview, true); assert.equal(order.inventoryState, 'failed');
});

test('buying more than a variant has in stock is rejected', async () => {
  const r = await customer.post('/api/orders/quote', { items: [{ productId: 'toto-101', size: '۴۴', colorIndex: 0, quantity: 1 }] });
  assert.equal(r.status, 200); assert.equal(r.data.quote.problems.length, 1, 'unavailable size 44 has zero stock');
  const strict = await customer.post('/api/orders', { items: [{ productId: 'toto-101', size: '۴۴', colorIndex: 0, quantity: 1 }], shippingMethodId: 'pickup', address: delivery });
  assert.equal(strict.status, 409);
});

test('notification preferences persist all five fields', async () => {
  const prefs = { orderSms: false, stockSms: true, campaignSms: false, loyaltySms: false, emailMagazine: true };
  const saved = await customer.patch('/api/account/notifications', prefs);
  assert.deepEqual(saved.data.preferences, prefs);
  assert.deepEqual((await customer.get('/api/account')).data.user.notifications, prefs);
});

test('saved items persist to the account and merge guest lists', async () => {
  assert.equal((await customer.put('/api/account/saved/toto-102')).status, 200);
  const merged = await customer.post('/api/account/saved/merge', { ids: ['toto-103', 'toto-102', 'unknown-product'] });
  assert.deepEqual(merged.data.saved.sort(), ['toto-102', 'toto-103']);
  assert.deepEqual((await customer.get('/api/auth/me')).data.user.savedProducts.sort(), ['toto-102', 'toto-103']);
  await customer.del('/api/account/saved/toto-103');
  assert.deepEqual((await customer.get('/api/account/saved')).data.saved, ['toto-102']);
});

test('stock alerts are stored per variant and notified on restock', async () => {
  const a = await customer.post('/api/account/stock-alerts', { productId: 'toto-101', colorIndex: 0, size: '۴۴' });
  assert.equal(a.status, 201, JSON.stringify(a.data));
  assert.equal((await customer.post('/api/account/stock-alerts', { productId: 'toto-101', colorIndex: 0, size: '۴۴' })).data.alreadyExists, true);
  assert.equal((await customer.post('/api/account/stock-alerts', { productId: 'toto-101', colorIndex: 0, size: '۳۸' })).status, 409, 'cannot alert for in-stock variant');
  assert.equal((await customer.get('/api/account')).data.availabilityAlerts.length, 1);
  await adminLogin(admin);
  const restock = await admin.patch('/api/admin/products/toto-101/inventory', { variants: [{ color: 'کرم روشن', size: '۴۴', stock: 3 }] });
  assert.equal(restock.status, 200, JSON.stringify(restock.data));
  const alert = await mongoose.connection.db.collection('stockalerts').findOne({ productId: 'toto-101', size: '۴۴' });
  assert.equal(alert.status, 'notified');
});

test('returns: full payload persisted, real image upload, private image access', async () => {
  const order = await mongoose.connection.db.collection('orders').findOne({ orderNumber: paidOrderNumber });
  assert.equal((await admin.patch(`/api/admin/orders/${order._id}`, { status: 'delivered' })).status, 200);
  const form = new FormData();
  Object.entries({ orderId: String(order._id), productId: 'toto-101', type: 'exchange', reason: 'size', exchangeSize: '۴۰', resolution: 'exchange', description: 'سایز کمی کوچک است و تعویض می‌خواهم', confirm: 'on' }).forEach(([k, v]) => form.append(k, v));
  form.append('images', new Blob([PNG], { type: 'image/png' }), 'photo.png');
  const created = await customer.req('POST', '/api/account/returns', { form });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const r = created.data.request;
  assert.equal(r.type, 'exchange'); assert.equal(r.exchangeSize, '۴۰'); assert.equal(r.resolution, 'exchange'); assert.equal(r.images.length, 1); assert.equal(r.reasonCode, 'size');
  assert.equal((await customer.raw('GET', r.images[0].url)).status, 200);
  const other = new Client(); await login(other, '09121110003');
  assert.equal((await other.raw('GET', r.images[0].url)).status, 404);
  assert.equal((await fetch(`${BASE}/uploads/${r.images[0].filename}`)).status, 404, 'return images are not public');
  const dup = await customer.req('POST', '/api/account/returns', { form });
  assert.equal(dup.status, 409);
  const fake = new FormData(); Object.entries({ orderId: String(order._id), productId: 'toto-101', type: 'return', reason: 'quality', resolution: 'refund', description: 'ایراد دوخت در آستین وجود دارد', confirm: 'on' }).forEach(([k, v]) => fake.append(k, v));
  fake.append('images', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'x.png');
  assert.equal((await customer.req('POST', '/api/account/returns', { form: fake })).status, 400, 'non-image content rejected');
  const admins = await admin.get('/api/admin/returns');
  const adminView = admins.data.returns[0];
  assert.equal(adminView.exchangeSize, '۴۰');
  assert.equal(adminView.customer.mobile, '09121110001', 'requester identity comes from the account');
  assert.ok(adminView.customer.id && adminView.customer.fullName);
  assert.equal(adminView.order.orderNumber, paidOrderNumber); assert.equal(adminView.order.postalCode, delivery.postalCode); assert.equal(adminView.order.belongsToCustomer, true);
  const handled = await admin.patch(`/api/admin/returns/${r.id}`, { status: 'awaiting-item', customerMessage: 'لطفاً کالا را ارسال کنید', adminNote: 'یادداشت داخلی محرمانه' });
  assert.equal(handled.status, 200, JSON.stringify(handled.data));
  const mine = (await customer.get('/api/account/returns')).data.returns.find(item => item.id === r.id);
  assert.equal(mine.statusLabel, 'در انتظار دریافت کالا'); assert.equal(mine.customerMessage, 'لطفاً کالا را ارسال کنید');
  assert.equal(mine.adminNote, undefined, 'internal admin note is not exposed to the customer'); assert.equal(mine.history.length, 2);
  assert.equal((await other.get('/api/account/returns')).data.returns.length, 0, 'other users cannot see this request');
  assert.equal((await customer.get('/api/admin/returns')).status, 401, 'admin endpoint requires admin session');
});

test('customer gallery: backend submission and admin moderation', async () => {
  const form = new FormData(); form.append('customerName', 'سارا'); form.append('productId', 'toto-101'); form.append('caption', 'با شلوار روشن ست کردم'); form.append('consent', 'on');
  form.append('image', new Blob([PNG], { type: 'image/png' }), 'look.png');
  assert.equal((await guest.req('POST', '/api/gallery', { form })).status, 401, 'login required');
  const created = await customer.req('POST', '/api/gallery', { form });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const post = created.data.post;
  assert.equal(post.status, 'pending');
  assert.equal((await guest.get('/api/gallery')).data.posts.length, 0);
  assert.equal((await guest.raw('GET', post.image)).status, 404, 'pending image hidden from public');
  assert.equal((await customer.raw('GET', post.image)).status, 200, 'owner sees pending image');
  assert.equal((await admin.get('/api/admin/gallery')).data.posts.length, 1);
  assert.equal((await admin.patch(`/api/admin/gallery/${post.id}`, { status: 'approved' })).status, 200);
  assert.equal((await guest.get('/api/gallery')).data.posts.length, 1);
  assert.equal((await guest.raw('GET', post.image)).status, 200);
  await admin.patch(`/api/admin/gallery/${post.id}`, { status: 'rejected', reason: 'نور کم' });
  assert.equal((await guest.get('/api/gallery')).data.posts.length, 0);
  assert.equal((await customer.get('/api/gallery/mine')).data.posts[0].rejectionReason, 'نور کم');
});

test('customer gallery accepts multiple images and supports per-image moderation', async () => {
  const form = new FormData(); form.append('customerName', 'سارا'); form.append('productId', 'toto-102'); form.append('caption', 'سه عکس از یک استایل'); form.append('consent', 'on');
  for (let i = 0; i < 3; i++) form.append('images', new Blob([PNG], { type: 'image/png' }), `look-${i}.png`);
  const created = await customer.req('POST', '/api/gallery', { form });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const post = created.data.post; assert.equal(post.images.length, 3); assert.ok(post.images.every(img => img.status === 'pending'));
  const tooMany = new FormData(); ['customerName', 'productId', 'caption', 'consent'].forEach(k => tooMany.append(k, { customerName: 'سارا', productId: 'toto-102', caption: 'تعداد زیاد عکس', consent: 'on' }[k]));
  for (let i = 0; i < 7; i++) tooMany.append('images', new Blob([PNG], { type: 'image/png' }), `x-${i}.png`);
  assert.equal((await customer.req('POST', '/api/gallery', { form: tooMany })).status, 400, 'max images per submission enforced');
  const listed = (await admin.get('/api/admin/gallery')).data.posts.find(p => p.id === post.id);
  assert.equal(listed.images.length, 3);
  const approved = await admin.patch(`/api/admin/gallery/${post.id}/images/${listed.images[0].id}`, { status: 'approved' });
  assert.equal(approved.status, 200, JSON.stringify(approved.data));
  await admin.patch(`/api/admin/gallery/${post.id}/images/${listed.images[1].id}`, { status: 'rejected', reason: 'تار است' });
  const publicPost = (await guest.get('/api/gallery')).data.posts.find(p => p.id === post.id);
  assert.equal(publicPost.images.length, 1, 'only the approved image is public');
  assert.equal((await guest.raw('GET', listed.images[0].url)).status, 200);
  assert.equal((await guest.raw('GET', listed.images[1].url)).status, 404);
  assert.equal((await guest.raw('GET', listed.images[2].url)).status, 404);
  const mine = (await customer.get('/api/gallery/mine')).data.posts.find(p => p.id === post.id);
  assert.deepEqual(mine.images.map(i => i.status), ['approved', 'rejected', 'pending']); assert.equal(mine.images[1].rejectionReason, 'تار است');
});

test('legacy single-image gallery posts are migrated', async () => {
  const user = await mongoose.connection.db.collection('users').findOne({ mobile: '09121110001' });
  await mongoose.connection.db.collection('galleryposts').insertOne({ publicId: 'GAL-LEGACY1', user: user._id, customerName: 'قدیمی', productId: 'toto-101', productName: 'x', caption: 'ارسال قدیمی', image: { filename: '1700000000000-aaaaaaaaaaaaaaaa.png', mimeType: 'image/png', size: 10 }, status: 'approved', images: [], createdAt: new Date(), updatedAt: new Date() });
  const { runMigrations } = require(path.join(root, 'services/migrations.js'));
  await runMigrations({ log: false });
  const migrated = await mongoose.connection.db.collection('galleryposts').findOne({ publicId: 'GAL-LEGACY1' });
  assert.equal(migrated.images.length, 1); assert.equal(migrated.images[0].status, 'approved'); assert.equal(migrated.images[0].filename, '1700000000000-aaaaaaaaaaaaaaaa.png');
});

test('reviews and questions are persisted and moderated', async () => {
  const review = await customer.post('/api/products/toto-101/reviews', { rating: 5, body: 'پارچه عالی و دوخت تمیز بود' });
  assert.equal(review.status, 201, JSON.stringify(review.data));
  assert.equal((await customer.post('/api/products/toto-101/reviews', { rating: 4, body: 'دوباره نظر می‌دهم برای تست' })).status, 409);
  assert.equal((await customer.post('/api/products/toto-102/reviews', { rating: 4, body: 'این محصول را نخریده‌ام' })).status, 403, 'only delivered buyers can review');
  assert.equal((await guest.get('/api/products/toto-101/feedback')).data.summary.count, 0);
  assert.equal((await admin.patch(`/api/admin/reviews/${review.data.review.id}`, { status: 'approved' })).status, 200);
  const feedback = await guest.get('/api/products/toto-101/feedback');
  assert.equal(feedback.data.summary.count, 1); assert.equal(feedback.data.summary.average, 5);
  const question = await customer.post('/api/products/toto-101/questions', { question: 'آیا آبرفت دارد؟' });
  assert.equal(question.status, 201);
  await admin.patch(`/api/admin/questions/${question.data.question.id}`, { status: 'answered', answer: 'با شست‌وشوی سرد خیر.' });
  assert.equal((await guest.get('/api/products/toto-101/feedback')).data.questions[0].answer, 'با شست‌وشوی سرد خیر.');
});

test('contact saves order number and returns a real ticket id; newsletter persists', async () => {
  const r = await guest.post('/api/contact', { fullName: 'مهمان تست', mobile: '09120000002', subject: 'پیگیری سفارش', message: 'سفارش من هنوز ارسال نشده است، لطفاً بررسی کنید', orderNumber: guestOrderNumber.replace(/\D/g, '') });
  assert.equal(r.status, 201, JSON.stringify(r.data)); assert.match(r.data.ticketId, /^SUP-/); assert.equal(r.data.orderNumber, guestOrderNumber);
  const saved = await mongoose.connection.db.collection('contactmessages').findOne({ publicId: r.data.ticketId });
  assert.equal(saved.orderNumber, guestOrderNumber);
  assert.equal((await guest.post('/api/contact', { fullName: 'مهمان تست', mobile: '09120000002', subject: 'x', message: 'پیام آزمایشی به اندازه کافی طولانی', orderNumber: 'abc' })).status, 400);
  assert.equal((await guest.post('/api/newsletter', { mobile: '09120000044' })).status, 201);
  assert.equal((await guest.post('/api/newsletter', { mobile: '۰۹۱۲۰۰۰۰۰۴۴' })).data.alreadySubscribed, true);
});

test('lucky wheel is server-driven, once per day, and prizes are redeemable', async () => {
  const state = await customer.get('/api/account/wheel');
  assert.equal(state.data.wheel.prizes.length, 7); assert.equal(state.data.wheel.usedToday, false);
  const spin = await customer.post('/api/account/wheel/spin');
  assert.equal(spin.status, 200, JSON.stringify(spin.data));
  assert.ok(spin.data.reward.id); assert.ok(spin.data.nextSpinAt);
  assert.equal((await customer.post('/api/account/wheel/spin')).status, 429);
  if (spin.data.code) {
    const items = spin.data.reward.type === 'shipping' ? [{ productId: 'toto-112', size: 'تک‌سایز', colorIndex: 0, quantity: 1 }] : [{ productId: 'toto-110', size: 'تک‌سایز', colorIndex: 0, quantity: 2 }];
    const q = await customer.post('/api/orders/quote', { items, discountCode: spin.data.code });
    assert.equal(q.data.quote.couponError, '', JSON.stringify(q.data.quote)); assert.ok(q.data.quote.coupon);
    assert.ok((await customer.get('/api/account')).data.rewards.some(r => r.code === spin.data.code));
    assert.equal((await guest.post('/api/orders/quote', { items, discountCode: spin.data.code })).data.quote.couponError.length > 0, true, 'personal code not usable by others');
  }
  // همه پیکربندی‌های جایزه چرخونه در تسویه حساب پذیرفته می‌شوند
  const { PRIZES } = require(path.join(root, 'services/wheel.js'));
  const Coupon = require(path.join(root, 'models/Coupon.js'));
  for (const prize of PRIZES.filter(p => p.coupon)) {
    const code = `TEST-${prize.id.toUpperCase()}`.replace(/[^A-Z0-9-]/g, '');
    await Coupon.create({ code, title: prize.title, ...prize.coupon, user: new mongoose.Types.ObjectId(customerUser ? (await mongoose.connection.db.collection('users').findOne({ mobile: '09121110001' }))._id : undefined), usageLimit: 1, expiresAt: new Date(Date.now() + 86400000), source: 'wheel' });
    const items = prize.coupon.type === 'shipping' ? [{ productId: 'toto-112', size: 'تک‌سایز', colorIndex: 0, quantity: 1 }] : [{ productId: 'toto-110', size: 'تک‌سایز', colorIndex: 0, quantity: 2 }];
    const q = await customer.post('/api/orders/quote', { items, discountCode: code });
    assert.equal(q.data.quote.couponError, '', `${prize.id}: ${q.data.quote.couponError}`);
  }
  const expired = await Coupon.create({ code: 'TEST-EXPIRED', title: 'x', type: 'percent', value: 5, expiresAt: new Date(Date.now() - 1000) });
  assert.match((await customer.post('/api/orders/quote', { items: [{ productId: 'toto-110', size: 'تک‌سایز', colorIndex: 0, quantity: 1 }], discountCode: expired.code })).data.quote.couponError, /مهلت/);
});

test('admin permissions are enforced by the backend', async () => {
  const created = await admin.post('/api/admin/admins', { fullName: 'مدیر محصول', email: 'pm@test.local', password: 'ProductManager-123', role: 'product-manager' });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const pm = new Client(); const me = await adminLogin(pm, { email: 'pm@test.local', password: 'ProductManager-123' });
  assert.ok(me.permissions.includes('products.edit') && !me.permissions.includes('orders.view'));
  assert.equal((await pm.get('/api/admin/products')).status, 200);
  assert.equal((await pm.get('/api/admin/orders')).status, 403);
  assert.equal((await pm.get('/api/admin/customers')).status, 403);
  assert.equal((await pm.put('/api/admin/content/announcement', { value: { status: 'published', text: 'hack' } })).status, 403);
  assert.equal((await pm.put('/api/admin/roles/product-manager', { permissions: ['admins.manage'] })).status, 403);
  assert.equal((await pm.post('/api/admin/admins', { fullName: 'x', email: 'x@test.local', password: 'xxxxxxxxxxxxxx', role: 'superadmin' })).status, 403);
  // تغییر مجوز نقش توسط مدیر کل بلافاصله اعمال می‌شود
  assert.equal((await admin.put('/api/admin/roles/product-manager', { permissions: ['products.view'] })).status, 200);
  assert.equal((await pm.patch('/api/admin/products/toto-102', { name: 'تغییر غیرمجاز' })).status, 403);
  assert.equal((await new Client().get('/api/admin/products')).status, 401);
});

test('admin product data contract includes variants and validates unsafe input', async () => {
  const list = await admin.get('/api/admin/products');
  const p = list.data.products.find(item => item.id === 'toto-101');
  assert.equal(typeof p.variantCount, 'number'); assert.ok(p.variantCount > 0); assert.equal(typeof p.variants[0].stock, 'number');
  assert.equal((await admin.post('/api/admin/products', { name: 'تست', category: 'شومیز', price: 100000, image: 'javascript:alert(1)' })).status, 400);
  assert.equal((await admin.post('/api/admin/products', { name: 'تست', category: 'شومیز', price: 100000, colors: ['red;}body{display:none'] })).status, 400);
  const xss = await admin.post('/api/admin/products', { name: '<img src=x onerror=alert(1)>', category: 'شومیز', price: 100000, colorNames: ['مشکی'], sizes: ['۳۸'], variants: [{ color: 'مشکی', size: '۳۸', stock: 4 }] });
  assert.equal(xss.status, 201, JSON.stringify(xss.data));
  assert.equal(xss.data.product.inventory, 4); assert.equal(xss.data.product.variantCount, 1);
});

test('admin order details include shipping, account and variant data', async () => {
  const list = await admin.get('/api/admin/orders');
  const summary = list.data.orders.find(o => o.orderNumber === paidOrderNumber);
  const detail = await admin.get(`/api/admin/orders/${summary.id}`);
  assert.equal(detail.status, 200);
  const o = detail.data.order;
  assert.equal(o.shippingAddress.postalCode, delivery.postalCode); assert.equal(o.shippingAddress.city, 'تهران');
  assert.equal(o.customerAccount.mobile, '09121110001');
  assert.equal(o.items[0].color, 'مشکی'); assert.equal(o.items[0].size, '۳۸'); assert.ok(o.items[0].variantSku, 'variant SKU resolved'); assert.equal(o.items[0].lineTotal, o.items[0].price * o.items[0].quantity);
  assert.equal(o.payment.provider, 'mock'); assert.ok(o.payment.refId);
  const owner = await customer.get(`/api/account/orders/${summary.id}`);
  assert.equal(owner.data.order.items[0].color, 'مشکی'); assert.equal(owner.data.order.items[0].size, '۳۸'); assert.ok(owner.data.order.items[0].price > 0);
});

test('dashboard applies the selected date range', async () => {
  const ranges = {};
  for (const range of ['today', '7d', '30d']) { const r = await admin.get(`/api/admin/dashboard?range=${range}`); assert.equal(r.status, 200); ranges[range] = r.data; assert.equal(r.data.range.id, range); }
  assert.ok(ranges.today.kpis.find(k => k.id === 'orders').value >= 2);
  const old = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10); const older = new Date(Date.now() - 80 * 86400000).toISOString().slice(0, 10);
  const custom = await admin.get(`/api/admin/dashboard?range=custom&from=${old}&to=${older}`);
  assert.equal(custom.status, 200); assert.equal(custom.data.kpis.find(k => k.id === 'orders').value, 0, 'old range has no orders');
  assert.equal((await admin.get('/api/admin/dashboard?range=custom&from=2026-02-30')).status, 400);
  assert.equal((await admin.get('/api/admin/dashboard?range=forever')).status, 400);
  assert.ok(!ranges['30d'].kpis.some(k => k.id === 'abandoned'), 'no fake metrics');
});

test('admin content management is served to the storefront', async () => {
  const saved = await admin.put('/api/admin/content/announcement', { value: { status: 'published', text: 'ارسال رایگان بالای {freeShippingThreshold}', linkLabel: 'تخفیف‌ها', href: './shop?discount=1' } });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal((await guest.get('/api/content/site')).data.site.announcement.linkLabel, 'تخفیف‌ها');
  assert.equal((await admin.put('/api/admin/content/announcement', { value: { status: 'published', text: 'x'.repeat(10), href: 'javascript:alert(1)' } })).status, 400);
  const article = await admin.post('/api/admin/articles', { slug: 'test-article', title: 'مقاله آزمایشی', category: 'راهنما', excerpt: 'خلاصه', image: './src/assets/images/article-1.webp', status: 'published', sections: [{ id: 'one', title: 'بخش', paragraphs: ['متن'] }] });
  assert.equal(article.status, 201, JSON.stringify(article.data));
  assert.equal((await guest.get('/api/content/articles/test-article')).data.article.title, 'مقاله آزمایشی');
  assert.ok((await guest.get('/api/content/articles')).data.articles.length >= 6, 'seeded magazine moved to database');
  await admin.patch('/api/admin/articles/test-article', { status: 'draft' });
  assert.equal((await guest.get('/api/content/articles/test-article')).status, 404);
  await admin.put('/api/admin/pages/privacy', { title: 'حریم خصوصی جدید', status: 'published', sections: [{ id: 'a', title: 'الف', paragraphs: ['متن'] }] });
  assert.equal((await guest.get('/api/content/pages/privacy')).data.page.title, 'حریم خصوصی جدید');
  assert.ok((await guest.get('/api/content/faq')).data.groups.length > 0);
});

test('server log contains no secrets', async () => {
  assert.ok(!serverLog.includes(ADMIN.password));
  assert.ok(!serverLog.includes('integration-test-secret'));
});
}
