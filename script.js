const LS={tx:'fin_tx',debts:'fin_debts',inv:'fin_inv',sections:'fin_sec',settings:'fin_set'};
let transactions=[],debts=[],investments=[],sections=[],settings={};

function load(){
  try{transactions=JSON.parse(localStorage.getItem(LS.tx))||[]}catch{transactions=[]}
  try{debts=JSON.parse(localStorage.getItem(LS.debts))||[]}catch{debts=[]}
  try{investments=JSON.parse(localStorage.getItem(LS.inv))||[]}catch{investments=[]}
  try{sections=JSON.parse(localStorage.getItem(LS.sections))||[]}catch{sections=[]}
  try{settings=JSON.parse(localStorage.getItem(LS.settings))||{}}catch{settings={}}
  if(settings.aiKey)document.getElementById('aiKey').value=settings.aiKey;
  if(settings.tgId)document.getElementById('tgId').value=settings.tgId;
  renderHome();renderDebts();renderInvest();renderCustom();
}

function save(){
  localStorage.setItem(LS.tx,JSON.stringify(transactions));
  localStorage.setItem(LS.debts,JSON.stringify(debts));
  localStorage.setItem(LS.inv,JSON.stringify(investments));
  localStorage.setItem(LS.sections,JSON.stringify(sections));
  localStorage.setItem(LS.settings,JSON.stringify(settings));
}

function fmt(n){return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n)}
function fmtDate(d){return new Date(d).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}

// Navigation
function setScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  event.currentTarget.classList.add('active');
}

// Home
function renderHome(){
  let inc=0,exp=0;
  transactions.forEach(t=>{if(t.type==='income')inc+=t.amount;else exp+=t.amount});
  document.getElementById('totalBalance').textContent=fmt(inc-exp);
  document.getElementById('balanceChange').textContent=(inc>=exp?'+':'')+fmt(inc-exp)+' за все время';
  
  const list=document.getElementById('recentList');
  const sorted=transactions.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,20);
  if(sorted.length===0){list.innerHTML='<div class="list-item"><div class="list-item-sub">Нет операций</div></div>';return}
  list.innerHTML=sorted.map(t=>{
    const isInc=t.type==='income';
    return `<div class="list-item" onclick="deleteTx(${transactions.indexOf(t)})">
      <div class="list-item-left">
        <div class="list-item-title">${esc(t.desc||t.cat)}</div>
        <div class="list-item-sub">${fmtDate(t.date)} · ${esc(t.cat)}</div>
      </div>
      <div class="list-item-right ${isInc?'pos':'neg'}">${isInc?'+':'−'}${fmt(t.amount)}</div>
    </div>`;
  }).join('');
}

let currentTxType='expense';
function setTxType(t){
  currentTxType=t;
  document.getElementById('tx-btn-exp').classList.toggle('active',t==='expense');
  document.getElementById('tx-btn-inc').classList.toggle('active',t==='income');
}
function showAddTx(){document.getElementById('modal-tx').classList.add('active')}
function addTx(){
  const amount=parseFloat(document.getElementById('txAmount').value);
  const desc=document.getElementById('txDesc').value.trim();
  const cat=document.getElementById('txCustomCat').value.trim()||document.getElementById('txCat').value;
  if(!amount){alert('Введите сумму');return}
  transactions.push({type:currentTxType,amount,desc,cat,date:new Date().toISOString()});
  save();renderHome();closeModals();
  document.getElementById('txAmount').value='';
  document.getElementById('txDesc').value='';
  document.getElementById('txCustomCat').value='';
}
function deleteTx(i){if(confirm('Удалить?')){transactions.splice(i,1);save();renderHome()}}

// Debts
let debtTab='owed';
function switchDebtTab(t){
  debtTab=t;
  document.querySelectorAll('.segmented-control button').forEach(b=>b.classList.remove('seg-active'));
  document.getElementById('tab-'+t).classList.add('seg-active');
  renderDebts();
}
function renderDebts(){
  const el=document.getElementById('debtsContent');
  const filtered=debts.filter(d=>d.type===debtTab);
  if(filtered.length===0){el.innerHTML='<div class="list-item"><div class="list-item-sub">Нет записей</div></div>';return}
  el.innerHTML=filtered.map((d,i)=>{
    const originalIdx=debts.indexOf(d);
    return `<div class="list-item" onclick="deleteDebt(${originalIdx})">
      <div class="list-item-left">
        <div class="list-item-title">${esc(d.person)}</div>
        <div class="list-item-sub">${d.rate?d.rate+'% · ':''}${d.dueDate?fmtDate(d.dueDate):'Без срока'}</div>
      </div>
      <div class="list-item-right neg">${fmt(d.amount)}</div>
    </div>`;
  }).join('');
}
function showAddDebt(){document.getElementById('modal-debt').classList.add('active')}
function addDebt(){
  const type=document.getElementById('debtType').value;
  const person=document.getElementById('debtPerson').value.trim();
  const amount=parseFloat(document.getElementById('debtAmount').value)||0;
  const rate=parseFloat(document.getElementById('debtRate').value)||0;
  const due=document.getElementById('debtDate').value||null;
  if(!person){alert('Введите имя');return}
  debts.push({type,person,amount,rate,dueDate:due});
  save();renderDebts();closeModals();
}
function deleteDebt(i){if(confirm('Удалить?')){debts.splice(i,1);save();renderDebts()}}

// Investments
function renderInvest(){
  let totalCost=0,totalValue=0;
  investments.forEach(inv=>{
    totalCost+=inv.qty*inv.buy;
    totalValue+=inv.qty*(inv.current||inv.buy);
  });
  const profit=totalValue-totalCost;
  document.getElementById('investSummary').innerHTML=`
    <div class="label">Портфель</div>
    <div class="value">${fmt(totalValue)}</div>
    <div style="color:${profit>=0?'var(--positive)':'var(--danger)'};margin-top:4px;font-size:14px">${profit>=0?'+':''}${fmt(profit)}</div>
  `;
  const list=document.getElementById('investList');
  if(investments.length===0){list.innerHTML='<div class="list-item"><div class="list-item-sub">Нет инвестиций</div></div>';return}
  list.innerHTML=investments.map((inv,i)=>{
    const val=inv.qty*(inv.current||inv.buy);
    const prof=val-(inv.qty*inv.buy);
    return `<div class="list-item" onclick="deleteInvest(${i})">
      <div class="list-item-left">
        <div class="list-item-title">${esc(inv.name)} ${inv.type==='crypto'?'· Крипта':''}</div>
        <div class="list-item-sub">${inv.qty} шт. · Куплено по ${fmt(inv.buy)}</div>
      </div>
      <div class="list-item-right ${prof>=0?'pos':'neg'}">${fmt(val)}</div>
    </div>`;
  }).join('');
}
function showAddInvest(){document.getElementById('modal-invest').classList.add('active')}
function addInvest(){
  const type=document.getElementById('invType').value;
  const name=document.getElementById('invName').value.trim();
  const qty=parseFloat(document.getElementById('invQty').value)||0;
  const buy=parseFloat(document.getElementById('invBuy').value)||0;
  const current=parseFloat(document.getElementById('invCurrent').value)||0;
  if(!name){alert('Введите название');return}
  investments.push({type,name,qty,buy,current});
  save();renderInvest();closeModals();
}
function deleteInvest(i){if(confirm('Удалить?')){investments.splice(i,1);save();renderInvest()}}

// Custom Sections
function renderCustom(){
  const el=document.getElementById('customSections');
  if(sections.length===0){el.innerHTML='<div class="list-item"><div class="list-item-sub">Нет разделов. Создайте первый.</div></div>';return}
  el.innerHTML=sections.map((sec,i)=>`
    <div class="list-item" onclick="openSection(${i})">
      <div class="list-item-left">
        <div class="list-item-title">${esc(sec.name)}</div>
        <div class="list-item-sub">${sec.items?sec.items.length:0} записей</div>
      </div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
    </div>
  `).join('');
}
function showAddSection(){document.getElementById('modal-section').classList.add('active')}
function addSection(){
  const name=document.getElementById('secName').value.trim();
  if(!name){alert('Введите название');return}
  sections.push({name,items:[]});
  save();renderCustom();closeModals();
}
function openSection(idx){
  const sec=sections[idx];
  const name=prompt('Новая запись в "'+sec.name+'":\nНазвание');
  if(!name)return;
  const sum=prompt('Сумма (число)');
  const note=prompt('Примечание (необязательно)');
  sec.items.push({name,amount:parseFloat(sum)||0,note,date:new Date().toISOString()});
  save();renderCustom();
  alert('Сохранено: '+name+' '+sum+'₽');
}

// Search
function doSearch(){
  const q=document.getElementById('searchInput').value.toLowerCase();
  const el=document.getElementById('searchResults');
  if(!q){el.innerHTML='';return}
  let results=[];
  transactions.forEach(t=>{
    if((t.desc+t.cat).toLowerCase().includes(q))results.push({type:'Операция',title:t.desc||t.cat,sub:t.cat+' · '+fmtDate(t.date),val:(t.type==='income'?'+':'−')+fmt(t.amount)});
  });
  debts.forEach(d=>{
    if(d.person.toLowerCase().includes(q))results.push({type:'Долг',title:d.person,sub:d.type==='owed'?'Мне должны':'Я должен',val:fmt(d.amount)});
  });
  investments.forEach(inv=>{
    if(inv.name.toLowerCase().includes(q))results.push({type:'Инвестиция',title:inv.name,sub:inv.type==='crypto'?'Крипта':'Акция',val:fmt(inv.qty*(inv.current||inv.buy))});
  });
  sections.forEach(sec=>{
    sec.items.forEach(item=>{
      if(item.name.toLowerCase().includes(q))results.push({type:sec.name,title:item.name,sub:fmtDate(item.date),val:fmt(item.amount)});
    });
  });
  
  if(results.length===0){el.innerHTML='<div class="list-item"><div class="list-item-sub">Ничего не найдено</div></div>';return}
  el.innerHTML=results.map(r=>`
    <div class="list-item">
      <div class="list-item-left">
        <div class="list-item-title">${esc(r.title)}</div>
        <div class="list-item-sub">${esc(r.type)} · ${esc(r.sub)}</div>
      </div>
      <div class="list-item-right">${r.val}</div>
    </div>
  `).join('');
}

// AI
async function sendAi(){
  const input=document.getElementById('aiInput');
  const text=input.value.trim();
  if(!text)return;
  const chat=document.getElementById('aiChat');
  chat.innerHTML+=`<div class="ai-msg ai-user">${esc(text)}</div>`;
  input.value='';
  chat.scrollTop=chat.scrollHeight;
  
  // Формируем контекст из данных
  let context='';
  let inc=0,exp=0;
  transactions.forEach(t=>{if(t.type==='income')inc+=t.amount;else exp+=t.amount});
  context+=`Баланс: ${fmt(inc-exp)}. Доходы: ${fmt(inc)}. Расходы: ${fmt(exp)}. `;
  if(debts.length)context+=`Долгов: ${debts.length}. `;
  if(investments.length)context+=`Инвестиций: ${investments.length}. `;
  
  if(!settings.aiKey){
    chat.innerHTML+=`<div class="ai-msg ai-bot">Добавьте API ключ в настройках (OpenRouter), чтобы я мог отвечать. Или вот что я знаю: ${context}</div>`;
    chat.scrollTop=chat.scrollHeight;
    return;
  }
  
  try{
    const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{
      method:'POST',
      headers:{'Authorization':'Bearer '+settings.aiKey,'Content-Type':'application/json'},
      body:JSON.stringify({model:'mistralai/mistral-7b-instruct',messages:[
        {role:'system',content:'Ты финансовый ассистент. Отвечай кратко, по делу. Данные пользователя: '+context},
        {role:'user',content:text}
      ]})
    });
    const data=await res.json();
    const reply=data.choices?.[0]?.message?.content||'Не удалось получить ответ';
    chat.innerHTML+=`<div class="ai-msg ai-bot">${esc(reply)}</div>`;
  }catch(e){
    chat.innerHTML+=`<div class="ai-msg ai-bot">Ошибка сети. Проверьте API ключ.</div>`;
  }
  chat.scrollTop=chat.scrollHeight;
}

// Settings
function showSettings(){document.getElementById('modal-settings').classList.add('active')}
function saveSettings(){
  settings.aiKey=document.getElementById('aiKey').value.trim();
  settings.tgId=document.getElementById('tgId').value.trim();
  save();
}
function exportData(){
  const data={transactions,debts,investments,sections,settings};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='finance-backup.json';a.click();
}
function importData(){document.getElementById('importFile').click()}
function handleImport(e){
  const file=e.target.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=ev=>{
    try{
      const d=JSON.parse(ev.target.result);
      if(d.transactions)transactions=d.transactions;
      if(d.debts)debts=d.debts;
      if(d.investments)investments=d.investments;
      if(d.sections)sections=d.sections;
      save();load();alert('Импортировано');
    }catch{alert('Ошибка импорта')}
  };
  r.readAsText(file);
}

// Utils
function esc(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML}
function closeModals(){document.querySelectorAll('.modal').forEach(m=>m.classList.remove('active'))}
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModals()}));

// Init
load();
