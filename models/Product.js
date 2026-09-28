const mongoose = require('mongoose');
const productSchema = new mongoose.Schema({
  publicId:{type:String,required:true,unique:true,index:true,trim:true}, sku:{type:String,required:true,unique:true,index:true,trim:true},
  name:{type:String,required:true,trim:true}, category:{type:String,required:true,trim:true,index:true}, type:{type:String,default:'',trim:true},
  price:{type:Number,required:true,min:0}, previousPrice:{type:Number,default:null,min:0}, discount:{type:Number,default:null,min:0,max:100},
  badge:{type:String,default:''}, badgeType:{type:String,default:''}, stockNote:{type:String,default:''},
  colors:{type:[String],default:[]}, colorNames:{type:[String],default:[]}, sizes:{type:[String],default:[]}, unavailableSizes:{type:[String],default:[]},
  fabric:{type:String,default:''}, season:{type:String,default:''}, style:{type:String,default:''}, occasion:{type:String,default:''}, fit:{type:String,default:'قالب استاندارد'},
  availability:{type:Boolean,default:true,index:true}, inventory:{type:Number,default:0,min:0}, isNew:{type:Boolean,default:false}, bestSeller:{type:Boolean,default:false},
  rating:{type:Number,default:0,min:0,max:5}, reviewCount:{type:Number,default:0,min:0},
  image:{type:String,default:'./src/assets/images/product-1.webp'}, secondaryImage:{type:String,default:''}, imageAlt:{type:String,default:''},
  popularity:{type:Number,default:0}, status:{type:String,enum:['active','draft','out-of-stock'],default:'active',index:true},
  seoTitle:{type:String,default:''}, description:{type:String,default:''}, sales:{type:Number,default:0,min:0}, views:{type:Number,default:0,min:0}, conversion:{type:Number,default:0,min:0}
}, {timestamps:true});
productSchema.pre('validate', function(next) {
  this.inventory = Math.max(0, Number(this.inventory || 0));
  if (this.status === 'out-of-stock' || this.inventory === 0) this.availability = false;
  else if (this.status === 'active') this.availability = true;
  if (this.previousPrice && this.previousPrice > this.price) this.discount = Math.round((1 - this.price / this.previousPrice) * 100);
  next();
});
module.exports = mongoose.model('Product', productSchema);
