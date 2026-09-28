const mongoose = require('mongoose');
const schema = new mongoose.Schema({ mobile:{type:String,required:true,unique:true,index:true}, codeHash:{type:String,required:true,select:false}, expiresAt:{type:Date,required:true,index:{expires:0}}, attempts:{type:Number,default:0}, lastSentAt:{type:Date,default:Date.now} }, {timestamps:true});
module.exports = mongoose.model('Otp', schema);
