const mongoose = require('mongoose');
const imageSchema = new mongoose.Schema({filename:{type:String,required:true},originalName:{type:String,default:''},mimeType:{type:String,default:''},size:{type:Number,default:0}},{_id:false});
const schema = new mongoose.Schema({
  publicId:{type:String,unique:true,index:true,default:()=>`RET-${Date.now().toString().slice(-8)}${Math.random().toString(16).slice(2,4).toUpperCase()}`}, user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  order:{type:mongoose.Schema.Types.ObjectId,ref:'Order',required:true,index:true}, orderNumber:{type:String,required:true,index:true}, productId:{type:String,required:true},
  // نسخه ثابت از قلم سفارش در لحظه ثبت درخواست
  item:{name:{type:String,default:''},image:{type:String,default:''},color:{type:String,default:''},size:{type:String,default:''},quantity:{type:Number,default:1},price:{type:Number,default:0}},
  reason:{type:String,required:true}, reasonCode:{type:String,enum:['size','different','quality','damaged','changed-mind','other'],default:'other'},
  requestType:{type:String,enum:['exchange','return','damaged'],default:'return'},
  exchangeSize:{type:String,default:''}, exchangeColor:{type:String,default:''},
  resolution:{type:String,enum:['exchange','wallet','refund'],default:'refund'},
  note:{type:String,default:''}, termsAccepted:{type:Boolean,default:false}, images:{type:[imageSchema],default:[]},
  // وضعیت‌ها: received=در انتظار، reviewing=در حال بررسی، approved=تأیید، awaiting-item=در انتظار دریافت کالا،
  // replacement-processing=آماده‌سازی جایگزین، refunded=بازپرداخت‌شده، rejected=رد، completed=تکمیل
  status:{type:String,enum:['received','reviewing','approved','awaiting-item','replacement-processing','refunded','rejected','completed'],default:'received',index:true},
  // adminNote فقط داخلی است؛ customerMessage پاسخی است که به مشتری نمایش داده می‌شود
  adminNote:{type:String,default:''}, customerMessage:{type:String,default:''}, history:{type:[{status:String,note:String,at:{type:Date,default:Date.now}}],default:[]}
},{timestamps:true});
module.exports = mongoose.model('ReturnRequest', schema);
