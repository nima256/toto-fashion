const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4173),
  siteUrl: (process.env.SITE_URL || 'http://localhost:4173').replace(/\/$/, ''),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/toto_fashion',
  sessionSecret: process.env.SESSION_SECRET || 'change-me-in-production',
  sessionStore: process.env.SESSION_STORE || 'memory',
  cookieSameSite: String(process.env.COOKIE_SAMESITE || 'lax').toLowerCase(),
  trustProxy: process.env.TRUST_PROXY === '1',
  otpExpiresSeconds: Number(process.env.OTP_EXPIRES_SECONDS || 120),
  melipayamakSharedKey: process.env.MELIPAYAMAK_SHARED_KEY || '',
  melipayamakBodyId: Number(process.env.MELIPAYAMAK_BODY_ID || 502666),
  melipayamakOrderBodyId: Number(process.env.MELIPAYAMAK_ORDER_BODY_ID || 0),
  paymentMock: String(process.env.PAYMENT_MOCK || 'true').toLowerCase() === 'true',
  zarinpalMerchantId: process.env.ZARINPAL_MERCHANT_ID || '',
  zarinpalSandbox: String(process.env.ZARINPAL_SANDBOX || 'true').toLowerCase() === 'true',
  zarinpalAmountUnit: process.env.ZARINPAL_AMOUNT_UNIT || 'toman',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@totofashion.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'ChangeMe-123456',
  adminMobile: process.env.ADMIN_MOBILE || '',
  seedOnStart: String(process.env.SEED_ON_START || 'true').toLowerCase() === 'true',
  freeShippingThreshold: Number(process.env.FREE_SHIPPING_THRESHOLD || 5000000),
  standardShippingPrice: Number(process.env.STANDARD_SHIPPING_PRICE || 120000)
};
env.isProduction = env.nodeEnv === 'production';
if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) throw new Error('PORT نامعتبر است');
if (!['lax','strict','none'].includes(env.cookieSameSite)) throw new Error('COOKIE_SAMESITE نامعتبر است');
if (env.isProduction && env.sessionSecret === 'change-me-in-production') throw new Error('SESSION_SECRET باید در Production تغییر کند');
module.exports = env;
