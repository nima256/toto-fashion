import { products, replaceProducts } from '../src/data/mock-data.js';
import { discountCodes, shippingMethods } from '../src/data/checkout-data.js';
import fs from 'node:fs';

const originalLength=products.length;
replaceProducts([...products]);
if(products.length!==originalLength)throw new Error('Product hydration failed');
if(!discountCodes.TOTO10||!shippingMethods.find(item=>item.id==='standard'))throw new Error('Checkout data is incomplete');
const apiSource=fs.readFileSync(new URL('../src/scripts/services/api.js',import.meta.url),'utf8');
for(const required of ['/api/auth/otp/request','/api/orders','/api/admin/dashboard','/api/account/orders'])if(!apiSource.includes(required))throw new Error(`Missing API integration: ${required}`);
console.log('Frontend integration smoke test passed.');
