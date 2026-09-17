import {createStore} from './store.mjs';
import {createApp} from './app.mjs';
import {configureBot} from '../scripts/setup-bot.mjs';

const production=process.env.NODE_ENV==='production';
if(production&&(!process.env.DATABASE_URL||!process.env.BOT_TOKEN))throw new Error('Production requires DATABASE_URL and BOT_TOKEN.');
if(production&&process.env.DEV_AUTH==='1')throw new Error('DEV_AUTH must be disabled in production.');
const store=await createStore({url:process.env.DATABASE_URL,filename:process.env.SQLITE_PATH||'data/ritm.sqlite',ssl:process.env.PGSSL==='require'});
const app=createApp({store,token:process.env.BOT_TOKEN,publicUrl:process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL||'',webhookSecret:process.env.WEBHOOK_SECRET,botUsername:process.env.BOT_USERNAME,devAuth:!production&&process.env.DEV_AUTH==='1'});
const port=Number(process.env.PORT||3000);
app.requestTimeout=20000;app.headersTimeout=15000;
app.listen(port,production?'0.0.0.0':'127.0.0.1',()=>console.log(`Мой ритм: http://127.0.0.1:${port} (${store.type})`));
if(process.env.AUTO_CONFIGURE_BOT==='1'){
 let attempts=0;
 const setup=async()=>{try{const username=await configureBot({token:process.env.BOT_TOKEN,publicUrl:process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL,secret:process.env.WEBHOOK_SECRET});console.log(`Бот @${username} подключён.`);}catch{console.error('Bot setup failed. Check BOT_TOKEN, WEBHOOK_SECRET and PUBLIC_URL; retry with npm run bot:setup.');if(++attempts<3)setTimeout(setup,15000).unref();}};
 setup();
}
let shuttingDown=false;
async function shutdown(){if(shuttingDown)return;shuttingDown=true;app.close(async()=>{await store.close();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
