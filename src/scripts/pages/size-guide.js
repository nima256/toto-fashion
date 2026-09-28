import { toPersianDigits } from '../core/utils.js';

const guides = {
  'مانتو و کت': { headers: ['سایز', 'دور سینه', 'دور کمر', 'دور باسن', 'سرشانه', 'قد آستین'], rows: [[36,88,70,94,38,59],[38,92,74,98,39,60],[40,96,78,102,40,60],[42,100,82,106,41,61],[44,104,86,110,42,61]] },
  'پیراهن': { headers: ['سایز', 'دور سینه', 'دور کمر', 'دور باسن', 'قد محصول'], rows: [[36,88,70,94,118],[38,92,74,98,119],[40,96,78,102,120],[42,100,82,106,121],[44,104,86,110,122]] },
  'شومیز': { headers: ['سایز', 'دور سینه', 'دور کمر', 'سرشانه', 'قد آستین', 'قد محصول'], rows: [[36,90,72,38,59,67],[38,94,76,39,60,68],[40,98,80,40,60,69],[42,102,84,41,61,70]] },
  'شلوار': { headers: ['سایز', 'دور کمر', 'دور باسن', 'قد شلوار'], rows: [[36,70,94,103],[38,74,98,104],[40,78,102,105],[42,82,106,106],[44,86,110,107]] },
  'دامن': { headers: ['سایز', 'دور کمر', 'دور باسن', 'قد محصول'], rows: [[36,70,94,78],[38,74,98,79],[40,78,102,80],[42,82,106,81],[44,86,110,82]] },
  'کفش': { headers: ['سایز', 'طول پا به سانتی‌متر'], rows: [[36,23],[37,23.7],[38,24.4],[39,25],[40,25.7],[41,26.4]] }
};

export const initSizeGuide = () => {
  const root = document.getElementById('size-tabs'); if (!root) return;
  let active = Object.keys(guides)[0];
  const render = () => {
    const guide = guides[active];
    root.innerHTML = `<div class="tabs" role="tablist" aria-label="دسته‌بندی جدول سایز">${Object.keys(guides).map(name => `<button type="button" role="tab" aria-selected="${name === active}" data-size-tab="${name}">${name}</button>`).join('')}</div><section class="size-table-card"><div class="size-table-card__head"><div><h2>${active}</h2><p>تمام اندازه‌ها به سانتی‌متر هستند.</p></div><span>راهنمای عمومی توتو</span></div><div class="table-scroll"><table class="size-table"><thead><tr>${guide.headers.map(header => `<th scope="col">${header}</th>`).join('')}</tr></thead><tbody>${guide.rows.map(row => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${toPersianDigits(cell)}</th>` : `<td>${toPersianDigits(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="size-fit-notes"><h3>یادداشت قالب</h3><ul><li><strong>قالب استاندارد:</strong> سایز همیشگی خود را انتخاب کنید.</li><li><strong>قالب جذب:</strong> اگر بین دو سایز هستید، سایز بزرگ‌تر را انتخاب کنید.</li><li><strong>قالب آزاد:</strong> برای فرم نزدیک‌تر به بدن، یک سایز کوچک‌تر را بررسی کنید.</li></ul></div></section>`;
  };
  root.addEventListener('click', event => { const tab = event.target.closest('[data-size-tab]'); if (!tab) return; active = tab.dataset.sizeTab; render(); });
  render();
};
