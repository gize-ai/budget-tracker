import {dateKey,dueOn,escapeHtml as esc} from './domain.js';
import {state,$,tg,get,toast,haptic,saveRecord,refresh,loadDemo,subscribe,storageKey} from './state.js';
import {render,noteCards} from './views.js';
import {initSheet,closeSheet,openEditor,openPicker,showNote,confirmDelete,manageSpaces,editSpace,settings} from './forms.js';

subscribe(render);initSheet();
async function toggle(id,date=dateKey()){
 const record=get(id);if(!record||state.busy.has(id))return;
 if(record.kind==='habit'&&(!dueOn(record,date)||date>dateKey()))return;
 state.busy.add(id);render();
 try{await saveRecord({...record,...(record.kind==='task'?{done:!record.done}:{completedDates:record.completedDates.includes(date)?record.completedDates.filter(d=>d!==date):[...record.completedDates,date].sort()})});haptic();}catch(error){toast(error.message);}finally{state.busy.delete(id);render();}
}
function handleClick(event){
 const button=event.target.closest('button');if(!button)return;const d=button.dataset;
 if(d.toggle)return void toggle(d.toggle);
 if(d.habitDay)return void toggle(d.habitDay,d.date);
 if(d.edit){const x=get(d.edit);if(x)openEditor(x.kind,x.id);return;}
 if(d.note)return showNote(d.note);
 if(d.create)return openEditor(d.create);
 if(d.delete)return confirmDelete(d.delete);
 if(d.spaceEdit)return editSpace(d.spaceEdit);
 if('space'in d){state.space=d.space;render();return;}
 if(d.fromNote){const note=get(d.fromNote);if(note)openEditor(d.kind,null,{title:note.title,spaceId:note.spaceId});return;}
 if(d.month){const date=new Date(state.month+'-15T12:00:00');date.setMonth(date.getMonth()+Number(d.month));const key=dateKey(date).slice(0,7);if(key>='2000-01'&&key<='2100-12'){state.month=key;render(true);}return;}
 if(d.action==='spaces')return manageSpaces();
 if(d.action==='task-scope'){state.taskScope=state.taskScope==='all'?'today':'all';render();}
}
$('#main').addEventListener('click',handleClick);$('#sheet-body').addEventListener('click',handleClick);
$('#main').addEventListener('input',event=>{if(event.target.id==='note-search'){state.search=event.target.value;$('#note-list').innerHTML=noteCards();}});
$('#main').addEventListener('change',event=>{if(event.target.id==='show-archived'){state.archived=event.target.checked;render();}});
$('#settings-button').onclick=()=>state.ready&&settings();
$('#add-button').onclick=()=>{if(!state.ready)return;if(state.tab==='today')openPicker();else openEditor({notes:'note',habits:'habit',finance:'transaction'}[state.tab]);};
function navigate(){const requested=location.hash.slice(1);state.tab=['today','notes','habits','finance'].includes(requested)?requested:'today';state.space='';state.search='';render(true);window.scrollTo({top:0});}
window.addEventListener('hashchange',navigate);
window.addEventListener('storage',event=>{if(!state.cloud&&event.key===storageKey){try{state.items=loadDemo();render();}catch{toast('Не удалось обновить записи из другой вкладки.');}}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.ready&&!state.busy.size){refresh().then(()=>render()).catch(error=>toast(error.message));}});
let lastDay=dateKey();
setInterval(()=>{if(dateKey()!==lastDay){lastDay=dateKey();render();}},30000);
async function init(){
 try{
  try{tg?.ready();tg?.expand();if(tg?.isVersionAtLeast('6.1')){tg.setHeaderColor('#0b0b0b');tg.setBackgroundColor('#0b0b0b');}tg?.BackButton?.onClick(closeSheet);}catch{}
  state.config=await fetch('/api/config').then(r=>r.json());
  state.cloud=Boolean(tg?.initData)||(new URLSearchParams(location.search).get('dev')==='1'&&state.config.devAuth);
  await refresh();state.ready=true;$('#mode-banner').hidden=state.cloud;if(!state.cloud)$('#mode-banner').textContent='Режим пробы · записи только в этом браузере';navigate();
  if(document.modelContext?.registerTool){try{document.modelContext.registerTool({name:'list_ritm_records',title:'Прочитать записи Мой ритм',description:'Возвращает заметки, дела, привычки, операции и разделы текущего открытого профиля.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async(input={})=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Этот инструмент не принимает параметры.');await refresh();render();return {items:state.items};}});}catch{}}
 }catch(error){$('#main').innerHTML=`<h1>Нужно чуть<br>подождать.</h1><div class="empty-state"><p>${esc(error.message)}</p><button class="secondary-button" id="retry-load">Попробовать снова</button></div>`;$('#retry-load').onclick=()=>location.reload();}
}
init();
