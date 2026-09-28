const express=require('express'); const crypto=require('crypto'); const rateLimit=require('express-rate-limit');
const User=require('../models/User'); const Otp=require('../models/Otp'); const env=require('../config/env');
const {sendOtpSms}=require('../services/sms'); const {asyncHandler,ok,AppError}=require('../utils/http'); const {normalizeMobile,normalizeDigits}=require('../utils/formatters'); const S=require('../services/serializers'); const {requireCsrf}=require('../middlewares/auth');
const router=express.Router();
const otpLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'تعداد درخواست کد بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید.'}});
const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const saveSession=req=>new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
const regenerate=req=>new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
router.post('/otp/request',requireCsrf,otpLimiter,asyncHandler(async(req,res)=>{
  const mobile=normalizeMobile(req.body.mobile); if(!/^09\d{9}$/.test(mobile))throw new AppError(400,'شماره موبایل معتبر نیست. شماره را با ۰۹ وارد کنید.');
  const existing=await Otp.findOne({mobile}); if(existing?.lastSentAt&&Date.now()-existing.lastSentAt.getTime()<60000)throw new AppError(429,'ارسال مجدد کد تا یک دقیقه دیگر امکان‌پذیر نیست');
  const code=String(crypto.randomInt(10000,100000)),expiresAt=new Date(Date.now()+env.otpExpiresSeconds*1000);
  await Otp.findOneAndUpdate({mobile},{codeHash:hash(code),expiresAt,attempts:0,lastSentAt:new Date()},{upsert:true,new:true,setDefaultsOnInsert:true});
  try{await sendOtpSms(mobile,code);}catch(e){await Otp.deleteOne({mobile});throw new AppError(502,`ارسال پیامک انجام نشد: ${e.message}`);}
  req.session.pendingOtpMobile=mobile; await saveSession(req);
  ok(res,{requestId:`otp-${Date.now()}`,expiresIn:env.otpExpiresSeconds,normalizedMobile:mobile,...(!env.isProduction&&!env.melipayamakSharedKey?{debugOtp:code}:{})});
}));
router.post('/otp/verify',requireCsrf,asyncHandler(async(req,res)=>{
  const mobile=normalizeMobile(req.body.mobile||req.session.pendingOtpMobile); const otp=normalizeDigits(req.body.otp||req.body.code).replace(/\D/g,'');
  if(!/^09\d{9}$/.test(mobile)||mobile!==req.session.pendingOtpMobile)throw new AppError(400,'درخواست ورود معتبر نیست؛ دوباره کد دریافت کنید');
  if(!/^\d{5}$/.test(otp))throw new AppError(400,'کد تأیید باید ۵ رقم باشد');
  const record=await Otp.findOne({mobile}).select('+codeHash'); if(!record||record.expiresAt<new Date()){if(record)await record.deleteOne();throw new AppError(400,'زمان استفاده از این کد به پایان رسیده است.');}
  if(record.attempts>=3){await record.deleteOne();throw new AppError(429,'تعداد تلاش مجاز تمام شده است؛ کد جدید دریافت کنید');}
  if(hash(otp)!==record.codeHash){record.attempts+=1;await record.save();throw new AppError(400,'کد واردشده صحیح نیست.');}
  await record.deleteOne();
  let user=await User.findOne({mobile}); if(!user)user=await User.create({mobile,fullName:'مشتری توتو'});
  if(!user.isActive)throw new AppError(403,'این حساب غیرفعال است');
  user.lastLoginAt=new Date(); await user.save();
  const adminId=req.session.adminId; await regenerate(req); if(adminId)req.session.adminId=adminId; req.session.userId=user._id.toString(); req.session.csrfToken=crypto.randomBytes(24).toString('hex'); await saveSession(req);
  ok(res,{token:'session-cookie',customer:{id:user.publicId,firstName:user.firstName||'کاربر توتو',mobile:user.mobile},user:S.user(user),loggedInAt:new Date().toISOString()});
}));
router.post('/logout',requireCsrf,asyncHandler(async(req,res)=>{delete req.session.userId;delete req.session.pendingOtpMobile;await saveSession(req);ok(res,{message:'از حساب خارج شدید'});}));
router.get('/me',asyncHandler(async(req,res)=>{if(!req.session?.userId)return ok(res,{authenticated:false,user:null});const user=await User.findById(req.session.userId);if(!user?.isActive)return ok(res,{authenticated:false,user:null});ok(res,{authenticated:true,user:S.user(user)});}));
module.exports=router;
