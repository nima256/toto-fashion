export const icon = (name, className = 'icon') => `
  <svg class="${className}" aria-hidden="true" focusable="false">
    <use href="./src/assets/icons/sprite.svg#${name}"></use>
  </svg>`;

export const toEnglishDigits = (value = '') => String(value)
  .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

export const toPersianDigits = (value = '') => String(value).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

export const formatPrice = value => `${new Intl.NumberFormat('fa-IR').format(value)} تومان`;

export const debounce = (fn, delay = 180) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

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
