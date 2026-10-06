const mongoose = require('mongoose');
const schema = new mongoose.Schema({action:{type:String,required:true},targetType:{type:String,default:''},targetId:{type:String,default:''},targetName:{type:String,default:''},admin:{type:mongoose.Schema.Types.ObjectId,ref:'Admin',default:null},adminName:{type:String,default:''},ipAddress:{type:String,default:''},meta:{type:mongoose.Schema.Types.Mixed,default:{}}},{timestamps:true});
module.exports = mongoose.model('ActivityLog',schema);
