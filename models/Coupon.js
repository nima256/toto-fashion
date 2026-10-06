const mongoose = require('mongoose');
const redemptionSchema = new mongoose.Schema({order:{type:mongoose.Schema.Types.ObjectId,ref:'Order'},user:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},mobile:{type:String,default:''},at:{type:Date,default:Date.now}},{_id:false});
// کدهای تخفیف عمومی (مدیر) و شخصی (چرخونه)؛ تنها منبع معتبر قوانین تخفیف در فروشگاه
const schema = new mongoose.Schema({
  code:{type:String,required:true,unique:true,uppercase:true,trim:true,index:true}, title:{type:String,default:''}, condition:{type:String,default:''},
  type:{type:String,enum:['percent','fixed','shipping','category'],required:true}, value:{type:Number,default:0,min:0},
  maxDiscount:{type:Number,default:null,min:0}, minSubtotal:{type:Number,default:0,min:0},
  category:{type:String,default:''}, onlyNonDiscounted:{type:Boolean,default:false}, firstOrderOnly:{type:Boolean,default:false},
  shippingMethods:{type:[String],default:[]},
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null,index:true},
  usageLimit:{type:Number,default:null,min:1}, perUserLimit:{type:Number,default:null,min:1}, usedCount:{type:Number,default:0,min:0},
  redemptions:{type:[redemptionSchema],default:[]},
  startsAt:{type:Date,default:null}, expiresAt:{type:Date,default:null,index:true}, isActive:{type:Boolean,default:true},
  source:{type:String,enum:['admin','wheel','seed'],default:'admin'}
},{timestamps:true});
module.exports = mongoose.model('Coupon', schema);
