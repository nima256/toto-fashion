const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true}, points:{type:Number,required:true},
  type:{type:String,enum:['earn','spend','adjust'],default:'earn'}, title:{type:String,default:''}, source:{type:String,default:''},
  // کلید یکتا برای جلوگیری از ثبت دوباره امتیاز یک رویداد (مثلاً order:<id>)
  refKey:{type:String,unique:true,sparse:true}
},{timestamps:true});
module.exports = mongoose.model('PointsTransaction', schema);
