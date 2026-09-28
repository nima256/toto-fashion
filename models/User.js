const mongoose = require('mongoose');
const addressSchema = new mongoose.Schema({
  publicId:{type:String,default:()=>`ADDR-${Date.now()}-${Math.random().toString(16).slice(2,8)}`}, title:{type:String,default:'آدرس من'},
  firstName:{type:String,default:''}, lastName:{type:String,default:''}, mobile:{type:String,default:''}, province:{type:String,default:''}, city:{type:String,default:''},
  postalCode:{type:String,default:''}, buildingNumber:{type:String,default:''}, unit:{type:String,default:''}, address:{type:String,default:''}, isDefault:{type:Boolean,default:false}
},{_id:true});
const userSchema = new mongoose.Schema({
  publicId:{type:String,unique:true,index:true,default:()=>`CUS-${Date.now().toString().slice(-8)}`},
  mobile:{type:String,required:true,unique:true,index:true}, firstName:{type:String,default:''}, lastName:{type:String,default:''}, fullName:{type:String,default:''},
  email:{type:String,default:'',lowercase:true,trim:true}, birthday:{type:String,default:''}, gender:{type:String,default:''},
  isActive:{type:Boolean,default:true,index:true}, adminNote:{type:String,default:''}, addresses:{type:[addressSchema],default:[]},
  notifications:{sms:{type:Boolean,default:true},offers:{type:Boolean,default:true},restock:{type:Boolean,default:true}},
  loyalty:{points:{type:Number,default:0},level:{type:String,default:'عضو توتو'}}, wheelLastDate:{type:String,default:''}, lastLoginAt:Date
},{timestamps:true});
userSchema.pre('save', function(next){ const joined=`${this.firstName||''} ${this.lastName||''}`.trim(); if(joined)this.fullName=joined; if(!this.fullName)this.fullName='مشتری توتو'; next(); });
module.exports = mongoose.model('User', userSchema);
