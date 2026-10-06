const express = require('express');
const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');
const Article = require('../models/Article');

const router = express.Router();
const viewsDir = path.join(__dirname, '..', 'views');
const pages = fs.readdirSync(viewsDir)
  .filter(file => file.endsWith('.ejs'))
  .map(file => file.replace(/\.ejs$/, ''));

// محصول یا مقاله ناموجود/حذف‌شده: صفحه اختصاصی ۴۰۴ با وضعیت HTTP 404
const notFound = (res, kind) => res.status(404).render('404', { kind });
router.get('/product', async (req, res, next) => {
  try {
    const id = String(req.query.id || '');
    const exists = /^[A-Za-z0-9_-]{1,80}$/.test(id) && await Product.exists({ publicId: id, status: { $in: ['active', 'out-of-stock'] } });
    if (!exists) return notFound(res, 'product');
    res.render('product');
  } catch (error) { next(error); }
});
router.get('/article', async (req, res, next) => {
  try {
    const slug = String(req.query.id || 'body-shape');
    const exists = /^[a-z0-9-]{2,80}$/.test(slug) && await Article.exists({ slug, status: 'published', publishedAt: { $lte: new Date() } });
    if (!exists) return notFound(res, 'article');
    res.render('article');
  } catch (error) { next(error); }
});

for (const page of pages) {
  if (['404', 'product', 'article'].includes(page)) continue;
  const route = page === 'index' ? '/' : `/${page}`;
  router.get(route, (_req, res) => res.render(page));
}

module.exports = router;
