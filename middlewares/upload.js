const fs=require('fs'); const path=require('path'); const multer=require('multer'); const {AppError}=require('../utils/http');
const dir=path.join(__dirname,'..','uploads','products'); fs.mkdirSync(dir,{recursive:true});
const extByMime={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'};
const storage=multer.diskStorage({
  destination:(_req,_file,cb)=>cb(null,dir),
  filename:(_req,file,cb)=>{const ext=extByMime[file.mimetype]; if(!ext)return cb(new AppError(400,'فرمت تصویر مجاز نیست')); cb(null,`${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);}
});
module.exports=multer({storage,limits:{fileSize:8*1024*1024,files:4},fileFilter:(_req,file,cb)=>extByMime[file.mimetype]?cb(null,true):cb(new AppError(400,'فقط JPG، PNG و WebP مجاز است'))});
