const mongoose = require('mongoose');
const schema = new mongoose.Schema({key:{type:String,required:true,unique:true,index:true},value:{type:mongoose.Schema.Types.Mixed,default:{}},updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin',default:null}},{timestamps:true});
module.exports = mongoose.model('AdminSetting',schema);
