const $=(s,r=document)=>r.querySelector(s);
const rnd=n=>Math.floor(Math.random()*n);
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const el=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- Questionnaire ---------- */
const Q=[
 {id:'name',t:"What is your child's name?",kind:'text',hint:'Cloudy will use it in the games.'},
 {id:'age',t:'How old is your child?',kind:'range',hint:'FlexiKeys is made for children aged 2 to 18.'},
 {id:'parts',t:'Which parts of the body are affected?',kind:'multi',hint:'Tick all that apply.',ex:'none',
  o:[['left_arm','Left arm'],['right_arm','Right arm'],['left_leg','Left leg'],['right_leg','Right leg'],['trunk','Back and tummy'],['none','None']]},
 {id:'move',t:'How does your child move around?',kind:'single',
  o:[['alone','Walks alone'],['help','Walks with help'],['sits','Sits, does not walk yet'],['lies','Mostly lies down']]},
 {id:'screen',t:'How does your child use a phone or tablet?',kind:'single',
  o:[['finger','Taps with one finger'],['hand','Uses the whole hand'],['switch','Needs very big buttons or a switch']]},
 {id:'goals',t:'What do you want to grow first?',kind:'multi',max:2,hint:'Choose one or two.',
  o:[['attention','Attention'],['memory','Memory'],['speech','Speech and reading'],['math','Math'],['hands','Hand skills'],['movement','Movement']]},
 {id:'words',t:'Does your child follow simple spoken requests?',kind:'single',hint:'For example: "Show me the cat."',
  o:[['yes','Yes, easily'],['some','Sometimes'],['no','Not yet']]},
 {id:'mins',t:'How many minutes a day can you give?',kind:'single',o:[[5,'5 minutes'],[10,'10 minutes'],[20,'20 minutes']]}
];
const ans={age:6}; let qi=0;
function answered(q){const v=ans[q.id];return q.kind==='text'?!!(v&&v.trim()):q.kind==='multi'?!!(v&&v.length):v!=null}
function drawQ(){
  const q=Q[qi],b=$('#qBody');
  $('#qCount').textContent=`Question ${qi+1} of ${Q.length}`;
  $('#qDots').innerHTML=Q.map((_,i)=>`<i class="${i<=qi?'on':''}"></i>`).join('');
  b.innerHTML=`<h3>${q.t}</h3>${q.hint?`<p class="hint">${q.hint}</p>`:''}`;
  if(q.kind==='text'){
    const i=el('input');i.type='text';i.id='q-name';i.placeholder='For example: Ali';i.maxLength=20;i.value=ans.name||'';i.setAttribute('aria-label',q.t);
    i.oninput=()=>{ans.name=i.value;sync()};i.onkeydown=e=>{if(e.key==='Enter'&&answered(q))next()};b.append(i);
  }else if(q.kind==='range'){
    const w=el('div','age',`<input type="range" id="q-age" min="2" max="18" value="${ans.age}" aria-label="${q.t}"><output>${ans.age}</output>`);
    w.firstChild.oninput=e=>{ans.age=+e.target.value;w.lastChild.textContent=ans.age};b.append(w);
  }else{
    const g=el('div','opts');
    q.o.forEach(([v,label])=>{
      const on=q.kind==='multi'?(ans[q.id]||[]).includes(v):ans[q.id]===v;
      const o=el('button','opt',label);o.type='button';o.setAttribute('aria-pressed',on);
      o.onclick=()=>{
        if(q.kind==='single')ans[q.id]=v;
        else{let a=ans[q.id]||[];
          if(a.includes(v))a=a.filter(x=>x!==v);
          else if(v===q.ex)a=[v];
          else{a=a.filter(x=>x!==q.ex);if(q.max&&a.length>=q.max)a.shift();a.push(v)}
          ans[q.id]=a}
        drawQ()};
      g.append(o)});
    b.append(g);
  }
  sync();
}
function sync(){$('#qBack').disabled=qi===0;const n=$('#qNext');n.disabled=!answered(Q[qi]);n.textContent=qi===Q.length-1?'Make the plan':'Next'}
function next(){if(qi<Q.length-1){qi++;drawQ()}else{drawPlan(ans,false);$('#plan').scrollIntoView();Cloudy.cheer(`${ans.name.trim()}'s plan is ready.`)}}
$('#qNext').onclick=next; $('#qBack').onclick=()=>{if(qi>0){qi--;drawQ()}};

/* ---------- Plan ---------- */
const GOAL={attention:['Attention',['Find the Same','Odd One Out']],memory:['Memory',['Card Pairs','Light Path']],speech:['Speech and reading',['Listen and Pick','Rhyme Time']],
  math:['Math',['More or Less','Missing Number']],hands:['Hand skills',['Draw the Path','Water Pipes']],movement:['Movement',[]]};
const SCREEN={finger:'Normal buttons, one tap to choose.',hand:'Big buttons with space between them. Hold to choose, so a slip of the hand is not counted.',switch:'Very big buttons, one highlighted at a time. One press on any switch or key chooses.'};
function exercisesFor(a){
  if(a.move==='lies')return['Tummy time with a toy','Rolling to the side'];
  const p=a.parts||[],x=[];
  if(p.some(v=>v.endsWith('arm')))x.push('Reach for a toy','Open and close the hand');
  if(p.some(v=>v.endsWith('leg')))x.push(a.move==='sits'?'Sitting balance':'Sit to stand');
  if(p.includes('trunk'))x.push('Sitting balance');
  if(!x.length)x.push('Animal walks','Sit to stand');
  return[...new Set(x)].slice(0,3);
}
function drawPlan(a,example){
  const name=esc((a.name||'').trim()||'Your child');
  let goals=a.goals.filter(g=>GOAL[g][1].length); if(!goals.length)goals=['attention'];
  const pool=goals.flatMap(g=>GOAL[g][1]);
  const play=Math.max(3,Math.round(a.mins*.7)),move=a.mins-play,each=Math.max(1,Math.round(play/3));
  const ex=exercisesFor(a);
  $('#planName').textContent=(a.name||'').trim()||'Your child';
  $('#planTag').hidden=!example;
  $('#planLead').textContent=example?'This is an example. Answer the 8 questions above and it becomes your child\'s plan.':`Made from your answers. It changes as ${(a.name||'').trim()} plays.`;
  const slot=(ic,k,t,m)=>`<div class="slot"><div class="ic" aria-hidden="true">${ic}</div><div><small>${k}</small><b>${t}</b></div><span class="m">${m} min</span></div>`;
  $('#planToday').innerHTML=`<h3>Today, ${a.mins} minutes</h3>`+
    slot('🌱','Easy win',pool[0],each)+slot('🌿','A little harder',pool[1]||pool[0],each)+
    slot('🎈',`${name}'s choice`,'Any open game',each)+slot('🤸','Move together',ex[0],Math.max(1,move));
  $('#planSide').innerHTML=`<h3>Focus this week</h3><div class="chips">${a.goals.map(g=>`<span class="chip">${GOAL[g][0]}</span>`).join('')}</div>
    <h3>Screen setup</h3><p>${SCREEN[a.screen]}</p>
    <h3>Level</h3><p>${name} starts at Seed${a.words==='no'?', with pictures and sounds, no reading':''}. Harder levels open by success, never by age.</p>
    <p>This plan is not a diagnosis.</p>`;
  drawVids(ex);
}

/* ---------- Videos ---------- */
const VIDS=[['Reach for a toy','Arms'],['Open and close the hand','Hands'],['Sit to stand','Legs'],['Sitting balance','Back and tummy'],['Tummy time with a toy','Whole body'],['Animal walks','Whole body'],['Rolling to the side','Whole body']];
function drawVids(mine){
  const list=[...VIDS.filter(v=>mine.includes(v[0])),...VIDS.filter(v=>!mine.includes(v[0]))].slice(0,6);
  $('#vids').innerHTML=list.map(([t,p])=>`<div class="vid tilt"><div class="poster" role="img" aria-label="Video slot"></div><div class="t"><h3>${t}</h3><small>${p} · about 2 min</small><br>${mine.includes(t)?'<span class="pill in">In the plan</span> ':''}<span class="pill">Waiting for physio check</span></div></div>`).join('');
}

/* ---------- Games ---------- */
const TIERS=[['Seed','first steps'],['Sprout','getting harder'],['Tree','school level'],['Summit','hard for adults']];
const GAMES=[{id:'find',e:'☁️',n:'Find Cloudy',a:'Attention · Cloudy game'},{id:'grow',e:'🌧️',n:'Grow Cloudy',a:'Memory and order · Cloudy game'},{id:'same',e:'🔎',n:'Find the Same',a:'Attention'},{id:'pairs',e:'🃏',n:'Card Pairs',a:'Memory'},{id:'path',e:'⭐',n:'Light Path',a:'Memory'},{id:'num',e:'➕',n:'Missing Number',a:'Math'}];
const EASY=['🐶','🍎','🚗','🌙','🐟','🌻','🎈','🏠','🐢','🦋','🍌','⚽'], CLOSE=['🍎','🍅','🍒','🍓','🍑','🍊','🍋','🍐','🥭'];
let tier=0,game='find',round=0,miss=0,timers=[];
const stage=$('#stage');
const later=(f,ms)=>timers.push(setTimeout(f,ms));
function drawPickers(){
  $('#tiers').innerHTML='';TIERS.forEach(([n,s],i)=>{const b=el('button','tier',`${n}<small>${s}</small>`);b.setAttribute('aria-pressed',i===tier);b.onclick=()=>{tier=i;startGame()};$('#tiers').append(b)});
  $('#gamePick').innerHTML='';GAMES.forEach((g,gi)=>{const b=el('button','gp tilt'+(gi<2?' big':''),`<span class="e" aria-hidden="true">${g.e}</span><b>${g.n}</b><small>${g.a}</small>`);b.setAttribute('aria-pressed',g.id===game);b.onclick=()=>{game=g.id;startGame()};$('#gamePick').append(b)});
}
const ROUNDS=()=>game==='grow'?4:game==='pairs'&&tier>0?1:3;
function startGame(){round=0;drawPickers();newRound()}
function head(text){
  timers.forEach(clearTimeout);timers=[];miss=0;stage.innerHTML='';
  stage.append(el('div','rd',Array.from({length:ROUNDS()},(_,i)=>`<i class="${i<round?'on':''}"></i>`).join('')),el('div','say',text));
}
function grid(cols,size){const g=el('div','grid');g.style.gridTemplateColumns=`repeat(${cols},auto)`;g.style.setProperty('--s',Math.min(size,Math.floor((Math.min(stage.clientWidth,560)-40-(cols-1)*10)/cols))+'px');stage.append(g);return g}
function nudge(t){t.classList.remove('nudge');void t.offsetWidth;t.classList.add('nudge');miss++}
function win(){
  for(let i=0;i<6;i++){const s=el('span','star','★');s.style.left=10+rnd(80)+'%';s.style.animationDelay=i*70+'ms';stage.append(s)}
  round++;stage.querySelectorAll('.rd i').forEach((d,i)=>d.classList.toggle('on',i<round));
  if(round<ROUNDS())later(newRound,1100);
  else later(()=>{
    head('Well done!');const r=el('div','q-nav');
    const again=el('button','btn ghost','Play again');again.onclick=startGame;r.append(again);
    if(tier<3){const up=el('button','btn',`Try ${TIERS[tier+1][0]}`);up.onclick=()=>{tier++;startGame()};r.append(up)}
    stage.append(r);Cloudy.cheer('Well done! Look, I changed.');
  },1100);
}
function newRound(){({find:gFind,grow:gGrow,same:gSame,pairs:gPairs,path:gPath,num:gNum})[game]()}

function gSame(){
  head('Find the same picture');
  const n=[3,6,9,16][tier];let items,ti;
  if(tier===3){items=shuffle(Array.from({length:16},(_,i)=>({e:'🔑',r:i*22.5})))}
  else items=shuffle(tier===2?CLOSE:EASY).slice(0,n).map(e=>({e,r:0}));
  ti=rnd(n);
  const tg=el('div','tile target',`<span style="transform:rotate(${items[ti].r}deg)">${items[ti].e}</span>`);tg.style.setProperty('--s','84px');stage.append(tg);
  const g=grid(n===16?4:3,n>6?72:84);
  items.forEach((it,i)=>{const b=el('button','tile',`<span style="transform:rotate(${it.r}deg)">${it.e}</span>`);b.setAttribute('aria-label',tier===3?`Key turned ${it.r} degrees`:it.e);
    b.onclick=()=>{if(i===ti){b.classList.add('ok');g.querySelectorAll('.tile').forEach(x=>x.disabled=true);win()}
      else{nudge(b);if(miss>=2)g.children[ti].classList.add('pulse');if(miss>=4)[...g.children].forEach((x,j)=>j!==ti&&x.classList.add('dim'))}};
    g.append(b)});
}
function gPairs(){
  head('Turn the cards and find the pairs');
  const p=[2,4,6,10][tier],cols=[2,4,4,5][tier];
  const cards=shuffle([...shuffle(EASY).slice(0,p),...shuffle(EASY).slice(0,0)].flatMap(e=>[e,e]));
  const g=grid(cols,84);let open=[],left=p,bad=0,lock=false;
  cards.forEach((e,i)=>{const b=el('button','tile flip',`<span class="in"><span class="f a"></span><span class="f b">${e}</span></span>`);b.setAttribute('aria-label','Card');
    b.onclick=()=>{if(lock||b.classList.contains('open')||b.classList.contains('ok'))return;
      b.classList.add('open');b.setAttribute('aria-label',e);open.push(b);
      if(open.length<2)return;
      const [x,y]=open;open=[];
      if(x.dataset.e===y.dataset.e){later(()=>{x.classList.add('ok');y.classList.add('ok');if(--left===0)win()},350)}
      else{lock=true;bad++;later(()=>{x.classList.remove('open');y.classList.remove('open');x.setAttribute('aria-label','Card');y.setAttribute('aria-label','Card');lock=false;
        if(bad>=4){bad=0;const c=[...g.children].find(k=>!k.classList.contains('ok'));if(c){const tw=[...g.children].filter(k=>k.dataset.e===c.dataset.e);tw.forEach(k=>k.classList.add('pulse'));later(()=>tw.forEach(k=>k.classList.remove('pulse')),2000)}}},900)}};
    b.dataset.e=e;g.append(b)});
}
function gPath(){
  const size=[3,3,4,5][tier],len=[3,4,6,8][tier],rev=tier===3;
  head(rev?'Watch the stars, then tap them in reverse order':'Watch the stars, then tap them in the same order');
  const g=grid(size,size>3?64:84),cells=[];
  for(let i=0;i<size*size;i++){const b=el('button','tile','');b.setAttribute('aria-label',`Square ${i+1}`);b.disabled=true;cells.push(b);g.append(b)}
  const seq=shuffle(cells.map((_,i)=>i)).slice(0,len),want=rev?[...seq].reverse():seq;let pos=0;
  const again=el('button','btn ghost','Show again');stage.append(again);
  function show(){cells.forEach(c=>{c.disabled=true;c.classList.remove('pulse')});again.disabled=true;
    seq.forEach((c,i)=>{later(()=>{cells[c].classList.add('lit');cells[c].textContent='★'},500+i*750);later(()=>{cells[c].classList.remove('lit');cells[c].textContent=''},500+i*750+550)});
    later(()=>{cells.forEach(c=>c.disabled=false);again.disabled=false},500+len*750)}
  again.onclick=()=>{pos=0;cells.forEach(c=>{c.classList.remove('ok');c.textContent=''});show()};
  cells.forEach((b,i)=>b.onclick=()=>{
    if(b.classList.contains('ok'))return;
    if(i===want[pos]){b.classList.add('ok');b.classList.remove('pulse');b.textContent='★';pos++;miss=0;if(pos===len){cells.forEach(c=>c.disabled=true);again.disabled=true;win()}}
    else{nudge(b);if(miss>=2)cells[want[pos]].classList.add('pulse')}});
  show();
}
function gNum(){
  head('Which number is missing?');
  let text,ansN,pips='';
  if(tier===0){const a=1+rnd(3);ansN=1+rnd(3);text=`${a} + ? = ${a+ansN}`;pips='●'.repeat(a)+'  +  ?  =  '+'●'.repeat(a+ansN)}
  else if(tier===1){ansN=2+rnd(9);const b=2+rnd(9);text=`? + ${b} = ${ansN+b}`}
  else if(tier===2){const a=3+rnd(7);ansN=3+rnd(7);text=`${a} × ? = ${a*ansN}`}
  else{const a=6+rnd(9),b=3+rnd(17);ansN=3+rnd(10);text=`${a} × ? − ${b} = ${a*ansN-b}`}
  stage.append(el('div','sum',text));if(pips)stage.append(el('div','pips',pips));
  const set=new Set([ansN]);while(set.size<(tier===0?3:4)){const v=ansN+rnd(7)-3;if(v>0)set.add(v)}
  const g=grid(set.size,84);
  shuffle([...set]).forEach(v=>{const b=el('button','tile',v);b.style.fontFamily='var(--display)';
    b.onclick=()=>{if(v===ansN){b.classList.add('ok');[...g.children].forEach(x=>x.disabled=true);win()}
      else{nudge(b);const ok=[...g.children].find(x=>+x.textContent===ansN);if(miss>=2)ok.classList.add('pulse');if(miss>=3)[...g.children].forEach(x=>x!==ok&&x.classList.add('dim'))}};
    g.append(b)});
}

