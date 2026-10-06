const express=require('express');
const fs=require('fs');
const mongoose=require('mongoose');
const rateLimit=require('express-rate-limit');
const env=require('../config/env');
const User=require('../models/User');
const Order=require('../models/Order');
const Product=require('../models/Product');
const ReturnRequest=require('../models/ReturnRequest');
const PointsTransaction=require('../models/PointsTransaction');
const Coupon=require('../models/Coupon');
const StockAlert=require('../models/StockAlert');
const GalleryPost=require('../models/GalleryPost');
const {requireUser,requireCsrf}=require('../middlewares/auth');
const {makeUploader,verifyImages,removeUploaded,privatePath}=require('../middlewares/upload');
const {asyncHandler,ok,AppError}=require('../utils/http');
const {faLongDate,normalizeDigits}=require('../utils/formatters');
const {z,validate,formatIssues,text,optionalText,int,bool,mobile,publicId}=require('../utils/validate');
const {couponView}=require('../services/coupons');
const wheel=require('../services/wheel');
const S=require('../services/serializers');
const router=express.Router();
router.use(requireUser);
const wheelLimiter=rateLimit({windowMs:60*1000,limit:10,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'درخواست بیش از حد مجاز است'}});
const returnUpload=makeUploader('returns',{maxSize:5*1024*1024,maxFiles:3});

function ownedOrderQuery(userId,id){const conditions=[{orderNumber:String(id)}];if(mongoose.isValidObjectId(id))conditions.push({_id:id});return{user:userId,$or:conditions};}
const digitsOnly=value=>normalizeDigits(String(value??'')).replace(/\D/g,'');
const addressSchema=z.object({
  title:optionalText(40).optional().default('آدرس من'),firstName:text(60,{min:1}),lastName:text(60,{min:1}),mobile,
  province:text(60,{min:1}),city:text(60,{min:1}),postalCode:z.preprocess(digitsOnly,z.string().regex(/^\d{10}$/,'کد پستی باید ۱۰ رقم باشد')),
  buildingNumber:text(20,{min:1}),unit:optionalText(20).optional().default(''),address:text(400,{min:10,message:'نشانی کامل را وارد کنید'}),isDefault:bool.optional().default(false)
});
const idParam=z.object({id:z.string().trim().min(1).max(80)});

const levelOf=points=>points>=10000?'special':points>=5000?'gold':points>=1500?'silver':'member';
router.get('/',asyncHandler(async(req,res)=>{
  const userId=req.session.userId;
  const now=new Date();
  const [user,orders,returns,transactions,coupons,alerts,galleryPosts,wheelState]=await Promise.all([
    User.findById(userId),Order.find({user:userId}).sort({createdAt:-1}).limit(100),ReturnRequest.find({user:userId}).sort({createdAt:-1}).limit(50),
    PointsTransaction.find({user:userId}).sort({createdAt:-1}).limit(30),
    Coupon.find({user:userId,isActive:true,$or:[{expiresAt:null},{expiresAt:{$gt:now}}],$expr:{$or:[{$eq:['$usageLimit',null]},{$lt:['$usedCount','$usageLimit']}]}}).sort({createdAt:-1}).limit(30),
    StockAlert.find({user:userId,status:'waiting'}).sort({createdAt:-1}).limit(50),GalleryPost.find({user:userId}).sort({createdAt:-1}).limit(20),wheel.wheelState(userId,now)
  ]);
  const profile=S.user(user);const points=profile.loyalty.points;
  ok(res,{
    user:profile,orders:orders.map(S.order),returns:returns.map(r=>S.returnRequest(r)),
    loyalty:{points,lifetimePoints:Math.max(profile.loyalty.lifetimePoints,points),level:levelOf(points),transactions:transactions.map(t=>({id:String(t._id),title:t.title,points:t.points,type:t.points<0?'spend':'earn',date:faLongDate(t.createdAt)}))},
    rewards:coupons.map(c=>({...couponView(c),id:String(c._id),source:c.source==='wheel'?'چرخونه شانس روزانه':'پاداش حساب',condition:c.condition||c.title,status:'active'})),
    availabilityAlerts:alerts.map(S.stockAlert),gallery:galleryPosts.map(g=>S.galleryPost(g,{owner:true})),wheel:wheelState
  });
}));
const profileSchema=z.object({firstName:optionalText(60).optional(),lastName:optionalText(60).optional(),email:z.union([z.literal(''),z.string().trim().max(120).email('ایمیل معتبر نیست')]).optional(),birthday:z.union([z.literal(''),z.preprocess(v=>normalizeDigits(String(v??'')).trim(),z.string().regex(/^1[34]\d{2}\/(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])$/,'تاریخ تولد را به شکل ۱۳۷۰/۰۱/۰۱ وارد کنید'))]).optional(),gender:z.enum(['','female','male','other']).optional()});
router.patch('/',requireCsrf,validate({body:profileSchema}),asyncHandler(async(req,res)=>{const user=await User.findById(req.session.userId);for(const key of ['firstName','lastName','email','birthday','gender'])if(req.body[key]!==undefined)user[key]=req.body[key];await user.save();ok(res,{profile:S.user(user)});}));

// هر پنج گزینه ذخیره و بازیابی می‌شوند؛ نام‌های قدیمی (sms/offers/restock) هم پذیرفته می‌شوند
const notificationSchema=z.object({orderSms:bool.optional(),stockSms:bool.optional(),campaignSms:bool.optional(),loyaltySms:bool.optional(),emailMagazine:bool.optional(),sms:bool.optional(),offers:bool.optional(),restock:bool.optional()});
router.patch('/notifications',requireCsrf,validate({body:notificationSchema}),asyncHandler(async(req,res)=>{
  const b=req.body;const set={};
  const map={'notifications.sms':b.orderSms??b.sms,'notifications.offers':b.campaignSms??b.offers,'notifications.restock':b.stockSms??b.restock,'notifications.loyaltySms':b.loyaltySms,'notifications.emailMagazine':b.emailMagazine};
  for(const [key,value] of Object.entries(map))if(value!==undefined)set[key]=value;
  const user=await User.findByIdAndUpdate(req.session.userId,{$set:set},{new:true});
  ok(res,{preferences:S.notificationPrefs(user.notifications)});
}));

router.get('/addresses',asyncHandler(async(req,res)=>{const user=await User.findById(req.session.userId);ok(res,{addresses:S.user(user).addresses});}));
router.post('/addresses',requireCsrf,validate({body:addressSchema}),asyncHandler(async(req,res)=>{const user=await User.findById(req.session.userId);if(user.addresses.length>=10)throw new AppError(400,'حداکثر ۱۰ آدرس قابل ذخیره است');const value=req.body;if(value.isDefault)user.addresses.forEach(a=>a.isDefault=false);user.addresses.push(value);if(user.addresses.length===1)user.addresses[0].isDefault=true;await user.save();const saved=user.addresses[user.addresses.length-1];ok(res,{address:S.user(user).addresses.find(a=>a.id===saved.publicId)},201);}));
router.patch('/addresses/:id',requireCsrf,validate({params:idParam,body:addressSchema.partial()}),asyncHandler(async(req,res)=>{const user=await User.findById(req.session.userId);const address=user.addresses.find(a=>a.publicId===req.params.id||String(a._id)===req.params.id);if(!address)throw new AppError(404,'آدرس پیدا نشد');const merged=addressSchema.safeParse({...address.toObject(),...req.body});if(!merged.success)throw new AppError(400,'اطلاعات آدرس کامل یا معتبر نیست',formatIssues(merged.error));if(merged.data.isDefault)user.addresses.forEach(a=>a.isDefault=false);Object.assign(address,merged.data);await user.save();ok(res,{address:S.user(user).addresses.find(a=>a.id===address.publicId)});}));
router.delete('/addresses/:id',requireCsrf,validate({params:idParam}),asyncHandler(async(req,res)=>{const user=await User.findById(req.session.userId);const before=user.addresses.length;user.addresses=user.addresses.filter(a=>a.publicId!==req.params.id&&String(a._id)!==req.params.id);if(user.addresses.length===before)throw new AppError(404,'آدرس پیدا نشد');if(user.addresses.length&&!user.addresses.some(a=>a.isDefault))user.addresses[0].isDefault=true;await user.save();ok(res,{deleted:true,addresses:S.user(user).addresses});}));

router.get('/orders',asyncHandler(async(req,res)=>{const orders=await Order.find({user:req.session.userId}).sort({createdAt:-1});ok(res,{orders:orders.map(S.order)});}));
router.get('/orders/:id',validate({params:idParam}),asyncHandler(async(req,res)=>{const order=await Order.findOne(ownedOrderQuery(req.session.userId,req.params.id));if(!order)throw new AppError(404,'سفارش پیدا نشد');ok(res,{order:S.order(order)});}));

// ---------- مرجوعی و تعویض ----------
const REASONS={size:'سایز مناسب نیست',different:'محصول با تصویر یا توضیحات متفاوت است',quality:'ایراد دوخت یا پارچه',damaged:'محصول آسیب‌دیده تحویل شده','changed-mind':'انصراف از خرید',other:'دلیل دیگر'};
const returnSchema=z.object({
  orderId:z.string().trim().min(1).max(80),productId:publicId,type:z.enum(['exchange','return','damaged'],{errorMap:()=>({message:'نوع درخواست معتبر نیست'})}),
  reason:z.enum(Object.keys(REASONS),{errorMap:()=>({message:'دلیل درخواست را انتخاب کنید'})}),exchangeSize:optionalText(24).optional().default(''),exchangeColor:optionalText(40).optional().default(''),
  resolution:z.enum(['exchange','wallet','refund'],{errorMap:()=>({message:'روش رسیدگی معتبر نیست'})}),description:text(1000,{min:10,message:'توضیحات را حداقل با ۱۰ نویسه بنویسید'}),
  confirm:z.preprocess(v=>v==='on'||v==='true'||v===true,z.literal(true,{errorMap:()=>({message:'تأیید شرایط مرجوعی الزامی است'})}))
}).superRefine((value,ctx)=>{
  if(value.type==='exchange'&&!value.exchangeSize)ctx.addIssue({code:'custom',path:['exchangeSize'],message:'سایز جایگزین را انتخاب کنید'});
  if(value.type==='exchange'&&value.resolution!=='exchange')ctx.addIssue({code:'custom',path:['resolution'],message:'برای تعویض سایز، روش رسیدگی باید تعویض کالا باشد'});
});
router.get('/returns',asyncHandler(async(req,res)=>{const returns=await ReturnRequest.find({user:req.session.userId}).sort({createdAt:-1});ok(res,{returns:returns.map(r=>S.returnRequest(r))});}));
router.post('/returns',requireCsrf,returnUpload.array('images',3),verifyImages,asyncHandler(async(req,res)=>{
  try{
    const parsed=returnSchema.safeParse(req.body||{});if(!parsed.success)throw new AppError(400,'اطلاعات درخواست کامل یا معتبر نیست',formatIssues(parsed.error));
    const body=parsed.data;
    const order=await Order.findOne(ownedOrderQuery(req.session.userId,body.orderId));if(!order)throw new AppError(404,'سفارش پیدا نشد');
    if(order.status!=='delivered')throw new AppError(400,'مرجوعی فقط برای سفارش تحویل‌شده قابل ثبت است');
    if(order.deliveredAt&&Date.now()-order.deliveredAt.getTime()>env.returnWindowDays*86400000)throw new AppError(400,`مهلت ${env.returnWindowDays} روزه ثبت مرجوعی برای این سفارش به پایان رسیده است`);
    const item=order.items.find(i=>i.productId===body.productId);if(!item||item.returnEligible===false)throw new AppError(400,'محصول برای مرجوعی معتبر نیست');
    if(body.type==='exchange'){
      const product=await Product.findOne({publicId:item.productId}).select('sizes');
      if(product&&!product.sizes.includes(body.exchangeSize))throw new AppError(400,'سایز جایگزین برای این محصول معتبر نیست',[{path:'exchangeSize',message:'سایز جایگزین معتبر نیست'}]);
      if(body.exchangeSize===item.size)throw new AppError(400,'سایز جایگزین باید با سایز فعلی متفاوت باشد',[{path:'exchangeSize',message:'سایز جایگزین باید متفاوت باشد'}]);
    }
    if(await ReturnRequest.exists({order:order._id,productId:item.productId,status:{$in:S.OPEN_RETURN_STATUSES}}))throw new AppError(409,'برای این محصول درخواست باز دیگری ثبت شده است');
    const request=await ReturnRequest.create({
      user:req.session.userId,order:order._id,orderNumber:order.orderNumber,productId:item.productId,item:{name:item.name,image:item.image,color:item.color,size:item.size,quantity:item.quantity,price:item.price},
      reason:REASONS[body.reason],reasonCode:body.reason,requestType:body.type,exchangeSize:body.type==='exchange'?body.exchangeSize:'',exchangeColor:body.type==='exchange'?(body.exchangeColor||item.color||''):'',
      resolution:body.resolution,note:body.description,termsAccepted:true,images:(req.files||[]).map(f=>({filename:f.filename,originalName:String(f.originalname||'').slice(0,120),mimeType:f.mimetype,size:f.size})),
      history:[{status:'received',note:'درخواست توسط مشتری ثبت شد'}]
    });
    ok(res,{request:S.returnRequest(request)},201);
  }catch(error){await removeUploaded(req);throw error;}
}));
router.get('/returns/:id/images/:file',asyncHandler(async(req,res)=>{
  const request=await ReturnRequest.findOne({publicId:String(req.params.id),user:req.session.userId}).select('images');
  const file=request?.images.find(img=>img.filename===req.params.file);const fullPath=file&&privatePath('returns',file.filename);
  if(!fullPath||!fs.existsSync(fullPath))throw new AppError(404,'تصویر پیدا نشد');
  res.set('Cache-Control','private, max-age=300');res.sendFile(fullPath);
}));

// ---------- چرخونه شانس ----------
router.get('/wheel',asyncHandler(async(req,res)=>ok(res,{wheel:await wheel.wheelState(req.session.userId)})));
router.post('/wheel/spin',requireCsrf,wheelLimiter,asyncHandler(async(req,res)=>{const result=await wheel.spin(req.session.userId);ok(res,result);}));

// ---------- علاقه‌مندی / ذخیره برای بعد ----------
const productIdParam=z.object({productId:publicId});
router.get('/saved',asyncHandler(async(req,res)=>{const user=await User.findById(req.session.userId).select('savedProducts');ok(res,{saved:user.savedProducts||[]});}));
router.put('/saved/:productId',requireCsrf,validate({params:productIdParam}),asyncHandler(async(req,res)=>{
  if(!(await Product.exists({publicId:req.params.productId,status:{$ne:'draft'}})))throw new AppError(404,'محصول پیدا نشد');
  const user=await User.findById(req.session.userId).select('savedProducts');
  if(!user.savedProducts.includes(req.params.productId)){if(user.savedProducts.length>=200)throw new AppError(400,'حداکثر ۲۰۰ محصول قابل ذخیره است');user.savedProducts.push(req.params.productId);await user.save();}
  ok(res,{saved:user.savedProducts});
}));
router.delete('/saved/:productId',requireCsrf,validate({params:productIdParam}),asyncHandler(async(req,res)=>{const user=await User.findByIdAndUpdate(req.session.userId,{$pull:{savedProducts:req.params.productId}},{new:true}).select('savedProducts');ok(res,{saved:user.savedProducts});}));
// ادغام فهرست مهمان پس از ورود
router.post('/saved/merge',requireCsrf,validate({body:z.object({ids:z.array(publicId).max(200)})}),asyncHandler(async(req,res)=>{
  const valid=(await Product.find({publicId:{$in:req.body.ids},status:{$ne:'draft'}}).select('publicId').lean()).map(p=>p.publicId);
  const user=await User.findById(req.session.userId).select('savedProducts');
  user.savedProducts=[...new Set([...user.savedProducts,...valid])].slice(0,200);await user.save();
  ok(res,{saved:user.savedProducts});
}));

// ---------- هشدار موجودی ----------
router.get('/stock-alerts',asyncHandler(async(req,res)=>{const alerts=await StockAlert.find({user:req.session.userId,status:'waiting'}).sort({createdAt:-1});ok(res,{alerts:alerts.map(S.stockAlert)});}));
router.post('/stock-alerts',requireCsrf,validate({body:z.object({productId:publicId,colorIndex:int({min:0,max:50}).optional().default(0),size:optionalText(24).optional().default('')})}),asyncHandler(async(req,res)=>{
  const product=await Product.findOne({publicId:req.body.productId,status:{$ne:'draft'}});if(!product)throw new AppError(404,'محصول پیدا نشد');
  const color=product.colorNames.length?product.colorNames[req.body.colorIndex]:'';if(product.colorNames.length&&color===undefined)throw new AppError(400,'رنگ انتخاب‌شده معتبر نیست');
  const size=product.sizes.length?req.body.size:'';if(product.sizes.length&&!product.sizes.includes(size))throw new AppError(400,'سایز انتخاب‌شده معتبر نیست');
  const variant=product.findVariant(color||'',size);
  if(variant&&variant.stock>0)throw new AppError(409,'این ترکیب در حال حاضر موجود است');
  const existing=await StockAlert.findOne({user:req.session.userId,productId:product.publicId,color:color||'',size,status:'waiting'});
  if(existing)return ok(res,{alert:S.stockAlert(existing),alreadyExists:true});
  const alert=await StockAlert.create({user:req.session.userId,productId:product.publicId,productName:product.name,image:product.image,color:color||'',size});
  ok(res,{alert:S.stockAlert(alert),alreadyExists:false},201);
}));
router.delete('/stock-alerts/:id',requireCsrf,validate({params:z.object({id:z.string().refine(v=>mongoose.isValidObjectId(v),'شناسه معتبر نیست')})}),asyncHandler(async(req,res)=>{
  const result=await StockAlert.updateOne({_id:req.params.id,user:req.session.userId,status:'waiting'},{$set:{status:'cancelled'}});
  if(!result.modifiedCount)throw new AppError(404,'هشدار پیدا نشد');ok(res,{cancelled:true});
}));
module.exports=router;
