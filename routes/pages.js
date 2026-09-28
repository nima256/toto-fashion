const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const viewsDir = path.join(__dirname, '..', 'views');
const pages = fs.readdirSync(viewsDir)
  .filter(file => file.endsWith('.ejs'))
  .map(file => file.replace(/\.ejs$/, ''));

for (const page of pages) {
  if (page === '404') continue;
  const route = page === 'index' ? '/' : `/${page}`;
  router.get(route, (_req, res) => res.render(page));
}

module.exports = router;
