export const weekdays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
export function dateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function dayNumber(key) { const day = new Date(`${key}T12:00:00`).getDay(); return (day + 6) % 7; }
export function weekDates(key = dateKey()) { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate()-dayNumber(key)); return Array.from({length:7},(_,i)=>{const next=new Date(d);next.setDate(d.getDate()+i);return dateKey(next);}); }
export function parseAmount(value) { const s=String(value).replace(/\s/g,'').replace(',','.');if(!/^\d{1,9}(\.\d{1,2})?$/.test(s))throw new Error('Введи сумму, например 250 или 250,50.');const [whole,fraction='']=s.split('.');const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(amount<=0)throw new Error('Сумма должна быть больше нуля.');return amount; }
export function money(amount) { return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:amount%100===0?0:2}).format(amount/100); }
export function escapeHtml(value='') { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function dueOn(habit,date) { return !habit.archived && (!habit.startDate || habit.startDate<=date) && habit.days.includes(dayNumber(date)); }
export function createDemo() {
 const today=dateKey();const now=Date.now();const prefix=today.slice(0,8);
 return [
  {id:'demo-work',kind:'space',title:'Работа',version:1,createdAt:now,updatedAt:now},
  {id:'demo-personal',kind:'space',title:'Личное',version:1,createdAt:now,updatedAt:now},
  {id:'demo-habit',kind:'habit',title:'30 минут на проект',spaceId:'demo-work',days:[0,1,2,3,4,5,6],startDate:prefix+'01',completedDates:[],archived:false,version:1,createdAt:now,updatedAt:now},
  {id:'demo-task',kind:'task',title:'Набросать план запуска',spaceId:'demo-work',dueDate:today,done:false,version:1,createdAt:now,updatedAt:now},
  {id:'demo-note1',kind:'note',title:'Идеи для проекта',body:'Сделать место, куда хочется возвращаться.\n\nБыстро записывать мысли. Видеть, что уже получилось. Держать важное рядом.',spaceId:'demo-work',pinned:true,version:1,createdAt:now,updatedAt:now},
  {id:'demo-note2',kind:'note',title:'Что попробовать на этой неделе',body:'Прогулка без телефона.\nВернуться к книге, которую давно откладывал.\nОсвободить один вечер для себя.',spaceId:'demo-personal',pinned:false,version:1,createdAt:now,updatedAt:now},
  {id:'demo-note3',kind:'note',title:'Первая версия',body:'Заметки, привычки и финансы. Оставить только то, чем действительно пользуешься каждый день.',spaceId:'demo-work',pinned:false,version:1,createdAt:now,updatedAt:now},
  ...[{id:'coffee',title:'Кофе',amount:25000,type:'expense',category:'Еда',spaceId:''},{id:'service',title:'Сервис для проекта',amount:90000,type:'expense',category:'Работа',spaceId:'demo-work'},{id:'income',title:'Подработка',amount:4500000,type:'income',category:'Работа',spaceId:'demo-work'}].map((x,i)=>({...x,id:'demo-'+x.id,kind:'transaction',date:today,version:1,createdAt:now-i,updatedAt:now-i}))
 ];
}
