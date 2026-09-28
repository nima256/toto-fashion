const {faDate}=require('../utils/formatters');
const dayKey=d=>new Date(d).toISOString().slice(0,10);
function pct(current,previous){if(!previous)return current?100:0;return Number((((current-previous)/previous)*100).toFixed(1));}
function buildAnalytics({orders=[],products=[],users=[]}){
  const now=new Date(), day=86400000;
  const paid=orders.filter(o=>o.paymentStatus==='paid');
  const since=ms=>paid.filter(o=>new Date(o.createdAt)>=new Date(now-ms));
  const today=since(day), week=since(7*day), month=since(30*day);
  const prevDay=paid.filter(o=>{const t=new Date(o.createdAt);return t<new Date(now-day)&&t>=new Date(now-2*day)});
  const prevWeek=paid.filter(o=>{const t=new Date(o.createdAt);return t<new Date(now-7*day)&&t>=new Date(now-14*day)});
  const prevMonth=paid.filter(o=>{const t=new Date(o.createdAt);return t<new Date(now-30*day)&&t>=new Date(now-60*day)});
  const sum=a=>a.reduce((s,o)=>s+Number(o.total||0),0);
  const monthSum=sum(month), avg=month.length?Math.round(monthSum/month.length):0;
  const newUsers=users.filter(u=>new Date(u.createdAt)>=new Date(now-30*day)).length;
  const pending=orders.filter(o=>['awaiting-payment','paid','processing','ready'].includes(o.status)).length;
  const lowStock=products.filter(p=>Number(p.inventory||0)<10).length;
  const returned=orders.filter(o=>o.status==='returned').length;
  const kpis=[
    {id:'todayRevenue',label:'فروش امروز',value:sum(today),type:'currency',delta:pct(sum(today),sum(prevDay)),note:'نسبت به روز قبل'},
    {id:'weeklyRevenue',label:'فروش هفتگی',value:sum(week),type:'currency',delta:pct(sum(week),sum(prevWeek)),note:'نسبت به هفته قبل'},
    {id:'monthlyRevenue',label:'فروش ماهانه',value:monthSum,type:'currency',delta:pct(monthSum,sum(prevMonth)),note:'نسبت به ماه قبل'},
    {id:'orders',label:'تعداد سفارش',value:month.length,type:'number',delta:0,note:'در ۳۰ روز اخیر'},
    {id:'averageOrder',label:'میانگین سفارش',value:avg,type:'currency',delta:0,note:'ارزش هر سفارش'},
    {id:'customers',label:'مشتری جدید',value:newUsers,type:'number',delta:0,note:'در ۳۰ روز اخیر'},
    {id:'pending',label:'سفارش در انتظار',value:pending,type:'number',delta:0,note:'نیازمند بررسی'},
    {id:'returns',label:'مرجوعی فعال',value:returned,type:'number',delta:0,note:'در حال رسیدگی'},
    {id:'lowStock',label:'موجودی رو به پایان',value:lowStock,type:'number',delta:0,note:'کمتر از ۱۰ عدد'},
    {id:'abandoned',label:'سبد رهاشده',value:0,type:'number',delta:0,note:'نیازمند اتصال رویداد'},
    {id:'discounts',label:'استفاده از تخفیف',value:month.filter(o=>o.couponCode).length,type:'number',delta:0,note:'این ماه'},
    {id:'loyalty',label:'فعالیت باشگاه',value:users.reduce((s,u)=>s+Number(u.loyalty?.points||0),0),type:'number',delta:0,note:'مجموع امتیاز'}
  ];
  const labels=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
  const salesSeries=Array.from({length:7},(_,idx)=>{
    const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-(6-idx));
    const end=new Date(start.getTime()+day);
    const list=paid.filter(o=>new Date(o.createdAt)>=start&&new Date(o.createdAt)<end);
    return {label:labels[start.getDay()===6?0:start.getDay()+1]||faDate(start),sales:Number((sum(list)/1000000).toFixed(1)),orders:list.length};
  });
  const categoryMap=new Map();
  for(const o of month)for(const i of o.items||[])categoryMap.set(i.category||'سایر',(categoryMap.get(i.category||'سایر')||0)+Number(i.price||0)*Number(i.quantity||1));
  let catTotal=[...categoryMap.values()].reduce((a,b)=>a+b,0);
  if(!catTotal)catTotal=1;
  const categoryRevenue=[...categoryMap.entries()].map(([label,value])=>({label,value:Math.round(value/catTotal*100)})).sort((a,b)=>b.value-a.value).slice(0,8);
  return {kpis,salesSeries,categoryRevenue};
}
module.exports={buildAnalytics};
