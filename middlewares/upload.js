const fs=require('fs'); const path=require('path'); const crypto=require('crypto'); const multer=require('multer'); const {AppError}=require('../utils/http');
const root=path.join(__dirname,'..');
// uploads/* به‌صورت عمومی سرو می‌شود؛ storage/* خصوصی است و فقط از مسیرهای کنترل‌شده API قابل دریافت است
const DIRS={products:path.join(root,'uploads','products'),content:path.join(root,'uploads','content'),gallery:path.join(root,'storage','gallery'),returns:path.join(root,'storage','returns')};
for(const dir of Object.values(DIRS))fs.mkdirSync(dir,{recursive:true});
const extByMime={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'};

function makeUploader(kind,{maxSize=8*1024*1024,maxFiles=4}={}){
  const storage=multer.diskStorage({
    destination:(_req,_file,cb)=>cb(null,DIRS[kind]),
    filename:(_req,file,cb)=>{const ext=extByMime[file.mimetype];if(!ext)return cb(new AppError(400,'فرمت تصویر مجاز نیست'));cb(null,`${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);}
  });
  return multer({storage,limits:{fileSize:maxSize,files:maxFiles,fields:30,fieldSize:20*1024},fileFilter:(_req,file,cb)=>extByMime[file.mimetype]?cb(null,true):cb(new AppError(400,'فقط JPG، PNG و WebP مجاز است'))});
}

// بررسی امضای واقعی فایل؛ نوع اعلام‌شده توسط مرورگر قابل اعتماد نیست
function detectImageType(buffer){
  if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return 'image/jpeg';
  if(buffer.length>=8&&buffer.slice(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return 'image/png';
  if(buffer.length>=12&&buffer.slice(0,4).toString('ascii')==='RIFF'&&buffer.slice(8,12).toString('ascii')==='WEBP')return 'image/webp';
  return '';
}
const collectFiles=req=>[...(req.file?[req.file]:[]),...(Array.isArray(req.files)?req.files:Object.values(req.files||{}).flat())];
async function removeUploaded(req){await Promise.all(collectFiles(req).map(file=>fs.promises.unlink(file.path).catch(()=>{})));}
async function verifyImages(req,_res,next){
  try{
    for(const file of collectFiles(req)){
      const handle=await fs.promises.open(file.path,'r');const buffer=Buffer.alloc(12);await handle.read(buffer,0,12,0);await handle.close();
      if(detectImageType(buffer)!==file.mimetype){await removeUploaded(req);return next(new AppError(400,'محتوای فایل با فرمت تصویر مطابقت ندارد'));}
    }
    next();
  }catch(error){await removeUploaded(req);next(error);}
}
// نام فایل فقط از الگوی تولیدشده توسط سرور پذیرفته می‌شود (جلوگیری از Path Traversal)
const safeStoredName=name=>/^\d+-[a-f0-9]{16}\.(?:jpg|png|webp)$/.test(String(name||''));
const privatePath=(kind,name)=>safeStoredName(name)?path.join(DIRS[kind],name):null;

const productUpload=makeUploader('products');
module.exports=productUpload;
module.exports.makeUploader=makeUploader;
module.exports.verifyImages=verifyImages;
module.exports.removeUploaded=removeUploaded;
module.exports.privatePath=privatePath;
module.exports.DIRS=DIRS;
