const express=require('express'); const Product=require('../models/Product'); const {asyncHandler,ok,AppError}=require('../utils/http'); const S=require('../services/serializers');
const router=express.Router();
router.get('/',asyncHandler(async(req,res)=>{
  const q=String(req.query.q||'').trim(); const filter={status:'active'};
  if(q)filter.$or=[{name:{$regex:q,$options:'i'}},{category:{$regex:q,$options:'i'}},{type:{$regex:q,$options:'i'}}];
  const products=await Product.find(filter).sort({popularity:-1,createdAt:-1});
  ok(res,{products:products.map(S.product)});
}));
router.get('/:id',asyncHandler(async(req,res)=>{
  const product=await Product.findOne({publicId:req.params.id,status:'active'});
  if(!product)throw new AppError(404,'محصول پیدا نشد');
  await Product.updateOne({_id:product._id},{$inc:{views:1}});
  ok(res,{product:S.product(product)});
}));
module.exports=router;
