const mongoose = require('mongoose');

// هر تنوع = ترکیب یک رنگ و یک سایز با موجودی مستقل
const variantSchema = new mongoose.Schema({
  sku:{type:String,default:'',trim:true}, color:{type:String,default:'',trim:true}, size:{type:String,default:'',trim:true},
  stock:{type:Number,default:0,min:0}
},{_id:true});

const productSchema = new mongoose.Schema({
  publicId:{type:String,required:true,unique:true,index:true,trim:true}, sku:{type:String,required:true,unique:true,index:true,trim:true},
  name:{type:String,required:true,trim:true}, category:{type:String,required:true,trim:true,index:true}, type:{type:String,default:'',trim:true},
  price:{type:Number,required:true,min:0}, previousPrice:{type:Number,default:null,min:0}, discount:{type:Number,default:null,min:0,max:100},
  badge:{type:String,default:''}, badgeType:{type:String,default:''}, stockNote:{type:String,default:''},
  colors:{type:[String],default:[]}, colorNames:{type:[String],default:[]}, sizes:{type:[String],default:[]}, unavailableSizes:{type:[String],default:[]},
  variants:{type:[variantSchema],default:[]},
  fabric:{type:String,default:''}, season:{type:String,default:''}, style:{type:String,default:''}, occasion:{type:String,default:''}, fit:{type:String,default:'قالب استاندارد'},
  // inventory همیشه مجموع موجودی تنوع‌هاست و فقط برای سازگاری و گزارش نگه داشته می‌شود
  availability:{type:Boolean,default:true,index:true}, inventory:{type:Number,default:0,min:0}, isNew:{type:Boolean,default:false}, bestSeller:{type:Boolean,default:false},
  rating:{type:Number,default:0,min:0,max:5}, reviewCount:{type:Number,default:0,min:0},
  image:{type:String,default:'./src/assets/images/product-1.webp'}, secondaryImage:{type:String,default:''}, imageAlt:{type:String,default:''},
  popularity:{type:Number,default:0}, status:{type:String,enum:['active','draft','out-of-stock'],default:'active',index:true},
  seoTitle:{type:String,default:''}, description:{type:String,default:''}, sales:{type:Number,default:0,min:0}, views:{type:Number,default:0,min:0}, conversion:{type:Number,default:0,min:0}
}, {timestamps:true,suppressReservedKeysWarning:true});

productSchema.methods.colorNameAt = function colorNameAt(index) {
  return this.colorNames?.[index] || '';
};
productSchema.methods.findVariant = function findVariant(color, size) {
  return (this.variants || []).find(v => (v.color || '') === (color || '') && (v.size || '') === (size || ''));
};

productSchema.pre('validate', function(next) {
  if (Array.isArray(this.variants) && this.variants.length) {
    this.variants.forEach(v => { v.stock = Math.max(0, Math.floor(Number(v.stock || 0))); });
    this.inventory = this.variants.reduce((sum, v) => sum + v.stock, 0);
    // سایزهایی که در هیچ رنگی موجودی ندارند برای سازگاری با کلاینت‌های قدیمی
    this.unavailableSizes = (this.sizes || []).filter(size => !this.variants.some(v => v.size === size && v.stock > 0));
  }
  this.inventory = Math.max(0, Number(this.inventory || 0));
  if (this.inventory === 0 && this.status === 'active') this.status = 'out-of-stock';
  else if (this.inventory > 0 && this.status === 'out-of-stock' && (this.isModified('variants') || this.isModified('inventory'))) this.status = 'active';
  this.availability = this.status === 'active' && this.inventory > 0;
  if (this.previousPrice && this.previousPrice > this.price) this.discount = Math.round((1 - this.price / this.previousPrice) * 100);
  else { this.previousPrice = this.previousPrice && this.previousPrice > this.price ? this.previousPrice : null; this.discount = null; }
  next();
});
module.exports = mongoose.model('Product', productSchema);
