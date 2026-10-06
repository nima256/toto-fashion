// لایه اعتبارسنجی متمرکز بر پایه Zod؛ خطاها همیشه با وضعیت ۴۰۰ و ساختار یکسان برگردانده می‌شوند.
const { z } = require('zod');
const mongoose = require('mongoose');
const { AppError } = require('./http');
const { normalizeDigits, normalizeMobile, normalizeOrderNumber } = require('./formatters');

const formatIssues = error => error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }));

function validate(schemas = {}) {
  return (req, _res, next) => {
    req.valid = req.valid || {};
    for (const key of ['params', 'query', 'body']) {
      if (!schemas[key]) continue;
      const result = schemas[key].safeParse(req[key] ?? {});
      if (!result.success) return next(new AppError(400, 'اطلاعات ارسالی معتبر نیست', formatIssues(result.error)));
      req.valid[key] = result.data;
      if (key !== 'query') req[key] = result.data;
    }
    next();
  };
}

// تبدیل ارقام فارسی/عربی پیش از بررسی عددی
const digits = value => (typeof value === 'string' ? normalizeDigits(value).trim() : value);
const text = (max, { min = 0, message } = {}) => z.string({ invalid_type_error: 'مقدار متنی معتبر نیست' }).trim().min(min, message || `حداقل ${min} نویسه لازم است`).max(max, `حداکثر ${max} نویسه مجاز است`);
const optionalText = max => z.preprocess(value => (value === null || value === undefined ? '' : value), text(max));
const int = ({ min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) => z.preprocess(
  value => (value === '' || value === null || value === undefined ? undefined : Number(digits(value))),
  z.number({ required_error: 'مقدار عددی الزامی است', invalid_type_error: 'مقدار عددی معتبر نیست' }).int('عدد باید صحیح باشد').min(min, `حداقل مقدار ${min} است`).max(max, `حداکثر مقدار ${max} است`)
);
const money = (max = 10_000_000_000) => int({ min: 0, max });
const bool = z.preprocess(value => (value === 'true' || value === '1' || value === 'on' ? true : value === 'false' || value === '0' || value === '' ? false : value), z.boolean());
const mobile = z.preprocess(value => normalizeMobile(String(value ?? '')), z.string().regex(/^09\d{9}$/, 'شماره موبایل باید ۱۱ رقم و با ۰۹ آغاز شود'));
const orderNumber = z.preprocess(value => normalizeOrderNumber(String(value ?? '')), z.string().min(1, 'شماره سفارش معتبر نیست؛ قالب صحیح مانند TO-261005-1234 است'));
const objectId = z.string().refine(value => mongoose.isValidObjectId(value), 'شناسه معتبر نیست');
const publicId = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/, 'شناسه معتبر نیست');
const slug = z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'نامک فقط شامل حروف کوچک انگلیسی، عدد و خط تیره است');
const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'کد رنگ باید به شکل #RRGGBB باشد');
// فقط مسیرهای داخلی و تصاویر بارگذاری‌شده؛ جلوگیری از javascript: و دامنه‌های ناشناخته
const assetPath = z.string().trim().max(300).regex(/^(?:\.\/src\/assets\/images\/|\/src\/assets\/images\/|\/uploads\/(?:products|content)\/)[A-Za-z0-9._\-/]+$/, 'مسیر تصویر مجاز نیست').refine(value => !value.includes('..'), 'مسیر تصویر مجاز نیست');
const internalLink = z.string().trim().max(300).regex(/^(?:\/|\.\/)(?!\/)[^\s<>"'`]*$/, 'فقط پیوند داخلی مجاز است');

module.exports = { z, validate, formatIssues, text, optionalText, int, money, bool, mobile, orderNumber, objectId, publicId, slug, hexColor, assetPath, internalLink };
