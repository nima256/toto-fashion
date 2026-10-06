const express=require('express'); const rateLimit=require('express-rate-limit');
const Product=require('../models/Product'); const Order=require('../models/Order'); const User=require('../models/User'); const Review=require('../models/Review'); const ProductQuestion=require('../models/ProductQuestion');
const {asyncHandler,ok,AppError}=require('../utils/http'); const S=require('../services/serializers'); const {escapeRegex}=require('../utils/formatters');
const {requireUser,requireCsrf}=require('../middlewares/auth'); const {z,validate,text,int,publicId}=require('../utils/validate');
const router=express.Router();
const VISIBLE={$in:['active','out-of-stock']};
const writeLimiter=rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد تلاش کنید.'}});

// جست‌وجو: ورودی محدود و escape می‌شود تا Regex مخرب یا سنگین ساخته نشود
const listQuery=z.object({q:z.string().trim().max(64,'عبارت جست‌وجو حداکثر ۶۴ نویسه است').optional().default('')}).passthrough();
router.get('/',validate({query:listQuery}),asyncHandler(async(req,res)=>{
  const q=req.valid.query.q.replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim(); const filter={status:VISIBLE};
  if(q){const pattern=escapeRegex(q);filter.$or=['name','category','type','style','fabric'].map(field=>({[field]:{$regex:pattern,$options:'i'}}));}
  const products=await Product.find(filter).sort({popularity:-1,createdAt:-1}).limit(500);
  ok(res,{products:products.map(p=>S.product(p))});
}));

const idParams=z.object({id:publicId});
router.get('/:id',validate({params:idParams}),asyncHandler(async(req,res)=>{
  const product=await Product.findOne({publicId:req.params.id,status:VISIBLE});
  if(!product)throw new AppError(404,'محصول پیدا نشد');
  await Product.updateOne({_id:product._id},{$inc:{views:1}});
  ok(res,{product:S.product(product)});
}));

router.get('/:id/feedback',validate({params:idParams}),asyncHandler(async(req,res)=>{
  const [reviews,questions,stats]=await Promise.all([
    Review.find({productId:req.params.id,status:'approved'}).sort({createdAt:-1}).limit(50),
    ProductQuestion.find({productId:req.params.id,status:'answered'}).sort({answeredAt:-1}).limit(50),
    Review.aggregate([{$match:{productId:req.params.id,status:'approved'}},{$group:{_id:null,count:{$sum:1},average:{$avg:'$rating'}}}])
  ]);
  ok(res,{reviews:reviews.map(S.review),questions:questions.map(S.question),summary:{count:stats[0]?.count||0,average:stats[0]?Number(stats[0].average.toFixed(1)):0}});
}));

const displayNameOf=user=>(user?.firstName?`${user.firstName}${user.lastName?` ${user.lastName.slice(0,1)}.`:''}`:'خریدار توتو');
router.post('/:id/reviews',requireUser,requireCsrf,writeLimiter,validate({params:idParams,body:z.object({rating:int({min:1,max:5}),body:text(1000,{min:10,message:'متن دیدگاه حداقل ۱۰ نویسه است'})})}),asyncHandler(async(req,res)=>{
  const product=await Product.findOne({publicId:req.params.id,status:VISIBLE}).select('publicId');if(!product)throw new AppError(404,'محصول پیدا نشد');
  // فقط خریدارانی که سفارش تحویل‌شده از همین محصول دارند
  const order=await Order.findOne({user:req.session.userId,status:'delivered','items.productId':product.publicId}).select('orderNumber');
  if(!order)throw new AppError(403,'ثبت دیدگاه پس از تحویل سفارش این محصول امکان‌پذیر است');
  const user=await User.findById(req.session.userId).select('firstName lastName');
  try{const review=await Review.create({user:req.session.userId,productId:product.publicId,displayName:displayNameOf(user),rating:req.body.rating,body:req.body.body,orderNumber:order.orderNumber});ok(res,{review:S.review(review),message:'دیدگاه شما ثبت شد و پس از بررسی منتشر می‌شود.'},201);}
  catch(error){if(error?.code===11000)throw new AppError(409,'شما قبلاً برای این محصول دیدگاه ثبت کرده‌اید');throw error;}
}));
router.post('/:id/questions',requireUser,requireCsrf,writeLimiter,validate({params:idParams,body:z.object({question:text(500,{min:5,message:'متن پرسش حداقل ۵ نویسه است'})})}),asyncHandler(async(req,res)=>{
  const product=await Product.findOne({publicId:req.params.id,status:VISIBLE}).select('publicId');if(!product)throw new AppError(404,'محصول پیدا نشد');
  const pending=await ProductQuestion.countDocuments({user:req.session.userId,productId:product.publicId,status:'pending'});
  if(pending>=3)throw new AppError(429,'پرسش‌های قبلی شما برای این محصول هنوز در انتظار پاسخ است');
  const user=await User.findById(req.session.userId).select('firstName lastName');
  const question=await ProductQuestion.create({user:req.session.userId,productId:product.publicId,displayName:displayNameOf(user),question:req.body.question});
  ok(res,{question:S.question(question),message:'پرسش شما ثبت شد و پس از پاسخ کارشناس نمایش داده می‌شود.'},201);
}));
module.exports=router;
