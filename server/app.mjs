import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {HttpError,verifyTelegram,safeEqual} from './auth.mjs';
import {createItem,updateItem,deleteItem,saveProfile} from './service.mjs';
import {listFriends,inviteFriend,previewInvite,acceptInvite,removeFriend} from './social.mjs';
import {handleUpdate} from './bot.mjs';

const publicRoot=fileURLToPath(new URL('../public/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'};
async function readJson(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>98304)throw new HttpError(413,'Запись слишком большая.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new HttpError(400,'Не удалось прочитать запись.');}}
function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));}

export function createApp({store,token='',publicUrl='',webhookSecret='',botUsername='',devAuth=false}){
 const limits=new Map();
 function rate(key){const now=Date.now();let slot=limits.get(key);if(!slot||slot.until<now){slot={count:0,until:now+60000};limits.set(key,slot);}if(++slot.count>150)throw new HttpError(429,'Слишком много действий. Подожди минуту.');if(limits.size>10000)for(const [id,x] of limits)if(x.until<now)limits.delete(id);}
 return http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors https://web.telegram.org https://*.telegram.org https://telegram.org");
  try{
   const url=new URL(req.url,'http://localhost');const path=url.pathname;
   if(path==='/healthz'&&req.method==='GET')return json(res,200,{ok:true});
   if(path==='/api/config'&&req.method==='GET')return json(res,200,{botUsername:botUsername||process.env.BOT_USERNAME||'',cloudEnabled:Boolean(token),devAuth});
   if(path==='/telegram/webhook'&&req.method==='POST'){
    if(!token||!webhookSecret||!safeEqual(req.headers['x-telegram-bot-api-secret-token']||'',webhookSecret))throw new HttpError(403,'Forbidden');
    await handleUpdate(await readJson(req),{store,token,publicUrl});return json(res,200,{ok:true});
   }
   if(path.startsWith('/api/')){
    const authorization=req.headers.authorization||'';
    const user=devAuth&&authorization==='Dev local-preview'?{id:'local-dev',firstName:'Локальный профиль'}:verifyTelegram(authorization.startsWith('tma ')?authorization.slice(4):'',token);
    rate(user.id);
    if(!['GET','HEAD'].includes(req.method)&&req.headers.origin){const allowed=publicUrl?new URL(publicUrl).origin:`http://${req.headers.host}`;if(req.headers.origin!==allowed)throw new HttpError(403,'Недопустимый источник запроса.');}
    if(path==='/api/state'&&req.method==='GET')return json(res,200,{items:await store.list(user.id),user});
    if(path==='/api/profile'&&req.method==='PATCH')return json(res,200,await saveProfile(store,user.id,await readJson(req)));
    if(path==='/api/friends'&&req.method==='GET')return json(res,200,{friends:await listFriends(store,user.id)});
    if(path==='/api/friends/invite'&&req.method==='POST')return json(res,201,await inviteFriend(store,user.id));
    if(path==='/api/friends/preview'&&req.method==='POST')return json(res,200,await previewInvite(store,user.id,await readJson(req)));
    if(path==='/api/friends/accept'&&req.method==='POST')return json(res,200,await acceptInvite(store,user.id,await readJson(req)));
    const friendMatch=path.match(/^\/api\/friends\/([a-f0-9-]{36})$/);
    if(friendMatch&&req.method==='DELETE')return json(res,200,await removeFriend(store,user.id,friendMatch[1]));
    if(path==='/api/items'&&req.method==='POST')return json(res,201,await createItem(store,user.id,await readJson(req)));
    const match=path.match(/^\/api\/items\/([a-zA-Z0-9_-]{1,80})$/);
    if(match&&req.method==='PATCH')return json(res,200,await updateItem(store,user.id,match[1],await readJson(req)));
    if(match&&req.method==='DELETE'){const body=await readJson(req);return json(res,200,await deleteItem(store,user.id,match[1],body.version));}
    throw new HttpError(404,'Не найдено.');
   }
   if(!['GET','HEAD'].includes(req.method))throw new HttpError(405,'Метод не поддерживается.');
   const requestPath=decodeURIComponent(path==='/demo'||path==='/'?'/index.html':path);
   const filename=resolve(publicRoot,'.'+requestPath);
   if(!filename.startsWith(resolve(publicRoot)+sep)||requestPath.includes('\\')||!mime[extname(filename)])throw new HttpError(404,'Не найдено.');
   let data;try{data=await readFile(filename);}catch{throw new HttpError(404,'Не найдено.');}
   res.writeHead(200,{'content-type':mime[extname(filename)],'cache-control':/\.(jpg|png|svg)$/.test(filename)?'public, max-age=86400':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
  }catch(error){const status=error.status||500;if(status===500)console.error('Request failed:',error.code||error.name);if(!res.headersSent)json(res,status,{error:status===500?'Не удалось сохранить. Попробуй ещё раз чуть позже.':error.message});else res.end();}
 });
}
