const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true}, productId:{type:String,required:true,index:true},
  displayName:{type:String,default:''}, rating:{type:Number,required:true,min:1,max:5}, body:{type:String,required:true},
  orderNumber:{type:String,default:''}, status:{type:String,enum:['pending','approved','rejected'],default:'pending',index:true},
  moderatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin',default:null}, moderatedAt:{type:Date,default:null}
},{timestamps:true});
schema.index({user:1,productId:1},{unique:true});
module.exports = mongoose.model('Review', schema);
