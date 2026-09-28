const mongoose = require('mongoose');
const itemSchema = new mongoose.Schema({
  productId:{type:String,required:true}, name:String, category:String, image:String, color:String, colorIndex:Number, size:String,
  quantity:{type:Number,min:1,max:5}, price:Number, returnEligible:{type:Boolean,default:true}
},{_id:false});
const timelineSchema = new mongoose.Schema({status:String,label:String,date:String,detail:String},{_id:false});
const orderSchema = new mongoose.Schema({
  orderNumber:{type:String,required:true,unique:true,index:true}, user:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null,index:true},
  customerName:{type:String,required:true}, mobile:{type:String,required:true,index:true}, email:{type:String,default:''},
  address:{type:String,required:true}, addressSnapshot:{type:mongoose.Schema.Types.Mixed,default:{}}, items:{type:[itemSchema],default:[]},
  subtotal:{type:Number,default:0}, productDiscount:{type:Number,default:0}, couponDiscount:{type:Number,default:0}, discount:{type:Number,default:0},
  shipping:{type:Number,default:0}, total:{type:Number,required:true}, couponCode:{type:String,default:''}, shippingMethod:{type:mongoose.Schema.Types.Mixed,default:{}},
  customerNote:{type:String,default:''},
  status:{type:String,enum:['registered','awaiting-payment','paid','processing','ready','shipped','delivered','cancelled','returned','payment-failed'],default:'awaiting-payment',index:true},
  paymentStatus:{type:String,enum:['pending','paid','failed','refunded'],default:'pending',index:true}, paymentMethod:{type:String,default:'درگاه پرداخت اینترنتی'},
  paymentInfo:{authority:String,url:String,refId:String,cardPan:String,paidAt:Date,failedAt:Date},
  trackingCode:{type:String,default:''}, carrier:{type:String,default:''}, deliveryEstimate:{type:String,default:''}, timeline:{type:[timelineSchema],default:[]},
  adminNote:{type:String,default:''}, inventoryApplied:{type:Boolean,default:false}
},{timestamps:true});
module.exports = mongoose.model('Order', orderSchema);
