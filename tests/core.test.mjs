import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyTelegram} from '../server/auth.mjs';
import {validateRecord,validDate} from '../server/validation.mjs';
import {createStore} from '../server/store.mjs';
import {createItem,updateItem,deleteItem} from '../server/service.mjs';
import {createApp} from '../server/app.mjs';
import {parseAmount,dateKey,weekDates,dueOn,escapeHtml} from '../public/domain.js';

const token='123456:test-only-secret';
function signed(id=42,authDate=Math.floor(Date.now()/1000)){
 const params=new URLSearchParams({auth_date:String(authDate),user:JSON.stringify({id,first_name:'Тест'}),query_id:'test-query'});
 const check=[...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
 const secret=createHmac('sha256','WebAppData').update(token).digest();params.set('hash',createHmac('sha256',secret).update(check).digest('hex'));return params.toString();
}
const note={kind:'note',title:'Пример',body:'Текст',spaceId:'',pinned:false};

test('Telegram signature authenticates the signed user and rejects forgery, expiry and duplicate fields',()=>{
 assert.equal(verifyTelegram(signed(),token).id,'42');
 assert.throws(()=>verifyTelegram(signed().replace('auth_date=','auth_date=1'),token),{status:401});
 assert.throws(()=>verifyTelegram(signed(42,1),token),{status:401});
 assert.throws(()=>verifyTelegram(signed()+'&user='+encodeURIComponent('{"id":1}'),token),{status:401});
 assert.throws(()=>verifyTelegram(signed(),token+'wrong'),{status:401});
 assert.throws(()=>verifyTelegram('',token),{status:401});
});
test('Money uses integer kopecks and accepts Russian decimal input without rounding drift',()=>{
 assert.equal(parseAmount('1 234,56'),123456);assert.equal(parseAmount('0.01'),1);assert.equal(parseAmount('250'),25000);
 for(const value of ['1.001','-2','1e3','Infinity','0','abc'])assert.throws(()=>parseAmount(value));
});
test('Validation rejects impossible dates, missing habit days and invalid money',()=>{
 assert.equal(validDate('2024-02-29'),true);assert.equal(validDate('2025-02-29'),false);
 assert.throws(()=>validateRecord({kind:'habit',title:'Read',days:[]}),{status:400});
 assert.throws(()=>validateRecord({kind:'transaction',title:'x',type:'expense',amount:0,date:'2026-09-18'}),{status:400});
 assert.throws(()=>validateRecord({...note,title:' '}),{status:400});
 assert.equal(validateRecord({...note,user_id:'other'}).user_id,undefined);
});
test('Week dates handle month boundaries and habit schedule starts correctly',()=>{
 assert.deepEqual(weekDates('2026-03-01'),['2026-02-23','2026-02-24','2026-02-25','2026-02-26','2026-02-27','2026-02-28','2026-03-01']);
 const habit={days:[0,2,4],startDate:'2026-09-17',archived:false};
 assert.equal(dueOn(habit,'2026-09-18'),true);assert.equal(dueOn(habit,'2026-09-16'),false);assert.equal(dueOn(habit,'2026-09-19'),false);
 assert.equal(dateKey(new Date(2026,0,1,0,5)),'2026-01-01');assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;');
});
test('Store persists across reopen, isolates users and detects concurrent edits',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ritm-test-'));const filename=join(dir,'test.sqlite');let store=await createStore({filename});
 try{
  const a=await createItem(store,'alice',note);assert.equal((await store.list('bob')).length,0);
  await assert.rejects(updateItem(store,'bob',a.id,{...a,title:'attack'}),{status:404});
  const outcomes=await Promise.allSettled([updateItem(store,'alice',a.id,{...a,title:'First'}),updateItem(store,'alice',a.id,{...a,title:'Second'})]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.find(x=>x.status==='rejected').reason.status,409);
  await store.close();store=await createStore({filename});assert.equal((await store.list('alice'))[0].version,2);
 }finally{await store.close();await rm(dir,{recursive:true,force:true});}
});
test('Deleting a section keeps its contents and clears the references atomically',async()=>{
 const store=await createStore({filename:':memory:'});try{
  const space=await createItem(store,'u',{kind:'space',title:'Работа'});
  const a=await createItem(store,'u',{...note,spaceId:space.id});
  await createItem(store,'u',{kind:'habit',title:'Read',spaceId:space.id,days:[0,1,2,3,4,5,6],completedDates:['2026-09-17']});
  await deleteItem(store,'u',space.id,space.version);const left=await store.list('u');assert.equal(left.length,2);assert.ok(left.every(x=>x.spaceId===''));
  await assert.rejects(updateItem(store,'u',a.id,{...a,title:'stale'}),{status:409});
  assert.deepEqual(left.find(x=>x.kind==='habit').completedDates,['2026-09-17']);
 }finally{await store.close();}
});
test('Bot update identifiers prevent duplicate record creation on webhook retry',async()=>{
 const store=await createStore({filename:':memory:'});try{await createItem(store,'u',note,'telegram-123');await createItem(store,'u',note,'telegram-123');assert.equal((await store.list('u')).length,1);}finally{await store.close();}
});
test('HTTP API enforces Telegram auth, ownership, version checks and secret webhook',async()=>{
 const store=await createStore({filename:':memory:'});const app=createApp({store,token,webhookSecret:'test-webhook'});await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.address().port}`;
 const call=(path,options={},id=42)=>fetch(base+path,{...options,headers:{authorization:'tma '+signed(id),'content-type':'application/json',...options.headers}});
 try{
  assert.equal((await fetch(base+'/api/state')).status,401);
  const created=await call('/api/items',{method:'POST',body:JSON.stringify({...note,user_id:'43'})});assert.equal(created.status,201);const item=await created.json();
  assert.equal((await (await call('/api/state',{},43)).json()).items.length,0);
  assert.equal((await call('/api/items/'+item.id,{method:'DELETE',body:JSON.stringify({version:1})},43)).status,404);
  assert.equal((await call('/api/items/'+item.id,{method:'PATCH',body:JSON.stringify({version:1,title:'Updated'})})).status,200);
  assert.equal((await call('/api/items/'+item.id,{method:'PATCH',body:JSON.stringify({version:1,title:'Stale'})})).status,409);
  assert.equal((await call('/api/items',{method:'POST',headers:{origin:'https://evil.example'},body:JSON.stringify(note)})).status,403);
  assert.equal((await fetch(base+'/telegram/webhook',{method:'POST',body:'{}'})).status,403);
  assert.equal((await fetch(base+'/.env')).status,404);
  const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/script-src 'self' https:\/\/telegram.org/);
  assert.equal((await call('/api/items/'+item.id,{method:'DELETE',body:JSON.stringify({version:2})})).status,200);
 }finally{await new Promise(resolve=>app.close(resolve));await store.close();}
});
