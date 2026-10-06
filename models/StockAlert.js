const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true}, productId:{type:String,required:true,index:true},
  productName:{type:String,default:''}, image:{type:String,default:''}, color:{type:String,default:''}, size:{type:String,default:''},
  status:{type:String,enum:['waiting','notified','cancelled'],default:'waiting',index:true}, notifiedAt:{type:Date,default:null}
},{timestamps:true});
schema.index({user:1,productId:1,color:1,size:1},{unique:true,partialFilterExpression:{status:'waiting'}});
module.exports = mongoose.model('StockAlert', schema);
