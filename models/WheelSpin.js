const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true}, dayKey:{type:String,required:true},
  prizeId:{type:String,required:true}, prize:{type:mongoose.Schema.Types.Mixed,default:{}},
  coupon:{type:mongoose.Schema.Types.ObjectId,ref:'Coupon',default:null}, couponCode:{type:String,default:''},
  expiresAt:{type:Date,default:null}
},{timestamps:true});
// هر کاربر در هر روز فقط یک چرخش؛ حتی در درخواست‌های هم‌زمان
schema.index({user:1,dayKey:1},{unique:true});
module.exports = mongoose.model('WheelSpin', schema);
