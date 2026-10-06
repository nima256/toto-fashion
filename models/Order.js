const mongoose = require('mongoose');
const itemSchema = new mongoose.Schema({
  productId:{type:String,required:true}, name:String, category:String, image:String, color:String, colorIndex:Number, size:String,
  variantId:{type:String,default:''},
  quantity:{type:Number,min:1,max:5}, price:Number, previousPrice:Number, returnEligible:{type:Boolean,default:true}
},{_id:false});
const timelineSchema = new mongoose.Schema({status:String,label:String,date:String,detail:String},{_id:false});
const orderSchema = new mongoose.Schema({
  orderNumber:{type:String,required:true,unique:true,index:true}, user:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null,index:true},
  customerName:{type:String,required:true}, mobile:{type:String,required:true,index:true}, email:{type:String,default:''},
  address:{type:String,required:true}, addressSnapshot:{type:mongoose.Schema.Types.Mixed,default:{}}, items:{type:[itemSchema],default:[]},
  subtotal:{type:Number,default:0}, productDiscount:{type:Number,default:0}, couponDiscount:{type:Number,default:0}, discount:{type:Number,default:0},
  shipping:{type:Number,default:0}, total:{type:Number,required:true}, couponCode:{type:String,default:''}, coupon:{type:mongoose.Schema.Types.ObjectId,ref:'Coupon',default:null},
  shippingMethod:{type:mongoose.Schema.Types.Mixed,default:{}},
  customerNote:{type:String,default:''},
  status:{type:String,enum:['registered','awaiting-payment','paid','processing','ready','shipped','delivered','cancelled','returned','payment-failed'],default:'awaiting-payment',index:true},
  paymentStatus:{type:String,enum:['pending','paid','failed','refunded'],default:'pending',index:true}, paymentMethod:{type:String,default:'درگاه پرداخت اینترنتی'},
  paymentInfo:{provider:String,authority:{type:String,index:true},url:String,refId:String,cardPan:String,paidAt:Date,failedAt:Date,lastError:String},
  trackingCode:{type:String,default:''}, carrier:{type:String,default:''}, deliveryEstimate:{type:String,default:''}, timeline:{type:[timelineSchema],default:[]},
  adminNote:{type:String,default:''}, deliveredAt:{type:Date,default:null},
  // وضعیت عملیات پس از پرداخت؛ هر کدام فقط یک‌بار و به‌صورت اتمیک اعمال می‌شود
  inventoryApplied:{type:Boolean,default:false}, inventoryState:{type:String,enum:['pending','applying','applied','failed'],default:'pending'},
  loyaltyState:{type:String,enum:['pending','awarded','skipped'],default:'pending'}, loyaltyPoints:{type:Number,default:0},
  couponState:{type:String,enum:['none','pending','redeemed','failed'],default:'none'}, paidSmsSent:{type:Boolean,default:false},
  needsReview:{type:Boolean,default:false,index:true}, reviewNotes:{type:[String],default:[]},
  // کلید یکتای ارسال‌شده از مرورگر برای جلوگیری از ثبت دوباره سفارش با دوبار کلیک یا ارسال مجدد
  idempotencyKey:{type:String,default:undefined}
},{timestamps:true});
orderSchema.index({idempotencyKey:1},{unique:true,sparse:true});
orderSchema.index({createdAt:-1});
module.exports = mongoose.model('Order', orderSchema);
