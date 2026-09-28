import { api } from '../services/api.js';
import { addReturnRequest, ensureDemoSession, getAccountData, getOrders, getSession, setOrders } from '../core/account-store.js';
import { icon, toEnglishDigits, toPersianDigits } from '../core/utils.js';
import { accountSidebarTemplate, accountMobileNavTemplate, authGateTemplate } from '../components/account-shell.js';

const eligibleOrders = () => getOrders().filter(order => order.status === 'delivered' && order.items.some(item => item.returnEligible));

const formTemplate = (orders, selectedOrderId, selectedProductId) => {
  const selectedOrder = orders.find(order => order.id === selectedOrderId) || orders[0];
  return `<form class="return-form account-panel" id="return-form" novalidate>
    <div class="account-panel__head"><div><p class="eyebrow">درخواست آنلاین</p><h2>اطلاعات مرجوعی یا تعویض</h2></div></div>
    <div class="form-grid form-grid--2"><label class="field"><span>سفارش</span><select class="input" name="orderId" id="return-order" required>${orders.map(order => `<option value="${order.id}" ${order.id === selectedOrder?.id ? 'selected' : ''}>سفارش ${order.orderNumber} · ${order.placedAt}</option>`).join('')}</select><small class="field-message"></small></label><label class="field"><span>محصول</span><select class="input" name="productId" id="return-product" required>${selectedOrder?.items.filter(item=>item.returnEligible).map(item => `<option value="${item.productId}" ${item.productId === selectedProductId ? 'selected' : ''}>${item.name} · ${item.color} · سایز ${item.size}</option>`).join('')}</select><small class="field-message"></small></label></div>
    <fieldset class="return-choice"><legend>نوع درخواست</legend><label><input type="radio" name="type" value="exchange" checked><span>${icon('refresh')}<strong>تعویض سایز</strong><small>جایگزینی با سایز موجود</small></span></label><label><input type="radio" name="type" value="return"><span>${icon('package')}<strong>مرجوعی محصول</strong><small>بررسی و بازپرداخت وجه</small></span></label><label><input type="radio" name="type" value="damaged"><span>${icon('error')}<strong>گزارش آسیب‌دیدگی</strong><small>ایراد یا مغایرت محصول</small></span></label></fieldset>
    <div class="form-grid form-grid--2"><label class="field"><span>دلیل درخواست</span><select class="input" name="reason" required><option value="">انتخاب کنید</option><option value="size">سایز مناسب نیست</option><option value="different">محصول با تصویر یا توضیحات متفاوت است</option><option value="quality">ایراد دوخت یا پارچه</option><option value="damaged">محصول آسیب‌دیده تحویل شده</option><option value="changed-mind">انصراف از خرید</option><option value="other">دلیل دیگر</option></select><small class="field-message"></small></label><label class="field" id="exchange-size-field"><span>سایز جایگزین</span><select class="input" name="exchangeSize"><option value="">انتخاب سایز</option><option>۳۶</option><option>۳۸</option><option>۴۰</option><option>۴۲</option><option>۴۴</option></select><small class="field-message"></small></label></div>
    <label class="field"><span>توضیحات</span><textarea class="input input--textarea" name="description" rows="4" placeholder="برای بررسی دقیق‌تر، وضعیت محصول و بسته‌بندی را توضیح دهید." required></textarea><small class="field-message"></small></label>
    <label class="upload-field"><input type="file" name="images" id="return-images" accept="image/jpeg,image/png,image/webp" multiple><span>${icon('upload')}<strong>افزودن تصویر</strong><small>حداکثر ۳ تصویر JPG، PNG یا WebP؛ هر فایل تا ۵ مگابایت</small></span></label><div class="upload-preview" id="upload-preview" aria-live="polite"></div><div class="field-message field-message--error" id="upload-error"></div>
    <fieldset class="resolution-options"><legend>روش موردنظر برای رسیدگی</legend><label><input type="radio" name="resolution" value="exchange" checked><span>تعویض کالا یا سایز</span></label><label><input type="radio" name="resolution" value="wallet"><span>بازگشت اعتبار به کیف پول توتو</span></label><label><input type="radio" name="resolution" value="refund"><span>بازپرداخت وجه پس از تأیید</span></label></fieldset>
    <label class="check-row"><input type="checkbox" name="confirm" required><span>شرایط مرجوعی را مطالعه کرده‌ام و محصول استفاده‌نشده، دارای برچسب و بسته‌بندی اولیه است.</span></label><div class="field-message field-message--error" id="confirm-error"></div>
    <div class="page-notice page-notice--info">${icon('info')}<div><strong>بررسی اولیه تا ۲۴ ساعت کاری</strong><p>پس از تأیید، راهنمای ارسال محصول از طریق پیامک نمایش داده می‌شود.</p></div></div>
    <button class="button button--block" type="submit">ثبت درخواست</button>
  </form>`;
};

const successTemplate = request => `<section class="return-success"><span>${icon('check','icon icon--lg')}</span><p class="eyebrow">درخواست ثبت شد</p><h1>درخواست شما در صف بررسی است</h1><p>کد درخواست <strong>${request.id}</strong> است. نتیجه بررسی از طریق پیامک اطلاع‌رسانی می‌شود.</p><div class="return-success__steps"><div><b>۱</b><span><strong>بررسی درخواست</strong><small>حداکثر تا ۲۴ ساعت کاری</small></span></div><div><b>۲</b><span><strong>دریافت راهنمای ارسال</strong><small>پس از تأیید اولیه</small></span></div><div><b>۳</b><span><strong>کنترل محصول و نتیجه نهایی</strong><small>پس از رسیدن بسته به توتو</small></span></div></div><div class="payment-actions"><a class="button" href="./account#return-requests">مشاهده درخواست‌ها</a><a class="button button--outline" href="./orders">بازگشت به سفارش‌ها</a></div></section>`;

const noEligibleTemplate = () => `<section class="account-auth-gate"><span class="account-auth-gate__icon">${icon('refresh')}</span><h1>سفارش واجد شرایطی ندارید</h1><p>در حال حاضر محصول تحویل‌شده‌ای که در بازه مجاز تعویض یا مرجوعی باشد پیدا نشد.</p><a class="button" href="./orders">مشاهده سفارش‌ها</a><a class="button button--outline" href="./shipping-returns">شرایط مرجوعی</a></section>`;

const layoutTemplate = (session, account, content) => `<div class="account-page-shell">${accountSidebarTemplate({active:'returns',session,account})}<div class="account-content">${accountMobileNavTemplate('returns')}<header class="account-welcome account-welcome--compact"><div><p class="eyebrow">خدمات پس از خرید</p><h1>تعویض سایز و مرجوعی</h1><p>درخواست خود را مرحله‌به‌مرحله ثبت کنید تا تیم پشتیبانی بررسی کند.</p></div><a class="button button--outline" href="./shipping-returns">مشاهده شرایط</a></header>${content}</div></div>`;

const refreshProductOptions = (orders, orderId, selected='') => {
  const select=document.getElementById('return-product'); const order=orders.find(item=>item.id===orderId);
  select.innerHTML=order.items.filter(item=>item.returnEligible).map(item=>`<option value="${item.productId}" ${item.productId===selected?'selected':''}>${item.name} · ${item.color} · سایز ${item.size}</option>`).join('');
};

const validate = form => {
  form.querySelectorAll('.field-message').forEach(node=>{node.textContent='';node.classList.remove('field-message--error');});
  const data=new FormData(form); let first=null;
  for(const name of ['orderId','productId','reason','description']){ const field=form.elements[name]; if(!String(data.get(name)||'').trim()){ const msg=field.closest('.field')?.querySelector('.field-message'); if(msg){msg.textContent='این فیلد را کامل کنید.';msg.classList.add('field-message--error');} first ||= field; } }
  if(data.get('type')==='exchange' && !data.get('exchangeSize')){ const field=form.elements.exchangeSize; const msg=field.closest('.field').querySelector('.field-message'); msg.textContent='سایز جایگزین را انتخاب کنید.'; msg.classList.add('field-message--error'); first ||= field; }
  if(!form.elements.confirm.checked){ const msg=document.getElementById('confirm-error'); msg.textContent='برای ثبت درخواست، تأیید شرایط لازم است.'; first ||= form.elements.confirm; }
  first?.focus(); return first ? null : data;
};

const bind = (orders, toast, root, session, account) => {
  const form=document.getElementById('return-form');
  document.getElementById('return-order')?.addEventListener('change', event=>refreshProductOptions(orders,event.target.value));
  form?.addEventListener('change', event=>{ if(event.target.name==='type'){ document.getElementById('exchange-size-field').hidden=event.target.value!=='exchange'; } });
  document.getElementById('return-images')?.addEventListener('change', event=>{
    const files=[...event.target.files]; const error=document.getElementById('upload-error'); error.textContent='';
    if(files.length>3 || files.some(file=>file.size>5*1024*1024) || files.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.type))){ error.textContent='حداکثر ۳ تصویر JPG، PNG یا WebP و هر فایل تا ۵ مگابایت مجاز است.'; event.target.value=''; document.getElementById('upload-preview').innerHTML=''; return; }
    document.getElementById('upload-preview').innerHTML=files.map(file=>`<span>${icon('image','icon icon--sm')}<strong>${file.name}</strong><small>${toPersianDigits(Math.ceil(file.size/1024))} کیلوبایت</small></span>`).join('');
  });
  form?.addEventListener('submit', async event=>{
    event.preventDefault(); const data=validate(form); if(!data) return;
    const order=orders.find(item=>item.id===data.get('orderId')); const product=order.items.find(item=>item.productId===data.get('productId')); const button=form.querySelector('button[type="submit"]'); button.disabled=true; button.textContent='در حال ثبت...';
    try { const result=await api.createReturnRequest(Object.fromEntries(data)); const request={id:result.id,orderId:order.id,orderNumber:order.orderNumber,type:data.get('type')==='exchange'?'تعویض سایز':data.get('type')==='damaged'?'گزارش آسیب‌دیدگی':'مرجوعی محصول',status:'received',statusLabel:'در انتظار بررسی',createdAt:new Intl.DateTimeFormat('fa-IR',{year:'numeric',month:'long',day:'numeric'}).format(new Date()),productName:product.name}; addReturnRequest(request); root.innerHTML=layoutTemplate(session,account,successTemplate(request)); toast('درخواست شما با موفقیت ثبت شد.'); }
    catch(error){ toast(error.message,'error'); button.disabled=false; button.textContent='ثبت درخواست'; }
  });
};

const render = async toast => {
  ensureDemoSession(); const root=document.getElementById('return-request-root'); const session=getSession();
  if(!session){root.innerHTML=authGateTemplate({title:'برای ثبت درخواست وارد شوید',message:'تعویض و مرجوعی فقط برای سفارش‌های ثبت‌شده در حساب مشتری در دسترس است.'});return;}
  const account=getAccountData();
  try { setOrders(await api.getOrders()); } catch (error) { if (error.status===401) { root.innerHTML=authGateTemplate({title:'نشست شما منقضی شده است'}); return; } }
  const orders=eligibleOrders(); if(!orders.length){root.innerHTML=layoutTemplate(session,account,noEligibleTemplate());return;}
  const params=new URLSearchParams(location.search); const selectedOrder=params.get('order'); const selectedProduct=params.get('product'); root.innerHTML=layoutTemplate(session,account,formTemplate(orders,selectedOrder,selectedProduct)); bind(orders,toast,root,session,account);
};

export const initReturnRequest=({toast})=>{render(toast);document.addEventListener('toto:auth-changed',()=>render(toast));};
