import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from '../server/store.mjs';
import {createItem,updateItem,deleteItem,saveProfile} from '../server/service.mjs';
import {inviteFriend,previewInvite,acceptInvite,listFriends,removeFriend} from '../server/social.mjs';
import {progress,profileOf,defaults,shiftDate,periodStats} from '../public/progress.js';
import {dateKey} from '../public/domain.js';

test('VANTA upgrades existing storage without changing notes, habits or money; profile and goal survive reopen',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vanta-upgrade-')),filename=join(dir,'data.sqlite');let store=await createStore({filename});
 try{const note=await createItem(store,'100',{kind:'note',title:'Старая заметка',body:'Сохранить меня'}),money=await createItem(store,'100',{kind:'transaction',title:'Доход',type:'income',amount:12345678,date:dateKey()}),habit=await createItem(store,'100',{kind:'habit',title:'Привычка',completedDates:[dateKey()]});
 const before=await store.list('100');await store.close();store=await createStore({filename});
 await saveProfile(store,'100',{...defaults,onboarded:true});await createItem(store,'100',{kind:'goal',title:'Моя цель',target:100,current:10,unit:'книг'});
 for(const old of before)assert.deepEqual((await store.list('100')).find(x=>x.id===old.id),old);
 assert.equal((await store.list('200')).length,0);await store.close();store=await createStore({filename});assert.equal((await store.list('100')).length,5);assert.equal(profileOf(await store.list('100')).onboarded,true);
 }finally{await store.close();await rm(dir,{recursive:true,force:true});}
});
test('XP cannot be multiplied by repeated checks, duplicate habit dates, or user supplied profile XP',async()=>{
 const store=await createStore({filename:':memory:'});try{
 let task=await createItem(store,'u',{kind:'task',title:'Read',done:false,area:'mind'});task=await updateItem(store,'u',task.id,{...task,done:true});const original=progress(await store.list('u')).xp;
 task=await updateItem(store,'u',task.id,{...task,done:false});assert.equal(progress(await store.list('u')).xp,0);
 task=await updateItem(store,'u',task.id,{...task,done:true});assert.equal(progress(await store.list('u')).xp,original);
 await saveProfile(store,'u',{...defaults,xp:999999,level:99});assert.equal(profileOf(await store.list('u')).xp,undefined);
 await assert.rejects(saveProfile(store,'u',{...profileOf(await store.list('u')),appearance:'spartan'}),{status:400});
 await createItem(store,'u',{kind:'habit',title:'Read',completedDates:[dateKey(),dateKey()]});assert.equal(progress(await store.list('u')).events.filter(x=>x.kind==='habit').length,1);
 }finally{await store.close();}
});
test('Progress uses real actions, calendar streaks, and never awards XP for recording income',()=>{
 const today='2026-09-20',items=[{kind:'habit',area:'body',completedDates:[today,shiftDate(today,-1),shiftDate(today,-2),shiftDate(today,1)],days:[0,1,2,3,4,5,6],startDate:'2026-09-01'},{kind:'transaction',type:'income',amount:999999999}];
 const s=progress(items,today);assert.equal(s.actions,3);assert.equal(s.streak,3);assert.equal(s.xp,85);assert.equal(s.attributes.find(x=>x.id==='body').xp,60);assert.equal(periodStats(items,7,today).length,7);
});
test('Friend invitations require consent, connect both users, expire, and disclose only explicitly public fields',async()=>{
 const store=await createStore({filename:':memory:'});try{
 await assert.rejects(inviteFriend(store,'1'),{status:400});
 await saveProfile(store,'1',{...defaults,displayName:'Аня',shareProgress:true});await saveProfile(store,'2',{...defaults,displayName:'Борис',shareProgress:true});
 await createItem(store,'1',{kind:'note',title:'PRIVATE_SECRET',body:'PRIVATE_BODY'});await createItem(store,'1',{kind:'transaction',title:'PRIVATE_MONEY',type:'income',amount:999900,date:dateKey()});
 const invitation=await inviteFriend(store,'1');assert.deepEqual(await listFriends(store,'2'),[]);assert.equal((await previewInvite(store,'2',invitation)).name,'Аня');
 await assert.rejects(acceptInvite(store,'1',invitation),{status:400});await acceptInvite(store,'2',invitation);
 const friends=await listFriends(store,'2');assert.equal(friends.length,1);assert.equal((await listFriends(store,'1')).length,1);assert.deepEqual(Object.keys(friends[0]).sort(),['appearance','id','level','name','sharing','streak','xp'].sort());assert.ok(!JSON.stringify(friends).includes('PRIVATE'));
 await assert.rejects(acceptInvite(store,'3',invitation),{status:400});await assert.rejects(removeFriend(store,'3',friends[0].id),{status:404});
 await saveProfile(store,'1',{...profileOf(await store.list('1')),shareProgress:false});assert.equal((await listFriends(store,'2'))[0].xp,undefined);
 await removeFriend(store,'2',friends[0].id);assert.equal((await listFriends(store,'1')).length,0);
 const newer=await inviteFriend(store,'2');await store.write('__vanta_social__',async tx=>{const row=await tx.get(newer.code);await tx.update({...row,expiresAt:1},row.version);});await assert.rejects(previewInvite(store,'1',newer),{status:404});
 }finally{await store.close();}
});
test('Profile is a singleton, version protected, and cannot bypass appearance or privacy validation via item APIs',async()=>{
 const store=await createStore({filename:':memory:'});try{const p=await saveProfile(store,'1',defaults);await assert.rejects(saveProfile(store,'1',{...p,version:99}),{status:409});await assert.rejects(createItem(store,'1',defaults),{status:400});await assert.rejects(updateItem(store,'1',p.id,{...p,appearance:'spartan'}),{status:400});await assert.rejects(deleteItem(store,'1',p.id,p.version),{status:400});assert.equal((await store.list('1')).length,1);}finally{await store.close();}
});
