import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import WebTorrent from 'webtorrent';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dns from 'node:dns/promises';
import net from 'node:net';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(__dirname,'..');
const DATA=path.join(ROOT,'data');
const FILES=path.join(DATA,'files');
const TORRENTS=path.join(DATA,'torrents');
const STATE_FILE=path.join(DATA,'jobs.json');
for(const dir of [FILES,TORRENTS]) fs.mkdirSync(dir,{recursive:true});

const app=express();
app.use(helmet());
app.use(express.json({limit:'1mb'}));
app.use(morgan('tiny'));
app.use(express.static(path.join(ROOT,'public')));

const LIMIT=10*1024**3;
const jobs=new Map(),files=new Map(),torrentByJob=new Map();
const client=new WebTorrent({maxConns:55});
const human=n=>{const u=['B','KB','MB','GB','TB'];let i=0,x=Number(n)||0;while(x>=1024&&i<u.length-1){x/=1024;i++}return(i?x.toFixed(1):Math.round(x))+' '+u[i]};
function saveState(){fs.writeFileSync(STATE_FILE,JSON.stringify({jobs:[...jobs.values()],files:[...files.values()]},null,2))}
function loadState(){if(!fs.existsSync(STATE_FILE))return;try{const d=JSON.parse(fs.readFileSync(STATE_FILE,'utf8'));for(const j of d.jobs||[])jobs.set(j.id,j);for(const f of d.files||[])files.set(f.id,f)}catch(e){console.error('state load:',e.message)}}
loadState();
function privateIp(ip){if(net.isIPv4(ip)){const[a,b]=ip.split('.').map(Number);return a===10||a===127||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||a===0}const x=ip.toLowerCase();return x==='::1'||x.startsWith('fc')||x.startsWith('fd')||x.startsWith('fe80:')}
async function safeUrl(s){const u=new URL(s);if(!['http:','https:'].includes(u.protocol))throw Error('Only HTTP/HTTPS URLs are allowed.');if(u.username||u.password)throw Error('Credentialed URLs are blocked.');const a=await dns.lookup(u.hostname,{all:true});if(!a.length||a.some(x=>privateIp(x.address)))throw Error('Target host resolves to a blocked/private address.')}
function sourceName(s){try{return decodeURIComponent(path.basename(new URL(s).pathname))||'download.bin'}catch{return'download.bin'}}
function safeName(s){return String(s||'file').replace(/[^a-zA-Z0-9._ -]/g,'_')}

async function downloadHttp(job){job.status='downloading';job.updatedAt=Date.now();saveState();try{await safeUrl(job.source);const r=await fetch(job.source,{redirect:'error'});if(!r.ok)throw Error('HTTP '+r.status);const target=path.join(FILES,job.id+'-'+safeName(sourceName(job.source)));const out=fs.createWriteStream(target);const total=Number(r.headers.get('content-length')||0);let got=0;for await(const c of r.body){out.write(c);got+=c.length;job.bytes=got;job.total=total;job.progress=total?Math.min(.99,got/total):job.progress;job.updatedAt=Date.now()}await new Promise((ok,bad)=>{out.end(ok);out.on('error',bad)});const st=fs.statSync(target);files.set(job.id,{id:job.id,name:path.basename(target),size:st.size,sizeHuman:human(st.size),createdAt:Date.now(),downloadUrl:'/api/files/'+job.id});job.name=path.basename(target);job.status='completed';job.progress=1;job.updatedAt=Date.now();saveState()}catch(e){job.status='failed';job.error=e.message;job.updatedAt=Date.now();saveState()}}

function attachTorrent(job,torrent){torrentByJob.set(job.id,torrent);const update=()=>{job.name=torrent.name||job.name||'Torrent';job.progress=torrent.progress||0;job.bytes=torrent.downloaded||0;job.total=torrent.length||0;job.downloadSpeed=torrent.downloadSpeed||0;job.peers=torrent.numPeers||0;job.paused=!!torrent.paused;job.updatedAt=Date.now()};torrent.on('metadata',update);torrent.on('download',update);torrent.on('wire',update);torrent.on('done',()=>{update();job.status='completed';job.progress=1;job.torrentFiles=torrent.files.map((f,index)=>({index,name:f.path||f.name,size:f.length,sizeHuman:human(f.length)}));for(const f of job.torrentFiles){const id=job.id+'-'+f.index;files.set(id,{id,name:f.name,size:f.size,sizeHuman:f.sizeHuman,createdAt:Date.now(),downloadUrl:'/api/torrents/'+job.id+'/files/'+f.index})}saveState()});torrent.on('error',e=>{job.status='failed';job.error=e.message;job.updatedAt=Date.now();saveState()});update();saveState()}
function startMagnet(job){if(torrentByJob.has(job.id))return torrentByJob.get(job.id);job.status='downloading';job.updatedAt=Date.now();const t=client.add(job.source,{path:TORRENTS,addUID:true,strategy:'sequential'},torrent=>attachTorrent(job,torrent));torrentByJob.set(job.id,t);t.on('error',e=>{job.status='failed';job.error=e.message;saveState()});saveState();return t}
async function restoreTorrents(){for(const job of jobs.values()){if(job.type!=='magnet'||['failed','removed'].includes(job.status))continue;try{startMagnet(job)}catch(e){job.status='failed';job.error=e.message;saveState()}}}
function addJob(source){const id=crypto.randomUUID();const type=/^magnet:/i.test(source)?'magnet':'http';const job={id,source,type,status:'queued',progress:0,createdAt:Date.now(),updatedAt:Date.now()};jobs.set(id,job);saveState();if(type==='magnet')startMagnet(job);else downloadHttp(job);return job}

app.get('/api/jobs',(_,r)=>r.json({jobs:[...jobs.values()].sort((a,b)=>b.createdAt-a.createdAt)}));
app.post('/api/jobs',async(req,r)=>{try{const s=String(req.body?.source||'').trim();if(!s)throw Error('Source is required.');if(/^magnet:/i.test(s)){if(!s.startsWith('magnet:?'))throw Error('Invalid magnet URI.')}else await safeUrl(s);r.status(202).json(addJob(s))}catch(e){r.status(400).json({error:e.message})}});
app.post('/api/jobs/:id/pause',(req,r)=>{const j=jobs.get(req.params.id),t=torrentByJob.get(req.params.id);if(!j||!t)return r.status(404).json({error:'Torrent not found.'});t.pause();j.status='paused';j.paused=true;saveState();r.json(j)});
app.post('/api/jobs/:id/resume',(req,r)=>{const j=jobs.get(req.params.id),t=torrentByJob.get(req.params.id);if(!j||!t)return r.status(404).json({error:'Torrent not found.'});t.resume();j.status='downloading';j.paused=false;saveState();r.json(j)});
app.delete('/api/jobs/:id',async(req,r)=>{const j=jobs.get(req.params.id);if(!j)return r.status(404).json({error:'Job not found.'});const t=torrentByJob.get(req.params.id);if(t){await new Promise(resolve=>t.destroy({destroyStore:true},()=>resolve()));torrentByJob.delete(req.params.id)}j.status='removed';j.updatedAt=Date.now();saveState();r.json({ok:true})});
app.get('/api/files',(_,r)=>r.json({files:[...files.values()].sort((a,b)=>b.createdAt-a.createdAt)}));
app.get('/api/files/:id',(req,r)=>{const f=files.get(req.params.id);if(!f)return r.status(404).json({error:'File not found.'});const p=path.join(FILES,f.name);if(!fs.existsSync(p))return r.status(404).json({error:'File missing on disk.'});r.download(p,f.name)});
app.get('/api/torrents/:jobId/files/:index',(req,r)=>{const t=torrentByJob.get(req.params.jobId),i=Number(req.params.index);if(!t||!t.files[i])return r.status(404).json({error:'Torrent file is not available in the active session.'});const f=t.files[i];r.setHeader('Content-Type',f.type||'application/octet-stream');r.setHeader('Content-Disposition','attachment; filename="'+safeName(f.name)+'"');const s=f.createReadStream();s.on('error',e=>{if(!r.headersSent)r.status(500).json({error:e.message});else r.destroy(e)});s.pipe(r)});
app.get('/api/storage',(_,r)=>{let used=0;for(const f of files.values())used+=f.size||0;r.json({used,usedHuman:human(used),limit:LIMIT,limitHuman:human(LIMIT),percent:used/LIMIT*100})});
app.get('*',(_,r)=>r.sendFile(path.join(ROOT,'public/index.html')));
client.on('error',e=>console.error('WebTorrent:',e.message));
const PORT=process.env.PORT||3000;app.listen(PORT,async()=>{console.log('P2P File Cloud on http://localhost:'+PORT);await restoreTorrents()});