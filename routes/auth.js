const express=require('express'); const crypto=require('crypto'); const rateLimit=require('express-rate-limit');
const User=require('../models/User'); const Otp=require('../models/Otp'); const env=require('../config/env');
const {sendOtpSms}=require('../services/sms'); const {asyncHandler,ok,AppError}=require('../utils/http'); const {normalizeMobile,normalizeDigits}=require('../utils/formatters'); const S=require('../services/serializers'); const {requireCsrf}=require('../middlewares/auth');
const {z,validate,mobile}=require('../utils/validate');
const router=express.Router();
const otpLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'تعداد درخواست کد بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید.'}});
const verifyLimiter=rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'تعداد تلاش بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید.'}});
const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const saveSession=req=>new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
const regenerate=req=>new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
router.post('/otp/request',requireCsrf,otpLimiter,validate({body:z.object({mobile})}),asyncHandler(async(req,res)=>{
  const mobileValue=req.body.mobile;
  const existing=await Otp.findOne({mobile:mobileValue}); if(existing?.lastSentAt&&Date.now()-existing.lastSentAt.getTime()<60000)throw new AppError(429,'ارسال مجدد کد تا یک دقیقه دیگر امکان‌پذیر نیست');
  const code=String(crypto.randomInt(10000,100000)),expiresAt=new Date(Date.now()+env.otpExpiresSeconds*1000);
  await Otp.findOneAndUpdate({mobile:mobileValue},{codeHash:hash(code),expiresAt,attempts:0,lastSentAt:new Date()},{upsert:true,new:true,setDefaultsOnInsert:true});
  try{await sendOtpSms(mobileValue,code);}catch(e){await Otp.deleteOne({mobile:mobileValue});console.error('[otp] sms failed',e.message);throw new AppError(502,'ارسال پیامک انجام نشد؛ کمی بعد دوباره تلاش کنید');}
  req.session.pendingOtpMobile=mobileValue; await saveSession(req);
  // کد آزمایشی فقط در محیط توسعه و بدون سرویس پیامک واقعی برگردانده می‌شود
  ok(res,{requestId:`otp-${Date.now()}`,expiresIn:env.otpExpiresSeconds,normalizedMobile:mobileValue,...(!env.isProduction&&!env.melipayamakSharedKey?{debugOtp:code}:{})});
}));
router.post('/otp/verify',requireCsrf,verifyLimiter,validate({body:z.object({mobile:z.string().max(20).optional(),otp:z.string().max(10).optional(),code:z.string().max(10).optional()})}),asyncHandler(async(req,res)=>{
  const mobileValue=normalizeMobile(req.body.mobile||req.session.pendingOtpMobile); const otp=normalizeDigits(req.body.otp||req.body.code||'').replace(/\D/g,'');
  if(!/^09\d{9}$/.test(mobileValue)||mobileValue!==req.session.pendingOtpMobile)throw new AppError(400,'درخواست ورود معتبر نیست؛ دوباره کد دریافت کنید');
  if(!/^\d{5}$/.test(otp))throw new AppError(400,'کد تأیید باید ۵ رقم باشد');
  const record=await Otp.findOne({mobile:mobileValue}).select('+codeHash'); if(!record||record.expiresAt<new Date()){if(record)await record.deleteOne();throw new AppError(400,'زمان استفاده از این کد به پایان رسیده است.');}
  if(record.attempts>=3){await record.deleteOne();throw new AppError(429,'تعداد تلاش مجاز تمام شده است؛ کد جدید دریافت کنید');}
  if(!crypto.timingSafeEqual(Buffer.from(hash(otp)),Buffer.from(record.codeHash))){record.attempts+=1;await record.save();throw new AppError(400,'کد واردشده صحیح نیست.');}
  await record.deleteOne();
  let user=await User.findOne({mobile:mobileValue}); if(!user)user=await User.create({mobile:mobileValue,fullName:'مشتری توتو'});
  if(!user.isActive)throw new AppError(403,'این حساب غیرفعال است');
  user.lastLoginAt=new Date(); await user.save();
  const {adminId,orderAccess}=req.session; await regenerate(req); if(adminId)req.session.adminId=adminId; if(orderAccess)req.session.orderAccess=orderAccess; req.session.userId=user._id.toString(); req.session.csrfToken=crypto.randomBytes(24).toString('hex'); await saveSession(req);
  ok(res,{authenticated:true,customer:{id:user.publicId,firstName:user.firstName||'کاربر توتو',mobile:user.mobile},user:S.user(user),csrfToken:req.session.csrfToken,loggedInAt:new Date().toISOString()});
}));
// خروج: شناسه نشست عوض می‌شود تا نشست قبلی قابل استفاده نباشد؛ ورود مدیر (در صورت وجود) حفظ می‌شود
router.post('/logout',requireCsrf,asyncHandler(async(req,res)=>{const {adminId}=req.session;await regenerate(req);if(adminId)req.session.adminId=adminId;req.session.csrfToken=crypto.randomBytes(24).toString('hex');await saveSession(req);ok(res,{authenticated:false,csrfToken:req.session.csrfToken,message:'از حساب خارج شدید'});}));
router.get('/me',asyncHandler(async(req,res)=>{res.set('Cache-Control','no-store');if(!req.session?.userId)return ok(res,{authenticated:false,user:null});const user=await User.findById(req.session.userId);if(!user?.isActive){delete req.session.userId;return ok(res,{authenticated:false,user:null});}ok(res,{authenticated:true,user:S.user(user),customer:{id:user.publicId,firstName:user.firstName||'کاربر توتو',mobile:user.mobile}});}));
module.exports=router;
