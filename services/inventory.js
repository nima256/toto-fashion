const Product=require('../models/Product');
const {AppError}=require('../utils/http');
async function validateAndPriceCart(cart=[]){
  if(!Array.isArray(cart)||!cart.length)throw new AppError(400,'سبد خرید خالی است');
  const ids=[...new Set(cart.map(i=>String(i.productId||'')).filter(Boolean))];
  const products=await Product.find({publicId:{$in:ids},status:'active'}),byId=new Map(products.map(p=>[p.publicId,p])),lines=[];
  for(const raw of cart){
    const product=byId.get(String(raw.productId||''));if(!product)throw new AppError(409,'یکی از محصولات دیگر در فروشگاه فعال نیست');
    const quantity=Math.max(1,Math.min(5,Number(raw.quantity||1)));if(!product.availability||product.inventory<quantity)throw new AppError(409,`موجودی «${product.name}» کافی نیست`);
    const size=String(raw.size||'');if(product.sizes.length&&!product.sizes.includes(size))throw new AppError(409,`سایز «${product.name}» معتبر نیست`);if(product.unavailableSizes.includes(size))throw new AppError(409,`سایز انتخاب‌شده «${product.name}» ناموجود است`);
    const colorIndex=Math.max(0,Math.min(Number(raw.colorIndex||0),Math.max(0,product.colorNames.length-1)));
    lines.push({product,quantity,size,colorIndex,currentPrice:product.price,previousPrice:product.previousPrice||product.price});
  }
  return lines;
}
async function applyInventory(order){
  if(order.inventoryApplied)return;
  const applied=[];
  try{
    for(const item of order.items){
      const result=await Product.findOneAndUpdate({publicId:item.productId,inventory:{$gte:item.quantity}},{$inc:{inventory:-item.quantity,sales:item.quantity}},{new:true});
      if(!result)throw new AppError(409,`موجودی ${item.name} تغییر کرده است`);
      applied.push({productId:item.productId,quantity:item.quantity});
      if(result.inventory<=0){result.inventory=0;result.availability=false;result.status='out-of-stock';await result.save();}
    }
    order.inventoryApplied=true;await order.save();
  }catch(error){
    for(const item of applied.reverse())await Product.updateOne({publicId:item.productId},{$inc:{inventory:item.quantity,sales:-item.quantity},$set:{availability:true,status:'active'}}).catch(()=>{});
    throw error;
  }
}
module.exports={validateAndPriceCart,applyInventory};
