const {faDate,faDateTime,faLongDate}=require('../utils/formatters');
const STATUS_LABELS={registered:'ثبت‌شده','awaiting-payment':'در انتظار پرداخت',paid:'پرداخت‌شده',processing:'در حال پردازش',ready:'آماده ارسال',shipped:'ارسال‌شده',delivered:'تحویل‌شده',cancelled:'لغوشده',returned:'مرجوع‌شده','payment-failed':'پرداخت ناموفق'};
const RETURN_STATUS_LABELS={received:'در انتظار بررسی',reviewing:'در حال بررسی',approved:'تأییدشده','awaiting-item':'در انتظار دریافت کالا','replacement-processing':'در حال آماده‌سازی جایگزین',refunded:'بازپرداخت‌شده',rejected:'ردشده',completed:'تکمیل‌شده'};
const OPEN_RETURN_STATUSES=['received','reviewing','approved','awaiting-item','replacement-processing'];
const RETURN_TYPE_LABELS={exchange:'تعویض سایز',return:'مرجوعی محصول',damaged:'گزارش آسیب‌دیدگی'};
const RESOLUTION_LABELS={exchange:'تعویض کالا یا سایز',wallet:'بازگشت اعتبار به کیف پول توتو',refund:'بازپرداخت وجه'};
const plain=doc=>doc?.toObject?doc.toObject():doc;

function variantView(product){
  const colorNames=product.colorNames||[];
  return (product.variants||[]).map(v=>({id:String(v._id||''),sku:v.sku||'',color:v.color||'',colorIndex:Math.max(0,colorNames.indexOf(v.color||'')),size:v.size||'',stock:Number(v.stock||0),available:Number(v.stock||0)>0}));
}
// options.admin=true فیلدهای عملیاتی (فروش، بازدید، موجودی دقیق) را هم برمی‌گرداند
function product(p,options={}){
  const v=plain(p);const variants=variantView(v);
  const inventory=variants.length?variants.reduce((s,x)=>s+x.stock,0):Number(v.inventory||0);
  const sizes=v.sizes||[];
  const unavailableSizes=variants.length?sizes.filter(size=>!variants.some(x=>x.size===size&&x.stock>0)):(v.unavailableSizes||[]);
  const base={id:v.publicId,sku:v.sku,name:v.name,category:v.category,type:v.type,price:v.price,previousPrice:v.previousPrice||null,discount:v.discount||null,badge:v.badge||'',badgeType:v.badgeType||'',stockNote:v.stockNote||'',colors:v.colors||[],colorNames:v.colorNames||[],sizes,unavailableSizes,
    // موجودی دقیق به فروشگاه داده نمی‌شود؛ فقط وضعیت موجود/ناموجود هر ترکیب
    variants:variants.map(x=>({id:x.id,color:x.color,colorIndex:x.colorIndex,size:x.size,available:x.available,...(options.admin?{stock:x.stock,sku:x.sku}:{lowStock:x.stock>0&&x.stock<=2})})),
    fabric:v.fabric||'',season:v.season||'',style:v.style||'',occasion:v.occasion||'',fit:v.fit||'',availability:Boolean(v.status==='active'&&inventory>0),isNew:Boolean(v.isNew),bestSeller:Boolean(v.bestSeller),rating:Number(v.rating||0),reviewCount:Number(v.reviewCount||0),image:v.image,secondaryImage:v.secondaryImage||v.image,imageAlt:v.imageAlt||v.name,popularity:Number(v.popularity||0),status:v.status||'active',seoTitle:v.seoTitle||'',description:v.description||'',createdAt:v.createdAt};
  if(!options.admin)return base;
  return{...base,inventory,variantCount:variants.length,variantsInStock:variants.filter(x=>x.available).length,lowStockVariants:variants.filter(x=>x.stock<5).length,sales:Number(v.sales||0),views:Number(v.views||0),conversion:Number(v.conversion||0),updatedAt:v.updatedAt};
}
const adminProduct=p=>product(p,{admin:true});

const notificationPrefs=n=>({orderSms:n?.sms!==false,campaignSms:n?.offers!==false,stockSms:n?.restock!==false,loyaltySms:n?.loyaltySms!==false,emailMagazine:Boolean(n?.emailMagazine)});
function user(u){const v=plain(u);return{id:v.publicId,firstName:v.firstName||'',lastName:v.lastName||'',fullName:v.fullName||'',mobile:v.mobile,email:v.email||'',birthday:v.birthday||'',gender:v.gender||'',isActive:v.isActive,addresses:(v.addresses||[]).map(a=>{const x=plain(a);return{id:x.publicId||String(x._id||''),title:x.title||'آدرس من',firstName:x.firstName||'',lastName:x.lastName||'',mobile:x.mobile||'',province:x.province||'',city:x.city||'',postalCode:x.postalCode||'',buildingNumber:x.buildingNumber||'',unit:x.unit||'',address:x.address||'',isDefault:Boolean(x.isDefault)}}),notifications:notificationPrefs(v.notifications),savedProducts:v.savedProducts||[],loyalty:{points:Number(v.loyalty?.points||0),lifetimePoints:Number(v.loyalty?.lifetimePoints||0)},createdAt:v.createdAt};}

const itemView=i=>({productId:i.productId,name:i.name,image:i.image,category:i.category||'',color:i.color||'',colorIndex:Number(i.colorIndex||0),size:i.size||'',quantity:Number(i.quantity||1),price:Number(i.price||0),previousPrice:Number(i.previousPrice||i.price||0),lineTotal:Number(i.price||0)*Number(i.quantity||1),variantId:i.variantId||'',returnEligible:i.returnEligible!==false});
// نمای کامل سفارش: فقط برای مالک حساب، سازنده همان نشست یا مدیر
function order(o){const v=plain(o);const pickup=v.shippingMethod?.id==='pickup';return{id:String(v._id||v.orderNumber),orderNumber:v.orderNumber,placedAt:faDate(v.createdAt),placedAtIso:v.createdAt,status:v.status,statusLabel:STATUS_LABELS[v.status]||v.status,total:Number(v.total||0),subtotal:Number(v.subtotal||0),productDiscount:Number(v.productDiscount||0),couponDiscount:Number(v.couponDiscount||0),couponCode:v.couponCode||'',discount:Number(v.discount||0),shipping:Number(v.shipping||0),trackingCode:v.trackingCode||'',paymentTrackingCode:v.paymentInfo?.refId||'',paymentMethod:v.paymentMethod||'درگاه پرداخت اینترنتی',deliveryEstimate:v.deliveryEstimate||v.shippingMethod?.eta||'',carrier:v.carrier||v.shippingMethod?.title||'',shippingMethod:{id:v.shippingMethod?.id||'',title:v.shippingMethod?.title||'',eta:v.shippingMethod?.eta||''},isPickup:pickup,mobile:v.mobile,customerName:v.customerName,customer:v.customerName,address:v.address,customerNote:v.customerNote||'',items:(v.items||[]).map(itemView),timeline:(v.timeline||[]).map(t=>({status:t.status,label:t.label,date:t.date,detail:t.detail||''})),paymentStatus:v.paymentStatus,createdAt:v.createdAt,dateTime:faDateTime(v.createdAt),deliveredAt:v.deliveredAt||null};}
// نمای مدیر: علاوه بر نمای کامل، یادداشت‌ها و وضعیت عملیات پس از پرداخت
// نمای مدیر: همه جزئیات سفارش شامل نشانی تفکیک‌شده، حساب مشتری، اطلاعات پرداخت و تنوع اقلام
function adminOrder(o,{skuByVariant=null}={}){
  const v=plain(o);const base=order(v);const a=v.addressSnapshot||{};const u=v.user&&typeof v.user==='object'&&v.user.mobile?v.user:null;
  return{...base,
    items:base.items.map(item=>({...item,variantSku:skuByVariant?.get(item.variantId)||''})),
    shippingAddress:{firstName:a.firstName||'',lastName:a.lastName||'',mobile:a.mobile||v.mobile,province:a.province||'',city:a.city||'',postalCode:a.postalCode||'',buildingNumber:a.buildingNumber||'',unit:a.unit||'',address:a.address||''},
    customerAccount:u?{id:u.publicId,fullName:u.fullName||'',mobile:u.mobile,email:u.email||'',joinedAt:u.createdAt?faDate(u.createdAt):''}:null,
    email:v.email||'',payment:{provider:v.paymentInfo?.provider||'',refId:v.paymentInfo?.refId||'',paidAt:v.paymentInfo?.paidAt?faDateTime(v.paymentInfo.paidAt):'',failedAt:v.paymentInfo?.failedAt?faDateTime(v.paymentInfo.failedAt):''},
    shippingPrice:Number(v.shippingMethod?.price??v.shipping??0),
    adminNote:v.adminNote||'',needsReview:Boolean(v.needsReview),reviewNotes:v.reviewNotes||[],inventoryState:v.inventoryState||(v.inventoryApplied?'applied':'pending'),loyaltyState:v.loyaltyState||'pending',loyaltyPoints:Number(v.loyaltyPoints||0),couponState:v.couponState||'none',userId:v.user?String(v.user._id||v.user):null,updatedAt:v.updatedAt?faDateTime(v.updatedAt):''};
}
/**
 * نمای عمومی پیگیری سفارش (مهمان یا هر کسی که شماره سفارش و موبایل را دارد).
 * بدون نام، نشانی، موبایل یا مبالغ؛ فقط وضعیت و اقلام (نام، تصویر، رنگ، سایز، تعداد) برای شناسایی مرسوله.
 */
const PUBLIC_TIMELINE_DETAIL={registered:'سفارش ثبت شد.',paid:'پرداخت تأیید شد.',processing:'سفارش در حال آماده‌سازی است.',ready:'سفارش آماده ارسال است.',shipped:'مرسوله تحویل شرکت حمل شد.',delivered:'سفارش تحویل شد.',cancelled:'سفارش لغو شد.',returned:'مرجوعی سفارش ثبت شد.','payment-failed':'پرداخت تکمیل نشد.'};
function publicOrder(o){const v=plain(o);return{orderNumber:v.orderNumber,placedAt:faDate(v.createdAt),status:v.status,statusLabel:STATUS_LABELS[v.status]||v.status,paymentStatus:v.paymentStatus==='paid'?'paid':v.paymentStatus==='failed'?'failed':'pending',itemCount:(v.items||[]).reduce((s,i)=>s+Number(i.quantity||1),0),items:(v.items||[]).map(i=>({productId:i.productId,name:i.name,image:i.image,color:i.color||'',size:i.size||'',quantity:Number(i.quantity||1)})),shippingMethod:v.shippingMethod?.title||'',isPickup:v.shippingMethod?.id==='pickup',carrier:v.carrier||'',trackingCode:v.trackingCode||'',deliveryEstimate:v.deliveryEstimate||'',timeline:(v.timeline||[]).map(t=>({status:t.status,label:t.label,date:t.date,detail:PUBLIC_TIMELINE_DETAIL[t.status]||''}))};}

// نمای مشتری از درخواست مرجوعی (فقط برای صاحب درخواست؛ یادداشت داخلی مدیر نمایش داده نمی‌شود)
function returnRequest(r){const v=plain(r);return{id:v.publicId,orderId:String(v.order?._id||v.order),orderNumber:v.orderNumber,productId:v.productId,productName:v.item?.name||'',image:v.item?.image||'',color:v.item?.color||'',size:v.item?.size||'',quantity:Number(v.item?.quantity||1),type:v.requestType,typeLabel:RETURN_TYPE_LABELS[v.requestType]||v.requestType,reasonCode:v.reasonCode,reason:v.reason,note:v.note||'',exchangeSize:v.exchangeSize||'',exchangeColor:v.exchangeColor||'',resolution:v.resolution,resolutionLabel:RESOLUTION_LABELS[v.resolution]||v.resolution,images:(v.images||[]).map(img=>({filename:img.filename,url:`/api/account/returns/${encodeURIComponent(v.publicId)}/images/${encodeURIComponent(img.filename)}`})),status:v.status,statusLabel:RETURN_STATUS_LABELS[v.status]||v.status,isOpen:OPEN_RETURN_STATUSES.includes(v.status),customerMessage:v.customerMessage||'',history:(v.history||[]).map(h=>({status:h.status,statusLabel:RETURN_STATUS_LABELS[h.status]||h.status,at:faDateTime(h.at)})),createdAt:faLongDate(v.createdAt),createdAtIso:v.createdAt,updatedAt:v.updatedAt?faDateTime(v.updatedAt):''};}
// نمای مدیر: هویت و اطلاعات تماس از حساب کاربر و خود سفارش (منبع معتبر سرور)، نه از ورودی مشتری
const adminReturn=r=>{const v=plain(r);const base=returnRequest(v);const u=v.user&&typeof v.user==='object'?v.user:null;const o=v.order&&typeof v.order==='object'?v.order:null;const a=o?.addressSnapshot||{};
  return{...base,orderId:o?String(o._id):base.orderId,adminNote:v.adminNote||'',
    images:(v.images||[]).map(img=>({filename:img.filename,url:`/api/admin/returns/${encodeURIComponent(v.publicId)}/images/${encodeURIComponent(img.filename)}`})),
    history:(v.history||[]).map(h=>({status:h.status,statusLabel:RETURN_STATUS_LABELS[h.status]||h.status,note:h.note||'',at:faDateTime(h.at)})),
    customer:u?{id:u.publicId,fullName:u.fullName||`${u.firstName||''} ${u.lastName||''}`.trim()||'مشتری توتو',mobile:u.mobile,email:u.email||'',isActive:u.isActive!==false}:null,
    order:o?{id:String(o._id),orderNumber:o.orderNumber,placedAt:faDate(o.createdAt),status:o.status,statusLabel:STATUS_LABELS[o.status]||o.status,recipientName:o.customerName,recipientMobile:o.mobile,email:o.email||'',address:o.address,postalCode:a.postalCode||'',shippingMethod:o.shippingMethod?.title||'',belongsToCustomer:Boolean(u&&o.user&&String(o.user)===String(u._id))}:null};};
const galleryImageUrl=filename=>`/api/gallery/images/${encodeURIComponent(filename||'')}`;
const galleryImages=v=>(v.images?.length?v.images:(v.image?.filename?[{_id:'legacy',filename:v.image.filename,status:v.status,rejectionReason:v.rejectionReason}]:[]));
// options.publicOnly: فقط تصاویر تأییدشده (گالری عمومی)
const galleryPost=(g,{admin=false,owner=false,publicOnly=false}={})=>{const v=plain(g);const images=galleryImages(v).filter(img=>!publicOnly||img.status==='approved').map(img=>({id:String(img._id),url:galleryImageUrl(img.filename),status:img.status,...(admin||owner?{rejectionReason:img.rejectionReason||''}:{})}));
  return{id:v.publicId,customerName:v.customerName,productId:v.productId,productName:v.productName,caption:v.caption,image:images[0]?.url||'',images,status:v.status,createdAt:faLongDate(v.createdAt),...(admin||owner?{rejectionReason:v.rejectionReason||''}:{})};};
const review=r=>{const v=plain(r);return{id:String(v._id),productId:v.productId,displayName:v.displayName||'خریدار توتو',rating:v.rating,body:v.body,verified:Boolean(v.orderNumber),status:v.status,createdAt:faLongDate(v.createdAt)};};
const question=q=>{const v=plain(q);return{id:String(v._id),productId:v.productId,displayName:v.displayName||'کاربر توتو',question:v.question,answer:v.answer||'',status:v.status,createdAt:faLongDate(v.createdAt),answeredAt:v.answeredAt?faLongDate(v.answeredAt):''};};
const stockAlert=a=>{const v=plain(a);return{id:String(v._id),productId:v.productId,productName:v.productName,image:v.image,color:v.color,size:v.size,variant:[v.color,v.size?`سایز ${v.size}`:''].filter(Boolean).join('، '),status:v.status,createdAt:faLongDate(v.createdAt)};};
const article=(a,{full=true}={})=>{const v=plain(a);const base={id:v.slug,slug:v.slug,category:v.category,title:v.title,excerpt:v.excerpt,image:v.image,imageAlt:v.imageAlt||v.title,readingTime:v.readingTime,date:faLongDate(v.publishedAt),isoDate:v.publishedAt,featured:Boolean(v.featured),popular:Boolean(v.popular),status:v.status};return full?{...base,intro:v.intro||'',sections:(v.sections||[]).map(s=>({id:s.id,title:s.title,paragraphs:s.paragraphs||[],note:s.note||'',subSections:(s.subSections||[]).map(x=>({title:x.title,text:x.text}))}))}:base;};
const contentPage=p=>{const v=plain(p);return{slug:v.slug,eyebrow:v.eyebrow||'',title:v.title,intro:v.intro||'',sections:(v.sections||[]).map(s=>({id:s.id,title:s.title,paragraphs:s.paragraphs||[]})),status:v.status,updatedAt:v.updatedAt};};

module.exports={product,adminProduct,user,notificationPrefs,order,adminOrder,publicOrder,returnRequest,adminReturn,galleryPost,review,question,stockAlert,article,contentPage,STATUS_LABELS,RETURN_STATUS_LABELS,OPEN_RETURN_STATUSES};
