const mongoose = require('mongoose');
// هر ارسال می‌تواند چند تصویر داشته باشد و هر تصویر جداگانه بررسی (تأیید/رد) می‌شود
const imageSchema = new mongoose.Schema({
  filename:{type:String,required:true}, mimeType:{type:String,default:''}, size:{type:Number,default:0},
  status:{type:String,enum:['pending','approved','rejected'],default:'pending'}, rejectionReason:{type:String,default:''},
  moderatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin',default:null}, moderatedAt:{type:Date,default:null}
},{_id:true});
const schema = new mongoose.Schema({
  publicId:{type:String,unique:true,index:true,default:()=>`GAL-${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`.toUpperCase()},
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true}, customerName:{type:String,required:true},
  productId:{type:String,required:true}, productName:{type:String,default:''}, caption:{type:String,required:true},
  images:{type:[imageSchema],default:[]},
  // فیلد قدیمی تک‌تصویری؛ با مهاجرت به images[0] منتقل می‌شود و فقط برای سازگاری باقی مانده است
  image:{filename:{type:String},mimeType:{type:String},size:{type:Number}},
  consent:{type:Boolean,default:false},
  // وضعیت کلی ارسال از وضعیت تصاویر محاسبه می‌شود
  status:{type:String,enum:['pending','approved','rejected'],default:'pending',index:true},
  rejectionReason:{type:String,default:''}, moderatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin',default:null}, moderatedAt:{type:Date,default:null}
},{timestamps:true});
schema.index({'images.filename':1});
schema.methods.refreshStatus = function refreshStatus() {
  const statuses = this.images.map(img => img.status);
  this.status = statuses.includes('approved') ? 'approved' : statuses.includes('pending') ? 'pending' : 'rejected';
  return this.status;
};
module.exports = mongoose.model('GalleryPost', schema);
