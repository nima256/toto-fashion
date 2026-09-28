const express=require('express');
const rateLimit=require('express-rate-limit');
const mongoose=require('mongoose');
const Admin=require('../models/Admin');
const Product=require('../models/Product');
const Order=require('../models/Order');
const User=require('../models/User');
const ReturnRequest=require('../models/ReturnRequest');
const AdminSetting=require('../models/AdminSetting');
const ActivityLog=require('../models/ActivityLog');
const upload=require('../middlewares/upload');
const {requireAdmin,requireCsrf}=require('../middlewares/auth');
const {asyncHandler,ok,AppError}=require('../utils/http');
const S=require('../services/serializers');
const {buildAnalytics}=require('../services/analytics');
const {faDate}=require('../utils/formatters');
const router=express.Router();

const loginLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'تعداد تلاش ورود بیش از حد مجاز است'}});
const saveSession=req=>new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
const regen=req=>new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
const log=async(req,action,targetType='',targetId='',targetName='',meta={})=>ActivityLog.create({action,targetType,targetId:String(targetId||''),targetName,admin:req.authAdmin?._id||req.session.adminId||null,adminName:req.authAdmin?.fullName||'',ipAddress:req.ip,meta}).catch(()=>{});
const productFields=['name','category','type','price','previousPrice','badge','badgeType','stockNote','colors','colorNames','sizes','unavailableSizes','fabric','season','style','occasion','fit','availability','inventory','isNew','bestSeller','rating','reviewCount','image','secondaryImage','imageAlt','popularity','status','seoTitle','description','conversion'];
const setFields=(doc,body,fields)=>{for(const key of fields)if(body[key]!==undefined)doc[key]=body[key];};
function makeSku(){return `TOTO-${String(Date.now()).slice(-6)}`;}
function makePublicId(){return `toto-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;}
function customerView(user,summary={}){return{id:user.publicId,name:user.fullName||`${user.firstName||''} ${user.lastName||''}`.trim()||'مشتری توتو',mobile:user.mobile,level:user.loyalty?.level||'عضو توتو',orders:summary.orders||0,spent:summary.spent||0,joined:faDate(user.createdAt),status:user.isActive?'active':'inactive',note:user.adminNote||''};}
function activityView(a){return{person:a.adminName||'مدیر فروشگاه',action:a.action,time:faDate(a.createdAt),createdAt:a.createdAt};}

router.post('/login',requireCsrf,loginLimiter,asyncHandler(async(req,res)=>{
  const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');
  const admin=await Admin.findOne({email}).select('+password'); if(!admin||!admin.isActive||!(await admin.comparePassword(password)))throw new AppError(401,'ایمیل یا رمز عبور مدیر صحیح نیست');
  const userId=req.session.userId; await regen(req); if(userId)req.session.userId=userId; req.session.adminId=admin._id; req.session.csrfToken=require('crypto').randomBytes(24).toString('hex'); admin.lastLoginAt=new Date(); admin.lastLoginIP=req.ip; await admin.save(); await saveSession(req);
  ok(res,{admin:{id:String(admin._id),fullName:admin.fullName,email:admin.email,role:admin.role,permissions:admin.permissions},csrfToken:req.session.csrfToken});
}));
router.post('/logout',requireCsrf,asyncHandler(async(req,res)=>{delete req.session.adminId;await saveSession(req);ok(res,{loggedOut:true});}));
router.get('/me',asyncHandler(async(req,res)=>{if(!req.session?.adminId)return ok(res,{authenticated:false});const admin=await Admin.findById(req.session.adminId);if(!admin?.isActive)return ok(res,{authenticated:false});ok(res,{authenticated:true,admin:{id:String(admin._id),fullName:admin.fullName,email:admin.email,role:admin.role,permissions:admin.permissions,lastLoginAt:admin.lastLoginAt}});}));

router.use(requireAdmin);
router.get('/dashboard',asyncHandler(async(req,res)=>{
  const [products,orders,users,activities,returns,settings]=await Promise.all([Product.find().sort({createdAt:-1}),Order.find().sort({createdAt:-1}).limit(500),User.find().sort({createdAt:-1}).limit(500),ActivityLog.find().sort({createdAt:-1}).limit(20),ReturnRequest.find().sort({createdAt:-1}).limit(50),AdminSetting.find()]);
  const analytics=buildAnalytics({orders,products,users});
  const customerAgg=await Order.aggregate([{$match:{user:{$ne:null},paymentStatus:'paid'}},{$group:{_id:'$user',orders:{$sum:1},spent:{$sum:'$total'}}}]);
  const byUser=new Map(customerAgg.map(x=>[String(x._id),x]));
  const customers=users.map(u=>customerView(u,byUser.get(String(u._id))));
  ok(res,{range:req.query.range||'30d',...analytics,products:products.map(S.product),orders:orders.map(S.order),customers,activities:activities.map(activityView),returns,settings:Object.fromEntries(settings.map(item=>[item.key,item.value]))});
}));

router.post('/products',requireCsrf,asyncHandler(async(req,res)=>{
  const product=new Product({publicId:makePublicId(),sku:String(req.body.sku||makeSku()).trim(),name:String(req.body.name||'').trim(),category:String(req.body.category||'').trim(),price:Number(req.body.price||0),inventory:Number(req.body.inventory||0)});
  setFields(product,req.body,productFields); if(!product.name||!product.category||!product.price)throw new AppError(400,'نام، دسته‌بندی و قیمت محصول الزامی است'); await product.save(); await log(req,'محصول جدید ایجاد شد','product',product.publicId,product.name); ok(res,{product:S.product(product)},201);
}));
router.patch('/products/:id',requireCsrf,asyncHandler(async(req,res)=>{const product=await Product.findOne({publicId:req.params.id});if(!product)throw new AppError(404,'محصول پیدا نشد');setFields(product,req.body,productFields);if(req.body.sku!==undefined)product.sku=String(req.body.sku).trim();await product.save();await log(req,'محصول ویرایش شد','product',product.publicId,product.name);ok(res,{product:S.product(product)});}));
router.delete('/products/:id',requireCsrf,asyncHandler(async(req,res)=>{const product=await Product.findOneAndDelete({publicId:req.params.id});if(!product)throw new AppError(404,'محصول پیدا نشد');await log(req,'محصول حذف شد','product',product.publicId,product.name);ok(res,{deleted:true,id:product.publicId});}));
router.patch('/products/:id/inventory',requireCsrf,asyncHandler(async(req,res)=>{const product=await Product.findOne({publicId:req.params.id});if(!product)throw new AppError(404,'محصول پیدا نشد');product.inventory=Math.max(0,Number(req.body.inventory||0));product.status=product.inventory===0?'out-of-stock':(product.status==='out-of-stock'?'active':product.status);await product.save();await log(req,`موجودی محصول به ${product.inventory} تغییر کرد`,'product',product.publicId,product.name);ok(res,{product:S.product(product)});}));
router.post('/products/upload',requireCsrf,upload.single('image'),asyncHandler(async(req,res)=>{if(!req.file)throw new AppError(400,'فایل تصویر انتخاب نشده است');ok(res,{url:`/uploads/products/${req.file.filename}`,filename:req.file.filename},201);}));

router.patch('/orders/:id',requireCsrf,asyncHandler(async(req,res)=>{
  const query=mongoose.isValidObjectId(req.params.id)?{$or:[{_id:req.params.id},{orderNumber:req.params.id}]}:{orderNumber:req.params.id}; const order=await Order.findOne(query);if(!order)throw new AppError(404,'سفارش پیدا نشد');
  const allowed=['registered','awaiting-payment','paid','processing','ready','shipped','delivered','cancelled','returned','payment-failed'];
  if(req.body.status!==undefined){const status=String(req.body.status);if(!allowed.includes(status))throw new AppError(400,'وضعیت سفارش معتبر نیست');if(order.status!==status){order.status=status;order.timeline.push({status,label:S.STATUS_LABELS[status]||status,date:new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tehran'}).format(new Date()),detail:'وضعیت سفارش توسط مدیر تغییر کرد.'});}}
  if(req.body.trackingCode!==undefined)order.trackingCode=String(req.body.trackingCode||'').trim(); if(req.body.note!==undefined||req.body.adminNote!==undefined)order.adminNote=String(req.body.note??req.body.adminNote??'').trim(); if(req.body.carrier!==undefined)order.carrier=String(req.body.carrier||'').trim(); if(req.body.deliveryEstimate!==undefined)order.deliveryEstimate=String(req.body.deliveryEstimate||'').trim(); await order.save();await log(req,`وضعیت سفارش ${order.orderNumber} به ${S.STATUS_LABELS[order.status]||order.status} تغییر کرد`,'order',order.orderNumber,order.customerName);ok(res,{order:S.order(order)});
}));
router.patch('/customers/:id',requireCsrf,asyncHandler(async(req,res)=>{const user=await User.findOne({$or:[{publicId:req.params.id},...(mongoose.isValidObjectId(req.params.id)?[{_id:req.params.id}]:[])]});if(!user)throw new AppError(404,'مشتری پیدا نشد');if(req.body.status!==undefined)user.isActive=String(req.body.status)==='active';if(req.body.note!==undefined)user.adminNote=String(req.body.note||'').trim();await user.save();const agg=await Order.aggregate([{$match:{user:user._id,paymentStatus:'paid'}},{$group:{_id:null,orders:{$sum:1},spent:{$sum:'$total'}}}]);await log(req,'پرونده مشتری ویرایش شد','customer',user.publicId,user.fullName);ok(res,{customer:customerView(user,agg[0]||{})});}));

router.get('/settings/:key',asyncHandler(async(req,res)=>{const setting=await AdminSetting.findOne({key:req.params.key});ok(res,{key:req.params.key,value:setting?.value||{}});}));
router.patch('/settings/:key',requireCsrf,asyncHandler(async(req,res)=>{const value=req.body.value!==undefined?req.body.value:req.body;const setting=await AdminSetting.findOneAndUpdate({key:req.params.key},{value,updatedBy:req.authAdmin._id},{upsert:true,new:true,setDefaultsOnInsert:true});await log(req,`تنظیمات ${req.params.key} ذخیره شد`,'setting',req.params.key,req.params.key);ok(res,{key:setting.key,value:setting.value});}));
router.get('/activities',asyncHandler(async(req,res)=>{const activities=await ActivityLog.find().sort({createdAt:-1}).limit(100);ok(res,{activities:activities.map(activityView)});}));
module.exports=router;
