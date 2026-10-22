
(()=>{
'use strict';
const $=id=>document.getElementById(id),D={N:1,E:2,S:4,W:8},DIRS=['N','E','S','W'],DELTA={N:[-1,0],E:[0,1],S:[1,0],W:[0,-1]},OP={N:'S',E:'W',S:'N',W:'E'};
const rot=m=>((m<<1)&15)|(m>>3),has=(m,b)=>!!(m&b);
let level=Math.min(50,Math.max(1,Number(localStorage.getItem('potok-v3-level'))||1)),n=5,tiles=[],source=0,goal=0,solution=[],moves=0,hints=3,usedHints=0,flowing=false,flowTimer=null,sound=true,best=Number(localStorage.getItem('potok-v3-best'))||0,audio=null,seed=0;
const sizeFor=l=>Math.min(15,4+Math.floor((l-1)*11/49));
function tone(f=500,d=.06){if(!sound)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();let o=audio.createOscillator(),g=audio.createGain();o.frequency.value=f;o.type='sine';g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+d)}catch(e){}}
function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function makeLevel(){
 clearFlow();$('overlay').classList.remove('show');n=sizeFor(level);moves=0;hints=3;usedHints=0;flowing=false;
 // The intended route is a randomized, branching spanning tree. Every regular tile is on the connected solution network;
 // a BFS-generated tree guarantees source-to-goal and many side branches, rather than a straight corridor.
 source=0;goal=n*n-1;const count=n*n,adj=Array.from({length:count},()=>[]),seen=new Set([source]),stack=[source];
 while(stack.length){const cur=stack[stack.length-1],r=Math.floor(cur/n),c=cur%n,opts=[];for(const d of DIRS){const [dr,dc]=DELTA[d],rr=r+dr,cc=c+dc;if(rr>=0&&rr<n&&cc>=0&&cc<n&&!seen.has(rr*n+cc))opts.push({i:rr*n+cc,d})}if(!opts.length){stack.pop();continue}
  // bias to explore a mix of long runs and turns
  const pick=opts[Math.floor(Math.random()*opts.length)],v=pick.i;seen.add(v);stack.push(v);adj[cur].push({i:v,d:pick.d});adj[v].push({i:cur,d:OP[pick.d]});
 }
 solution=adj.map((edges,i)=>({i,mask:edges.reduce((m,e)=>m|D[e.d],0)}));
 // Ensure all cells are connected, but add extra cross-links to create alternate paths and useful cross junctions.
 for(let r=0;r<n;r++)for(let c=0;c<n;c++){const i=r*n+c;if(c<n-1&&Math.random()<.13){const j=i+1;if(!adj[i].some(e=>e.i===j)){adj[i].push({i:j,d:'E'});adj[j].push({i,d:'W'})}}if(r<n-1&&Math.random()<.13){const j=i+n;if(!adj[i].some(e=>e.i===j)){adj[i].push({i:j,d:'S'});adj[j].push({i,d:'N'})}}}
 // Increase junction variety at higher levels. Build masks from the designed network.
 tiles=adj.map((edges,i)=>({type:'pipe',mask:edges.reduce((m,e)=>m|D[e.d],0),correct:true,wet:false,rot:0}));
 // Place hazards and fixed pipes on connected cells; these do not break the intended solution: fixed pieces keep their required orientation.
 const hazardCount=level<5?0:Math.min(1+Math.floor((level-5)/5),Math.floor(count*.055));
 const candidates=shuffle(Array.from({length:count},(_,i)=>i).filter(i=>i!==source&&i!==goal));
 const hazardIds=new Set(candidates.slice(0,hazardCount));
 // Dirty sources sit on side branches, not on the required source-to-goal route.
 // Disconnect their neighboring pipe ports in the intended solution; the player can accidentally connect one by rotating a neighboring pipe.
 const dirtyMasks=new Map();
 for(const h of hazardIds){
  const edges=adj[h].slice();
  const chosen=edges.length?edges[Math.floor(Math.random()*edges.length)]:null;
  for(const e of edges){adj[h]=adj[h].filter(x=>x.i!==e.i);adj[e.i]=adj[e.i].filter(x=>x.i!==h)}
  if(chosen)dirtyMasks.set(h,D[chosen.d]); else dirtyMasks.set(h,D.E);
 }
 // Mark a small number of connected pipes immovable, preserving their orientation.
 const fixedChance=level<4?0:Math.min(.04+(level-4)*.006,.13);
 for(let i=0;i<count;i++){
  let mask=tiles[i].mask,deg=adj[i].length;
  let type='pipe';
  if(i===source)type='source';else if(i===goal)type='goal';else if(hazardIds.has(i)){type='dirty';mask=dirtyMasks.get(i)||D.E}
  else if(Math.random()<fixedChance)type='fixedpipe';
  // Make sure all movable pipes begin scrambled, while fixed pieces remain correctly oriented.
  let turns=0;if(type==='pipe'){turns=1+Math.floor(Math.random()*3);mask=turnMask(mask,turns)}
  tiles[i]={type,mask,rot:turns,correct:true,wet:false,solutionMask:adj[i].reduce((m,e)=>m|D[e.d],0)};
 }
 // Hazards can be encountered in the intended flowing network, so contaminated routes are a genuine risk.
 // Keep some alternate paths available; the goal is to reach it without the flowing network touching any dirty tile.
 render();updateStats();$('stateText').textContent='Собери безопасную сеть';$('boardTitle').textContent='Задействуй сеть труб';$('flowBtn').disabled=false;$('flowBtn').innerHTML='▶ Запустить воду';$('hintBtn').disabled=false;$('resetBtn').disabled=false;
}
function turnMask(m,t){for(let i=0;i<t;i++)m=rot(m);return m}
function tileSVG(t){
 if(t.type==='wall')return '<svg viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" rx="12" fill="#172638" stroke="#3a5062" stroke-width="5"/></svg>';
 const col=t.type==='source'?'#4ab7ff':t.type==='goal'?'#8af0b2':t.type==='dirty'?'#b5d34e':t.type==='fixedpipe'?'#91a8c0':'#55768f';
 let s='<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="'+col+'" stroke-width="17" stroke-linecap="round">';
 for(const d of DIRS)if(has(t.mask,D[d])){const paths={N:'M50 50V12',E:'M50 50H88',S:'M50 50V88',W:'M50 50H12'};s+='<path d="'+paths[d]+'"/>'}
 if(t.mask)s+='<circle cx="50" cy="50" r="8.5" fill="'+col+'" stroke="none"/>';s+='</g><g class="waterline" fill="none" stroke="'+(t.wet?(t.dirtyWet?'#d7f45d':'#68fff1'):'#29475c')+'" stroke-width="3.5" stroke-linecap="round">';
 for(const d of DIRS)if(has(t.mask,D[d])){const paths={N:'M50 50V12',E:'M50 50H88',S:'M50 50V88',W:'M50 50H12'};s+='<path d="'+paths[d]+'"/>'}s+='</g>';
 if(t.type==='source')s+='<circle cx="50" cy="50" r="8" fill="#4ab7ff" stroke="#c5f7ff" stroke-width="3"/>';
 if(t.type==='goal')s+='<circle cx="50" cy="50" r="12" fill="#8af0b2" stroke="#dcffe8" stroke-width="3"/><path d="M43 50l5 5 10-12" stroke="#0b433b" stroke-width="4" fill="none" stroke-linecap="round"/>';
 if(t.type==='dirty')s+='<circle cx="50" cy="50" r="12" fill="#b5d34e" stroke="#e9ff8e" stroke-width="3"/><path d="M44 45l12 12m0-12L44 57" stroke="#35410e" stroke-width="4" stroke-linecap="round"/>';
 return s+'</svg>';
}
function render(){const b=$('board');b.innerHTML='';b.style.gridTemplateColumns=`repeat(${n},minmax(0,1fr))`;b.style.gridTemplateRows=`repeat(${n},minmax(0,1fr))`;tiles.forEach((t,i)=>{const el=document.createElement('button');el.type='button';el.className='tile'+(t.type==='source'?' source fixed':t.type==='goal'?' goal fixed':t.type==='fixedpipe'?' immovable':t.type==='dirty'?' dirty':'')+(t.wet?' wet':'');el.dataset.index=i;el.setAttribute('role','gridcell');el.setAttribute('aria-label',label(t,i));el.innerHTML=tileSVG(t);if(['source','goal','fixedpipe','wall','dirty'].includes(t.type))el.disabled=true;else el.addEventListener('click',()=>turn(i));b.appendChild(el)})}
function label(t,i){return t.type==='source'?'Источник чистой воды':t.type==='goal'?'Цель':t.type==='dirty'?'Источник загрязнения':t.type==='fixedpipe'?'Закреплённая труба':`Труба ${Math.floor(i/n)+1}, ${i%n+1}`}
function refresh(){tiles.forEach((t,i)=>{const el=$('board').children[i];el.className='tile'+(t.type==='source'?' source fixed':t.type==='goal'?' goal fixed':t.type==='fixedpipe'?' immovable':t.type==='dirty'?' dirty':'')+(t.wet?' wet':'');el.innerHTML=tileSVG(t)})}
function turn(i){if(flowing||tiles[i].type!=='pipe')return;tiles[i].mask=rot(tiles[i].mask);tiles[i].rot=(tiles[i].rot+1)%4;moves++;tone(420+tiles[i].rot*60,.04);refresh();updateStats();$('stateText').textContent='Сеть изменена'}
function neighbors(i){let r=Math.floor(i/n),c=i%n;return DIRS.map(d=>{let [dr,dc]=DELTA[d],rr=r+dr,cc=c+dc;return rr<0||rr>=n||cc<0||cc>=n?null:{i:rr*n+cc,d}}).filter(Boolean)}
function connected(a,b,d){return has(tiles[a].mask,D[d])&&has(tiles[b].mask,D[OP[d]])}
function network(){let q=[source],seen=new Set(q),order=[],prev=new Map(),dirty=false;while(q.length){let i=q.shift();order.push(i);if(tiles[i].type==='dirty')dirty=true;for(const nb of neighbors(i)){if(seen.has(nb.i))continue;if(connected(i,nb.i,nb.d)){seen.add(nb.i);prev.set(nb.i,i);q.push(nb.i)}}}return{seen,order,prev,dirty,success:seen.has(goal)}}
function clearFlow(){if(flowTimer)clearTimeout(flowTimer);flowTimer=null;flowing=false;tiles.forEach(t=>{t.wet=false;t.dirtyWet=false})}
function runWater(){if(flowing)return;clearFlow();const net=network();if(net.dirty){$('stateText').textContent='Загрязнение обнаружено!';$('boardTitle').textContent='Вода испорчена';$('flowBtn').disabled=true;$('hintBtn').disabled=true;$('resetBtn').disabled=false;let j=0;const contaminated=net.order;const step=()=>{if(j<contaminated.length){let i=contaminated[j++];tiles[i].wet=true;tiles[i].dirtyWet=true;refresh();$('progressBar').style.width=`${Math.round(j/contaminated.length*100)}%`;flowTimer=setTimeout(step,70)}else{$('modalIcon').textContent='☣️';$('modalTitle').textContent='Вода загрязнена!';$('modalText').textContent='Поток коснулся источника грязной воды. Уровень провален — измени соединения и попробуй снова.';$('modalBtn').textContent='Попробовать снова';$('overlay').classList.add('show');tone(130,.3)}};flowing=true;step();return}
 if(!net.success){$('stateText').textContent='Цель не подключена';$('boardTitle').textContent='Нужна непрерывная цепь';tone(170,.12);net.seen.forEach(i=>tiles[i].wet=true);refresh();$('progressBar').style.width=`${Math.round(net.seen.size/tiles.length*100)}%`;return}
 flowing=true;$('flowBtn').disabled=true;$('flowBtn').textContent='◌ Вода течёт…';$('hintBtn').disabled=true;$('resetBtn').disabled=true;$('stateText').textContent='Вода заполняет сеть';let j=0;
 const step=()=>{if(j<net.order.length){let i=net.order[j++];tiles[i].wet=true;refresh();$('progressBar').style.width=`${Math.round(j/net.order.length*100)}%`;tone(300+j*4,.025);flowTimer=setTimeout(step,Math.max(28,115-level*1.4))}else{flowing=false;$('stateText').textContent='Цель достигнута';$('boardTitle').textContent='Отлично! Сеть работает';$('flowBtn').disabled=false;$('flowBtn').textContent='✓ Вода доставлена';$('hintBtn').disabled=false;$('resetBtn').disabled=false;best=Math.max(best,Math.max(0,1200-level*10-moves*3-usedHints*60));localStorage.setItem('potok-v3-best',String(best));$('bestVal').textContent=best;$('modalIcon').textContent='💧';$('modalTitle').textContent=level>=50?'Все 50 уровней пройдены!':'Уровень пройден!';$('modalText').textContent=`Вода достигла цели и прошла по ${net.order.length} клеткам сети. Ходов: ${moves}. Подсказок использовано: ${usedHints}/3.`;$('modalBtn').textContent=level>=50?'Играть заново':'Следующий уровень →';$('overlay').classList.add('show');tone(760,.15);setTimeout(()=>tone(970,.2),110)}};step()}
function hint(){if(flowing)return;if(hints<=0){$('stateText').textContent='Подсказки закончились';tone(180,.1);return}hints--;usedHints++;updateStats();const net=network();let target=-1;for(let i=0;i<tiles.length;i++){const t=tiles[i];if(t.type==='pipe'&&t.mask!==t.solutionMask){target=i;break}}if(target<0){$('stateText').textContent='Проверь загрязнители и разрывы';return}const el=$('board').children[target];el.animate([{transform:'scale(1)',filter:'brightness(1)'},{transform:'scale(.88)',filter:'brightness(2.2)'},{transform:'scale(1)',filter:'brightness(1)'}],{duration:600,iterations:2});$('stateText').textContent=`Подсказка использована (${hints} осталось)`;tone(650,.08)}
function updateStats(){$('levelVal').textContent=String(level).padStart(2,'0')+' / 50';$('movesVal').textContent=moves;$('hintsVal').textContent=hints;$('bestVal').textContent=best;$('sizeText').textContent=`${n} × ${n}`;$('progressText').textContent=`Сеть уровня ${level}`;if(!flowing&&$('progressBar').style.width==='')$('progressBar').style.width='0%'}
function reset(){makeLevel()}
$('flowBtn').addEventListener('click',runWater);$('hintBtn').addEventListener('click',hint);$('resetBtn').addEventListener('click',reset);$('modalBtn').addEventListener('click',()=>{if($('modalTitle').textContent.includes('загрязнена')){makeLevel();return}if(level>=50)level=1;else level++;localStorage.setItem('potok-v3-level',String(level));makeLevel()});$('soundBtn').addEventListener('click',()=>{sound=!sound;$('soundBtn').textContent=sound?'♪':'♫̸';if(sound)tone(620,.08)});document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='r')reset()});makeLevel();
})();
