const path=require('path');
const crypto=require('crypto');
const express=require('express');
const mongoose=require('mongoose');
const session=require('express-session');
const MongoStore=require('connect-mongo');
const helmet=require('helmet');
const compression=require('compression');
const multer=require('multer');
const env=require('./config/env');
const {ensureAdminFromEnv}=require('./services/adminAccount');
const {ensureSeedProducts}=require('./services/seed');
const {runMigrations}=require('./services/migrations');
const {AppError}=require('./utils/http');

const app=express();
if(env.trustProxy)app.set('trust proxy',1);
app.disable('x-powered-by');
app.set('view engine','ejs');
app.set('views',path.join(__dirname,'views'));
// CSP: فقط اسکریپت‌های همین دامنه؛ بدون inline script و eval. فونت از Google Fonts.
// استایل inline فقط در قالب attribute (متغیرهای CSS مثل --swatch) مجاز است، نه تگ <style>.
app.use(helmet({
  contentSecurityPolicy:{useDefaults:false,directives:{
    defaultSrc:["'self'"],scriptSrc:["'self'"],scriptSrcAttr:["'none'"],
    styleSrc:["'self'",'https://fonts.googleapis.com',"'unsafe-inline'"],styleSrcElem:["'self'",'https://fonts.googleapis.com'],styleSrcAttr:["'unsafe-inline'"],
    fontSrc:["'self'",'https://fonts.gstatic.com','data:'],imgSrc:["'self'",'data:','blob:'],connectSrc:["'self'"],
    objectSrc:["'none'"],baseUri:["'self'"],formAction:["'self'"],frameAncestors:["'none'"],manifestSrc:["'self'"],
    ...(env.isProduction?{upgradeInsecureRequests:[]}:{})
  }},
  crossOriginEmbedderPolicy:false,
  referrerPolicy:{policy:'strict-origin-when-cross-origin'}
}));
app.use(compression());
app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:true,limit:'1mb'}));

const sessionOptions={name:'toto.sid',secret:env.sessionSecret,resave:false,saveUninitialized:false,cookie:{httpOnly:true,secure:env.isProduction,sameSite:env.cookieSameSite,maxAge:1000*60*60*24*14}};
if(env.sessionStore==='mongo'||env.isProduction)sessionOptions.store=MongoStore.create({mongoUrl:env.mongodbUri,ttl:14*24*60*60});
app.use(session(sessionOptions));
app.use((req,_res,next)=>{if(!req.session.csrfToken)req.session.csrfToken=crypto.randomBytes(24).toString('hex');next();});
app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});

app.get('/api/health',(_req,res)=>res.json({success:true,service:'toto-fashion',database:mongoose.connection.readyState===1?'connected':'disconnected'}));
app.get('/api/csrf',(req,res)=>res.json({success:true,csrfToken:req.session.csrfToken}));
app.use('/api/auth',require('./routes/auth'));
app.use('/api/products',require('./routes/products'));
app.use('/api/account',require('./routes/account'));
app.use('/api/orders',require('./routes/orders'));
app.use('/api/admin',require('./routes/admin'));
app.use('/api',require('./routes/misc'));

app.use('/src',express.static(path.join(__dirname,'src'),{maxAge:env.isProduction?'7d':0}));
// فقط تصاویر عمومی محصول/محتوا؛ تصاویر گالری و مرجوعی در storage/ و از مسیرهای کنترل‌شده سرو می‌شوند
app.use('/uploads',express.static(path.join(__dirname,'uploads'),{maxAge:'7d',setHeaders:res=>res.set('X-Content-Type-Options','nosniff')}));
app.use(express.static(path.join(__dirname,'public'),{maxAge:env.isProduction?'1d':0}));
for(const file of ['favicon.ico','manifest.webmanifest','sitemap.xml'])app.get(`/${file}`,(req,res)=>res.sendFile(path.join(__dirname,file)));
app.use(require('./routes/pages'));
app.use((req,res,next)=>{if(req.path.startsWith('/api/'))return next(new AppError(404,'مسیر API پیدا نشد'));res.status(404).render('404',{kind:'page'});});
app.use((err,req,res,_next)=>{
  let status=Number(err.status||err.statusCode||500);let message=err.message;let details=err.details;
  if(err instanceof multer.MulterError){status=400;message=err.code==='LIMIT_FILE_SIZE'?'حجم فایل بیش از حد مجاز است':err.code==='LIMIT_FILE_COUNT'||err.code==='LIMIT_UNEXPECTED_FILE'?'تعداد فایل‌ها بیش از حد مجاز است':'فایل ارسالی معتبر نیست';details=undefined;}
  else if(err.type==='entity.parse.failed'){status=400;message='بدنه درخواست JSON معتبر نیست';details=undefined;}
  else if(err.type==='entity.too.large'){status=413;message='حجم درخواست بیش از حد مجاز است';details=undefined;}
  else if(err.name==='CastError'||err.name==='ValidationError'){status=400;message='اطلاعات ارسالی معتبر نیست';details=undefined;}
  if(!Number.isInteger(status)||status<400||status>599)status=500;
  // جزئیات خطای داخلی فقط در لاگ سرور؛ پاسخ کاربر بدون stack یا اطلاعات حساس
  if(status>=500)console.error(`[error] ${req.method} ${req.originalUrl}`,err);
  if(status>=500)message=env.isProduction?'خطای داخلی سرور':(message||'خطای داخلی سرور');
  if(req.path.startsWith('/api/'))return res.status(status).json({success:false,message:message||'درخواست انجام نشد',...(details?{details}:{})});
  res.status(status).send(message);
});

async function start(){await mongoose.connect(env.mongodbUri);await ensureAdminFromEnv();if(env.seedOnStart)await ensureSeedProducts();await runMigrations();app.listen(env.port,()=>console.log(`TOTO Fashion: ${env.siteUrl} (port ${env.port})`));}
if(require.main===module||process.env.TOTO_AUTOSTART==='1')start().catch(err=>{console.error('Startup failed:',err.message);process.exitCode=1;});
module.exports=app;
module.exports.start=start;
