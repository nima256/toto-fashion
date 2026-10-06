const mongoose=require('mongoose');
const Product=require('../models/Product');
const Order=require('../models/Order');
const {AppError}=require('../utils/http');

const ONE_SIZE='تک‌سایز';
const keyOf=(color,size)=>`${color||''}\u0000${size||''}`;

// برای محصولات قدیمی که فقط موجودی کلی دارند، تنوع‌های رنگ×سایز ساخته و موجودی به‌طور مساوی تقسیم می‌شود
function buildDefaultVariants(product,total=Number(product.inventory||0)){
  const colors=(product.colorNames||[]).length?product.colorNames:[''];
  const unavailable=new Set(product.unavailableSizes||[]);
  const sizes=(product.sizes||[]).length?product.sizes:[''];
  const combos=[];
  for(const color of colors)for(const size of sizes)combos.push({color,size,sellable:!unavailable.has(size)});
  const sellable=combos.filter(c=>c.sellable);
  const base=sellable.length?Math.floor(total/sellable.length):0;let remainder=sellable.length?total-base*sellable.length:0;
  return combos.map((combo,index)=>{let stock=0;if(combo.sellable){stock=base+(remainder>0?1:0);if(remainder>0)remainder-=1;}return{sku:`${product.sku||'TOTO'}-${index+1}`,color:combo.color,size:combo.size,stock};});
}

// تنوع‌ها را با فهرست رنگ/سایز محصول هم‌گام می‌کند و موجودی ترکیب‌های موجود را حفظ می‌کند
function syncVariants(product,stockMap=null){
  const existing=new Map((product.variants||[]).map(v=>[keyOf(v.color,v.size),v]));
  const colors=(product.colorNames||[]).length?product.colorNames:[''];
  const sizes=(product.sizes||[]).length?product.sizes:[''];
  const next=[];let index=0;
  for(const color of colors)for(const size of sizes){
    index+=1;const key=keyOf(color,size);const old=existing.get(key);
    const stock=stockMap&&stockMap.has(key)?stockMap.get(key):(old?old.stock:0);
    next.push({...(old?.toObject?old.toObject():old||{}),sku:old?.sku||`${product.sku||'TOTO'}-${index}`,color,size,stock:Math.max(0,Math.floor(Number(stock)||0))});
  }
  product.variants=next;
  return product;
}

function resolveLine(product,raw){
  const colorIndex=Number.isInteger(raw.colorIndex)?raw.colorIndex:0;
  const colorCount=(product.colorNames||[]).length;
  if(colorCount&&(colorIndex<0||colorIndex>=colorCount))throw new AppError(409,`رنگ انتخاب‌شده برای «${product.name}» معتبر نیست`);
  const color=colorCount?product.colorNames[colorIndex]:'';
  let size=String(raw.size||'').trim();
  if(!(product.sizes||[]).length){if(size&&size!==ONE_SIZE)throw new AppError(409,`سایز «${product.name}» معتبر نیست`);size='';}
  else if(!product.sizes.includes(size))throw new AppError(409,`سایز «${product.name}» معتبر نیست`);
  return{color,colorIndex,size};
}

// lenient=true: به‌جای توقف روی اولین مشکل، اقلام مشکل‌دار را در problems برمی‌گرداند (برای نمایش سبد)
async function validateAndPriceCart(cart=[],{lenient=false}={}){
  if(!Array.isArray(cart)||!cart.length)throw new AppError(400,'سبد خرید خالی است');
  const ids=[...new Set(cart.map(i=>String(i.productId||'')).filter(Boolean))];
  const products=await Product.find({publicId:{$in:ids},status:{$in:['active','out-of-stock']}});
  const byId=new Map(products.map(p=>[p.publicId,p]));const lines=[];const demand=new Map();
  const problems=[];
  for(const raw of cart){
   try{
    const product=byId.get(String(raw.productId||''));if(!product||product.status==='draft')throw new AppError(409,'یکی از محصولات دیگر در فروشگاه فعال نیست',{productId:raw.productId});
    const quantity=raw.quantity;if(!Number.isInteger(quantity)||quantity<1||quantity>5)throw new AppError(400,'تعداد هر محصول باید بین ۱ تا ۵ باشد');
    const {color,colorIndex,size}=resolveLine(product,raw);
    const variant=product.variants?.length?product.findVariant(color,size):null;
    if(product.variants?.length&&!variant)throw new AppError(409,`ترکیب رنگ و سایز «${product.name}» موجود نیست`,{productId:product.publicId});
    const demandKey=`${product.publicId}\u0000${keyOf(color,size)}`;const needed=(demand.get(demandKey)||0)+quantity;demand.set(demandKey,needed);
    const available=variant?variant.stock:product.inventory;
    if(product.status!=='active'||available<needed)throw new AppError(409,`موجودی «${product.name}»${color?` رنگ ${color}`:''}${size?` سایز ${size}`:''} کافی نیست`,{productId:product.publicId,color,size,available});
    lines.push({product,quantity,size,color,colorIndex,variantId:variant?String(variant._id):'',available,currentPrice:product.price,previousPrice:product.previousPrice||product.price});
   }catch(error){
    if(!lenient||!(error instanceof AppError))throw error;
    problems.push({productId:String(raw.productId||''),size:String(raw.size||''),colorIndex:raw.colorIndex,message:error.message,available:error.details?.available??0});
   }
  }
  lines.problems=problems;
  return lines;
}

let transactionSupport=null;
async function supportsTransactions(){
  if(transactionSupport!==null)return transactionSupport;
  try{const hello=await mongoose.connection.db.admin().command({hello:1});transactionSupport=Boolean(hello.setName||hello.msg==='isdbgrid');}
  catch{transactionSupport=false;}
  return transactionSupport;
}

async function changeLine(item,direction,session){
  const qty=Number(item.quantity)*direction;const color=item.color||'',size=item.size||'';
  const product=await Product.findOne({publicId:item.productId}).select('variants').session(session||null).lean();
  if(!product)return false;
  if(product.variants?.length){
    const filter={publicId:item.productId,variants:{$elemMatch:{color,size,...(direction<0?{stock:{$gte:item.quantity}}:{})}}};
    const result=await Product.updateOne(filter,{$inc:{'variants.$[v].stock':qty,inventory:qty,sales:-qty}},{session,arrayFilters:[{'v.color':color,'v.size':size}]});
    return result.modifiedCount===1;
  }
  const result=await Product.updateOne({publicId:item.productId,...(direction<0?{inventory:{$gte:item.quantity}}:{})},{$inc:{inventory:qty,sales:-qty}},{session});
  return result.modifiedCount===1;
}
async function markSoldOut(ids,session){await Product.updateMany({publicId:{$in:ids},inventory:{$lte:0},status:'active'},{$set:{status:'out-of-stock',availability:false,inventory:0}},{session});}

// کسر موجودی یک سفارش؛ اتمیک (تراکنش در Replica Set) و idempotent (فقط یک‌بار برای هر سفارش)
async function applyInventory(orderOrId,{retryFailed=false}={}){
  const orderId=orderOrId?._id||orderOrId;
  const claimable=retryFailed?['pending','failed']:['pending'];
  const order=await Order.findById(orderId);if(!order)throw new AppError(404,'سفارش پیدا نشد');
  if(order.inventoryState==='applied'||order.inventoryApplied)return{applied:false,reason:'already-applied'};
  if(!claimable.includes(order.inventoryState))return{applied:false,reason:order.inventoryState};
  const ids=[...new Set(order.items.map(i=>i.productId))];
  if(await supportsTransactions()){
    const session=await mongoose.startSession();let outcome={applied:true};
    try{
      await session.withTransaction(async()=>{
        outcome={applied:true};
        const claim=await Order.updateOne({_id:orderId,inventoryState:{$in:claimable}},{$set:{inventoryState:'applied',inventoryApplied:true}},{session});
        if(!claim.modifiedCount){outcome={applied:false,reason:'already-applied'};return;}
        for(const item of order.items)if(!(await changeLine(item,-1,session)))throw new AppError(409,`موجودی «${item.name}»${item.size?` سایز ${item.size}`:''} تغییر کرده است`);
        await markSoldOut(ids,session);
      });
    }catch(error){
      // تراکنش برگشت خورده و هیچ موجودی کسر نشده؛ وضعیت failed تا تلاش دوباره فقط توسط مدیر انجام شود
      await Order.updateOne({_id:orderId,inventoryState:{$in:claimable}},{$set:{inventoryState:'failed'}});
      throw error;
    }finally{await session.endSession();}
    return outcome;
  }
  // حالت بدون تراکنش (MongoDB تک‌نود): ادعای اتمیک سفارش + جبران کنترل‌شده در صورت خطا
  const claimed=await Order.findOneAndUpdate({_id:orderId,inventoryState:{$in:claimable}},{$set:{inventoryState:'applying'}},{new:true});
  if(!claimed)return{applied:false,reason:'already-applied'};
  const applied=[];
  try{
    for(const item of claimed.items){if(!(await changeLine(item,-1)))throw new AppError(409,`موجودی «${item.name}»${item.size?` سایز ${item.size}`:''} تغییر کرده است`);applied.push(item);}
    await markSoldOut(ids);
    await Order.updateOne({_id:orderId},{$set:{inventoryState:'applied',inventoryApplied:true}});
    return{applied:true};
  }catch(error){
    const rollbackFailures=[];
    for(const item of applied.reverse()){try{if(!(await changeLine(item,1)))rollbackFailures.push(item.productId);}catch(rollbackError){rollbackFailures.push(item.productId);console.error('[inventory] rollback failed',item.productId,rollbackError.message);}}
    await Order.updateOne({_id:orderId},{$set:{inventoryState:'failed'}});
    if(rollbackFailures.length){
      await Order.updateOne({_id:orderId},{$set:{needsReview:true},$push:{reviewNotes:`بازگردانی موجودی برای ${rollbackFailures.join('، ')} انجام نشد؛ موجودی دستی بررسی شود.`}});
      console.error('[inventory] manual review required for order',claimed.orderNumber,rollbackFailures);
    }
    throw error;
  }
}

module.exports={ONE_SIZE,keyOf,buildDefaultVariants,syncVariants,validateAndPriceCart,applyInventory,supportsTransactions};
