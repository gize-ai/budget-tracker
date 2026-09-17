import { HttpError } from './auth.mjs';
const fail=message=>{throw new HttpError(400,message);};
function text(value,name,max,optional=false){if(typeof value!=='string')fail(`Некорректное поле «${name}».`);const s=value.trim();if((!s&&!optional)||s.length>max)fail(`Поле «${name}»: ${optional?'до':'от 1 до'} ${max} символов.`);return s;}
function flag(value){if(typeof value!=='boolean')fail('Некорректное значение отметки.');return value;}
export function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&s>='2000-01-01'&&s<='2100-12-31'&&!Number.isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
function date(s,optional=false){if(optional&&s==='')return '';if(!validDate(s))fail('Укажи корректную дату.');return s;}
export function validateRecord(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('Некорректная запись.');
 const kind=raw.kind;if(!['space','note','task','habit','transaction'].includes(kind))fail('Неизвестный тип записи.');
 const common={kind,title:text(raw.title,'Название',180)};
 if(kind==='space')return {...common,title:text(raw.title,'Название раздела',50)};
 const spaceId=raw.spaceId??'';if(typeof spaceId!=='string'||spaceId.length>80||!/^[a-zA-Z0-9_-]*$/.test(spaceId))fail('Некорректный раздел.');
 common.spaceId=spaceId;
 if(kind==='note')return {...common,body:text(raw.body??'','Текст',20000,true),pinned:flag(raw.pinned??false)};
 if(kind==='task')return {...common,dueDate:date(raw.dueDate??'',true),done:flag(raw.done??false)};
 if(kind==='habit'){
  const days=raw.days??[0,1,2,3,4,5,6];if(!Array.isArray(days)||days.length<1||days.length>7||days.some(x=>!Number.isInteger(x)||x<0||x>6))fail('Выбери дни для привычки.');
  const completedDates=raw.completedDates??[];if(!Array.isArray(completedDates)||completedDates.length>3660||completedDates.some(x=>!validDate(x)))fail('Некорректные даты отметок.');
  return {...common,days:[...new Set(days)].sort(),startDate:date(raw.startDate??new Date().toISOString().slice(0,10)),completedDates:[...new Set(completedDates)].sort(),archived:flag(raw.archived??false)};
 }
 if(!['income','expense'].includes(raw.type))fail('Выбери доход или расход.');
 if(!Number.isSafeInteger(raw.amount)||raw.amount<=0||raw.amount>99999999999)fail('Укажи положительную сумму, не более 999 999 999,99 ₽.');
 return {...common,type:raw.type,amount:raw.amount,category:text(raw.category||'Другое','Категория',50),date:date(raw.date)};
}
