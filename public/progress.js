import {dateKey,dueOn} from './domain.js';

export const areas=[['body','Форма','Физическая активность'],['mind','Разум','Чтение и обучение'],['career','Карьера','Работа и проекты'],['wealth','Финансы','Финансовые привычки'],['discipline','Дисциплина','Порядок и регулярность'],['health','Здоровье','Сон и забота о себе']];
export const appearances=[{id:'marble',name:'Marble',level:1,description:'Начало твоего пути',image:'marble.png'},{id:'bronze',name:'Bronze',level:3,description:'Тепло постоянства',image:'marble.png'},{id:'obsidian',name:'Obsidian',level:7,description:'Спокойная уверенность',image:'marble.png'},{id:'spartan',name:'Spartan',level:12,description:'Сила в действии',image:'spartan.png'}];
export const defaults={kind:'profile',title:'VANTA',appearance:'marble',priorities:[],onboarded:false,gaming:true,shareProgress:false,displayName:'',reducedMotion:false};
export const profileOf=items=>({...defaults,...items.find(x=>x.kind==='profile')});
export function shiftDate(key,n){const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+n);return dateKey(d);}
export function activity(items,today=dateKey()){
 const events=[];
 for(const item of items){
  if(item.kind==='habit')for(const day of new Set(item.completedDates||[])){if(day<=today)events.push({date:day,xp:20,area:item.area||'discipline',kind:'habit'});}
  if(item.kind==='task'&&item.done){const day=item.completedOn||dateKey(new Date(item.updatedAt));if(day<=today)events.push({date:day,xp:30,area:item.area||'discipline',kind:'task'});}
 }
 return events;
}
export function progress(items,today=dateKey()){
 const events=activity(items,today),days=new Set(events.map(e=>e.date));let streak=0,cursor=days.has(today)?today:shiftDate(today,-1);
 while(days.has(cursor)){streak++;cursor=shiftDate(cursor,-1);}
 let best=0,run=0,previous='';for(const day of [...days].sort()){run=previous&&shiftDate(previous,1)===day?run+1:1;best=Math.max(best,run);previous=day;}
 const habits=events.filter(e=>e.kind==='habit').length,tasks=events.length-habits,goals=items.filter(x=>x.kind==='goal'&&x.current>=x.target).length;
 const achievements=[
  {id:'first',name:'Первый шаг',description:'Выполни первое действие',value:events.length,target:1,bonus:25,icon:'spark'},
  {id:'week',name:'Держишь ритм',description:'7 дней активности подряд',value:best,target:7,bonus:100,icon:'flame'},
  {id:'ten',name:'Человек дела',description:'Выполни 10 разовых дел',value:tasks,target:10,bonus:100,icon:'check'},
  {id:'habit50',name:'Это уже привычка',description:'Отметь привычки 50 раз',value:habits,target:50,bonus:200,icon:'repeat'},
  {id:'goal',name:'Дальше горизонта',description:'Достигни первой цели',value:goals,target:1,bonus:150,icon:'target'},
  {id:'month',name:'Тихая сила',description:'30 дней активности подряд',value:best,target:30,bonus:500,icon:'shield'},
  {id:'hundred',name:'Шаг за шагом',description:'Выполни 100 действий',value:events.length,target:100,bonus:300,icon:'trophy'}
 ].map(x=>({...x,unlocked:x.value>=x.target}));
 const xp=events.reduce((s,e)=>s+e.xp,0)+achievements.filter(x=>x.unlocked).reduce((s,x)=>s+x.bonus,0);let level=1;while(125*level*(level+1)<=xp)level++;
 const floor=125*(level-1)*level,ceiling=125*level*(level+1);
 const attributes=areas.map(([id,name])=>({id,name,xp:events.filter(e=>e.area===id).reduce((s,e)=>s+e.xp,0)}));
 return {xp,level,floor,ceiling,percent:(xp-floor)/(ceiling-floor)*100,streak,best,events,achievements,attributes,actions:events.length};
}
export function periodStats(items,count=7,today=dateKey()){
 const events=activity(items,today);return Array.from({length:count},(_,i)=>{const date=shiftDate(today,i-count+1),done=events.filter(e=>e.date===date).length;
 const planned=items.filter(x=>x.kind==='habit'?dueOn(x,date):x.kind==='task'&&x.dueDate===date).length;
 return {date,done,planned:Math.max(done,planned),xp:events.filter(e=>e.date===date).reduce((s,e)=>s+e.xp,0)};});
}
