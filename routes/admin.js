const express=require('express');
const fs=require('fs');
const crypto=require('crypto');
const rateLimit=require('express-rate-limit');
const mongoose=require('mongoose');
const Admin=require('../models/Admin');
const Product=require('../models/Product');
const Order=require('../models/Order');
const User=require('../models/User');
const ReturnRequest=require('../models/ReturnRequest');
const AdminSetting=require('../models/AdminSetting');
const ActivityLog=require('../models/ActivityLog');
const GalleryPost=require('../models/GalleryPost');
const Review=require('../models/Review');
const ProductQuestion=require('../models/ProductQuestion');
const Article=require('../models/Article');
const ContentPage=require('../models/ContentPage');
const Coupon=require('../models/Coupon');
const upload=require('../middlewares/upload');
const {makeUploader,verifyImages,privatePath}=upload;
const {requireAdmin,requirePermission,requireCsrf}=require('../middlewares/auth');
const {asyncHandler,ok,AppError}=require('../utils/http');
const {faDate}=require('../utils/formatters');
const {z,validate,formatIssues,text,optionalText,int,money,bool,mobile,publicId,slug,hexColor,assetPath,internalLink,objectId}=require('../utils/validate');
const S=require('../services/serializers');
const {buildAnalytics}=require('../services/analytics');
const {syncVariants,keyOf,applyInventory}=require('../services/inventory');
const {notifyRestocked}=require('../services/stockAlerts');
const {timelineEntry}=require('../services/orderFinalize');
const {couponView,normalizeCode}=require('../services/coupons');
const P=require('../services/permissions');
const {PRIZES,publicPrize}=require('../services/wheel');
const router=express.Router();

const loginLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'تعداد تلاش ورود بیش از حد مجاز است'}});
const saveSession=req=>new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
const regen=req=>new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
const log=async(req,action,targetType='',targetId='',targetName='',meta={})=>ActivityLog.create({action,targetType,targetId:String(targetId||''),targetName,admin:req.authAdmin?._id||req.session.adminId||null,adminName:req.authAdmin?.fullName||'',ipAddress:req.ip,meta}).catch(error=>console.error('[admin] activity log failed',error.message));
function makeSku(){return `TOTO-${String(Date.now()).slice(-6)}${crypto.randomInt(10,99)}`;}
function makePublicId(){return `toto-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;}
function customerView(user,summary={}){return{id:user.publicId,name:user.fullName||`${user.firstName||''} ${user.lastName||''}`.trim()||'مشتری توتو',mobile:user.mobile,points:Number(user.loyalty?.points||0),level:Number(user.loyalty?.points||0)>=10000?'ویژه':Number(user.loyalty?.points||0)>=5000?'طلایی':Number(user.loyalty?.points||0)>=1500?'نقره‌ای':'عضو توتو',orders:summary.orders||0,spent:summary.spent||0,joined:faDate(user.createdAt),status:user.isActive?'active':'inactive',note:user.adminNote||''};}
function activityView(a){return{person:a.adminName||'مدیر فروشگاه',action:a.action,time:faDate(a.createdAt),createdAt:a.createdAt};}
const adminView=(admin,permissions)=>({id:String(admin._id),fullName:admin.fullName,email:admin.email,role:admin.role,permissions,lastLoginAt:admin.lastLoginAt,isActive:admin.isActive});
// تغییر نقش‌ها یا حساب مدیران فقط برای مدیر کل؛ جلوگیری از افزایش دسترسی توسط خود کاربر
const requireSuperadmin=(req,_res,next)=>req.adminPermissions?.includes('*')?next():next(new AppError(403,'این عملیات فقط برای مدیر کل مجاز است'));
const orderLookup=id=>mongoose.isValidObjectId(id)?{$or:[{_id:id},{orderNumber:id}]}:{orderNumber:id};

router.post('/login',requireCsrf,loginLimiter,validate({body:z.object({email:z.string().trim().toLowerCase().max(120),password:z.string().max(200)})}),asyncHandler(async(req,res)=>{
  const {email,password}=req.body;
  const admin=await Admin.findOne({email}).select('+password'); if(!admin||!admin.isActive||!(await admin.comparePassword(password)))throw new AppError(401,'ایمیل یا رمز عبور مدیر صحیح نیست');
  if(admin.passwordNeedsHash())await admin.setPassword(password);
  const {userId,orderAccess}=req.session; await regen(req); if(userId)req.session.userId=userId; if(orderAccess)req.session.orderAccess=orderAccess; req.session.adminId=admin._id; req.session.csrfToken=crypto.randomBytes(24).toString('hex'); admin.lastLoginAt=new Date(); admin.lastLoginIP=req.ip; await admin.save(); await saveSession(req);
  ok(res,{admin:adminView(admin,await P.effectivePermissions(admin)),csrfToken:req.session.csrfToken});
}));
router.post('/logout',requireCsrf,asyncHandler(async(req,res)=>{delete req.session.adminId;await saveSession(req);ok(res,{loggedOut:true});}));
router.get('/me',asyncHandler(async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!req.session?.adminId)return ok(res,{authenticated:false});const admin=await Admin.findById(req.session.adminId);if(!admin?.isActive)return ok(res,{authenticated:false});
  const permissions=await P.effectivePermissions(admin);const has=p=>P.can(permissions,p);
  const [pendingOrders,needsReview,openReturns,galleryQueue,reviewQueue,questionQueue]=await Promise.all([
    has('orders.view')?Order.countDocuments({paymentStatus:'paid',status:{$in:['paid','processing','ready']}}):null,has('orders.view')?Order.countDocuments({needsReview:true}):null,
    has('returns.manage')?ReturnRequest.countDocuments({status:{$in:['received','reviewing']}}):null,has('gallery.moderate')?GalleryPost.countDocuments({'images.status':'pending'}):null,
    has('reviews.moderate')?Review.countDocuments({status:'pending'}):null,has('reviews.moderate')?ProductQuestion.countDocuments({status:'pending'}):null
  ]);
  ok(res,{authenticated:true,admin:adminView(admin,permissions),permissionLabels:P.PERMISSIONS,counts:{pendingOrders,needsReview,openReturns,galleryQueue,reviewQueue,questionQueue}});
}));

router.use(requireAdmin);

// ---------- داشبورد ----------
const rangeQuery=z.object({range:z.enum(['today','7d','30d','custom']).optional().default('30d'),from:z.string().max(10).optional(),to:z.string().max(10).optional()});
router.get('/dashboard',requirePermission('dashboard.view'),validate({query:rangeQuery}),asyncHandler(async(req,res)=>{
  const analytics=await buildAnalytics(req.valid.query);
  const activities=P.can(req.adminPermissions,'admins.manage')?(await ActivityLog.find().sort({createdAt:-1}).limit(15)).map(activityView):[];
  ok(res,{...analytics,activities});
}));

// ---------- محصولات و موجودی ----------
const colorsDefault=['#111111','#d9d0c3','#7899aa','#b7a78e','#684947','#e9e3d8'];
const variantInput=z.object({color:optionalText(40).default(''),size:optionalText(24).default(''),stock:int({min:0,max:100000})});
const productSchema=z.object({
  name:text(120,{min:2,message:'نام محصول را وارد کنید'}),category:text(60,{min:1,message:'دسته‌بندی الزامی است'}),type:optionalText(60).optional(),sku:z.string().trim().regex(/^[A-Za-z0-9_-]{3,40}$/,'کد محصول فقط حروف انگلیسی، عدد و خط تیره').optional(),
  price:money().refine(v=>v>0,'قیمت باید بیشتر از صفر باشد'),previousPrice:z.preprocess(v=>(v===''||v===null||v===0||v==='0'?null:v),money().nullable()).optional(),
  badge:optionalText(30).optional(),badgeType:z.enum(['','new','warning','sale']).optional(),stockNote:optionalText(80).optional(),
  colors:z.array(hexColor).max(12).optional(),colorNames:z.array(text(30,{min:1})).max(12).optional(),sizes:z.array(text(12,{min:1})).max(15).optional(),
  fabric:optionalText(60).optional(),season:optionalText(60).optional(),style:optionalText(60).optional(),occasion:optionalText(60).optional(),fit:optionalText(80).optional(),
  status:z.enum(['active','draft','out-of-stock']).optional(),isNew:bool.optional(),bestSeller:bool.optional(),popularity:int({min:0,max:1000000}).optional(),
  image:assetPath.optional(),secondaryImage:assetPath.optional(),imageAlt:optionalText(160).optional(),seoTitle:optionalText(70).optional(),description:optionalText(3000).optional(),
  variants:z.array(variantInput).max(180).optional()
}).superRefine((value,ctx)=>{
  if(value.colorNames&&new Set(value.colorNames).size!==value.colorNames.length)ctx.addIssue({code:'custom',path:['colorNames'],message:'نام رنگ تکراری است'});
  if(value.sizes&&new Set(value.sizes).size!==value.sizes.length)ctx.addIssue({code:'custom',path:['sizes'],message:'سایز تکراری است'});
});
function applyProductChanges(product,body){
  const fields=['name','category','type','price','previousPrice','badge','badgeType','stockNote','colorNames','sizes','fabric','season','style','occasion','fit','status','isNew','bestSeller','popularity','image','secondaryImage','imageAlt','seoTitle','description'];
  for(const key of fields)if(body[key]!==undefined)product[key]=body[key];
  if(body.sku)product.sku=body.sku;
  if(body.colors)product.colors=body.colors;
  if(body.colorNames&&(!body.colors||body.colors.length!==body.colorNames.length))product.colors=body.colorNames.map((_,i)=>body.colors?.[i]||product.colors?.[i]||colorsDefault[i%colorsDefault.length]);
  const stockMap=body.variants?new Map(body.variants.map(v=>[keyOf(v.color,v.size),v.stock])):null;
  if(stockMap){
    const valid=new Set(((product.colorNames||[]).length?product.colorNames:['']).flatMap(c=>((product.sizes||[]).length?product.sizes:['']).map(s=>keyOf(c,s))));
    for(const key of stockMap.keys())if(!valid.has(key))throw new AppError(400,'یکی از تنوع‌های ارسالی با رنگ‌ها یا سایزهای محصول هم‌خوانی ندارد');
  }
  syncVariants(product,stockMap);
}
router.get('/products',requirePermission('products.view'),asyncHandler(async(_req,res)=>{const products=await Product.find().sort({createdAt:-1});ok(res,{products:products.map(S.adminProduct)});}));
router.post('/products',requirePermission('products.edit'),requireCsrf,validate({body:productSchema}),asyncHandler(async(req,res)=>{
  const product=new Product({publicId:makePublicId(),sku:req.body.sku||makeSku(),name:req.body.name,category:req.body.category,price:req.body.price});
  applyProductChanges(product,req.body);
  if(!P.can(req.adminPermissions,'inventory.edit'))product.variants.forEach(v=>{v.stock=0;});
  try{await product.save();}catch(error){if(error?.code===11000)throw new AppError(409,'کد محصول تکراری است');throw error;}
  await log(req,'محصول جدید ایجاد شد','product',product.publicId,product.name); ok(res,{product:S.adminProduct(product)},201);
}));
router.patch('/products/:id',requirePermission('products.edit'),requireCsrf,validate({params:z.object({id:publicId}),body:productSchema.innerType().partial()}),asyncHandler(async(req,res)=>{
  const product=await Product.findOne({publicId:req.params.id});if(!product)throw new AppError(404,'محصول پیدا نشد');
  if(req.body.variants&&!P.can(req.adminPermissions,'inventory.edit'))throw new AppError(403,'ویرایش موجودی نیازمند مجوز inventory.edit است');
  const before=(product.variants||[]).map(v=>({color:v.color,size:v.size,stock:v.stock}));
  applyProductChanges(product,req.body);
  try{await product.save();}catch(error){if(error?.code===11000)throw new AppError(409,'کد محصول تکراری است');throw error;}
  await notifyRestocked(product,before);
  await log(req,'محصول ویرایش شد','product',product.publicId,product.name);ok(res,{product:S.adminProduct(product)});
}));
router.delete('/products/:id',requirePermission('products.edit'),requireCsrf,validate({params:z.object({id:publicId})}),asyncHandler(async(req,res)=>{const product=await Product.findOneAndDelete({publicId:req.params.id});if(!product)throw new AppError(404,'محصول پیدا نشد');await log(req,'محصول حذف شد','product',product.publicId,product.name);ok(res,{deleted:true,id:product.publicId});}));
// موجودی هر ترکیب رنگ/سایز؛ مقدار کلی فقط برای محصولات تک‌تنوعی پذیرفته می‌شود
router.patch('/products/:id/inventory',requirePermission('inventory.edit'),requireCsrf,validate({params:z.object({id:publicId}),body:z.object({variants:z.array(variantInput).max(180).optional(),inventory:int({min:0,max:100000}).optional()}).refine(v=>v.variants||v.inventory!==undefined,'موجودی ارسال نشده است')}),asyncHandler(async(req,res)=>{
  const product=await Product.findOne({publicId:req.params.id});if(!product)throw new AppError(404,'محصول پیدا نشد');
  const before=(product.variants||[]).map(v=>({color:v.color,size:v.size,stock:v.stock}));
  if(req.body.variants){
    const map=new Map(req.body.variants.map(v=>[keyOf(v.color,v.size),v.stock]));
    for(const key of map.keys())if(!product.variants.some(v=>keyOf(v.color,v.size)===key))throw new AppError(400,'تنوع ارسالی در این محصول وجود ندارد');
    product.variants.forEach(v=>{const key=keyOf(v.color,v.size);if(map.has(key))v.stock=map.get(key);});
  }else{
    if(product.variants.length>1)throw new AppError(400,'این محصول چند تنوع رنگ/سایز دارد؛ موجودی هر تنوع را جداگانه ثبت کنید');
    if(product.variants.length===1)product.variants[0].stock=req.body.inventory;else product.inventory=req.body.inventory;
  }
  product.markModified('variants');await product.save();await notifyRestocked(product,before);
  await log(req,`موجودی محصول به ${product.inventory} تغییر کرد`,'product',product.publicId,product.name);ok(res,{product:S.adminProduct(product)});
}));
router.post('/products/upload',requirePermission('products.edit'),requireCsrf,upload.single('image'),verifyImages,asyncHandler(async(req,res)=>{if(!req.file)throw new AppError(400,'فایل تصویر انتخاب نشده است');ok(res,{url:`/uploads/products/${req.file.filename}`,filename:req.file.filename},201);}));

// ---------- سفارش‌ها ----------
const USER_FIELDS='publicId fullName firstName lastName mobile email isActive createdAt';
// نگاشت شناسه تنوع به SKU برای نمایش اطلاعات تنوع اقلام سفارش
async function variantSkuMap(orders){
  const ids=[...new Set(orders.flatMap(o=>(o.items||[]).map(i=>i.productId)))];
  const products=await Product.find({publicId:{$in:ids}}).select('variants').lean();
  return new Map(products.flatMap(p=>(p.variants||[]).map(v=>[String(v._id),v.sku||''])));
}
router.get('/orders',requirePermission('orders.view'),validate({query:z.object({status:z.string().max(30).optional(),needsReview:z.enum(['1','0']).optional()}).passthrough()}),asyncHandler(async(req,res)=>{
  const filter={};if(req.valid.query.status&&S.STATUS_LABELS[req.valid.query.status])filter.status=req.valid.query.status;if(req.valid.query.needsReview==='1')filter.needsReview=true;
  const orders=await Order.find(filter).sort({createdAt:-1}).limit(500).populate('user',USER_FIELDS);const skuByVariant=await variantSkuMap(orders);
  ok(res,{orders:orders.map(o=>S.adminOrder(o,{skuByVariant}))});
}));
router.get('/orders/:id',requirePermission('orders.view'),validate({params:z.object({id:z.string().trim().min(1).max(60)})}),asyncHandler(async(req,res)=>{
  const order=await Order.findOne(orderLookup(req.params.id)).populate('user',USER_FIELDS);if(!order)throw new AppError(404,'سفارش پیدا نشد');
  ok(res,{order:S.adminOrder(order,{skuByVariant:await variantSkuMap([order])})});
}));
const ADMIN_STATUSES=['processing','ready','shipped','delivered','cancelled','returned'];
router.patch('/orders/:id',requirePermission('orders.edit'),requireCsrf,validate({params:z.object({id:z.string().trim().min(1).max(60)}),body:z.object({status:z.enum(ADMIN_STATUSES).optional(),trackingCode:optionalText(60).optional(),note:optionalText(1000).optional(),carrier:optionalText(60).optional(),deliveryEstimate:optionalText(80).optional(),resolveReview:bool.optional()})}),asyncHandler(async(req,res)=>{
  const order=await Order.findOne(orderLookup(req.params.id));if(!order)throw new AppError(404,'سفارش پیدا نشد');
  if(req.body.status&&order.status!==req.body.status){
    const status=req.body.status;
    // وضعیت‌های پرداخت فقط توسط درگاه تعیین می‌شوند؛ مدیر فقط مراحل پس از پرداخت را تغییر می‌دهد
    if(order.paymentStatus!=='paid'&&status!=='cancelled')throw new AppError(400,'سفارش پرداخت‌نشده فقط قابل لغو است');
    order.status=status;if(status==='delivered'&&!order.deliveredAt)order.deliveredAt=new Date();
    order.timeline.push(timelineEntry(status,S.STATUS_LABELS[status]||status,'وضعیت سفارش توسط مدیر تغییر کرد.'));
  }
  if(req.body.trackingCode!==undefined)order.trackingCode=req.body.trackingCode;if(req.body.note!==undefined)order.adminNote=req.body.note;if(req.body.carrier!==undefined)order.carrier=req.body.carrier;if(req.body.deliveryEstimate!==undefined)order.deliveryEstimate=req.body.deliveryEstimate;
  if(req.body.resolveReview){order.needsReview=false;order.reviewNotes.push(`بررسی شد توسط ${req.authAdmin.fullName}`);}
  await order.save();await log(req,`سفارش ${order.orderNumber} به‌روزرسانی شد (${S.STATUS_LABELS[order.status]||order.status})`,'order',order.orderNumber,order.customerName);await order.populate('user',USER_FIELDS);ok(res,{order:S.adminOrder(order,{skuByVariant:await variantSkuMap([order])})});
}));
router.post('/orders/:id/retry-inventory',requirePermission('orders.edit','inventory.edit'),requireCsrf,validate({params:z.object({id:z.string().trim().min(1).max(60)})}),asyncHandler(async(req,res)=>{
  const order=await Order.findOne(orderLookup(req.params.id));if(!order)throw new AppError(404,'سفارش پیدا نشد');
  if(order.paymentStatus!=='paid')throw new AppError(400,'فقط برای سفارش پرداخت‌شده امکان‌پذیر است');
  const result=await applyInventory(order._id,{retryFailed:true});
  await log(req,`تلاش دوباره کسر موجودی سفارش ${order.orderNumber}`,'order',order.orderNumber,order.customerName,result);
  ok(res,{result,order:S.adminOrder(await Order.findById(order._id))});
}));

// ---------- مشتریان ----------
router.get('/customers',requirePermission('customers.view'),asyncHandler(async(_req,res)=>{
  const users=await User.find().sort({createdAt:-1}).limit(500);
  const agg=await Order.aggregate([{$match:{user:{$in:users.map(u=>u._id)},paymentStatus:'paid'}},{$group:{_id:'$user',orders:{$sum:1},spent:{$sum:'$total'}}}]);
  const byUser=new Map(agg.map(x=>[String(x._id),x]));ok(res,{customers:users.map(u=>customerView(u,byUser.get(String(u._id))))});
}));
router.patch('/customers/:id',requirePermission('customers.edit'),requireCsrf,validate({params:z.object({id:z.string().trim().min(1).max(60)}),body:z.object({status:z.enum(['active','inactive']).optional(),note:optionalText(1000).optional()})}),asyncHandler(async(req,res)=>{const user=await User.findOne({$or:[{publicId:req.params.id},...(mongoose.isValidObjectId(req.params.id)?[{_id:req.params.id}]:[])]});if(!user)throw new AppError(404,'مشتری پیدا نشد');if(req.body.status!==undefined)user.isActive=req.body.status==='active';if(req.body.note!==undefined)user.adminNote=req.body.note;await user.save();const agg=await Order.aggregate([{$match:{user:user._id,paymentStatus:'paid'}},{$group:{_id:null,orders:{$sum:1},spent:{$sum:'$total'}}}]);await log(req,'پرونده مشتری ویرایش شد','customer',user.publicId,user.fullName);ok(res,{customer:customerView(user,agg[0]||{})});}));

// ---------- مرجوعی‌ها ----------
const ORDER_FIELDS='orderNumber customerName mobile email address addressSnapshot shippingMethod status createdAt user';
router.get('/returns',requirePermission('returns.manage'),asyncHandler(async(_req,res)=>{const returns=await ReturnRequest.find().sort({createdAt:-1}).limit(300).populate('user',USER_FIELDS).populate('order',ORDER_FIELDS);ok(res,{returns:returns.map(S.adminReturn)});}));
const RETURN_STATUSES=['received','reviewing','approved','awaiting-item','replacement-processing','refunded','rejected','completed'];
router.patch('/returns/:id',requirePermission('returns.manage'),requireCsrf,validate({params:z.object({id:z.string().trim().min(3).max(40)}),body:z.object({status:z.enum(RETURN_STATUSES).optional(),adminNote:optionalText(1000).optional(),customerMessage:optionalText(1000).optional()})}),asyncHandler(async(req,res)=>{
  const request=await ReturnRequest.findOne({publicId:req.params.id});if(!request)throw new AppError(404,'درخواست پیدا نشد');
  if(req.body.status&&req.body.status!==request.status){request.status=req.body.status;request.history.push({status:req.body.status,note:req.body.adminNote||''});}
  if(req.body.adminNote!==undefined)request.adminNote=req.body.adminNote;if(req.body.customerMessage!==undefined)request.customerMessage=req.body.customerMessage;
  await request.save();await request.populate([{path:'user',select:USER_FIELDS},{path:'order',select:ORDER_FIELDS}]);
  await log(req,`درخواست مرجوعی ${request.publicId} به ${S.RETURN_STATUS_LABELS[request.status]} تغییر کرد`,'return',request.publicId,request.orderNumber);ok(res,{request:S.adminReturn(request)});
}));
router.get('/returns/:id/images/:file',requirePermission('returns.manage'),asyncHandler(async(req,res)=>{
  const request=await ReturnRequest.findOne({publicId:String(req.params.id)}).select('images');const file=request?.images.find(img=>img.filename===req.params.file);const fullPath=file&&privatePath('returns',file.filename);
  if(!fullPath||!fs.existsSync(fullPath))throw new AppError(404,'تصویر پیدا نشد');res.set('Cache-Control','private, no-store');res.sendFile(fullPath);
}));

// ---------- گالری، دیدگاه و پرسش ----------
router.get('/gallery',requirePermission('gallery.moderate'),asyncHandler(async(_req,res)=>{const posts=await GalleryPost.find().sort({createdAt:-1}).limit(300);ok(res,{posts:posts.map(p=>S.galleryPost(p,{admin:true}))});}));
const galleryId=z.string().trim().min(3).max(40);
// بررسی کل ارسال (همه تصاویر) یا یک تصویر مشخص
router.patch('/gallery/:id',requirePermission('gallery.moderate'),requireCsrf,validate({params:z.object({id:galleryId}),body:z.object({status:z.enum(['approved','rejected','pending']),reason:optionalText(300).optional().default('')})}),asyncHandler(async(req,res)=>{
  const post=await GalleryPost.findOne({publicId:req.params.id});if(!post)throw new AppError(404,'عکس پیدا نشد');
  post.images.forEach(img=>{img.status=req.body.status;img.rejectionReason=req.body.status==='rejected'?req.body.reason:'';img.moderatedBy=req.authAdmin._id;img.moderatedAt=new Date();});
  post.rejectionReason=req.body.status==='rejected'?req.body.reason:'';post.moderatedBy=req.authAdmin._id;post.moderatedAt=new Date();post.refreshStatus();await post.save();
  await log(req,`ارسال گالری ${post.publicId} ${req.body.status==='approved'?'منتشر شد':req.body.status==='rejected'?'رد شد':'به صف بازگشت'}`,'gallery',post.publicId,post.customerName);ok(res,{post:S.galleryPost(post,{admin:true})});
}));
router.patch('/gallery/:id/images/:imageId',requirePermission('gallery.moderate'),requireCsrf,validate({params:z.object({id:galleryId,imageId:objectId}),body:z.object({status:z.enum(['approved','rejected','pending']),reason:optionalText(300).optional().default('')})}),asyncHandler(async(req,res)=>{
  const post=await GalleryPost.findOne({publicId:req.params.id});const image=post?.images.id(req.params.imageId);if(!image)throw new AppError(404,'تصویر پیدا نشد');
  image.status=req.body.status;image.rejectionReason=req.body.status==='rejected'?req.body.reason:'';image.moderatedBy=req.authAdmin._id;image.moderatedAt=new Date();
  post.moderatedBy=req.authAdmin._id;post.moderatedAt=new Date();post.refreshStatus();await post.save();
  await log(req,`تصویر گالری ${post.publicId} ${req.body.status==='approved'?'تأیید شد':req.body.status==='rejected'?'رد شد':'به صف بازگشت'}`,'gallery',post.publicId,post.customerName);ok(res,{post:S.galleryPost(post,{admin:true})});
}));
router.delete('/gallery/:id',requirePermission('gallery.moderate'),requireCsrf,validate({params:z.object({id:galleryId})}),asyncHandler(async(req,res)=>{
  const post=await GalleryPost.findOneAndDelete({publicId:req.params.id});if(!post)throw new AppError(404,'عکس پیدا نشد');
  const names=[...(post.images||[]).map(img=>img.filename),post.image?.filename].filter(Boolean);
  await Promise.all(names.map(name=>{const file=privatePath('gallery',name);return file?fs.promises.unlink(file).catch(()=>{}):null;}));
  await log(req,`ارسال گالری ${post.publicId} حذف شد`,'gallery',post.publicId,post.customerName);ok(res,{deleted:true});
}));
async function refreshProductRating(productId){
  const stats=await Review.aggregate([{$match:{productId,status:'approved'}},{$group:{_id:null,count:{$sum:1},avg:{$avg:'$rating'}}}]);
  await Product.updateOne({publicId:productId},{$set:{reviewCount:stats[0]?.count||0,rating:stats[0]?Number(stats[0].avg.toFixed(1)):0}});
}
router.get('/reviews',requirePermission('reviews.moderate'),asyncHandler(async(_req,res)=>{const [reviews,questions]=await Promise.all([Review.find().sort({createdAt:-1}).limit(300),ProductQuestion.find().sort({createdAt:-1}).limit(300)]);ok(res,{reviews:reviews.map(S.review),questions:questions.map(S.question)});}));
router.patch('/reviews/:id',requirePermission('reviews.moderate'),requireCsrf,validate({params:z.object({id:objectId}),body:z.object({status:z.enum(['approved','rejected','pending'])})}),asyncHandler(async(req,res)=>{
  const review=await Review.findByIdAndUpdate(req.params.id,{$set:{status:req.body.status,moderatedBy:req.authAdmin._id,moderatedAt:new Date()}},{new:true});if(!review)throw new AppError(404,'دیدگاه پیدا نشد');
  await refreshProductRating(review.productId);await log(req,`دیدگاه محصول ${review.productId} ${req.body.status==='approved'?'تأیید شد':'رد شد'}`,'review',String(review._id),review.productId);ok(res,{review:S.review(review)});
}));
router.patch('/questions/:id',requirePermission('reviews.moderate'),requireCsrf,validate({params:z.object({id:objectId}),body:z.object({answer:optionalText(1000).optional(),status:z.enum(['answered','rejected','pending'])})}),asyncHandler(async(req,res)=>{
  if(req.body.status==='answered'&&!(req.body.answer||'').trim())throw new AppError(400,'متن پاسخ را وارد کنید');
  const question=await ProductQuestion.findByIdAndUpdate(req.params.id,{$set:{status:req.body.status,...(req.body.answer!==undefined?{answer:req.body.answer}:{}),answeredBy:req.authAdmin._id,answeredAt:new Date()}},{new:true});if(!question)throw new AppError(404,'پرسش پیدا نشد');
  await log(req,`پرسش محصول ${question.productId} ${req.body.status==='answered'?'پاسخ داده شد':'رد شد'}`,'question',String(question._id),question.productId);ok(res,{question:S.question(question)});
}));

// ---------- محتوا ----------
const contentUpload=makeUploader('content',{maxSize:8*1024*1024,maxFiles:1});
router.post('/content/upload',requirePermission('content.edit'),requireCsrf,contentUpload.single('image'),verifyImages,asyncHandler(async(req,res)=>{if(!req.file)throw new AppError(400,'فایل تصویر انتخاب نشده است');ok(res,{url:`/uploads/content/${req.file.filename}`},201);}));
const paragraphs=z.array(text(3000,{min:1})).max(40);
const articleSchema=z.object({
  slug,title:text(160,{min:3}),category:text(60,{min:1}),excerpt:text(400,{min:1}),image:assetPath,imageAlt:optionalText(160).optional().default(''),intro:optionalText(2000).optional().default(''),
  readingTime:optionalText(30).optional().default(''),publishedAt:z.preprocess(v=>(v?new Date(v):new Date()),z.date({invalid_type_error:'تاریخ انتشار معتبر نیست'})),
  status:z.enum(['draft','published']),featured:bool.optional().default(false),popular:bool.optional().default(false),
  sections:z.array(z.object({id:z.string().trim().regex(/^[a-z0-9-]{1,40}$/,'شناسه بخش معتبر نیست'),title:text(160,{min:1}),paragraphs,note:optionalText(600).optional().default(''),subSections:z.array(z.object({title:text(120,{min:1}),text:text(1500,{min:1})})).max(20).optional().default([])})).max(30)
});
router.get('/articles',requirePermission('content.edit'),asyncHandler(async(_req,res)=>{const articles=await Article.find().sort({publishedAt:-1});ok(res,{articles:articles.map(a=>S.article(a))});}));
router.post('/articles',requirePermission('content.edit'),requireCsrf,validate({body:articleSchema}),asyncHandler(async(req,res)=>{
  if(await Article.exists({slug:req.body.slug}))throw new AppError(409,'نامک مقاله تکراری است');
  const article=await Article.create({...req.body,updatedBy:req.authAdmin._id});await log(req,'مقاله جدید ثبت شد','article',article.slug,article.title);ok(res,{article:S.article(article)},201);
}));
router.patch('/articles/:slug',requirePermission('content.edit'),requireCsrf,validate({params:z.object({slug}),body:articleSchema.partial()}),asyncHandler(async(req,res)=>{
  const article=await Article.findOne({slug:req.params.slug});if(!article)throw new AppError(404,'مقاله پیدا نشد');
  if(req.body.slug&&req.body.slug!==article.slug&&await Article.exists({slug:req.body.slug}))throw new AppError(409,'نامک مقاله تکراری است');
  Object.assign(article,req.body,{updatedBy:req.authAdmin._id});await article.save();await log(req,'مقاله ویرایش شد','article',article.slug,article.title);ok(res,{article:S.article(article)});
}));
router.delete('/articles/:slug',requirePermission('content.edit'),requireCsrf,validate({params:z.object({slug})}),asyncHandler(async(req,res)=>{const article=await Article.findOneAndDelete({slug:req.params.slug});if(!article)throw new AppError(404,'مقاله پیدا نشد');await log(req,'مقاله حذف شد','article',article.slug,article.title);ok(res,{deleted:true});}));
const PAGE_SLUGS=['about','privacy','terms','shipping-returns'];
const pageSchema=z.object({eyebrow:optionalText(60).optional().default(''),title:text(160,{min:2}),intro:optionalText(1500).optional().default(''),status:z.enum(['draft','published']),sections:z.array(z.object({id:z.string().trim().regex(/^[a-z0-9-]{1,40}$/,'شناسه بخش معتبر نیست'),title:text(160,{min:1}),paragraphs})).max(30)});
router.get('/pages',requirePermission('content.edit'),asyncHandler(async(_req,res)=>{const pages=await ContentPage.find({slug:{$in:PAGE_SLUGS}});ok(res,{slugs:PAGE_SLUGS,pages:pages.map(S.contentPage)});}));
router.put('/pages/:slug',requirePermission('content.edit'),requireCsrf,validate({params:z.object({slug:z.enum(PAGE_SLUGS)}),body:pageSchema}),asyncHandler(async(req,res)=>{
  const page=await ContentPage.findOneAndUpdate({slug:req.params.slug},{$set:{...req.body,updatedBy:req.authAdmin._id}},{upsert:true,new:true,setDefaultsOnInsert:true});
  await log(req,`صفحه ${req.params.slug} ذخیره شد`,'page',req.params.slug,page.title);ok(res,{page:S.contentPage(page)});
}));
const slideSchema=z.object({image:assetPath,eyebrow:optionalText(60).default(''),title:text(120,{min:1}),text:optionalText(300).default(''),cta:optionalText(40).default(''),href:internalLink});
const contentSchemas={
  announcement:z.object({status:z.enum(['draft','published']),text:text(160,{min:3}),linkLabel:optionalText(40).default(''),href:z.union([z.literal(''),internalLink]).default('')}),
  hero:z.object({status:z.enum(['draft','published']),slides:z.array(slideSchema).min(1).max(6)}),
  offer:z.object({status:z.enum(['draft','published']),eyebrow:optionalText(60).default(''),title:text(80,{min:1}),description:optionalText(200).default(''),endAt:z.string().trim().refine(v=>!Number.isNaN(Date.parse(v)),'تاریخ پایان معتبر نیست')}),
  faq:z.object({status:z.enum(['draft','published']),groups:z.array(z.object({id:z.string().trim().regex(/^[a-z0-9-]{1,40}$/,'شناسه گروه معتبر نیست'),title:text(80,{min:1}),items:z.array(z.tuple([text(300,{min:3}),text(2000,{min:3})])).max(40)})).max(15)})
};
router.get('/content/:key',requirePermission('content.edit'),validate({params:z.object({key:z.enum(Object.keys(contentSchemas))})}),asyncHandler(async(req,res)=>{const setting=await AdminSetting.findOne({key:`content:${req.params.key}`}).lean();ok(res,{key:req.params.key,value:setting?.value||null});}));
router.put('/content/:key',requirePermission('content.edit'),requireCsrf,validate({params:z.object({key:z.enum(Object.keys(contentSchemas))})}),asyncHandler(async(req,res,next)=>{
  const parsed=contentSchemas[req.params.key].safeParse(req.body?.value??req.body);if(!parsed.success)return next(new AppError(400,'اطلاعات محتوا معتبر نیست',formatIssues(parsed.error)));
  const setting=await AdminSetting.findOneAndUpdate({key:`content:${req.params.key}`},{$set:{value:parsed.data,updatedBy:req.authAdmin._id}},{upsert:true,new:true});
  await log(req,`محتوای ${req.params.key} ذخیره شد`,'setting',`content:${req.params.key}`,req.params.key);ok(res,{key:req.params.key,value:setting.value});
}));

// ---------- کدهای تخفیف ----------
const couponSchema=z.object({
  code:z.preprocess(normalizeCode,z.string().regex(/^[A-Z0-9-]{3,40}$/,'کد فقط حروف انگلیسی، عدد و خط تیره (۳ تا ۴۰ نویسه)')),title:text(80,{min:2}),condition:optionalText(200).optional().default(''),
  type:z.enum(['percent','fixed','shipping','category']),value:int({min:0,max:100000000}),maxDiscount:z.preprocess(v=>(v===''||v===null||v===undefined?null:v),money().nullable()).optional(),minSubtotal:money().optional().default(0),
  category:optionalText(60).optional().default(''),onlyNonDiscounted:bool.optional().default(false),firstOrderOnly:bool.optional().default(false),
  usageLimit:z.preprocess(v=>(v===''||v===null||v===undefined?null:v),int({min:1,max:1000000}).nullable()).optional(),perUserLimit:z.preprocess(v=>(v===''||v===null||v===undefined?null:v),int({min:1,max:1000}).nullable()).optional(),
  expiresAt:z.preprocess(v=>(v?new Date(v):null),z.date().nullable()).optional(),isActive:bool.optional().default(true)
}).superRefine((v,ctx)=>{if(v.type==='percent'||v.type==='category'){if(v.value<1||v.value>90)ctx.addIssue({code:'custom',path:['value'],message:'درصد تخفیف باید بین ۱ تا ۹۰ باشد'});}if(v.type==='category'&&!v.category)ctx.addIssue({code:'custom',path:['category'],message:'دسته‌بندی را مشخص کنید'});if(v.type==='fixed'&&v.value<1000)ctx.addIssue({code:'custom',path:['value'],message:'مبلغ تخفیف معتبر نیست'});});
const adminCoupon=c=>({...couponView(c),id:String(c._id),isActive:c.isActive,usedCount:c.usedCount,usageLimit:c.usageLimit,perUserLimit:c.perUserLimit,firstOrderOnly:c.firstOrderOnly,onlyNonDiscounted:c.onlyNonDiscounted,source:c.source,condition:c.condition});
router.get('/coupons',requirePermission('marketing.edit'),asyncHandler(async(_req,res)=>{const coupons=await Coupon.find({source:{$ne:'wheel'}}).sort({createdAt:-1}).limit(300);const wheelStats=await Coupon.aggregate([{$match:{source:'wheel'}},{$group:{_id:null,issued:{$sum:1},used:{$sum:'$usedCount'}}}]);ok(res,{coupons:coupons.map(adminCoupon),wheel:{issued:wheelStats[0]?.issued||0,used:wheelStats[0]?.used||0,prizes:PRIZES.map(p=>({...publicPrize(p),weight:p.weight}))}});}));
router.post('/coupons',requirePermission('marketing.edit'),requireCsrf,validate({body:couponSchema}),asyncHandler(async(req,res)=>{if(await Coupon.exists({code:req.body.code}))throw new AppError(409,'این کد قبلاً ثبت شده است');const coupon=await Coupon.create({...req.body,source:'admin'});await log(req,`کد تخفیف ${coupon.code} ایجاد شد`,'coupon',coupon.code,coupon.title);ok(res,{coupon:adminCoupon(coupon)},201);}));
router.patch('/coupons/:id',requirePermission('marketing.edit'),requireCsrf,validate({params:z.object({id:objectId}),body:couponSchema.innerType().partial().omit({code:true})}),asyncHandler(async(req,res)=>{const coupon=await Coupon.findOne({_id:req.params.id,source:{$ne:'wheel'}});if(!coupon)throw new AppError(404,'کد پیدا نشد');Object.assign(coupon,req.body);await coupon.save();await log(req,`کد تخفیف ${coupon.code} ویرایش شد`,'coupon',coupon.code,coupon.title);ok(res,{coupon:adminCoupon(coupon)});}));

// ---------- نقش‌ها و مدیران ----------
router.get('/roles',requirePermission('admins.manage'),asyncHandler(async(_req,res)=>{const [roles,admins,failedLogins]=await Promise.all([P.getRoles(),Admin.find().sort({createdAt:1}),ActivityLog.find().sort({createdAt:-1}).limit(30)]);const counts=admins.reduce((m,a)=>m.set(a.role,(m.get(a.role)||0)+1),new Map());ok(res,{roles:roles.map(r=>({...r,users:counts.get(r.id)||0})),permissions:P.PERMISSIONS,admins:await Promise.all(admins.map(async a=>adminView(a,await P.effectivePermissions(a)))),activities:failedLogins.map(activityView)});}));
router.put('/roles/:id',requirePermission('admins.manage'),requireSuperadmin,requireCsrf,validate({params:z.object({id:z.enum(Object.keys(P.DEFAULT_ROLES))}),body:z.object({permissions:z.array(z.enum(P.ALL)).max(P.ALL.length)})}),asyncHandler(async(req,res)=>{
  if(P.DEFAULT_ROLES[req.params.id].locked)throw new AppError(400,'دسترسی مدیر کل قابل تغییر نیست');
  await AdminSetting.findOneAndUpdate({key:`role:${req.params.id}`},{$set:{value:{permissions:req.body.permissions},updatedBy:req.authAdmin._id}},{upsert:true});
  await log(req,`مجوزهای نقش ${P.DEFAULT_ROLES[req.params.id].label} تغییر کرد`,'role',req.params.id,P.DEFAULT_ROLES[req.params.id].label,{permissions:req.body.permissions});
  ok(res,{roles:await P.getRoles()});
}));
const adminCreateSchema=z.object({fullName:text(80,{min:2}),email:z.string().trim().toLowerCase().email('ایمیل معتبر نیست').max(120),password:z.string().min(12,'رمز عبور حداقل ۱۲ نویسه است').max(200),role:z.enum(Object.keys(P.DEFAULT_ROLES)),mobile:z.union([z.literal(''),mobile]).optional().default('')});
router.post('/admins',requirePermission('admins.manage'),requireSuperadmin,requireCsrf,validate({body:adminCreateSchema}),asyncHandler(async(req,res)=>{
  if(await Admin.exists({email:req.body.email}))throw new AppError(409,'این ایمیل قبلاً ثبت شده است');
  const admin=new Admin({fullName:req.body.fullName,email:req.body.email,mobile:req.body.mobile,role:req.body.role,permissions:[],isActive:true});await admin.setPassword(req.body.password);await admin.save();
  await log(req,`مدیر جدید با نقش ${req.body.role} ایجاد شد`,'admin',String(admin._id),admin.email);ok(res,{admin:adminView(admin,await P.effectivePermissions(admin))},201);
}));
router.patch('/admins/:id',requirePermission('admins.manage'),requireSuperadmin,requireCsrf,validate({params:z.object({id:objectId}),body:z.object({role:z.enum(Object.keys(P.DEFAULT_ROLES)).optional(),isActive:bool.optional(),password:z.string().min(12).max(200).optional()})}),asyncHandler(async(req,res)=>{
  const admin=await Admin.findById(req.params.id).select('+password');if(!admin)throw new AppError(404,'مدیر پیدا نشد');
  if(String(admin._id)===String(req.authAdmin._id)&&(req.body.isActive===false||(req.body.role&&req.body.role!==admin.role)))throw new AppError(400,'نقش یا وضعیت حساب خودتان را نمی‌توانید تغییر دهید');
  if(req.body.role){admin.role=req.body.role;admin.permissions=req.body.role==='superadmin'?['*']:[];}if(req.body.isActive!==undefined)admin.isActive=req.body.isActive;if(req.body.password)await admin.setPassword(req.body.password);
  await admin.save();await log(req,'حساب مدیر ویرایش شد','admin',String(admin._id),admin.email);ok(res,{admin:adminView(admin,await P.effectivePermissions(admin))});
}));
router.get('/activities',requirePermission('admins.manage'),asyncHandler(async(_req,res)=>{const activities=await ActivityLog.find().sort({createdAt:-1}).limit(100);ok(res,{activities:activities.map(activityView)});}));

// ---------- خروجی گزارش ----------
router.get('/reports/:type',requirePermission('reports.export'),validate({params:z.object({type:z.enum(['orders','products','customers'])})}),asyncHandler(async(req,res)=>{
  if(req.params.type==='products'){const products=await Product.find().sort({createdAt:-1});return ok(res,{headers:['کد','نام','وضعیت','قیمت','موجودی کل','تنوع‌ها'],rows:products.map(p=>{const v=S.adminProduct(p);return[v.sku,v.name,v.status,v.price,v.inventory,v.variants.map(x=>`${x.color||'-'}/${x.size||'-'}:${x.stock}`).join(' | ')];})});}
  if(req.params.type==='customers'){const users=await User.find().sort({createdAt:-1}).limit(5000);return ok(res,{headers:['کد','نام','موبایل','امتیاز','تاریخ عضویت'],rows:users.map(u=>[u.publicId,u.fullName,u.mobile,u.loyalty?.points||0,faDate(u.createdAt)])});}
  const orders=await Order.find().sort({createdAt:-1}).limit(5000);ok(res,{headers:['شماره سفارش','مشتری','وضعیت','وضعیت پرداخت','مبلغ','تاریخ'],rows:orders.map(o=>[o.orderNumber,o.customerName,S.STATUS_LABELS[o.status]||o.status,o.paymentStatus,o.total,faDate(o.createdAt)])});
}));
module.exports=router;
