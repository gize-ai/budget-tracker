const LS={tx:'bt_tx_v3',budget:'bt_budget_v3',goals:'bt_goals_v3',theme:'bt_theme'};
const RATES={USD:92,EUR:100,KZT:0.2};
let transactions=[],goals=[],budgetLimit=0;

const ACH=[{id:'first',name:'Первый шаг',desc:'Первая операция',icon:'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'},{id:'week',name:'Неделя учёта',desc:'7 дней подряд',icon:'M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16z'},{id:'month',name:'Месяц учёта',desc:'30 дней подряд',icon:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'},{id:'saver',name:'Накопитель',desc:'Цель достигнута',icon:'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z'},{id:'big',name:'Крупный доход',desc:'Более 100 000 ₽',icon:'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'}];
let achievements=JSON.parse(localStorage.getItem('bt_ach')||'{}');

function load(){
  try{transactions=JSON.parse(localStorage.getItem(LS.tx))||[]}catch{transactions=[]}
  try{goals=JSON.parse(localStorage.getItem(LS.goals))||[]}catch{goals=[]}
  budgetLimit=parseFloat(localStorage.getItem(LS.budget))||0;
  const t=localStorage.getItem(LS.theme);
  if(t==='light')document.body.style.setProperty('--bg','#f2f2f7');
}
function save(){
  localStorage.setItem(LS.tx,JSON.stringify(transactions));
  localStorage.setItem(LS.goals,JSON.stringify(goals));
  localStorage.setItem(LS.budget,budgetLimit);
  localStorage.setItem('bt_ach',JSON.stringify(achievements));
}

function fmt(n){return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n)}
function fmtDate(iso){const d=new Date(iso);return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}
function esc(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML}

function toast(msg,icon='check'){
  const c=document.getElementById('toastContainer');
  const el=document.createElement('div');el.className='toast';
  const svgs={check:'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',warn:'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',del:'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'};
  el.innerHTML=`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="${svgs[icon]||svgs.check}"/></svg><span>${esc(msg)}</span>`;
  c.appendChild(el);setTimeout(()=>el.remove(),3000);
}

function toggleTheme(){
  const isLight=getComputedStyle(document.body).getPropertyValue('--bg').trim()==='#f2f2f7';
  if(isLight){document.body.style.setProperty('--bg','#050508');localStorage.setItem(LS.theme,'dark')}
  else{document.body.style.setProperty('--bg','#f2f2f7');localStorage.setItem(LS.theme,'light')}
}

function checkAch(id){
  if(!achievements[id]){achievements[id]=true;save();renderAch();toast('Достижение разблокировано!','check')}
}

function renderAch(){
  const el=document.getElementById('achGrid');
  el.innerHTML=ACH.map(a=>{
    const ok=!!achievements[a.id];
    return `<div class="ach-card ${ok?'unlocked':''}"><svg class="ach-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${a.icon}"/></svg><div class="ach-name">${esc(a.name)}</div><div class="ach-desc">${esc(a.desc)}</div></div>`;
  }).join('');
}

function filteredTx(){
  const p=document.getElementById('filterPeriod').value;
  const s=document.getElementById('filterSearch').value.toLowerCase();
  const n=new Date();
  return transactions.filter(t=>{
    const d=new Date(t.date);let ok=true;
    if(p==='today')ok=d.toDateString()===n.toDateString();
    else if(p==='week'){const w=new Date(n);w.setDate(n.getDate()-7);ok=d>=w}
    else if(p==='month')ok=d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();
    if(s)ok=ok&&(t.desc+t.cat).toLowerCase().includes(s);
    return ok;
  });
}

function calcStreak(){
  const days=new Set(transactions.map(t=>new Date(t.date).toDateString()));
  let s=0;const d=new Date();
  while(days.has(d.toDateString())){s++;d.setDate(d.getDate()-1)}
  return s;
}

function render(){
  const txs=filteredTx();
  let inc=0,exp=0;
  txs.forEach(t=>{if(t.type==='income')inc+=t.amount;else exp+=t.amount});
  document.getElementById('sumIncome').textContent=fmt(inc);
  document.getElementById('sumExpense').textContent=fmt(exp);
  document.getElementById('sumBalance').textContent=fmt(inc-exp);

  const streak=calcStreak();
  if(streak>=7)checkAch('week');
  if(streak>=30)checkAch('month');

  // Budget
  const bFill=document.getElementById('budgetFill');
  if(budgetLimit>0){
    const pct=Math.min(100,(exp/budgetLimit)*100);
    document.getElementById('budgetMeta').innerHTML=`<span>${fmt(exp)}</span><span>из ${fmt(budgetLimit)}</span>`;
    setTimeout(()=>{bFill.style.width=pct+'%';bFill.textContent=Math.round(pct)+'%'},50);
    bFill.className='budget-fill '+(pct>90?'crit':pct>70?'warn':'ok');
  }else{
    document.getElementById('budgetMeta').innerHTML='<span>Лимит не задан</span>';
    bFill.style.width='0%';bFill.textContent='';
  }

  // Goals
  const gEl=document.getElementById('goalsList');
  if(goals.length===0)gEl.innerHTML='<div class="empty">Нет целей</div>';
  else gEl.innerHTML=goals.map((g,i)=>{
    const pct=Math.min(100,(g.current/g.target)*100);
    return `<div class="goal"><div class="goal-info"><div class="goal-name">${esc(g.name)}</div><div class="goal-meta">${fmt(g.current)} / ${fmt(g.target)}</div></div><div class="goal-bar-wrap"><div class="goal-bar" style="width:${pct}%"></div></div><div style="display:flex;gap:6px"><button class="btn btn-sec" style="height:32px;padding:0 10px;font-size:12px" onclick="addToGoal(${i})">+</button><button class="btn btn-sec" style="height:32px;padding:0 10px;font-size:12px" onclick="delGoal(${i})">Del</button></div></div>`;
  }).join('');

  // Heatmap
  const hm=document.getElementById('heatmap');hm.innerHTML='';
  const n=new Date();const y=n.getFullYear(),m=n.getMonth();
  const fd=new Date(y,m,1).getDay();const dim=new Date(y,m+1,0).getDate();
  const dm={};transactions.filter(t=>t.type==='expense').forEach(t=>{
    const d=new Date(t.date);if(d.getMonth()===m&&d.getFullYear()===y)dm[d.getDate()]=(dm[d.getDate()]||0)+t.amount;
  });
  const mx=Math.max(...Object.values(dm),1);
  for(let i=0;i<(fd===0?6:fd-1);i++)hm.appendChild(document.createElement('div'));
  for(let d=1;d<=dim;d++){
    const div=document.createElement('div');div.className='hm-day';
    const v=dm[d]||0;const l=v===0?0:v<mx*0.25?1:v<mx*0.5?2:v<mx*0.75?3:4;
    div.classList.add('hm-l'+l);div.textContent=d;
    if(d===n.getDate())div.classList.add('hm-today');
    div.title=v?fmt(v):'Нет трат';
    hm.appendChild(div);
  }

  // Chart
  renderChart(txs);

  // List
  const list=document.getElementById('txList');
  if(txs.length===0){list.innerHTML='<div class="empty">Нет операций</div>';return}
  const sorted=txs.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
  list.innerHTML=sorted.map(t=>{
    const ri=transactions.indexOf(t);const sign=t.type==='income'?'+':'−';
    const cats={'Зарплата':'briefcase','Фриланс':'code','Инвестиции':'trending-up','Продукты':'shopping-cart','Транспорт':'truck','Жильё':'home','Развлечения':'gamepad','Здоровье':'heart','Покупки':'shopping-bag','Образование':'book','Другое':'file'};
    const icons={briefcase:'M10 2h4a2 2 0 012 2v2H8V4a2 2 0 012-2zM4 8h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8z',code:'M16 18l6-6-6-6M8 6l-6 6 6 6','trending-up':'M23 6l-11 11-5-5L0 19','shopping-cart':'M1 1h4l2.68 13.39a2 2 0 001.92 1.61h9.8a2 2 0 001.92-1.61L23 6H6',truck:'M1 3h15v13H1zM16 8h4l3 5v3h-7V8z',home:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',gamepad:'M6 11h4M8 9v4m7-1h.01M18 10h.01M2 6a2 2 0 012-2h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z',heart:'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z','shopping-bag':'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',book:'M4 19.5A2.5 2.5 0 016.5 17H20',file:'M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z'};
    const ic=icons[cats[t.cat]]||icons.file;
    return `<div class="tx-item" data-idx="${ri}" ontouchstart="touchStart(event)" ontouchmove="touchMove(event)" ontouchend="touchEnd(event)"><div class="tx-swipe" style="position:relative;overflow:hidden"><div class="tx-del-bg" onclick="delTx(${ri})">DEL</div><div class="tx-content" style="display:flex;align-items:center;justify-content:space-between;width:100%"><div style="display:flex;align-items:center;gap:12px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-sec);flex-shrink:0"><path d="${ic}"/></svg><div><div style="font-size:14px;font-weight:500">${esc(t.desc||t.cat)}</div><div style="font-size:12px;color:var(--text-sec);margin-top:2px">${fmtDate(t.date)} · ${esc(t.cat)}</div></div></div><div style="display:flex;align-items:center;gap:10px"><div style="font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;color:${t.type==='income'?'var(--positive)':'var(--danger)'}">${sign}${fmt(t.amount)}</div></div></div></div></div>`;
  }).join('');
}

function renderChart(txs){
  const exp={};txs.filter(t=>t.type==='expense').forEach(t=>exp[t.cat]=(exp[t.cat]||0)+t.amount);
  const total=Object.values(exp).reduce((a,b)=>a+b,0);
  const svg=document.getElementById('pieChart');const leg=document.getElementById('chartLegend');
  if(total===0){svg.innerHTML='<text x="90" y="95" text-anchor="middle" fill="var(--text-sec)" font-size="13">Нет данных</text>';leg.innerHTML='';return}
  const colors=['#0a84ff','#ff453a','#30d158','#ff9500','#af52de','#64d2ff','#ffd60a','#ff6482'];
  let start=0;let paths='';let lhtml='';
  Object.entries(exp).sort((a,b)=>b[1]-a[1]).forEach(([cat,val],i)=>{
    const pct=val/total;const end=start+pct*2*Math.PI;
    const x1=90+70*Math.cos(start-Math.PI/2),y1=90+70*Math.sin(start-Math.PI/2);
    const x2=90+70*Math.cos(end-Math.PI/2),y2=90+70*Math.sin(end-Math.PI/2);
    const large=pct>0.5?1:0;
    paths+=`<path d="M90,90 L${x1},${y1} A70,70 0 ${large},1 ${x2},${y2} Z" fill="${colors[i%colors.length]}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
    lhtml+=`<div class="leg-item"><div class="leg-dot" style="background:${colors[i%colors.length]}"></div>${esc(cat)} — ${fmt(val)}</div>`;
    start=end;
  });
  svg.innerHTML=paths+'<circle cx="90" cy="90" r="42" fill="var(--bg)"/>';
  leg.innerHTML=lhtml;
}

// Swipe
let sx=0,swipedIdx=null;
function touchStart(e){sx=e.touches[0].clientX;swipedIdx=null}
function touchMove(e){
  const x=e.touches[0].clientX;const diff=sx-x;
  const item=e.currentTarget;if(diff>50){item.classList.add('swiped');swipedIdx=item.dataset.idx}
  else if(diff<-30)item.classList.remove('swiped');
}
function touchEnd(e){if(swipedIdx!==null)setTimeout(()=>{if(swipedIdx!==null)document.querySelector(`.tx-item[data-idx="${swipedIdx}"]`)?.classList.remove('swiped')},3000)}

function addTx(){
  const type=document.getElementById('tType').value;
  let amount=parseFloat(document.getElementById('tAmount').value);
  const cur=document.getElementById('tCurrency').value;
  const cat=document.getElementById('tCat').value;
  const desc=document.getElementById('tDesc').value.trim();
  if(!amount||amount<=0){toast('Введите сумму','warn');return}
  if(cur!=='RUB')amount=amount*RATES[cur];
  transactions.push({type,amount,cat,desc:desc||cat,date:new Date().toISOString()});
  save();render();
  document.getElementById('tAmount').value='';document.getElementById('tDesc').value='';
  toast('Операция добавлена','check');
  if(transactions.length===1)checkAch('first');
}

function delTx(i){
  const t=transactions[i];
  transactions.splice(i,1);save();render();
  toast('Удалено','del');
}

function editBudget(){
  const v=prompt('Бюджет на месяц (₽):',budgetLimit||'');if(v===null)return;
  budgetLimit=parseFloat(v)||0;save();render();
}

function addGoal(){
  const n=prompt('Название цели:');if(!n)return;
  const t=parseFloat(prompt('Сколько нужно (₽)?'));if(!t)return;
  goals.push({name:n,target:t,current:0});save();render();
}
function addToGoal(i){
  const v=parseFloat(prompt('Сколько отложить (₽)?'));if(!v)return;
  goals[i].current=Math.min(goals[i].target,goals[i].current+v);
  if(goals[i].current>=goals[i].target){checkAch('saver');confetti()}
  save();render();
}
function delGoal(i){goals.splice(i,1);save();render()}

function runSim(){
  const pct=parseInt(document.getElementById('simSlider').value);
  document.getElementById('simPercent').textContent=pct;
  const txs=filteredTx();const exp=txs.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0);
  const saved=exp*(pct/100);
  document.getElementById('simResult').innerHTML=`Экономия за месяц: <b style="color:var(--positive)">${fmt(saved*4)}</b><br>За год: <b style="color:var(--positive)">${fmt(saved*48)}</b>`;
}

function exportCSV(){
  const txs=transactions.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  let csv='Дата,Тип,Категория,Описание,Сумма\n';
  txs.forEach(t=>csv+=`${t.date},${t.type},${t.cat},"${t.desc}",${t.amount}\n`);
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='budget.csv';a.click();URL.revokeObjectURL(url);
  checkAch('exporter');toast('CSV экспортирован','check');
}

// Voice
let recog=null;
function startVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast('Голос не поддерживается','warn');return}
  recog=new SR();recog.lang='ru-RU';recog.interimResults=false;
  document.getElementById('voiceWave').style.display='flex';
  recog.onresult=e=>{
    document.getElementById('voiceWave').style.display='none';
    const text=e.results[0][0].transcript.toLowerCase();
    const m=text.match(/(\d+(?:[\.,]\d+)?)/);const amount=m?parseFloat(m[1].replace(',','.')):0;
    const inc=/зарплата|доход|получил|вышло/.test(text);
    document.getElementById('tType').value=inc?'income':'expense';
    document.getElementById('tAmount').value=amount;
    let cat='Другое';
    if(/еда|продукт/.test(text))cat='Продукты';else if(/транспорт|метро|такси/.test(text))cat='Транспорт';else if(/игра|кино/.test(text))cat='Развлечения';else if(/здоровье|врач/.test(text))cat='Здоровье';else if(/жильё|аренда/.test(text))cat='Жильё';else if(/зарплата|работа/.test(text))cat='Зарплата';
    document.getElementById('tCat').value=cat;
    document.getElementById('tDesc').value=text.substring(0,30);
    toast(`Распознано: ${amount} ₽`,'check');
  };
  recog.onerror=()=>{document.getElementById('voiceWave').style.display='none'};
  recog.start();
}

// Confetti
function confetti(){
  const c=document.getElementById('confetti');const ctx=c.getContext('2d');
  c.width=window.innerWidth;c.height=window.innerHeight;c.style.display='block';
  const parts=[];const colors=['#0a84ff','#30d158','#ff9500','#af52de','#ff453a'];
  for(let i=0;i<150;i++)parts.push({x:Math.random()*c.width,y:Math.random()*c.height-100,vx:(Math.random()-0.5)*4,vy:Math.random()*3+2,s:Math.random()*6+2,c:colors[Math.floor(Math.random()*colors.length)],r:Math.random()*Math.PI*2});
  let frame=0;
  function draw(){
    ctx.clearRect(0,0,c.width,c.height);
    parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.r+=0.1;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s);ctx.restore()});
    frame++;if(frame<120)requestAnimationFrame(draw);else{c.style.display='none'}
  }
  draw();
}

// Parallax
document.addEventListener('mousemove',e=>{
  const x=(e.clientX/window.innerWidth-0.5)*20;
  const y=(e.clientY/window.innerHeight-0.5)*20;
  document.querySelectorAll('.bg-blob::before,.bg-blob::after').forEach(el=>{/* pseudo-elements via CSS vars */});
  document.documentElement.style.setProperty('--parallax-x',x+'px');
  document.documentElement.style.setProperty('--parallax-y',y+'px');
});

document.getElementById('tAmount').addEventListener('keydown',e=>{if(e.key==='Enter')addTx()});
document.getElementById('tDesc').addEventListener('keydown',e=>{if(e.key==='Enter')addTx()});

load();
render();
