const path=require('path');
const crypto=require('crypto');
const express=require('express');
const mongoose=require('mongoose');
const session=require('express-session');
const MongoStore=require('connect-mongo');
const helmet=require('helmet');
const compression=require('compression');
const env=require('./config/env');
const {ensureAdminFromEnv}=require('./services/adminAccount');
const {ensureSeedProducts}=require('./services/seed');
const {AppError}=require('./utils/http');

const app=express();
if(env.trustProxy)app.set('trust proxy',1);
app.disable('x-powered-by');
app.set('view engine','ejs');
app.set('views',path.join(__dirname,'views'));
app.use(helmet({contentSecurityPolicy:false,crossOriginEmbedderPolicy:false}));
app.use(compression());
app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:true,limit:'1mb'}));

const sessionOptions={name:'toto.sid',secret:env.sessionSecret,resave:false,saveUninitialized:false,cookie:{httpOnly:true,secure:env.isProduction,sameSite:env.cookieSameSite,maxAge:1000*60*60*24*14}};
if(env.sessionStore==='mongo'||env.isProduction)sessionOptions.store=MongoStore.create({mongoUrl:env.mongodbUri,ttl:14*24*60*60});
app.use(session(sessionOptions));
app.use((req,_res,next)=>{if(!req.session.csrfToken)req.session.csrfToken=crypto.randomBytes(24).toString('hex');next();});

app.get('/api/health',(_req,res)=>res.json({success:true,service:'toto-fashion',database:mongoose.connection.readyState===1?'connected':'disconnected'}));
app.get('/api/csrf',(req,res)=>res.json({success:true,csrfToken:req.session.csrfToken}));
app.use('/api/auth',require('./routes/auth'));
app.use('/api/products',require('./routes/products'));
app.use('/api/account',require('./routes/account'));
app.use('/api/orders',require('./routes/orders'));
app.use('/api/admin',require('./routes/admin'));
app.use('/api',require('./routes/misc'));

app.use('/src',express.static(path.join(__dirname,'src'),{maxAge:env.isProduction?'7d':0}));
app.use('/uploads',express.static(path.join(__dirname,'uploads'),{maxAge:'7d'}));
app.use(express.static(path.join(__dirname,'public'),{maxAge:env.isProduction?'1d':0}));
for(const file of ['favicon.ico','manifest.webmanifest','sitemap.xml'])app.get(`/${file}`,(req,res)=>res.sendFile(path.join(__dirname,file)));
app.use(require('./routes/pages'));
app.use((req,res,next)=>{if(req.path.startsWith('/api/'))return next(new AppError(404,'مسیر API پیدا نشد'));res.status(404).render('404');});
app.use((err,req,res,_next)=>{console.error(err);const status=Number(err.status||err.statusCode||500);const message=status>=500&&env.isProduction?'خطای داخلی سرور':(err.message||'خطای داخلی سرور');if(req.path.startsWith('/api/'))return res.status(status).json({success:false,message,details:err.details});res.status(status).send(message);});

async function start(){await mongoose.connect(env.mongodbUri);await ensureAdminFromEnv();if(env.seedOnStart)await ensureSeedProducts();app.listen(env.port,()=>console.log(`TOTO Fashion: ${env.siteUrl} (port ${env.port})`));}
start().catch(err=>{console.error('Startup failed:',err);process.exitCode=1;});
module.exports=app;
