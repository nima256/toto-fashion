const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  publicId:{type:String,unique:true,index:true,default:()=>`SUP-${Date.now().toString().slice(-7)}${Math.random().toString(16).slice(2,4).toUpperCase()}`},
  fullName:String, mobile:String, subject:String, message:String, orderNumber:{type:String,default:''},
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null}, status:{type:String,default:'open'}
},{timestamps:true});
module.exports = mongoose.model('ContactMessage',schema);
