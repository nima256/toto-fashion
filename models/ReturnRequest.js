const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  publicId:{type:String,unique:true,index:true,default:()=>`RET-${Date.now().toString().slice(-8)}`}, user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  order:{type:mongoose.Schema.Types.ObjectId,ref:'Order',required:true,index:true}, orderNumber:{type:String,required:true,index:true}, productId:{type:String,required:true},
  reason:{type:String,required:true}, requestType:{type:String,default:'return'}, note:{type:String,default:''},
  status:{type:String,enum:['received','reviewing','approved','rejected','completed'],default:'received'}
},{timestamps:true});
module.exports = mongoose.model('ReturnRequest', schema);
