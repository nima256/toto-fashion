const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true}, productId:{type:String,required:true,index:true},
  displayName:{type:String,default:''}, question:{type:String,required:true}, answer:{type:String,default:''},
  status:{type:String,enum:['pending','answered','rejected'],default:'pending',index:true},
  answeredBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin',default:null}, answeredAt:{type:Date,default:null}
},{timestamps:true});
module.exports = mongoose.model('ProductQuestion', schema);
