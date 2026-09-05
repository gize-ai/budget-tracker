const LS={tx:'ld_tx',proj:'ld_proj',debts:'ld_debts',inv:'ld_inv',notes:'ld_notes',folders:'ld_folders',habits:'ld_habits',set:'ld_set'};
let data={tx:[],projects:[],debts:[],invest:[],notes:[],folders:[],habits:[],settings:{}};
let currentPage='home';
let currentSub='proj';
let currentSubLife='notes';
let activeDebtIdx=null;
let txType='expense';

function init(){
  load();
  render();
  document.addEventListener('click',e=>{if(e.target.classList.contains('sheet-overlay'))closeSheets()});
  document.addEventListener('scroll',parallax,{passive:true});
}

function load(){
  Object.keys(LS).forEach(k=>{
    try{data[k]=JSON.parse(localStorage.getItem(LS[k]))||data[k]}catch{}
  });
}

function save(){
  Object.keys(LS).forEach(k=>localStorage.setItem(LS[k],JSON.stringify(data[k])));
}

function fmt(n){return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n||0)}
function esc(t){const d=document.createElement('div');d.textContent=t||'';return d.innerHTML}
function today(){return new Date().toISOString().split('T')[0]}
function vibrate(){if(navigator.vibrate)navigator.vibrate(8)}

function toast(m){
  const b=document.getElementById('toastBox');
  const el=document.createElement('div');el.className='toast';el.textContent=m;
  b.appendChild(el);setTimeout(()=>el.remove(),2500);
}

/* Navigation */
function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
  vibrate();
}

function navigate(page){
  vibrate();
  currentPage=page;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  event.currentTarget.classList.add('active');
  
  const titles={home:'Главная',projects:'Финансы',life:'Жизнь',settings:'Настройки'};
  document.getElementById('pageTitle').textContent=titles[page]||'';
  
  toggleSidebar();
  render();
}

function switchSub(sub){
  vibrate();
  currentSub=sub;
  document.querySelectorAll('#page-projects .sub-btn').forEach(b=>b.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('#page-projects .sub-page').forEach(p=>p.classList.remove('active'));
  document.getElementById('sub-'+sub).classList.add('active');
  render();
}

function switchSubLife(sub){
  vibrate();
  currentSubLife=sub;
  document.querySelectorAll('#page-life .sub-btn').forEach(b=>b.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('#page-life .sub-page').forEach(p=>p.classList.remove('active'));
  document.getElementById('sub-'+sub).classList.add('active');
  render();
}

/* Render */
function render(){
  renderHome();
  renderProjects();
  renderDebts();
  renderInvest();
  renderNotes();
  renderHabits();
  renderSettings();
}

function renderHome(){
  let inc=0,exp=0;
  data.tx.forEach(t=>{if(t.type==='income')inc+=t.amount;else exp+=t.amount});
  const bal=inc-exp;
  
  const balEl=document.getElementById('homeBalance');
  balEl.textContent=fmt(bal);
  balEl.classList.add('count-anim');
  setTimeout(()=>balEl.classList.remove('count-anim'),600);
  
  // Monthly change
  const now=new Date();
  let mInc=0,mExp=0;
  data.tx.forEach(t=>{
    const d=new Date(t.date);
    if(d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()){
      if(t.type==='income')mInc+=t.amount;else mExp+=t.amount;
    }
  });
  document.getElementById('homeChange').textContent=(mInc>=mExp?'+':'')+fmt(mInc-mExp)+' за месяц';
  
  // Debt badge
  let dTotal=0;
  data.debts.forEach(d=>dTotal+=d.left);
  const badge=document.getElementById('debtBadge');
  if(dTotal>0){badge.style.display='inline-flex';document.getElementById('debtBadgeSum').textContent=fmt(dTotal)}
  else{badge.style.display='none'}
  
  // Analytics
  document.getElementById('anSave').textContent=fmt(mInc*0.2); // 20% экономия для примера
  document.getElementById('anYear').textContent=fmt((mInc-mExp)*12);
  
  // Recent list
  const list=document.getElementById('homeList');
  const sorted=data.tx.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,15);
  if(sorted.length===0){list.innerHTML='<div class="empty">Нет операций</div>';return}
  list.innerHTML=sorted.map(t=>{
    const isInc=t.type==='income';
    return `<div class="list-item" onclick="deleteTx(${data.tx.indexOf(t)})">
      <div class="list-left"><div class="list-title">${esc(t.desc||t.cat)}</div><div class="list-sub">${fmtDate(t.date)} · ${esc(t.cat)}</div></div>
      <div class="list-right ${isInc?'pos':'neg'}">${isInc?'+':'−'}${fmt(t.amount)}</div>
    </div>`;
  }).join('');
}

function fmtDate(iso){
  const d=new Date(iso);
  return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
}

/* Transactions */
function showAdd(){showSheet('sheet-tx');fillProjectSelect();}
function setTxType(t){txType=t;document.querySelectorAll('.tx-type').forEach(b=>b.classList.remove('active'));event.target.classList.add('active');}
function fillProjectSelect(){
  const s=document.getElementById('txProject');
  s.innerHTML='<option value="">Без раздела</option>'+data.projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
}

function addTx(){
  const sum=parseFloat(document.getElementById('txSum').value)||0;
  const cat=document.getElementById('txCat').value.trim()||'Без категории';
  const desc=document.getElementById('txDesc').value.trim();
  const proj=document.getElementById('txProject').value;
  if(!sum){toast('Введите сумму');return}
  
  data.tx.push({type:txType,amount:sum,cat,desc,project:proj,date:new Date().toISOString()});
  save();closeSheets();render();toast('Сохранено');
  document.getElementById('txSum').value='';
  document.getElementById('txCat').value='';
  document.getElementById('txDesc').value='';
}

function deleteTx(i){if(confirm('Удалить операцию?')){data.tx.splice(i,1);save();render();toast('Удалено');}}

/* Projects */
function renderProjects(){
  const list=document.getElementById('projList');
  if(data.projects.length===0){list.innerHTML='<div class="empty">Нет разделов. Создайте первый.</div>';return}
  list.innerHTML=data.projects.map((p,i)=>{
    let inc=0,exp=0;
    data.tx.filter(t=>t.project===p.id).forEach(t=>{if(t.type==='income')inc+=t.amount;else exp+=t.amount});
    const prof=inc-exp;
    return `<div class="list-item" onclick="openProject(${i})">
      <div class="list-left"><div class="list-title">${esc(p.name)}</div><div class="list-sub">Вложено: ${fmt(exp)} · Доход: ${fmt(inc)}</div></div>
      <div class="list-right ${prof>=0?'pos':'neg'}">${prof>=0?'+':''}${fmt(prof)}</div>
    </div>`;
  }).join('');
}

function openProject(idx){
  const p=data.projects[idx];
  const txs=data.tx.filter(t=>t.project===p.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  let inc=0,exp=0;
  txs.forEach(t=>{if(t.type==='income')inc+=t.amount;else exp+=t.amount});
  
  const html=`
    <div style="margin-bottom:16px"><button class="header-btn" onclick="backFromProject()" style="margin-bottom:12px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
    <h2 style="font-size:24px;font-weight:700;margin-bottom:12px">${esc(p.name)}</h2>
    <div class="project-stat"><div class="p-stat"><div class="label">Вложено</div><div class="value">${fmt(exp)}</div></div><div class="p-stat"><div class="label">Доход</div><div class="value">${fmt(inc)}</div></div><div class="p-stat"><div class="label">Итог</div><div class="value" style="color:${inc-exp>=0?'var(--accent)':'var(--accent-red)'}">${inc-exp>=0?'+':''}${fmt(inc-exp)}</div></div></div>
    <div class="list">${txs.length?txs.map(t=>`<div class="list-item" onclick="deleteTx(${data.tx.indexOf(t)})"><div class="list-left"><div class="list-title">${esc(t.desc||t.cat)}</div><div class="list-sub">${fmtDate(t.date)}</div></div><div class="list-right ${t.type==='income'?'pos':'neg'}">${t.type==='income'?'+':'−'}${fmt(t.amount)}</div></div>`).join(''):'<div class="empty">Нет операций</div>'}</div></div>
  `;
  document.getElementById('sub-proj').innerHTML=html;
}

function backFromProject(){renderProjects();document.getElementById('sub-proj').innerHTML='<div class="list" id="projList"></div><button class="add-btn" onclick="showModal(\'modal-project\')">+ Новый раздел</button>';renderProjects();}

function addProject(){
  const n=document.getElementById('projName').value.trim();
  if(!n){toast('Введите название');return}
  data.projects.push({id:Date.now().toString(),name:n});
  save();closeSheets();render();toast('Раздел создан');
  document.getElementById('projName').value='';
}

/* Debts */
function renderDebts(){
  const list=document.getElementById('debtList');
  if(data.debts.length===0){list.innerHTML='<div class="empty">Нет долгов</div>';return}
  list.innerHTML=data.debts.map((d,i)=>`
    <div class="list-item" onclick="showDebtPay(${i})">
      <div class="list-left"><div class="list-title">${esc(d.name)}</div><div class="list-sub">Осталось: ${fmt(d.left)}${d.rate?' · '+d.rate+'%':''}${d.due?' · до '+d.due:''}</div></div>
      <div class="list-right neg">${fmt(d.left)}</div>
    </div>
  `).join('');
}

function addDebt(){
  const n=document.getElementById('debtName').value.trim();
  const s=parseFloat(document.getElementById('debtSum').value)||0;
  const r=parseFloat(document.getElementById('debtRate').value)||0;
  const d=document.getElementById('debtDue').value;
  if(!n||!s){toast('Заполните поля');return}
  data.debts.push({id:Date.now(),name:n,total:s,left:s,rate:r,due:d,payments:[]});
  save();closeSheets();render();toast('Долг добавлен');
}

function showDebtPay(i){activeDebtIdx=i;showSheet('sheet-debtpay');}
function payDebt(){
  const sum=parseFloat(document.getElementById('debtPaySum').value)||0;
  if(!sum||activeDebtIdx===null)return;
  data.debts[activeDebtIdx].left=Math.max(0,data.debts[activeDebtIdx].left-sum);
  data.debts[activeDebtIdx].payments.push({amount:sum,date:today()});
  save();closeSheets();render();toast('Платёж учтён');
  document.getElementById('debtPaySum').value='';
}

/* Invest */
function renderInvest(){
  const list=document.getElementById('invList');
  if(data.invest.length===0){list.innerHTML='<div class="empty">Нет инвестиций</div>';return}
  list.innerHTML=data.invest.map((inv,i)=>{
    let val=0,prof=0;
    if(inv.kind==='deposit'){
      const days=Math.max(1,Math.floor((Date.now()-new Date(inv.date).getTime())/86400000));
      const rateDaily=(inv.rate||0)/365/100;
      val=inv.amount*Math.pow(1+rateDaily,days);
      prof=val-inv.amount;
    }else if(inv.kind==='crypto'){
      val=(inv.current||inv.price||0)*(inv.qty||1);
      prof=val-(inv.price||0)*(inv.qty||1);
    }else{
      val=inv.amount;prof=0;
    }
    return `<div class="list-item" onclick="deleteInvest(${i})">
      <div class="list-left"><div class="list-title">${esc(inv.name)}</div><div class="list-sub">${inv.kind==='deposit'?'Вклад':inv.kind==='crypto'?'Крипта':'Другое'}</div></div>
      <div class="list-right ${prof>=0?'pos':'neg'}">${fmt(val)}</div>
    </div>`;
  }).join('');
}

function onInvKind(){
  const k=document.getElementById('invKind').value;
  document.getElementById('invRate').style.display=k==='deposit'?'block':'none';
  document.getElementById('invPrice').style.display=k==='crypto'?'block':'none';
  document.getElementById('invCurrent').style.display=k==='crypto'?'block':'none';
}

function addInvest(){
  const k=document.getElementById('invKind').value;
  const n=document.getElementById('invName').value.trim();
  const a=parseFloat(document.getElementById('invAmount').value)||0;
  if(!n||!a){toast('Заполните поля');return}
  
  const obj={id:Date.now(),kind:k,name:n,amount:a,date:today()};
  if(k==='deposit')obj.rate=parseFloat(document.getElementById('invRate').value)||0;
  if(k==='crypto'){obj.qty=a;obj.price=parseFloat(document.getElementById('invPrice').value)||0;obj.current=parseFloat(document.getElementById('invCurrent').value)||0;}
  data.invest.push(obj);
  save();closeSheets();render();toast('Сохранено');
}

function deleteInvest(i){if(confirm('Удалить?')){data.invest.splice(i,1);save();render();toast('Удалено');}}

/* Notes */
let activeFolder='';

function renderNotes(){
  // Folders
  const fWrap=document.getElementById('noteFolders');
  let html=`<button class="folder-chip ${activeFolder===''?'active':''}" onclick="setFolder('')">Все</button>`;
  html+=`<button class="folder-chip add" onclick="showSheet('sheet-folder')">+</button>`;
  data.folders.forEach(f=>{
    html+=`<button class="folder-chip ${activeFolder===f.id?'active':''}" onclick="setFolder('${f.id}')">${esc(f.name)}</button>`;
  });
  fWrap.innerHTML=html;
  
  // Notes list
  const list=document.getElementById('noteList');
  let notes=data.notes;
  if(activeFolder)notes=notes.filter(n=>n.folder===activeFolder);
  if(notes.length===0){list.innerHTML='<div class="empty">Нет заметок</div>';return}
  list.innerHTML=notes.map((n,i)=>`
    <div class="list-item" onclick="editNote(${data.notes.indexOf(n)})">
      <div class="list-left"><div class="list-title">${esc(n.title||'Без названия')}</div><div class="list-sub">${n.body?n.body.substring(0,40)+'...':'Пусто'}</div></div>
    </div>
  `).join('');
  
  // Update select in modal
  const sel=document.getElementById('noteFolder');
  sel.innerHTML='<option value="">Общие</option>'+data.folders.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
}

function setFolder(id){activeFolder=id;renderNotes();}

function addNote(){
  const t=document.getElementById('noteTitle').value.trim();
  const b=document.getElementById('noteBody').value.trim();
  const f=document.getElementById('noteFolder').value;
  if(!t&&!b){toast('Заметка пуста');return}
  data.notes.push({id:Date.now(),title:t,body:b,folder:f,date:today()});
  save();closeSheets();render();toast('Заметка сохранена');
  document.getElementById('noteTitle').value='';
  document.getElementById('noteBody').value='';
}

function addFolder(){
  const n=document.getElementById('folderName').value.trim();
  if(!n)return;
  data.folders.push({id:Date.now().toString(),name:n});
  save();closeSheets();render();toast('Папка создана');
  document.getElementById('folderName').value='';
}

function editNote(idx){
  const n=data.notes[idx];
  const t=prompt('Заголовок:',n.title||'');
  if(t===null)return;
  const b=prompt('Текст:',n.body||'');
  if(b===null)return;
  n.title=t;n.body=b;
  save();render();toast('Обновлено');
}

/* Habits */
function renderHabits(){
  const list=document.getElementById('habitList');
  if(data.habits.length===0){list.innerHTML='<div class="empty">Нет привычек</div>';return}
  
  const now=new Date();const y=now.getFullYear();const m=now.getMonth();
  const dim=new Date(y,m+1,0).getDate();
  
  list.innerHTML=data.habits.map((h,i)=>{
    // streak
    let streak=0;const checks=h.checks||{};
    for(let d=now.getDate();d>=1;d--){
      const key=`${y}-${m}-${d}`;
      if(checks[key])streak++;else break;
    }
    
    let cal='';
    for(let d=1;d<=dim;d++){
      const key=`${y}-${m}-${d}`;
      const isDone=!!checks[key];
      const isToday=d===now.getDate();
      cal+=`<div class="habit-day ${isDone?'done':''} ${isToday?'today':''}" onclick="toggleHabitDay(${i},'${key}')">${d}</div>`;
    }
    
    return `<div class="habit-card">
      <div class="habit-header"><div class="habit-name">${esc(h.name)}</div><div class="habit-streak">${streak} дней 🔥</div></div>
      <div class="habit-cal">${cal}</div>
      <button style="margin-top:10px;width:100%;height:36px;border-radius:10px;border:none;background:var(--card-hover);color:var(--accent-red);font-size:14px;font-weight:600;cursor:pointer" onclick="deleteHabit(${i})">Удалить</button>
    </div>`;
  }).join('');
}

function addHabit(){
  const n=document.getElementById('habitName').value.trim();
  if(!n){toast('Введите название');return}
  data.habits.push({id:Date.now(),name:n,checks:{}});
  save();closeSheets();render();toast('Привычка добавлена');
  document.getElementById('habitName').value='';
}

function toggleHabitDay(hIdx,key){
  vibrate();
  const h=data.habits[hIdx];
  h.checks=h.checks||{};
  if(h.checks[key])delete h.checks[key];else h.checks[key]=true;
  save();render();
}

function deleteHabit(i){if(confirm('Удалить привычку?')){data.habits.splice(i,1);save();render();toast('Удалено');}}

/* Settings */
function renderSettings(){
  document.getElementById('setTgId').value=data.settings.tgId||'';
}

function saveSet(){
  data.settings.tgId=document.getElementById('setTgId').value.trim();
  save();toast('Сохранено');
}

function exportData(){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='lifedash-backup.json';a.click();
  toast('Экспортировано');
}

function importData(){document.getElementById('importFile').click();}
function handleImport(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{
    try{
      const d=JSON.parse(ev.target.result);
      Object.assign(data,d);save();render();toast('Импортировано');
    }catch{toast('Ошибка импорта');}
  };
  r.readAsText(f);
}

function clearAll(){if(confirm('ВСЕ данные будут удалены. Продолжить?')){localStorage.clear();location.reload();}}

/* Sheets / Modals */
function showSheet(id){
  document.querySelectorAll('.bottom-sheet').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById('sheetOverlay').classList.add('active');
  onInvKind();
}

function showModal(type){ /* legacy */ showSheet(type.replace('modal','sheet')); }
function closeSheets(){
  document.querySelectorAll('.bottom-sheet').forEach(s=>s.classList.remove('active'));
  document.getElementById('sheetOverlay').classList.remove('active');
}

/* Parallax */
function parallax(){
  const y=window.scrollY||document.querySelector('.main-content').scrollTop;
  document.body.style.setProperty('--parallax-y',(y*0.05)+'px');
}

/* Init */
init();
