import {randomBytes,randomUUID} from 'node:crypto';
import {HttpError} from './auth.mjs';
import {profileOf,progress} from '../public/progress.js';

// Reserved owner never comes from a Telegram user ID; private records stay in their existing namespace.
const owner='__vanta_social__';
function codeOf(raw){const code=raw?.code;if(typeof code!=='string'||!/^v_[a-f0-9]{32}$/.test(code))throw new HttpError(400,'Проверь код приглашения.');return code;}
async function publicProfile(store,id){const items=await store.list(id),profile=profileOf(items),stats=progress(items);return {name:profile.displayName||'Участник VANTA',appearance:profile.appearance,sharing:profile.shareProgress,...(profile.shareProgress?{xp:stats.xp,level:stats.level,streak:stats.streak}:{})};}
export async function listFriends(store,user){const rows=await store.list(owner),edges=rows.filter(x=>x.kind==='friend'&&(x.a===user||x.b===user));return Promise.all(edges.map(async e=>({id:e.id,...await publicProfile(store,e.a===user?e.b:e.a)})));}
export async function inviteFriend(store,user){
 const profile=profileOf(await store.list(user));if(!profile.shareProgress)throw new HttpError(400,'Включи показ игрового прогресса друзьям.');
 return store.write(owner,async tx=>{
  const all=await tx.list();for(const x of all)if(x.kind==='invite'&&(x.expiresAt<Date.now()||x.owner===user))await tx.remove(x.id,x.version);
  if(all.filter(x=>x.kind==='friend'&&(x.a===user||x.b===user)).length>=100)throw new HttpError(400,'Можно добавить до 100 друзей.');
  const code='v_'+randomBytes(16).toString('hex'),expiresAt=Date.now()+7*86400000;
  await tx.insert({id:code,kind:'invite',owner:user,expiresAt});return {code,expiresAt};
 });
}
export async function previewInvite(store,user,raw){const code=codeOf(raw),invite=(await store.list(owner)).find(x=>x.id===code);if(!invite||invite.kind!=='invite'||invite.expiresAt<Date.now())throw new HttpError(404,'Приглашение истекло или уже использовано. Попроси новое.');if(invite.owner===user)throw new HttpError(400,'Это твоё приглашение. Отправь его другу.');const p=await publicProfile(store,invite.owner);return {name:p.name,appearance:p.appearance};}
export async function acceptInvite(store,user,raw){const code=codeOf(raw);if(!profileOf(await store.list(user)).shareProgress)throw new HttpError(400,'Включи показ игрового прогресса друзьям.');return store.write(owner,async tx=>{
 const all=await tx.list(),invite=all.find(x=>x.id===code);if(!invite||invite.kind!=='invite'||invite.expiresAt<Date.now())throw new HttpError(404,'Приглашение истекло или уже использовано.');if(invite.owner===user)throw new HttpError(400,'Нельзя добавить себя.');
 const existing=all.find(x=>x.kind==='friend'&&((x.a===user&&x.b===invite.owner)||(x.b===user&&x.a===invite.owner)));
 if(!existing){for(const id of [user,invite.owner])if(all.filter(x=>x.kind==='friend'&&(x.a===id||x.b===id)).length>=100)throw new HttpError(400,'У одного из участников уже 100 друзей.');await tx.insert({id:randomUUID(),kind:'friend',a:user,b:invite.owner,createdAt:Date.now()});}
 await tx.remove(invite.id,invite.version);return {ok:true};
});}
export async function removeFriend(store,user,id){return store.write(owner,async tx=>{const e=await tx.get(id);if(!e||e.kind!=='friend'||(e.a!==user&&e.b!==user))throw new HttpError(404,'Друг не найден.');await tx.remove(id,e.version);return {ok:true};});}
