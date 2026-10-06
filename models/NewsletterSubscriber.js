const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  mobile:{type:String,required:true,unique:true,index:true}, status:{type:String,enum:['subscribed','unsubscribed'],default:'subscribed'},
  source:{type:String,default:'footer'}, user:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null}
},{timestamps:true});
module.exports = mongoose.model('NewsletterSubscriber', schema);
