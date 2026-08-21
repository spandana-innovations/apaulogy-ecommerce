import fs from 'node:fs';
const cat = JSON.parse(fs.readFileSync('src/data/catalog.json','utf8'));
const catName = Object.fromEntries(cat.categories.map(c=>[c.slug,c.name]));
const idx = cat.products.map(p=>({
  s:p.slug, n:p.name,
  c:p.primary_category||'', cn:catName[p.primary_category]||'',
  p:p.sale_price??p.price, pm:p.price_max||null, t:p.type,
  img:(p.images[0]&&p.images[0].url)||''
}));
fs.mkdirSync('public/data',{recursive:true});
fs.writeFileSync('public/data/search-index.json', JSON.stringify(idx));
console.log('search index:', idx.length, 'products');
