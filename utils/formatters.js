const normalizeDigits = (value = '') => String(value)
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const normalizeMobile = (value = '') => {
  let mobile = normalizeDigits(value).trim().replace(/[^\d+]/g, '');
  mobile = mobile.replace(/^\+98/, '0').replace(/^0098/, '0').replace(/^98(?=9\d{9}$)/, '0');
  if (/^9\d{9}$/.test(mobile)) mobile = `0${mobile}`;
  return mobile;
};
// شماره سفارش را به قالب استاندارد TO-YYMMDD-NNNN برمی‌گرداند؛ ورودی‌هایی مثل «۲۶۱۰۰۵۱۲۳۴» یا «to 261005 1234» هم پذیرفته می‌شوند.
const normalizeOrderNumber = (value = '') => {
  const compact = normalizeDigits(value).toUpperCase().replace(/[\s‌_]/g, '').replace(/[‐‑‒–—−]/g, '-');
  if (!compact || compact.length > 32) return '';
  const standard = compact.match(/^(?:TO)?-?(\d{6})-?(\d{4,6})$/);
  if (standard) return `TO-${standard[1]}-${standard[2]}`;
  const legacy = compact.match(/^TO-?(\d{10,16})$/);
  if (legacy) return `TO-${legacy[1]}`;
  return '';
};
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const faDate = date => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year:'numeric', month:'2-digit', day:'2-digit', timeZone:'Asia/Tehran' }).format(new Date(date || Date.now()));
const faDateTime = date => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23', timeZone:'Asia/Tehran' }).format(new Date(date || Date.now()));
const faLongDate = date => new Intl.DateTimeFormat('fa-IR', { year:'numeric', month:'long', day:'numeric', timeZone:'Asia/Tehran' }).format(new Date(date || Date.now()));
// کلید روز بر اساس ساعت تهران؛ برای محدودیت‌های روزانه (مثل چرخونه) استفاده می‌شود.
const tehranDayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Tehran' }).format(date);
module.exports = { normalizeDigits, normalizeMobile, normalizeOrderNumber, escapeRegex, faDate, faDateTime, faLongDate, tehranDayKey };
