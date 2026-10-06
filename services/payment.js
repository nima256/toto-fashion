// درگاه پرداخت. در حالت PAYMENT_MOCK=true هیچ ارتباطی با زرین‌پال برقرار نمی‌شود، اما سفارش دقیقاً از همان مسیر callback و تأیید سرور عبور می‌کند.
const crypto=require('crypto'); const ZarinPal=require('zarinpal-checkout'); const env=require('../config/env'); let client=null;
function getClient(){if(!env.zarinpalMerchantId)throw new Error('ZARINPAL_MERCHANT_ID تنظیم نشده است');if(!client)client=ZarinPal.create(env.zarinpalMerchantId,env.zarinpalSandbox);return client;}
const gatewayAmount=toman=>env.zarinpalAmountUnit==='rial'?Number(toman)*10:Number(toman);
const callbackUrl=()=>`${env.siteUrl}/api/orders/payment/callback`;
const providerName=()=>env.paymentMock?'mock':'zarinpal';

async function requestPayment(order){
  if(env.paymentMock){
    const authority=`MOCK${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
    // آدرس نسبی تا در هر دامنه/پورت توسعه کار کند
    return{status:100,authority,url:`/api/orders/payment/callback?Authority=${authority}&Status=OK`};
  }
  return getClient().PaymentRequest({Amount:gatewayAmount(order.total),CallbackURL:callbackUrl(),Description:`سفارش ${order.orderNumber}`.slice(0,250),Email:order.email||undefined,Mobile:order.mobile});
}
async function verifyPayment(order,authority){
  if(env.paymentMock){
    // فقط authority صادرشده برای همین سفارش پذیرفته می‌شود
    if(!authority||authority!==order.paymentInfo?.authority||!authority.startsWith('MOCK'))return{status:-11};
    return{status:100,refId:`MOCK-${crypto.randomInt(100000000,999999999)}`,cardPan:'mock'};
  }
  return getClient().PaymentVerification({Amount:gatewayAmount(order.total),Authority:authority});
}
module.exports={requestPayment,verifyPayment,providerName};
