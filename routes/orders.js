const express = require('express');
const crypto = require('crypto');
const Order = require('../models/Order');
const User = require('../models/User');
const env = require('../config/env');
const { validateAndPriceCart, applyInventory } = require('../services/inventory');
const { requestPayment, verifyPayment } = require('../services/payment');
const { sendOrderRegisteredSms } = require('../services/sms');
const S = require('../services/serializers');
const { asyncHandler, ok, AppError } = require('../utils/http');
const { requireCsrf } = require('../middlewares/auth');
const { normalizeMobile } = require('../utils/formatters');

const router = express.Router();

const shippingMethods = {
  standard: { id:'standard', title:'ارسال استاندارد', description:'تهران ۱ تا ۳ و سایر شهرها ۳ تا ۶ روز کاری', price:env.standardShippingPrice, eta:'۱ تا ۶ روز کاری' },
  'express-tehran': { id:'express-tehran', title:'ارسال سریع تهران', description:'ویژه آدرس‌های شهر تهران؛ تحویل در روز کاری بعد', price:220000, eta:'روز کاری بعد', province:'تهران', city:'تهران' },
  pickup: { id:'pickup', title:'تحویل حضوری از فروشگاه', description:'پس از آماده‌شدن سفارش با پیامک اطلاع‌رسانی می‌شود', price:0, eta:'۱ تا ۲ روز کاری' }
};
const discounts = {
  TOTO10: { type:'percent', value:10, max:500000, label:'۱۰٪ تخفیف تا سقف ۵۰۰ هزار تومان' },
  NEWTOTO: { type:'fixed', value:250000, min:1800000, label:'۲۵۰ هزار تومان تخفیف خرید اول' },
  FREESHIP: { type:'shipping', value:0, label:'ارسال رایگان' }
};
const timelineEntry = (status,label,detail='') => ({ status, label, date:new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tehran'}).format(new Date()), detail });

function getPayload(req) {
  const source = req.body?.order || req.body || {};
  const items = req.body?.items || source.items || [];
  const checkout = req.body?.checkout || source.checkout || {};
  const discountCode = String(req.body?.discountCode ?? source.discountCode ?? '').trim().toUpperCase();
  return { source, items, checkout, discountCode };
}
function calculateCoupon(code, merchandiseSubtotal, shipping) {
  if (!code) return { discount:0, shipping, coupon:null };
  const coupon = discounts[code];
  if (!coupon) throw new AppError(400,'کد تخفیف معتبر نیست');
  if (coupon.min && merchandiseSubtotal < coupon.min) throw new AppError(400,`حداقل خرید برای این کد ${coupon.min.toLocaleString('fa-IR')} تومان است`);
  if (coupon.type === 'percent') return { discount:Math.min(Math.round(merchandiseSubtotal * coupon.value / 100), coupon.max || Infinity), shipping, coupon };
  if (coupon.type === 'fixed') return { discount:Math.min(coupon.value, merchandiseSubtotal), shipping, coupon };
  if (coupon.type === 'shipping') return { discount:0, shipping:0, coupon };
  return { discount:0, shipping, coupon };
}
function addressText(address) {
  return [address.province,address.city,address.address,address.buildingNumber ? `پلاک ${address.buildingNumber}` : '',address.unit ? `واحد ${address.unit}` : ''].filter(Boolean).join('، ');
}
async function uniqueOrderNumber() {
  for (let i=0;i<8;i++) {
    const d = new Date();
    const stamp = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const candidate = `TO-${stamp}-${crypto.randomInt(1000,10000)}`;
    if (!(await Order.exists({orderNumber:candidate}))) return candidate;
  }
  return `TO-${Date.now()}`;
}
async function priceOrder(req) {
  const {items,checkout,discountCode} = getPayload(req);
  const lines = await validateAndPriceCart(items);
  const address = checkout.address || {};
  const mobile = normalizeMobile(address.mobile || req.body.mobile || '');
  if (!/^09\d{9}$/.test(mobile)) throw new AppError(400,'شماره موبایل گیرنده معتبر نیست');
  if (!address.firstName || !address.lastName) throw new AppError(400,'نام و نام خانوادگی گیرنده کامل نیست');
  const selectedId = String(checkout.shippingMethod?.id || 'standard');
  const selected = shippingMethods[selectedId];
  if (!selected) throw new AppError(400,'روش ارسال معتبر نیست');
  if (selected.id === 'express-tehran' && !(address.province === 'تهران' && address.city === 'تهران')) throw new AppError(400,'ارسال سریع فقط برای شهر تهران فعال است');

  const itemsOut = lines.map(({product,quantity,size,colorIndex,currentPrice}) => ({
    productId:product.publicId, name:product.name, category:product.category, image:product.image,
    color:product.colorNames?.[colorIndex] || '', colorIndex, size, quantity, price:currentPrice, returnEligible:true
  }));
  const subtotal = lines.reduce((sum,l)=>sum + Number(l.previousPrice || l.currentPrice) * l.quantity,0);
  const merchandiseSubtotal = lines.reduce((sum,l)=>sum + Number(l.currentPrice) * l.quantity,0);
  const productDiscount = Math.max(0, subtotal - merchandiseSubtotal);
  let shipping = selected.price;
  if (selected.id === 'standard' && merchandiseSubtotal >= env.freeShippingThreshold) shipping = 0;
  const couponResult = calculateCoupon(discountCode, merchandiseSubtotal, shipping);
  shipping = couponResult.shipping;
  const couponDiscount = couponResult.discount;
  const total = Math.max(0, merchandiseSubtotal - couponDiscount + shipping);
  return {address,mobile,selected,discountCode,couponResult,itemsOut,subtotal,merchandiseSubtotal,productDiscount,couponDiscount,shipping,total,checkout};
}

router.post('/validate-cart', requireCsrf, asyncHandler(async(req,res)=>{
  const priced = await priceOrder(req);
  ok(res,{ok:true,amounts:{subtotal:priced.subtotal,productDiscount:priced.productDiscount,couponDiscount:priced.couponDiscount,shipping:priced.shipping,total:priced.total},shippingMethod:priced.selected,coupon:priced.couponResult.coupon});
}));

router.post('/', requireCsrf, asyncHandler(async(req,res)=>{
  const priced = await priceOrder(req);
  let user = null;
  if (req.session?.userId) user = await User.findById(req.session.userId);
  const orderNumber = await uniqueOrderNumber();
  const order = await Order.create({
    orderNumber, user:user?._id || null,
    customerName:`${priced.address.firstName} ${priced.address.lastName}`.trim(), mobile:priced.mobile, email:user?.email || '',
    address:addressText(priced.address) || (priced.selected.id === 'pickup' ? 'تحویل حضوری از فروشگاه' : 'نشانی ثبت نشده'),
    addressSnapshot:priced.address, items:priced.itemsOut,
    subtotal:priced.subtotal, productDiscount:priced.productDiscount, couponDiscount:priced.couponDiscount,
    discount:priced.productDiscount + priced.couponDiscount, shipping:priced.shipping, total:priced.total,
    couponCode:priced.discountCode, shippingMethod:priced.selected, customerNote:String(priced.checkout.notes || '').trim(),
    status:'awaiting-payment', paymentStatus:'pending', carrier:priced.selected.title, deliveryEstimate:priced.selected.eta,
    timeline:[timelineEntry('registered','سفارش ثبت شد','سفارش در انتظار تأیید پرداخت است.')]
  });

  if (env.paymentMock) {
    order.paymentStatus='paid'; order.status='processing'; order.paymentInfo.refId=`MOCK-${Date.now()}`; order.paymentInfo.paidAt=new Date();
    order.timeline.push(timelineEntry('paid','پرداخت تأیید شد','پرداخت آزمایشی با موفقیت تأیید شد.'));
    order.timeline.push(timelineEntry('processing','آماده‌سازی سفارش','سفارش برای آماده‌سازی وارد صف شد.'));
    await applyInventory(order);
    if (user) { user.loyalty.points += Math.floor(order.total/10000); await user.save(); }
    sendOrderRegisteredSms(order).catch(()=>{});
    return ok(res,{paymentId:order.orderNumber,redirectUrl:`/payment-success?order=${encodeURIComponent(order.orderNumber)}`,order:S.order(order)},201);
  }

  try {
    const payment = await requestPayment(order);
    if (!payment?.url || !payment?.authority) throw new Error('پاسخ معتبر از درگاه دریافت نشد');
    order.paymentInfo.authority=payment.authority; order.paymentInfo.url=payment.url; await order.save();
    return ok(res,{paymentId:payment.authority,redirectUrl:payment.url,order:S.order(order)},201);
  } catch (e) {
    order.status='payment-failed'; order.paymentStatus='failed'; order.paymentInfo.failedAt=new Date();
    order.timeline.push(timelineEntry('payment-failed','ایجاد پرداخت ناموفق بود',e.message)); await order.save();
    throw new AppError(502,`اتصال به درگاه پرداخت انجام نشد: ${e.message}`);
  }
}));

router.get('/payment/callback', asyncHandler(async(req,res)=>{
  const authority = String(req.query.Authority || req.query.authority || '');
  const status = String(req.query.Status || req.query.status || '');
  const order = await Order.findOne({'paymentInfo.authority':authority});
  if (!order) return res.redirect(`/payment-failed?reason=order-not-found`);
  if (order.paymentStatus === 'paid') return res.redirect(`/payment-success?order=${encodeURIComponent(order.orderNumber)}`);
  if (status.toUpperCase() !== 'OK') {
    order.paymentStatus='failed'; order.status='payment-failed'; order.paymentInfo.failedAt=new Date(); order.timeline.push(timelineEntry('payment-failed','پرداخت لغو شد','پرداخت در درگاه تکمیل نشد.')); await order.save();
    return res.redirect(`/payment-failed?order=${encodeURIComponent(order.orderNumber)}`);
  }
  try {
    const result = await verifyPayment(order,authority);
    if (![100,101].includes(Number(result?.status))) throw new Error(`کد تأیید درگاه: ${result?.status ?? 'نامشخص'}`);
    order.paymentStatus='paid'; order.status='processing'; order.paymentInfo.refId=String(result.refId || result.RefID || ''); order.paymentInfo.cardPan=String(result.cardPan || ''); order.paymentInfo.paidAt=new Date();
    order.timeline.push(timelineEntry('paid','پرداخت تأیید شد','پرداخت اینترنتی با موفقیت تأیید شد.')); order.timeline.push(timelineEntry('processing','آماده‌سازی سفارش','سفارش برای آماده‌سازی وارد صف شد.'));
    try { await applyInventory(order); }
    catch (inventoryError) { order.status='paid'; order.adminNote=`پرداخت تأیید شده اما تخصیص موجودی نیازمند بررسی است: ${inventoryError.message}`; order.timeline.push(timelineEntry('paid','نیازمند بررسی موجودی','پرداخت موفق بوده و تیم فروش باید موجودی را بررسی کند.')); await order.save(); }
    if (order.user) { const user=await User.findById(order.user); if(user){user.loyalty.points += Math.floor(order.total/10000); await user.save();} }
    sendOrderRegisteredSms(order).catch(()=>{});
    return res.redirect(`/payment-success?order=${encodeURIComponent(order.orderNumber)}`);
  } catch(e) {
    order.paymentStatus='failed'; order.status='payment-failed'; order.paymentInfo.failedAt=new Date(); order.timeline.push(timelineEntry('payment-failed','تأیید پرداخت ناموفق بود',e.message)); await order.save();
    return res.redirect(`/payment-failed?order=${encodeURIComponent(order.orderNumber)}`);
  }
}));

router.get('/:orderNumber/status', asyncHandler(async(req,res)=>{
  const order = await Order.findOne({orderNumber:req.params.orderNumber}); if(!order)throw new AppError(404,'سفارش پیدا نشد');
  if (order.user && (!req.session?.userId || String(order.user)!==String(req.session.userId))) throw new AppError(403,'دسترسی به این سفارش مجاز نیست');
  ok(res,{status:order.paymentStatus,order:S.order(order),trackingCode:order.paymentInfo?.refId || order.trackingCode || ''});
}));

router.post('/track', requireCsrf, asyncHandler(async(req,res)=>{
  const orderNumber=String(req.body.orderNumber||'').trim(); const mobile=normalizeMobile(req.body.mobile);
  const digits=orderNumber.replace(/[^0-9A-Za-z-]/g,'');
  const order=await Order.findOne({$or:[{orderNumber},{orderNumber:digits}],mobile}); if(!order)throw new AppError(404,'سفارشی با این شماره و موبایل پیدا نشد');
  ok(res,{order:S.order(order)});
}));
module.exports = router;
