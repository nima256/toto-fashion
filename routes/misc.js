const express=require('express');
const ContactMessage=require('../models/ContactMessage');
const {asyncHandler,ok,AppError}=require('../utils/http');
const {requireCsrf}=require('../middlewares/auth');
const {normalizeMobile}=require('../utils/formatters');
const router=express.Router();
router.post('/contact',requireCsrf,asyncHandler(async(req,res)=>{const fullName=String(req.body.fullName||'').trim(),mobile=normalizeMobile(req.body.mobile),subject=String(req.body.subject||'').trim(),message=String(req.body.message||'').trim();if(!fullName||!/^09\d{9}$/.test(mobile)||!subject||!message)throw new AppError(400,'اطلاعات پیام کامل نیست');const ticket=await ContactMessage.create({fullName,mobile,subject,message});ok(res,{ticketId:ticket.publicId,receivedAt:ticket.createdAt},201);}));
module.exports=router;
