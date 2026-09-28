const ZarinPal=require('zarinpal-checkout'); const env=require('../config/env'); let client=null;
function getClient(){if(!env.zarinpalMerchantId)throw new Error('ZARINPAL_MERCHANT_ID تنظیم نشده است');if(!client)client=ZarinPal.create(env.zarinpalMerchantId,env.zarinpalSandbox);return client;}
const gatewayAmount=toman=>env.zarinpalAmountUnit==='rial'?Number(toman)*10:Number(toman);
async function requestPayment(order){return getClient().PaymentRequest({Amount:gatewayAmount(order.total),CallbackURL:`${env.siteUrl}/api/orders/payment/callback`,Description:`سفارش ${order.orderNumber} - ${order.customerName}`.slice(0,250),Email:order.email||undefined,Mobile:order.mobile});}
async function verifyPayment(order,authority){return getClient().PaymentVerification({Amount:gatewayAmount(order.total),Authority:authority});}
module.exports={requestPayment,verifyPayment};
