const state={items:[],files:[]};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}
async function api(p,o){const r=await fetch('/api'+p,{headers:{'Content-Type':'application/json',...(o?.headers||{})},...o});const j=await r.json();if(!r.ok)throw Error(j.error||'Request failed');return j}
function humanRate(n){if(!n)return'0 B';const u=['B','KB','MB','GB'];let i=0,x=Number(n)||0;while(x>=1024&&i<3){x/=1024;i++}return(x<10?x.toFixed(1):Math.round(x))+' '+u[i]}
function humanBytes(n){if(!n)return'0 B';const u=['B','KB','MB','GB','TB'];let i=0,x=Number(n)||0;while(x>=1024&&i<u.length-1){x/=1024;i++}return(x<10?x.toFixed(1):Math.round(x))+' '+u[i]}
function eta(x){const speed=Number(x.downloadSpeed)||0,total=Number(x.total)||0,done=Number(x.bytes)||0;if(!speed||!total||done>=total)return'—';const sec=Math.max(0,(total-done)/speed);if(sec<60)return Math.round(sec)+'s';if(sec<3600)return Math.floor(sec/60)+'m '+Math.round(sec%60)+'s';return Math.floor(sec/3600)+'h '+Math.round((sec%3600)/60)+'m'}
function connectionState(x){if(x.status==='completed')return['COMPLETED','good'];if(x.status==='failed')return['FAILED','bad'];if(x.status==='paused')return['PAUSED','pause'];if(x.status==='queued')return['QUEUED','wait'];if(x.type==='magnet'){const peers=Number(x.peers)||0,speed=Number(x.downloadSpeed)||0;if(peers>0&&speed>0)return['P2P DOWNLOADING','good'];if(peers>0)return['CONNECTED · WAITING FOR DATA','wait'];return['SEARCHING FOR PEERS','wait']}return['DOWNLOADING','good']}
function actions(x){
  if(x.type!=='magnet'||['completed','failed','removed'].includes(x.status))return '';
  const pause=x.status==='paused';
  return '<button class="mini" data-action="'+(pause?'resume':'pause')+'" data-id="'+esc(x.id)+'">'+(pause?'Resume':'Pause')+'</button><button class="mini danger" data-action="remove" data-id="'+esc(x.id)+'">Remove</button>';
}
function render(){
  const i=state.items.filter(x=>x.status!=='removed');
  $('#activeCount').textContent=i.filter(x=>['queued','downloading','paused'].includes(x.status)).length;
  $('#completedCount').textContent=i.filter(x=>x.status==='completed').length;
  $('#failedCount').textContent=i.filter(x=>x.status==='failed').length;
  $('#lastUpdated').textContent='Updated '+new Date().toLocaleTimeString();
  $('#transferList').innerHTML=i.length?i.map(x=>{
    const p=Math.round((x.progress||0)*100);
    const [label,cls]=connectionState(x);
    const speed=humanRate(x.downloadSpeed);
    const peers=Number(x.peers)||0;
    const total=Number(x.total)||0;
    const done=Number(x.bytes)||0;
    const details=x.type==='magnet'
      ? '<div class="transfer-metrics"><span>Peers <b>'+peers+'</b></span><span>Speed <b>'+esc(speed)+'/s</b></span><span>Downloaded <b>'+esc(humanBytes(done))+(total?' / '+esc(humanBytes(total)):'')+'</b></span><span>ETA <b>'+esc(eta(x))+'</b></span></div>'
      : '';
    return '<article class="transfer '+esc(cls)+'"><div class="row"><div style="min-width:0;flex:1"><div class="name">'+esc(x.name||x.source)+'</div><div class="meta"><span class="status-dot '+esc(cls)+'"></span>'+esc(label)+' · '+p+'%</div>'+details+'</div><div class="transfer-actions">'+actions(x)+'</div></div><div class="progress"><i style="width:'+p+'%"></i></div></article>';
  }).join(''):'<div class="transfer"><span class="muted">No transfers yet.</span></div>';
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=jobAction);
}
function renderFiles(){
  $('#fileList').innerHTML=state.files.length?state.files.map(x=>'<article class="file"><div class="row"><div><div class="name">'+esc(x.name)+'</div><div class="meta">'+esc(x.sizeHuman)+'</div></div><a class="download" href="'+esc(x.downloadUrl)+'" target="_blank">Download</a></div></article>').join(''):'<div class="file"><span class="muted">Completed files will appear here.</span></div>';
}
async function jobAction(e){
  const id=e.currentTarget.dataset.id,action=e.currentTarget.dataset.action;
  try{
    if(action==='remove')await api('/jobs/'+encodeURIComponent(id),{method:'DELETE'});
    else await api('/jobs/'+encodeURIComponent(id)+'/'+action,{method:'POST'});
    await load();
  }catch(err){toast(err.message)}
}
async function load(){
  try{
    const[q,f,s]=await Promise.all([api('/jobs'),api('/files'),api('/storage')]);
    state.items=q.jobs;state.files=f.files;
    $('#storageValue').textContent=s.usedHuman+' / '+s.limitHuman;
    $('#storageBar').style.width=Math.min(100,s.percent)+'%';
    render();renderFiles();
  }catch(e){toast(e.message)}
}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n===b));
  document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
  $('#'+b.dataset.view+'View').classList.remove('hidden');
  $('#pageTitle').textContent=b.dataset.view==='home'?'Dashboard':b.dataset.view==='downloads'?'My files':'Settings';
});
$('#addForm').onsubmit=async e=>{
  e.preventDefault();
  try{
    await api('/jobs',{method:'POST',body:JSON.stringify({source:$('#sourceInput').value.trim()})});
    $('#sourceInput').value='';toast('Transfer queued');await load();
  }catch(err){toast(err.message)}
};
$('#refreshBtn').onclick=load;
load();setInterval(load,2000);
