import { magazineArticles } from '../../data/content-data.js';

let csrfToken = '';
const errorWithCode = (message, code, status) => { const error=new Error(message); error.code=code; error.status=status; return error; };
async function getCsrf(force=false){if(csrfToken&&!force)return csrfToken;const r=await fetch('/api/csrf',{credentials:'same-origin'});const d=await r.json();if(!r.ok||!d.csrfToken)throw errorWithCode(d.message||'دریافت توکن امنیتی ناموفق بود','CSRF_FAILED',r.status);csrfToken=d.csrfToken;return csrfToken;}
async function request(path,{method='GET',body,formData,retry=true}={}){
  const options={method,credentials:'same-origin',headers:{'Accept':'application/json'}};
  if(!['GET','HEAD'].includes(method)){options.headers['x-csrf-token']=await getCsrf();if(formData)options.body=formData;else{options.headers['Content-Type']='application/json';options.body=JSON.stringify(body??{});}}
  let response;
  try{response=await fetch(path,options);}catch{throw errorWithCode('ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.','NETWORK_ERROR',0);}
  let data={};try{data=await response.json();}catch{}
  if(response.status===403&&retry&&!['GET','HEAD'].includes(method)){csrfToken='';await getCsrf(true);return request(path,{method,body,formData,retry:false});}
  if(!response.ok||data.success===false)throw errorWithCode(data.message||'درخواست انجام نشد',data.code||`HTTP_${response.status}`,response.status);
  return data;
}
const q = params => { const s=new URLSearchParams(); Object.entries(params||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')s.set(k,v)}); return s.toString(); };

export const api = {
  async getProducts(){return (await request('/api/products')).products||[];},
  async search(query){return (await request(`/api/products?${q({q:query})}`)).products||[];},
  async requestOtp(mobile){return request('/api/auth/otp/request',{method:'POST',body:{mobile}});},
  async verifyOtp(code){const data=await request('/api/auth/otp/verify',{method:'POST',body:{otp:code}});csrfToken='';return data;},
  async me(){return request('/api/auth/me');},
  async logout(){const data=await request('/api/auth/logout',{method:'POST'});csrfToken='';return data;},
  async addToCart(payload){return {id:`cart-${Date.now()}`,...payload,addedAt:new Date().toISOString()};},
  async validateCart(cart,checkout={},discountCode=''){try{const data=await request('/api/orders/validate-cart',{method:'POST',body:{items:cart,checkout,discountCode}});return {ok:true,...data};}catch(error){return {ok:false,message:error.message};}},
  async createPayment(order){return request('/api/orders',{method:'POST',body:{order}});},
  async getAccountOverview(){return request('/api/account');},
  async getAddresses(){return (await request('/api/account/addresses')).addresses||[];},
  async createAddress(address){return (await request('/api/account/addresses',{method:'POST',body:address})).address;},
  async updateAddress(id,address){return (await request(`/api/account/addresses/${encodeURIComponent(id)}`,{method:'PATCH',body:address})).address;},
  async deleteAddress(id){return request(`/api/account/addresses/${encodeURIComponent(id)}`,{method:'DELETE'});},
  async getOrders(){return (await request('/api/account/orders')).orders||[];},
  async getOrder(id){return (await request(`/api/account/orders/${encodeURIComponent(id)}`)).order;},
  async trackOrder(orderNumber,mobile){return (await request('/api/orders/track',{method:'POST',body:{orderNumber,mobile}})).order;},
  async spinWheel(){return request('/api/account/wheel/spin',{method:'POST'});},
  async createReturnRequest(payload){const data=await request('/api/account/returns',{method:'POST',body:payload});return data.request;},
  async saveProfile(profile){const data=await request('/api/account',{method:'PATCH',body:profile});return {...profile,...(data.profile||{}),completed:profile.completed};},
  async saveNotificationPreferences(preferences){await request('/api/account/notifications',{method:'PATCH',body:{sms:preferences.orderSms!==false,offers:preferences.campaignSms!==false,restock:preferences.stockSms!==false}});return preferences;},
  async getMagazineArticles(){return magazineArticles;},
  async getContentPage(slug){return {slug,source:'frontend-static'};},
  async sendContactMessage(payload){return request('/api/contact',{method:'POST',body:payload});},
  async getAdminMe(){return request('/api/admin/me');},
  async adminLogin(email,password){const data=await request('/api/admin/login',{method:'POST',body:{email,password}});if(data.csrfToken)csrfToken=data.csrfToken;return data;},
  async adminLogout(){const data=await request('/api/admin/logout',{method:'POST'});csrfToken='';return data;},
  async getAdminDashboard(range='30d'){return request(`/api/admin/dashboard?${q({range})}`);},
  async createAdminProduct(changes){return (await request('/api/admin/products',{method:'POST',body:changes})).product;},
  async updateAdminProduct(productId,changes){return (await request(`/api/admin/products/${encodeURIComponent(productId)}`,{method:'PATCH',body:changes})).product;},
  async deleteAdminProduct(productId){return request(`/api/admin/products/${encodeURIComponent(productId)}`,{method:'DELETE'});},
  async updateAdminInventory(productId,inventory){return (await request(`/api/admin/products/${encodeURIComponent(productId)}/inventory`,{method:'PATCH',body:{inventory}})).product;},
  async uploadAdminProductImage(file){const formData=new FormData();formData.append('image',file);return request('/api/admin/products/upload',{method:'POST',formData});},
  async updateAdminOrder(orderId,changes){return (await request(`/api/admin/orders/${encodeURIComponent(orderId)}`,{method:'PATCH',body:changes})).order;},
  async updateAdminCustomer(customerId,changes){return (await request(`/api/admin/customers/${encodeURIComponent(customerId)}`,{method:'PATCH',body:changes})).customer;},
  async saveAdminSetting(key,value){return request(`/api/admin/settings/${encodeURIComponent(key)}`,{method:'PATCH',body:{value}});},
  async exportAdminReport(type,rows){return {type,rowCount:rows?.length||0,generatedAt:new Date().toISOString()};},
  async verifyPayment(orderNumber){return request(`/api/orders/${encodeURIComponent(orderNumber)}/status`);}
};
