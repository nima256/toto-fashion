const express=require('express');
const fs=require('fs');
const rateLimit=require('express-rate-limit');
const ContactMessage=require('../models/ContactMessage');
const NewsletterSubscriber=require('../models/NewsletterSubscriber');
const Article=require('../models/Article');
const ContentPage=require('../models/ContentPage');
const AdminSetting=require('../models/AdminSetting');
const GalleryPost=require('../models/GalleryPost');
const Product=require('../models/Product');
const {asyncHandler,ok,AppError}=require('../utils/http');
const {requireCsrf,requireUser}=require('../middlewares/auth');
const {makeUploader,verifyImages,removeUploaded,privatePath}=require('../middlewares/upload');
const {z,validate,formatIssues,text,mobile,publicId,slug}=require('../utils/validate');
const {normalizeOrderNumber}=require('../utils/formatters');
const S=require('../services/serializers');
const {checkoutConfig}=require('../services/checkout');
const {effectivePermissions,can}=require('../services/permissions');
const Admin=require('../models/Admin');
const router=express.Router();
const publicWriteLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد تلاش کنید.'}});
const galleryUpload=makeUploader('gallery',{maxSize:8*1024*1024,maxFiles:7});

// ---------- تماس با پشتیبانی ----------
const contactSchema=z.object({
  fullName:text(80,{min:3,message:'نام و نام خانوادگی را کامل وارد کنید'}),mobile,subject:text(80,{min:1,message:'موضوع پیام را انتخاب کنید'}),message:text(2000,{min:15,message:'پیام را با حداقل ۱۵ نویسه توضیح دهید'}),
  orderNumber:z.preprocess(v=>String(v??'').trim(),z.string().max(40)).optional().default('')
}).superRefine((value,ctx)=>{if(value.orderNumber&&!normalizeOrderNumber(value.orderNumber))ctx.addIssue({code:'custom',path:['orderNumber'],message:'شماره سفارش معتبر نیست؛ قالب صحیح مانند TO-261005-1234 است'});});
router.post('/contact',requireCsrf,publicWriteLimiter,validate({body:contactSchema}),asyncHandler(async(req,res)=>{
  const {fullName,mobile:mobileValue,subject,message,orderNumber}=req.body;
  const ticket=await ContactMessage.create({fullName,mobile:mobileValue,subject,message,orderNumber:orderNumber?normalizeOrderNumber(orderNumber):'',user:req.session?.userId||null});
  ok(res,{ticketId:ticket.publicId,orderNumber:ticket.orderNumber,receivedAt:ticket.createdAt},201);
}));

// ---------- خبرنامه ----------
router.post('/newsletter',requireCsrf,publicWriteLimiter,validate({body:z.object({mobile})}),asyncHandler(async(req,res)=>{
  const existing=await NewsletterSubscriber.findOne({mobile:req.body.mobile});
  if(existing?.status==='subscribed')return ok(res,{subscribed:true,alreadySubscribed:true});
  await NewsletterSubscriber.updateOne({mobile:req.body.mobile},{$set:{status:'subscribed',user:req.session?.userId||null},$setOnInsert:{source:'footer'}},{upsert:true});
  ok(res,{subscribed:true,alreadySubscribed:false},201);
}));

// ---------- محتوای مدیریت‌شده ----------
const published=value=>value&&value.status!=='draft'&&(!value.publishAt||new Date(value.publishAt)<=new Date());
router.get('/content/site',asyncHandler(async(_req,res)=>{
  const settings=await AdminSetting.find({key:{$in:['content:announcement','content:hero','content:offer']}}).lean();
  const map=Object.fromEntries(settings.map(s=>[s.key.slice(8),s.value]));
  res.set('Cache-Control','no-cache');
  ok(res,{site:{announcement:published(map.announcement)?map.announcement:null,hero:published(map.hero)?map.hero:null,offer:published(map.offer)?map.offer:null},checkout:checkoutConfig()});
}));
router.get('/content/articles',asyncHandler(async(_req,res)=>{const articles=await Article.find({status:'published',publishedAt:{$lte:new Date()}}).sort({featured:-1,publishedAt:-1}).limit(100);ok(res,{articles:articles.map(a=>S.article(a,{full:false}))});}));
router.get('/content/articles/:slug',validate({params:z.object({slug})}),asyncHandler(async(req,res)=>{const article=await Article.findOne({slug:req.params.slug,status:'published',publishedAt:{$lte:new Date()}});if(!article)throw new AppError(404,'مقاله پیدا نشد');ok(res,{article:S.article(article)});}));
router.get('/content/pages/:slug',validate({params:z.object({slug})}),asyncHandler(async(req,res)=>{const page=await ContentPage.findOne({slug:req.params.slug,status:'published'});ok(res,{page:page?S.contentPage(page):null});}));
router.get('/content/faq',asyncHandler(async(_req,res)=>{const setting=await AdminSetting.findOne({key:'content:faq'}).lean();ok(res,{groups:published(setting?.value)?setting.value.groups||[]:[]});}));

// ---------- گالری مشتریان ----------
const MAX_GALLERY_IMAGES=6;
// فقط پست‌های دارای حداقل یک تصویر تأییدشده و فقط همان تصاویر تأییدشده عمومی‌اند
router.get('/gallery',asyncHandler(async(_req,res)=>{const posts=await GalleryPost.find({$or:[{'images.status':'approved'},{status:'approved','images.0':{$exists:false}}]}).sort({moderatedAt:-1,createdAt:-1}).limit(120);ok(res,{posts:posts.map(p=>S.galleryPost(p,{publicOnly:true})).filter(p=>p.images.length)});}));
router.get('/gallery/mine',requireUser,asyncHandler(async(req,res)=>{const posts=await GalleryPost.find({user:req.session.userId}).sort({createdAt:-1}).limit(50);ok(res,{posts:posts.map(p=>S.galleryPost(p,{owner:true}))});}));
const gallerySchema=z.object({customerName:text(32,{min:2,message:'نام نمایشی را وارد کنید'}),productId:publicId,caption:text(220,{min:5,message:'توضیح استایل را کامل کنید'}),consent:z.preprocess(v=>v==='on'||v==='true'||v===true,z.literal(true,{errorMap:()=>({message:'اجازه انتشار عکس را تأیید کنید'})}))});
// چند تصویر در یک ارسال (فیلد images)؛ فیلد قدیمی image هم برای سازگاری پذیرفته می‌شود
router.post('/gallery',requireUser,requireCsrf,publicWriteLimiter,galleryUpload.fields([{name:'images',maxCount:MAX_GALLERY_IMAGES},{name:'image',maxCount:1}]),verifyImages,asyncHandler(async(req,res)=>{
  try{
    const files=[...(req.files?.images||[]),...(req.files?.image||[])];
    if(!files.length)throw new AppError(400,'لطفاً دست‌کم یک عکس انتخاب کنید');
    if(files.length>MAX_GALLERY_IMAGES)throw new AppError(400,`حداکثر ${MAX_GALLERY_IMAGES} عکس در هر ارسال مجاز است`);
    const parsed=gallerySchema.safeParse(req.body||{});if(!parsed.success)throw new AppError(400,'اطلاعات ارسال عکس کامل نیست',formatIssues(parsed.error));
    const product=await Product.findOne({publicId:parsed.data.productId,status:{$ne:'draft'}}).select('publicId name');if(!product)throw new AppError(400,'محصول انتخاب‌شده معتبر نیست');
    if(await GalleryPost.countDocuments({user:req.session.userId,status:'pending'})>=5)throw new AppError(429,'پنج ارسال شما در صف بررسی است؛ پس از بررسی دوباره ارسال کنید');
    const post=await GalleryPost.create({user:req.session.userId,customerName:parsed.data.customerName,productId:product.publicId,productName:product.name,caption:parsed.data.caption,consent:true,images:files.map(f=>({filename:f.filename,mimeType:f.mimetype,size:f.size}))});
    ok(res,{post:S.galleryPost(post,{owner:true})},201);
  }catch(error){await removeUploaded(req);throw error;}
}));
router.delete('/gallery/:id',requireUser,requireCsrf,validate({params:z.object({id:z.string().trim().min(3).max(40).regex(/^[A-Z0-9-]+$/)})}),asyncHandler(async(req,res)=>{
  const post=await GalleryPost.findOneAndDelete({publicId:req.params.id,user:req.session.userId,status:{$ne:'approved'}});
  if(!post)throw new AppError(404,'عکس قابل حذف پیدا نشد');
  const names=[...(post.images||[]).map(img=>img.filename),post.image?.filename].filter(Boolean);
  await Promise.all(names.map(name=>{const file=privatePath('gallery',name);return file?fs.promises.unlink(file).catch(()=>{}):null;}));
  ok(res,{deleted:true});
}));
// تصاویر گالری خصوصی‌اند: تصویر تأییدشده برای همه، بقیه فقط برای صاحب عکس یا مدیر دارای مجوز
router.get('/gallery/images/:file',asyncHandler(async(req,res)=>{
  const fullPath=privatePath('gallery',req.params.file);if(!fullPath)throw new AppError(404,'تصویر پیدا نشد');
  const post=await GalleryPost.findOne({$or:[{'images.filename':req.params.file},{'image.filename':req.params.file}]}).select('status user images image');if(!post||!fs.existsSync(fullPath))throw new AppError(404,'تصویر پیدا نشد');
  const image=post.images.find(img=>img.filename===req.params.file);const imageStatus=image?image.status:post.status;
  let allowed=imageStatus==='approved'||String(post.user)===String(req.session?.userId||'');
  if(!allowed&&req.session?.adminId){const admin=await Admin.findById(req.session.adminId).select('role permissions isActive');allowed=Boolean(admin?.isActive&&can(await effectivePermissions(admin),'gallery.moderate'));}
  if(!allowed)throw new AppError(404,'تصویر پیدا نشد');
  res.set('Cache-Control',imageStatus==='approved'?'public, max-age=86400':'private, no-store');res.sendFile(fullPath);
}));
module.exports=router;
