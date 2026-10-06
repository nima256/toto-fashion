let csrfToken = '';
const errorWithCode = (message, code, status, details) => { const error = new Error(message); error.code = code; error.status = status; error.details = details; return error; };
async function getCsrf(force = false) {
  if (csrfToken && !force) return csrfToken;
  let r; try { r = await fetch('/api/csrf', { credentials: 'same-origin', cache: 'no-store' }); } catch { throw errorWithCode('ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.', 'NETWORK_ERROR', 0); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.csrfToken) throw errorWithCode(d.message || 'دریافت توکن امنیتی ناموفق بود', 'CSRF_FAILED', r.status);
  csrfToken = d.csrfToken; return csrfToken;
}
async function request(path, { method = 'GET', body, formData, retry = true } = {}) {
  const options = { method, credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } };
  if (!['GET', 'HEAD'].includes(method)) { options.headers['x-csrf-token'] = await getCsrf(); if (formData) options.body = formData; else { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body ?? {}); } }
  let response;
  try { response = await fetch(path, options); } catch { throw errorWithCode('ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.', 'NETWORK_ERROR', 0); }
  let data = {}; try { data = await response.json(); } catch { /* پاسخ غیر JSON */ }
  // فقط خطای CSRF با توکن تازه یک‌بار تکرار می‌شود؛ خطای مجوز (۴۰۳) تکرار نمی‌شود
  if (response.status === 403 && data?.details?.code === 'CSRF' && retry && !['GET', 'HEAD'].includes(method)) { csrfToken = ''; await getCsrf(true); return request(path, { method, body, formData, retry: false }); }
  if (response.status === 401) document.dispatchEvent(new CustomEvent('toto:unauthorized', { detail: { path } }));
  if (!response.ok || data.success === false) throw errorWithCode(data.message || 'درخواست انجام نشد', data.code || `HTTP_${response.status}`, response.status, Array.isArray(data.details) ? data.details : data.details ? [data.details] : undefined);
  if (data.csrfToken) csrfToken = data.csrfToken;
  return data;
}
const q = params => { const s = new URLSearchParams(); Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') s.set(k, v); }); return s.toString(); };
const enc = encodeURIComponent;
const cartPayload = cart => (cart || []).map(item => ({ productId: item.productId, size: item.size || '', colorIndex: Number(item.colorIndex || 0), quantity: Number(item.quantity || 1) }));

export const api = {
  // فروشگاه
  async getProducts() { return (await request('/api/products')).products || []; },
  async getProduct(id) { return (await request(`/api/products/${enc(id)}`)).product; },
  async search(query) { return (await request(`/api/products?${q({ q: String(query || '').slice(0, 64) })}`)).products || []; },
  async getProductFeedback(id) { return request(`/api/products/${enc(id)}/feedback`); },
  async createReview(id, payload) { return request(`/api/products/${enc(id)}/reviews`, { method: 'POST', body: payload }); },
  async askQuestion(id, question) { return request(`/api/products/${enc(id)}/questions`, { method: 'POST', body: { question } }); },
  async getSiteContent() { return (await request('/api/content/site')); },
  async getMagazineArticles() { return (await request('/api/content/articles')).articles || []; },
  async getArticle(slug) { return (await request(`/api/content/articles/${enc(slug)}`)).article; },
  async getContentPage(slug) { return (await request(`/api/content/pages/${enc(slug)}`)).page; },
  async getFaq() { return (await request('/api/content/faq')).groups || []; },
  async sendContactMessage(payload) { return request('/api/contact', { method: 'POST', body: payload }); },
  async subscribeNewsletter(mobile) { return request('/api/newsletter', { method: 'POST', body: { mobile } }); },
  // احراز هویت (نشست سرور منبع اصلی است)
  async requestOtp(mobile) { return request('/api/auth/otp/request', { method: 'POST', body: { mobile } }); },
  async verifyOtp(code, mobile) { return request('/api/auth/otp/verify', { method: 'POST', body: { otp: code, mobile } }); },
  async me() { return request('/api/auth/me'); },
  async logout() { return request('/api/auth/logout', { method: 'POST' }); },
  // سبد و سفارش
  async getCheckoutConfig() { return (await request('/api/orders/config')).config; },
  async quote(cart, { shippingMethodId = 'standard', address, discountCode = '' } = {}) { return (await request('/api/orders/quote', { method: 'POST', body: { items: cartPayload(cart), shippingMethodId, address, discountCode } })).quote; },
  async createOrder({ cart, shippingMethodId, address, discountCode, notes, idempotencyKey }) { return request('/api/orders', { method: 'POST', body: { items: cartPayload(cart), shippingMethodId, address, discountCode, notes, idempotencyKey } }); },
  async verifyPayment(orderNumber) { return request(`/api/orders/${enc(orderNumber)}/status`); },
  async trackOrder(orderNumber, mobile) { return request('/api/orders/track', { method: 'POST', body: { orderNumber, mobile } }); },
  // حساب مشتری
  async getAccountOverview() { return request('/api/account'); },
  async getAddresses() { return (await request('/api/account/addresses')).addresses || []; },
  async createAddress(address) { return (await request('/api/account/addresses', { method: 'POST', body: address })).address; },
  async updateAddress(id, address) { return (await request(`/api/account/addresses/${enc(id)}`, { method: 'PATCH', body: address })).address; },
  async deleteAddress(id) { return request(`/api/account/addresses/${enc(id)}`, { method: 'DELETE' }); },
  async getOrders() { return (await request('/api/account/orders')).orders || []; },
  async getOrder(id) { return (await request(`/api/account/orders/${enc(id)}`)).order; },
  async getWheel() { return (await request('/api/account/wheel')).wheel; },
  async spinWheel() { return request('/api/account/wheel/spin', { method: 'POST' }); },
  async getReturns() { return (await request('/api/account/returns')).returns || []; },
  async createReturnRequest(formData) { return (await request('/api/account/returns', { method: 'POST', formData })).request; },
  async saveProfile(profile) { return (await request('/api/account', { method: 'PATCH', body: profile })).profile; },
  async saveNotificationPreferences(preferences) { return (await request('/api/account/notifications', { method: 'PATCH', body: preferences })).preferences; },
  async getSaved() { return (await request('/api/account/saved')).saved || []; },
  async addSaved(productId) { return (await request(`/api/account/saved/${enc(productId)}`, { method: 'PUT' })).saved || []; },
  async removeSaved(productId) { return (await request(`/api/account/saved/${enc(productId)}`, { method: 'DELETE' })).saved || []; },
  async mergeSaved(ids) { return (await request('/api/account/saved/merge', { method: 'POST', body: { ids } })).saved || []; },
  async createStockAlert(payload) { return request('/api/account/stock-alerts', { method: 'POST', body: payload }); },
  async cancelStockAlert(id) { return request(`/api/account/stock-alerts/${enc(id)}`, { method: 'DELETE' }); },
  // گالری مشتریان
  async getGallery() { return (await request('/api/gallery')).posts || []; },
  async getMyGallery() { return (await request('/api/gallery/mine')).posts || []; },
  async submitGallery(formData) { return (await request('/api/gallery', { method: 'POST', formData })).post; },
  async deleteGallery(id) { return request(`/api/gallery/${enc(id)}`, { method: 'DELETE' }); },
  // مدیریت
  async getAdminMe() { return request('/api/admin/me'); },
  async adminLogin(email, password) { return request('/api/admin/login', { method: 'POST', body: { email, password } }); },
  async adminLogout() { const data = await request('/api/admin/logout', { method: 'POST' }); csrfToken = ''; return data; },
  async getAdminDashboard(range = '30d', from = '', to = '') { return request(`/api/admin/dashboard?${q({ range, from, to })}`); },
  async getAdminProducts() { return (await request('/api/admin/products')).products || []; },
  async createAdminProduct(changes) { return (await request('/api/admin/products', { method: 'POST', body: changes })).product; },
  async updateAdminProduct(productId, changes) { return (await request(`/api/admin/products/${enc(productId)}`, { method: 'PATCH', body: changes })).product; },
  async deleteAdminProduct(productId) { return request(`/api/admin/products/${enc(productId)}`, { method: 'DELETE' }); },
  async updateAdminInventory(productId, variants) { return (await request(`/api/admin/products/${enc(productId)}/inventory`, { method: 'PATCH', body: { variants } })).product; },
  async uploadAdminProductImage(file) { const formData = new FormData(); formData.append('image', file); return request('/api/admin/products/upload', { method: 'POST', formData }); },
  async uploadAdminContentImage(file) { const formData = new FormData(); formData.append('image', file); return request('/api/admin/content/upload', { method: 'POST', formData }); },
  async getAdminOrders() { return (await request('/api/admin/orders')).orders || []; },
  async getAdminOrder(orderId) { return (await request(`/api/admin/orders/${enc(orderId)}`)).order; },
  async updateAdminOrder(orderId, changes) { return (await request(`/api/admin/orders/${enc(orderId)}`, { method: 'PATCH', body: changes })).order; },
  async retryOrderInventory(orderId) { return request(`/api/admin/orders/${enc(orderId)}/retry-inventory`, { method: 'POST' }); },
  async getAdminCustomers() { return (await request('/api/admin/customers')).customers || []; },
  async updateAdminCustomer(customerId, changes) { return (await request(`/api/admin/customers/${enc(customerId)}`, { method: 'PATCH', body: changes })).customer; },
  async getAdminReturns() { return (await request('/api/admin/returns')).returns || []; },
  async updateAdminReturn(id, changes) { return (await request(`/api/admin/returns/${enc(id)}`, { method: 'PATCH', body: changes })).request; },
  async getAdminGallery() { return (await request('/api/admin/gallery')).posts || []; },
  async moderateGallery(id, status, reason = '') { return (await request(`/api/admin/gallery/${enc(id)}`, { method: 'PATCH', body: { status, reason } })).post; },
  async moderateGalleryImage(id, imageId, status, reason = '') { return (await request(`/api/admin/gallery/${enc(id)}/images/${enc(imageId)}`, { method: 'PATCH', body: { status, reason } })).post; },
  async deleteAdminGallery(id) { return request(`/api/admin/gallery/${enc(id)}`, { method: 'DELETE' }); },
  async getAdminFeedback() { return request('/api/admin/reviews'); },
  async moderateReview(id, status) { return (await request(`/api/admin/reviews/${enc(id)}`, { method: 'PATCH', body: { status } })).review; },
  async answerQuestion(id, status, answer) { return (await request(`/api/admin/questions/${enc(id)}`, { method: 'PATCH', body: { status, answer } })).question; },
  async getAdminArticles() { return (await request('/api/admin/articles')).articles || []; },
  async createAdminArticle(article) { return (await request('/api/admin/articles', { method: 'POST', body: article })).article; },
  async updateAdminArticle(slug, article) { return (await request(`/api/admin/articles/${enc(slug)}`, { method: 'PATCH', body: article })).article; },
  async deleteAdminArticle(slug) { return request(`/api/admin/articles/${enc(slug)}`, { method: 'DELETE' }); },
  async getAdminPages() { return request('/api/admin/pages'); },
  async saveAdminPage(slug, page) { return (await request(`/api/admin/pages/${enc(slug)}`, { method: 'PUT', body: page })).page; },
  async getAdminContent(key) { return (await request(`/api/admin/content/${enc(key)}`)).value; },
  async saveAdminContent(key, value) { return (await request(`/api/admin/content/${enc(key)}`, { method: 'PUT', body: { value } })).value; },
  async getAdminCoupons() { return request('/api/admin/coupons'); },
  async createAdminCoupon(coupon) { return (await request('/api/admin/coupons', { method: 'POST', body: coupon })).coupon; },
  async updateAdminCoupon(id, changes) { return (await request(`/api/admin/coupons/${enc(id)}`, { method: 'PATCH', body: changes })).coupon; },
  async getAdminRoles() { return request('/api/admin/roles'); },
  async saveAdminRole(id, permissions) { return request(`/api/admin/roles/${enc(id)}`, { method: 'PUT', body: { permissions } }); },
  async createAdminUser(payload) { return (await request('/api/admin/admins', { method: 'POST', body: payload })).admin; },
  async updateAdminUser(id, changes) { return (await request(`/api/admin/admins/${enc(id)}`, { method: 'PATCH', body: changes })).admin; },
  async exportAdminReport(type) { return request(`/api/admin/reports/${enc(type)}`); }
};
