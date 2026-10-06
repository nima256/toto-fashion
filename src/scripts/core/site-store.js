// محتوای مدیریت‌شده سایت و تنظیمات تسویه حساب که در شروع هر صفحه از سرور دریافت می‌شود
export const site = { announcement: null, hero: null, offer: null, checkout: null, loaded: false };
export const setSiteContent = data => {
  Object.assign(site, { announcement: data?.site?.announcement || null, hero: data?.site?.hero || null, offer: data?.site?.offer || null, checkout: data?.checkout || null, loaded: true });
  return site;
};
