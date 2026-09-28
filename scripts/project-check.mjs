import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requiredPages = [
  'index','shop','product','cart','checkout','order-review',
  'payment-success','payment-failed','payment-pending','account','orders',
  'order-details','gallery','saved-for-later','blog','article','search','about',
  'contact','size-guide','shipping-returns','faq','privacy','terms',
  'order-tracking','return-request','admin','404','login'
];
const routePages = new Set(requiredPages.filter(page => page !== '404'));
const walk = dir => readdirSync(dir,{withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(join(dir,entry.name)) : [join(dir,entry.name)]);
const files = walk(root).filter(path => !path.includes('/.git/') && !path.includes('/node_modules/'));
const errors = [];
const warnings = [];

for (const page of requiredPages) {
  const file = join(root, 'views', `${page}.ejs`);
  if (!existsSync(file)) errors.push(`قالب EJS الزامی وجود ندارد: views/${page}.ejs`);
}

const rootHtml = readdirSync(root).filter(name => name.endsWith('.html'));
if (rootHtml.length) errors.push(`فایل HTML در ریشه باقی مانده است: ${rootHtml.join(', ')}`);

const localRefPattern = /(?:href|src)=["']([^"'#?]+)["']/g;
for (const file of files.filter(path => extname(path)==='.ejs')) {
  const text = readFileSync(file,'utf8');
  const relativeName = file.slice(root.length+1);
  if (!/<html[^>]+lang=["']fa["'][^>]+dir=["']rtl["']|<html[^>]+dir=["']rtl["'][^>]+lang=["']fa["']/.test(text)) errors.push(`lang/dir در ${relativeName} ناقص است.`);
  if (!/<main\b/.test(text) && !text.includes('id="admin-root"')) warnings.push(`عنصر main در ${relativeName} پیدا نشد.`);
  if (/\.html(?:[?#"']|$)/.test(text)) errors.push(`لینک .html در ${relativeName} باقی مانده است.`);

  let match;
  while ((match=localRefPattern.exec(text))) {
    const ref = match[1];
    if (!ref.startsWith('./')) continue;
    const clean = ref.slice(2);
    if (!clean) continue;

    if (clean.startsWith('src/') || clean.startsWith('uploads/') || /\.[a-z0-9]+$/i.test(clean)) {
      const target = resolve(root, clean);
      if (!existsSync(target)) errors.push(`ارجاع فایل مفقود در ${relativeName}: ${ref}`);
      continue;
    }

    const routeName = clean.split('/')[0];
    if (routeName && !routePages.has(routeName)) errors.push(`ارجاع route ناشناخته در ${relativeName}: ${ref}`);
  }
}

for (const file of files.filter(path => extname(path)==='.js' || extname(path)==='.mjs')) {
  try { execFileSync(process.execPath,['--check',file],{stdio:'pipe'}); }
  catch (error) { errors.push(`خطای Syntax در ${file.slice(root.length+1)}: ${error.stderr?.toString().trim()}`); }
  const text=readFileSync(file,'utf8');
  if (file !== join(root, 'scripts', 'project-check.mjs') && /\.html(?:[?#"'`]|$)/.test(text)) errors.push(`ارجاع .html در ${file.slice(root.length+1)} باقی مانده است.`);
  for (const match of text.matchAll(/from\s+["']([^"']+)["']|import\(["']([^"']+)["']\)/g)) {
    const ref=match[1]||match[2];
    if (!ref?.startsWith('.')) continue;
    const cleanRef = ref.split(/[?#]/)[0];
    const target=resolve(dirname(file),cleanRef);
    if (!existsSync(target)) errors.push(`Import مفقود در ${file.slice(root.length+1)}: ${ref}`);
  }
}

for (const file of files.filter(path => extname(path)==='.css')) {
  const text=readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  let depth=0;
  for (const char of text) { if(char==='{') depth++; if(char==='}') depth--; if(depth<0) break; }
  if (depth!==0) errors.push(`آکولاد CSS نامتوازن در ${file.slice(root.length+1)}`);
}

const visibleFiles=files.filter(path=>['.ejs','.js','.md'].includes(extname(path)) && !path.endsWith('project-check.mjs'));
const forbidden = [/Lorem ipsum/i, /لورم ایپسوم/i];
for(const file of visibleFiles){ const text=readFileSync(file,'utf8'); for(const pattern of forbidden) if(pattern.test(text)) errors.push(`متن نمونه ممنوع در ${file.slice(root.length+1)}`); }

const budgets = {
  js: files.filter(path=>extname(path)==='.js').reduce((sum,path)=>sum+statSync(path).size,0),
  css: files.filter(path=>extname(path)==='.css').reduce((sum,path)=>sum+statSync(path).size,0),
  images: files.filter(path=>['.webp','.avif','.png','.jpg','.jpeg'].includes(extname(path))).reduce((sum,path)=>sum+statSync(path).size,0)
};
if (budgets.js > 420*1024) warnings.push(`حجم خام JavaScript از بودجه توسعه بیشتر است: ${Math.round(budgets.js/1024)}KB`);
if (budgets.css > 240*1024) warnings.push(`حجم خام CSS از بودجه توسعه بیشتر است: ${Math.round(budgets.css/1024)}KB`);

console.log(`قالب‌های EJS الزامی: ${requiredPages.length}/${requiredPages.length}`);
console.log(`JavaScript خام: ${Math.round(budgets.js/1024)}KB`);
console.log(`CSS خام: ${Math.round(budgets.css/1024)}KB`);
console.log(`تصاویر پروژه: ${Math.round(budgets.images/1024)}KB`);
for(const warning of warnings) console.log(`هشدار: ${warning}`);
if(errors.length){ for(const error of errors) console.error(`خطا: ${error}`); process.exit(1); }
console.log('بررسی ساختاری پروژه با موفقیت انجام شد.');
