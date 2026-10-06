// لایه امن‌سازی خروجی: هر مقدار دیتابیس/کاربر پیش از قرار گرفتن در innerHTML باید با escapeHtml یا توابع زیر عبور کند.
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"'`]/g, char => HTML_ESCAPES[char]);
export const esc = escapeHtml;
// فقط مسیرهای داخلی، تصاویر محلی و data/blob پیش‌نمایش؛ javascript: و دامنه‌های خارجی رد می‌شوند
export const safeUrl = (value = '', fallback = '') => {
  const url = String(value ?? '').trim();
  if (/^(?:\.\/|\/(?!\/))[^\s"'<>`\\]*$/.test(url)) return escapeHtml(url);
  if (/^blob:/.test(url) || /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(url)) return escapeHtml(url);
  return escapeHtml(fallback);
};
export const safeImage = value => safeUrl(value, './src/assets/images/product-1.webp');
export const safeColor = (value = '') => (/^#[0-9a-fA-F]{3,8}$/.test(String(value)) ? value : '#cccccc');
export const encodeParam = value => encodeURIComponent(String(value ?? ''));

export const icon = (name, className = 'icon') => `
  <svg class="${escapeHtml(className)}" aria-hidden="true" focusable="false">
    <use href="./src/assets/icons/sprite.svg#${escapeHtml(name)}"></use>
  </svg>`;

export const toEnglishDigits = (value = '') => String(value)
  .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

export const toPersianDigits = (value = '') => String(value).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

export const formatPrice = value => `${new Intl.NumberFormat('fa-IR').format(Number(value) || 0)} تومان`;

// همان قالب سرور: TO-YYMMDD-NNNN (ورودی با ارقام فارسی، فاصله یا بدون خط تیره هم پذیرفته می‌شود)
export const normalizeOrderNumber = (value = '') => {
  const compact = toEnglishDigits(value).toUpperCase().replace(/[\s‌_]/g, '').replace(/[‐‑‒–—−]/g, '-');
  if (!compact || compact.length > 32) return '';
  const standard = compact.match(/^(?:TO)?-?(\d{6})-?(\d{4,6})$/);
  if (standard) return `TO-${standard[1]}-${standard[2]}`;
  const legacy = compact.match(/^TO-?(\d{10,16})$/);
  return legacy ? `TO-${legacy[1]}` : '';
};

export const debounce = (fn, delay = 180) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;

export const getFocusable = container => [...container.querySelectorAll(
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
)].filter(element => !element.hasAttribute('hidden'));

export const trapFocus = (event, container) => {
  if (event.key !== 'Tab') return;
  const focusable = getFocusable(container);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

export const announce = message => {
  const live = document.getElementById('app-live-region');
  if (!live) return;
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = message; });
};

// پیام خطای فیلدها از پاسخ ۴۰۰ سرور (details) برای نمایش زیر هر فیلد
export const fieldErrors = error => Object.fromEntries((Array.isArray(error?.details) ? error.details : []).map(item => [String(item.path || '').split('.').pop(), item.message]));
