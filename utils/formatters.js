const normalizeDigits = (value = '') => String(value)
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const normalizeMobile = (value = '') => {
  let mobile = normalizeDigits(value).trim().replace(/[^\d+]/g, '');
  mobile = mobile.replace(/^\+98/, '0').replace(/^0098/, '0').replace(/^98(?=9\d{9}$)/, '0');
  if (/^9\d{9}$/.test(mobile)) mobile = `0${mobile}`;
  return mobile;
};
const faDate = date => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year:'numeric', month:'2-digit', day:'2-digit', timeZone:'Asia/Tehran' }).format(new Date(date || Date.now()));
const faDateTime = date => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23', timeZone:'Asia/Tehran' }).format(new Date(date || Date.now()));
module.exports = { normalizeDigits, normalizeMobile, faDate, faDateTime };
