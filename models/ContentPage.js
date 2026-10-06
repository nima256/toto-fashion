const mongoose = require('mongoose');
const sectionSchema = new mongoose.Schema({id:{type:String,default:''},title:{type:String,default:''},paragraphs:{type:[String],default:[]}},{_id:false});
// نسخه مدیریت‌شده صفحات اطلاعاتی؛ در صورت انتشار جایگزین متن پیش‌فرض قالب می‌شود
const schema = new mongoose.Schema({
  slug:{type:String,required:true,unique:true,index:true}, eyebrow:{type:String,default:''}, title:{type:String,required:true}, intro:{type:String,default:''},
  sections:{type:[sectionSchema],default:[]}, status:{type:String,enum:['draft','published'],default:'draft'},
  updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin',default:null}
},{timestamps:true});
module.exports = mongoose.model('ContentPage', schema);
