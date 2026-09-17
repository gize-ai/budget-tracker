import {dateKey,createDemo} from './domain.js';
export const $=selector=>document.querySelector(selector);
export const tg=window.Telegram?.WebApp;
export const storageKey='moy-ritm-demo-v1';
export const state={items:[],cloud:false,config:{},user:{},tab:'today',space:'',search:'',archived:false,taskScope:'today',month:dateKey().slice(0,7),ready:false,busy:new Set()};
let listener=()=>{},toastTimer;
export const subscribe=fn=>{listener=fn;};
export const notify=()=>listener();
export const all=kind=>state.items.filter(x=>x.kind===kind);
export const get=id=>state.items.find(x=>x.id===id);
export const spaces=()=>all('space').sort((a,b)=>a.createdAt-b.createdAt);
export const spaceName=id=>spaces().find(x=>x.id===id)?.title||'Без раздела';
export const inSpace=x=>!state.space||(state.space==='__none'?!x.spaceId:x.spaceId===state.space);
export const defaultSpace=()=>state.space&&state.space!=='__none'?state.space:'';
export const shortDate=key=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short'}).format(new Date(key+'T12:00:00')).replace('.','');
export const monthLabel=key=>new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(new Date(key+'-15T12:00:00')).replace(' г.','');
export function plural(n,forms){return n%10===1&&n%100!==11?forms[0]:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?forms[1]:forms[2];}
export function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
export function haptic(){try{if(tg?.isVersionAtLeast('6.1'))tg.HapticFeedback.selectionChanged();}catch{}}
export async function api(path,options={}){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(path,{...options,signal:controller.signal,headers:{'content-type':'application/json',authorization:tg?.initData?'tma '+tg.initData:'Dev local-preview',...options.headers}});
  const data=await response.json();if(!response.ok){const error=new Error(data.error||'Не удалось выполнить действие.');error.status=response.status;throw error;}return data;
 }catch(error){if(error.name==='AbortError')throw new Error('Сервер пока не ответил. Попробуй ещё раз.');if(error instanceof TypeError)throw new Error('Нет связи с сервером. Проверь подключение и повтори.');throw error;}finally{clearTimeout(timeout);}
}
export function loadDemo(){const saved=localStorage.getItem(storageKey);if(!saved){const seed=createDemo();localStorage.setItem(storageKey,JSON.stringify(seed));return seed;}const parsed=JSON.parse(saved);if(!Array.isArray(parsed))throw new Error('Не удалось прочитать сохранённые записи.');return parsed;}
export async function refresh(){if(state.cloud){const result=await api('/api/state');state.items=result.items;state.user=result.user;}else state.items=loadDemo();}
export async function saveRecord(record){
 let saved;
 if(state.cloud){try{saved=await api(record.id?'/api/items/'+record.id:'/api/items',{method:record.id?'PATCH':'POST',body:JSON.stringify(record)});}catch(error){if(error.status===409){await refresh();notify();}throw error;}}
 else{const latest=loadDemo();const existing=record.id?latest.find(x=>x.id===record.id):null;if(record.id&&(!existing||record.version!==existing.version)){state.items=latest;notify();const error=new Error('Запись изменилась в другой вкладке. Проверь данные и сохрани ещё раз.');error.status=409;throw error;}const now=Date.now();saved={...record,id:record.id||crypto.randomUUID(),createdAt:existing?.createdAt||now,updatedAt:now,version:(existing?.version||0)+1};const next=existing?latest.map(x=>x.id===saved.id?saved:x):[...latest,saved];localStorage.setItem(storageKey,JSON.stringify(next));state.items=next;}
 if(state.cloud)state.items=state.items.some(x=>x.id===saved.id)?state.items.map(x=>x.id===saved.id?saved:x):[...state.items,saved];
 notify();return saved;
}
export async function removeRecord(record){
 if(state.cloud){try{await api('/api/items/'+record.id,{method:'DELETE',body:JSON.stringify({version:record.version})});}catch(error){if(error.status===409){await refresh();notify();}throw error;}await refresh();}
 else{const latest=loadDemo();const current=latest.find(x=>x.id===record.id);if(!current||current.version!==record.version)throw new Error('Запись изменилась. Открой её заново.');const next=latest.filter(x=>x.id!==record.id).map(x=>x.spaceId===record.id?{...x,spaceId:'',version:x.version+1,updatedAt:Date.now()}:x);localStorage.setItem(storageKey,JSON.stringify(next));state.items=next;}
 if(state.space===record.id)state.space='';notify();
}
