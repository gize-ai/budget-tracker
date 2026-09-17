import {pathToFileURL} from 'node:url';
import {telegramCall} from '../server/bot.mjs';

export async function configureBot({token,publicUrl,secret}){
 if(!token||!publicUrl||!secret)throw new Error('Set BOT_TOKEN, PUBLIC_URL and WEBHOOK_SECRET.');
 const url=new URL(publicUrl);if(url.protocol!=='https:')throw new Error('PUBLIC_URL must use HTTPS.');
 if(!/^[a-zA-Z0-9_-]{1,256}$/.test(secret))throw new Error('WEBHOOK_SECRET: use 1–256 letters, numbers, _ or -.');
 const appUrl=url.origin;
 const me=await telegramCall(token,'getMe',{});
 await telegramCall(token,'setChatMenuButton',{menu_button:{type:'web_app',text:'Мой ритм',web_app:{url:appUrl}}});
 await telegramCall(token,'setMyCommands',{commands:[{command:'start',description:'Открыть Мой ритм'},{command:'help',description:'Как добавлять записи'},{command:'task',description:'Добавить дело'},{command:'expense',description:'Записать расход'},{command:'income',description:'Записать доход'}]});
 await telegramCall(token,'setWebhook',{url:appUrl+'/telegram/webhook',secret_token:secret,allowed_updates:['message'],drop_pending_updates:false});
 return me.username;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const username=await configureBot({token:process.env.BOT_TOKEN,publicUrl:process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL,secret:process.env.WEBHOOK_SECRET});console.log(`Бот @${username} настроен. Открой его и отправь /start.`);}catch(error){console.error(error.message);process.exitCode=1;}
}
