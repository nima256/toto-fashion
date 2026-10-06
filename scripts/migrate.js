// اجرای دستی مهاجرت‌ها: npm run migrate (idempotent؛ اجرای چندباره بی‌خطر است)
const mongoose=require('mongoose');const env=require('../config/env');const {runMigrations}=require('../services/migrations');
(async()=>{try{await mongoose.connect(env.mongodbUri);const result=await runMigrations();console.log('Migrations complete',result);}finally{await mongoose.disconnect();}})().catch(e=>{console.error('Migration failed:',e.message);process.exit(1);});
