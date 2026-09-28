const mongoose = require('mongoose');
const schema = new mongoose.Schema({publicId:{type:String,unique:true,index:true,default:()=>`SUP-${Date.now().toString().slice(-7)}`},fullName:String,mobile:String,subject:String,message:String,status:{type:String,default:'open'}},{timestamps:true});
module.exports = mongoose.model('ContactMessage',schema);
