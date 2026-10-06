const mongoose = require('mongoose');
const subSectionSchema = new mongoose.Schema({title:{type:String,default:''},text:{type:String,default:''}},{_id:false});
const sectionSchema = new mongoose.Schema({id:{type:String,default:''},title:{type:String,default:''},paragraphs:{type:[String],default:[]},note:{type:String,default:''},subSections:{type:[subSectionSchema],default:[]}},{_id:false});
// مقاله‌های مجله؛ همه فیلدها متن ساده‌اند و در فرانت‌اند بدون HTML رندر می‌شوند
const schema = new mongoose.Schema({
  slug:{type:String,required:true,unique:true,index:true,trim:true}, category:{type:String,default:''}, title:{type:String,required:true},
  excerpt:{type:String,default:''}, image:{type:String,default:''}, imageAlt:{type:String,default:''}, intro:{type:String,default:''},
  sections:{type:[sectionSchema],default:[]}, readingTime:{type:String,default:''}, publishedAt:{type:Date,default:Date.now,index:true},
  status:{type:String,enum:['draft','published'],default:'published',index:true}, featured:{type:Boolean,default:false}, popular:{type:Boolean,default:false},
  updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin',default:null}
},{timestamps:true});
module.exports = mongoose.model('Article', schema);
