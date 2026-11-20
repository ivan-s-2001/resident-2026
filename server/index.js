import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID,scryptSync,createHash,timingSafeEqual} from 'node:crypto';
import {evaluateRoll} from './rolls.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const STORE=process.env.DATA_FILE||path.resolve(ROOT,'../data/db.json');
const PROD=process.env.NODE_ENV==='production';
const PORT=Number(process.env.PORT||3000);
const COOKIE='resident_session';
const ATTRS=['strength','agility','endurance','knowledge','imagination','will','manipulation','presence','insight'];
const GROUPS=['Тело','Ум','Харизма'];
const clients=new Map(), attemptMap=new Map();
const uuid=()=>randomUUID();
const failure=(code,message)=>Object.assign(new Error(message),{code});
const trim=(x,n=300)=>String(x??'').trim().slice(0,n);
const integer=(x,min,max)=>{const n=Number(x);if(!Number.isInteger(n)||n<min||n>max)throw failure(400,'Число должно быть от '+min+' до '+max);return n};
const createDB=()=>({users:[],sessions:[],campaigns:[],characters:[],events:[]});
let db;
try{db=JSON.parse(fs.readFileSync(STORE,'utf8'));for(const k of Object.keys(createDB()))if(!Array.isArray(db[k]))throw new Error('Corrupt database')}catch(e){if(e.code==='ENOENT')db=createDB();else throw e}
function save(){fs.mkdirSync(path.dirname(STORE),{recursive:true,mode:0o700});const temp=STORE+'.'+process.pid+'.tmp';fs.writeFileSync(temp,JSON.stringify(db),{mode:0o600});fs.renameSync(temp,STORE)}
function send(res,code,data,headers={}){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data))}
function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim().split('=')).filter(x=>x[0]))}
const tokenHash=s=>createHash('sha256').update(s).digest('hex');
function sessionCookie(token,age){return COOKIE+'='+token+'; HttpOnly; SameSite=Lax; Path=/; Max-Age='+age+(PROD?'; Secure':'')}
function startSession(res,user){const token=randomBytes(32).toString('base64url');db.sessions.push({tokenHash:tokenHash(token),userId:user.id,expires:Date.now()+30*86400000});save();send(res,200,{user:{id:user.id,username:user.username}},{'Set-Cookie':sessionCookie(token,2592000)})}
function identify(req){const token=cookies(req)[COOKIE];if(!token)return null;const s=db.sessions.find(x=>x.tokenHash===tokenHash(token)&&x.expires>Date.now());return s?db.users.find(x=>x.id===s.userId):null}
function auth(req){const user=identify(req);if(!user)throw failure(401,'Войдите в аккаунт');return user}
function member(c,u){const m=c.members.find(x=>x.userId===u.id);if(!m)throw failure(403,'Нет доступа к кампании');return m}
function campaign(id,u){const c=db.campaigns.find(x=>x.id===id);if(!c)throw failure(404,'Кампания не найдена');return {c,m:member(c,u)}}
function gm(m){if(m.role!=='gm')throw failure(403,'Действие доступно только мастеру')}
function emit(id){for(const c of clients.get(id)||[])try{c.write('event: update\ndata: {}\n\n')}catch{}}
function event(c,user,type,payload,visibility='all',ownerId=null){db.events.push({id:uuid(),campaignId:c.id,actorId:user.id,at:new Date().toISOString(),type,payload,visibility,ownerId});if(db.events.length>10000)db.events.splice(0,db.events.length-10000)}
const EVENING_BLOCKS=new Set(['heading','scene','check','note']);
const EVENING_STATUSES=new Set(['planned','running','completed']);
function dateValue(x){const d=trim(x,10);if(d!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(d))throw failure(400,'Неверная дата');return d}
function getEvenings(c){if(!Array.isArray(c.evenings))c.evenings=[];return c.evenings}
function eveningBlock(e,id){const b=e.blocks.find(x=>x.id===id);if(!b)throw failure(404,'Блок не найден');return b}
const visible=(ev,m,user)=>ev.visibility==='all'||m.role==='gm'||ev.visibility==='owner'&&ev.ownerId===user.id;
function getChar(ch,m,u){const owner=ch.ownerId===u.id,master=m.role==='gm';const d=structuredClone(ch.data);if(!master)delete d.gmNotes;if(!owner&&!master)delete d.notes;return {id:ch.id,ownerId:ch.ownerId,data:d,editable:master||owner}}
function snapshot(c,m,u){return {
 id:c.id,title:c.title,description:c.description,role:m.role,ownerId:c.ownerId,
 inviteCode:m.role==='gm'?c.inviteCode:null,scene:c.scene,round:c.round,turn:c.turn,
 initiative:c.initiative.filter(i=>!i.hidden||m.role==='gm'),
 members:c.members.map(x=>({userId:x.userId,role:x.role,username:db.users.find(y=>y.id===x.userId)?.username||'Участник'})),
 gmNotes:m.role==='gm'?c.gmNotes:null,
 evenings:m.role==='gm'?getEvenings(c):null,
 characters:db.characters.filter(x=>x.campaignId===c.id).map(x=>getChar(x,m,u)),
 events:db.events.filter(x=>x.campaignId===c.id&&visible(x,m,u)).slice(-120).map(e=>({...e,username:db.users.find(x=>x.id===e.actorId)?.username||'Система'}))
}}
function template(){return {name:'Новый оперативник',role:'Новобранец BSAA',concept:'',origin:'',motivation:'',story:'',strongest:'Ум',weakest:'Тело',
 attrs:Object.fromEntries(ATTRS.map(x=>[x,1])),skills:[],abilities:[],items:[],health:{physical:[],mental:[]},notes:'',gmNotes:''}}
function cleanData(data,old,isMaster){
 if(!data||typeof data!=='object'||Array.isArray(data))throw failure(400,'Неверные данные чарника');
 const d=old?structuredClone(old):template();
 for(const k of ['name','role','concept','origin','motivation','story','notes'])if(k in data)d[k]=trim(data[k],k==='story'||k==='notes'?5000:160);
 if('gmNotes'in data){if(!isMaster)throw failure(403,'Заметки мастера скрыты');d.gmNotes=trim(data.gmNotes,5000)}
 if('strongest'in data)d.strongest=GROUPS.includes(data.strongest)?data.strongest:'Ум';
 if('weakest'in data)d.weakest=GROUPS.includes(data.weakest)?data.weakest:'Тело';
 if(d.strongest===d.weakest)throw failure(400,'Сильная и слабая группы должны различаться');
 if(data.attrs){if(!data.attrs||typeof data.attrs!=='object'||Array.isArray(data.attrs))throw failure(400,'Неверные атрибуты');for(const k of ATTRS)if(k in data.attrs)d.attrs[k]=integer(data.attrs[k],1,5)}
 if('skills'in data){if(!Array.isArray(data.skills)||data.skills.length>60)throw failure(400,'Слишком много навыков');d.skills=data.skills.map(x=>({id:trim(x.id,80)||uuid(),name:trim(x.name,90),level:integer(x.level,0,5)})).filter(x=>x.name)}
 if('abilities'in data){if(!Array.isArray(data.abilities)||data.abilities.length>60)throw failure(400,'Слишком много способностей');d.abilities=data.abilities.map(x=>({id:trim(x.id,80)||uuid(),name:trim(x.name,100)})).filter(x=>x.name)}
 if('items'in data){if(!Array.isArray(data.items)||data.items.length>100)throw failure(400,'Слишком много предметов');d.items=data.items.map(x=>({id:trim(x.id,80)||uuid(),name:trim(x.name,90),quantity:integer(x.quantity,0,999),cost:integer(x.cost??0,0,21),notes:trim(x.notes,200)})).filter(x=>x.name)}
 if(data.health){for(const t of ['physical','mental'])if(t in data.health){
  if(!Array.isArray(data.health[t])||data.health[t].length>20)throw failure(400,'Недопустимое количество ранений');
  d.health[t]=data.health[t].map(x=>{if(!['blunt','lethal'].includes(x))throw failure(400,'Неверный тип урона');return x});
 }}
 return d;
}
async function readBody(req){let s='';for await(const b of req){s+=b.toString('utf8');if(Buffer.byteLength(s)>180000)throw failure(413,'Слишком большие данные')}try{return s?JSON.parse(s):{}}catch{throw failure(400,'Неверный JSON')}}
function security(req){if(['POST','PATCH','PUT','DELETE'].includes(req.method)){
 if(req.headers['x-resident-request']!=='1')throw failure(403,'Неверный заголовок запроса');
 if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin)}catch{throw failure(403,'Origin недопустим')};if(origin.host!==req.headers.host)throw failure(403,'Чужой Origin')}
}}
function throttle(req){const ip=req.socket.remoteAddress||'?';const e=attemptMap.get(ip)||{until:Date.now()+900000,count:0};if(e.until<Date.now()){e.until=Date.now()+900000;e.count=0}if(++e.count>35)throw failure(429,'Слишком много попыток, попробуйте позже');attemptMap.set(ip,e)}
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',png:'image/png',webmanifest:'application/manifest+json'};
function serve(res,p){const name=p==='/'?'/index.html':p;const fp=path.resolve(ROOT,'.'+name);if(!fp.startsWith(ROOT+path.sep))throw failure(404,'Не найдено');let stat;try{stat=fs.statSync(fp)}catch{throw failure(404,'Файл не найден')};if(!stat.isFile())throw failure(404,'Файл не найден');const ext=path.extname(fp).slice(1);res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':ext==='html'||ext==='js'?'no-cache':'public,max-age=600'});fs.createReadStream(fp).pipe(res)}
const server=http.createServer(async(req,res)=>{try{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
 const url=new URL(req.url,'http://localhost'), p=url.pathname, method=req.method;
 if(method==='GET'&&p==='/health')return send(res,200,{ok:true});
 if(!p.startsWith('/api/')){if(method!=='GET')throw failure(405,'Метод не разрешён');return serve(res,p)}
 security(req);
 if(method==='POST'&&p==='/api/auth/register'){
  throttle(req);const b=await readBody(req),username=trim(b.username,30),password=String(b.password||'');
  if(!/^[a-zA-Zа-яА-ЯёЁ0-9_.-]{3,30}$/u.test(username))throw failure(400,'Логин: 3–30 символов, буквы, цифры, точка, дефис');
  if(password.length<10||Buffer.byteLength(password)>256)throw failure(400,'Пароль: от 10 символов');
  if(db.users.some(x=>x.username.toLowerCase()===username.toLowerCase()))throw failure(409,'Логин занят');
  const salt=randomBytes(16).toString('hex');
  const u={id:uuid(),username,salt,passwordHash:scryptSync(password,salt,64).toString('hex')};db.users.push(u);return startSession(res,u);
 }
 if(method==='POST'&&p==='/api/auth/login'){
  throttle(req);const b=await readBody(req);
  const u=db.users.find(x=>x.username.toLowerCase()===trim(b.username,30).toLowerCase());
  const actual=scryptSync(String(b.password||''),u?.salt||'00000000000000000000000000000000',64);
  const expected=Buffer.from(u?.passwordHash||'00'.repeat(64),'hex');
  if(!u||!timingSafeEqual(actual,expected))throw failure(401,'Неверный логин или пароль');
  return startSession(res,u);
 }
 if(method==='POST'&&p==='/api/auth/logout'){
  const t=cookies(req)[COOKIE];if(t)db.sessions=db.sessions.filter(s=>s.tokenHash!==tokenHash(t));
  save();return send(res,200,{ok:true},{'Set-Cookie':sessionCookie('',0)});
 }
 const u=auth(req);
 if(method==='GET'&&p==='/api/me')return send(res,200,{user:{id:u.id,username:u.username}});
 if(method==='GET'&&p==='/api/campaigns')return send(res,200,{setupAvailable:db.campaigns.length===0,campaigns:db.campaigns.filter(c=>c.members.some(m=>m.userId===u.id)).map(c=>({id:c.id,title:c.title,role:member(c,u).role,scene:c.scene.title,count:c.members.length}))});
 if(method==='POST'&&p==='/api/campaigns'){
  const b=await readBody(req);if(db.campaigns.length!==0)throw failure(409,'Единственная кампания уже создана');const title=trim(b.title,100);if(title.length<3)throw failure(400,'Слишком короткое название');
  const c={id:uuid(),title,ownerId:u.id,inviteCode:randomBytes(6).toString('hex').toUpperCase(),
  description:trim(b.description,500),members:[{userId:u.id,role:'gm'}],scene:{title:'Пролог',description:'',status:'Подготовка',difficulty:1},
  round:1,turn:0,initiative:[],gmNotes:'',evenings:[{id:uuid(),title:'Первая игровая встреча',date:'',status:'planned',blocks:[
    {id:uuid(),type:'heading',title:'Подготовка к игре',text:'',done:false,difficulty:1},
    {id:uuid(),type:'check',title:'Проверить чарники и готовность игроков',text:'',done:false,difficulty:1},
    {id:uuid(),type:'scene',title:'Открывающая сцена',text:'Завязка игрового вечера. Что узнают персонажи?',done:false,difficulty:1},
    {id:uuid(),type:'note',title:'За кулисами',text:'Секретные подсказки, возможные решения и импровизация мастера.',done:false,difficulty:1}
 ]}],createdAt:new Date().toISOString()};db.campaigns.push(c);
  event(c,u,'system',{text:'Создана кампания'});save();return send(res,201,{campaign:snapshot(c,c.members[0],u)});
 }
 if(method==='POST'&&p==='/api/campaigns/join'){
  const b=await readBody(req),code=trim(b.code,24).toUpperCase(),c=db.campaigns.find(x=>x.inviteCode===code);
  if(!c)throw failure(404,'Код приглашения не найден');
  if(!c.members.some(x=>x.userId===u.id)){c.members.push({userId:u.id,role:'player'});event(c,u,'system',{text:u.username+' присоединился к операции'});save();emit(c.id)}
  return send(res,200,{campaignId:c.id});
 }
 const mat=p.match(/^\/api\/campaigns\/([a-f\d-]{36})(?:\/(.*))?$/);
 if(!mat)throw failure(404,'Маршрут не найден');
 const {c,m}=campaign(mat[1],u),route=mat[2]||'';
 if(method==='GET'&&route==='')return send(res,200,{campaign:snapshot(c,m,u)});
 if(method==='GET'&&route==='stream'){
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write('event: connected\ndata: {}\n\n');
  if(!clients.has(c.id))clients.set(c.id,new Set());clients.get(c.id).add(res);
  const timer=setInterval(()=>{try{res.write(': heartbeat\n\n')}catch{}},25000);req.on('close',()=>{clearInterval(timer);clients.get(c.id)?.delete(res)});return;
 }
 if(method==='POST'&&route==='evenings'){
  gm(m);const b=await readBody(req),list=getEvenings(c);
  if(list.length>=100)throw failure(400,'Достигнут лимит игровых вечеров');
  const evening={id:uuid(),title:trim(b.title,120)||'Игровой вечер',date:dateValue(b.date),status:'planned',blocks:[]};
  list.push(evening);save();emit(c.id);return send(res,201,{evening});
 }
 const eveningMatch=route.match(/^evenings\/([a-f0-9-]{36})(?:\/blocks(?:\/([a-f0-9-]{36})(?:\/(play|move))?)?)?$/);
 if(eveningMatch){
  gm(m);
  const evenings=getEvenings(c),evening=evenings.find(x=>x.id===eveningMatch[1]);
  if(!evening)throw failure(404,'Игровой вечер не найден');
  const blockId=eveningMatch[2],action=eveningMatch[3],onBlocks=route.includes('/blocks');
  if(method==='PATCH'&&!onBlocks){
   const b=await readBody(req);
   if('title' in b)evening.title=trim(b.title,120)||'Игровой вечер';
   if('date' in b)evening.date=dateValue(b.date);
   if('status' in b){if(!EVENING_STATUSES.has(b.status))throw failure(400,'Неверный статус вечера');evening.status=b.status}
   save();emit(c.id);return send(res,200,{evening});
  }
  if(method==='DELETE'&&!onBlocks){
   c.evenings=evenings.filter(x=>x.id!==evening.id);save();emit(c.id);return send(res,200,{ok:true});
  }
  if(method==='POST'&&onBlocks&&!blockId){
   const b=await readBody(req);if(evening.blocks.length>=200)throw failure(400,'Слишком много блоков');
   const type=trim(b.type,30);if(!EVENING_BLOCKS.has(type))throw failure(400,'Тип блока не поддерживается');
   const block={id:uuid(),type,title:trim(b.title,160)||({scene:'Новая сцена',heading:'Раздел',check:'Задача',note:'Заметка'}[type]),text:trim(b.text,10000),done:false,difficulty:integer(b.difficulty??1,1,5)};
   evening.blocks.push(block);save();emit(c.id);return send(res,201,{block});
  }
  if(blockId&&onBlocks){
   const block=eveningBlock(evening,blockId);
   if(method==='PATCH'&&!action){
    const b=await readBody(req);
    if('title' in b)block.title=trim(b.title,160);
    if('text' in b)block.text=trim(b.text,10000);
    if('done' in b)block.done=Boolean(b.done);
    if('difficulty' in b)block.difficulty=integer(b.difficulty,1,5);
    save();emit(c.id);return send(res,200,{block});
   }
   if(method==='POST'&&action==='play'){
    if(block.type!=='scene')throw failure(400,'В сцену можно вывести только блок сцены');
    c.scene={title:block.title||'Сцена',description:block.text,status:'В игре',difficulty:block.difficulty};
    evening.status='running';event(c,u,'system',{text:'Мастер открыл сцену: '+c.scene.title});
    save();emit(c.id);return send(res,200,{scene:c.scene});
   }
   if(method==='POST'&&action==='move'){
    const b=await readBody(req),direction=integer(b.direction,-1,1);
    if(direction===0)throw failure(400,'Направление не указано');
    const i=evening.blocks.findIndex(x=>x.id===block.id),j=i+direction;
    if(j>=0&&j<evening.blocks.length)[evening.blocks[i],evening.blocks[j]]=[evening.blocks[j],evening.blocks[i]];
    save();emit(c.id);return send(res,200,{ok:true});
   }
   if(method==='DELETE'&&!action){
    evening.blocks=evening.blocks.filter(x=>x.id!==block.id);save();emit(c.id);return send(res,200,{ok:true});
   }
  }
 }
 if(method==='POST'&&route==='invite/regenerate'){gm(m);if(c.ownerId!==u.id)throw failure(403,'Только создатель может сменить код');c.inviteCode=randomBytes(6).toString('hex').toUpperCase();save();emit(c.id);return send(res,200,{inviteCode:c.inviteCode})}
 if(method==='PATCH'&&route.startsWith('members/')){
  gm(m);if(c.ownerId!==u.id)throw failure(403,'Недостаточно прав');const uid=route.slice(8);if(uid===u.id)throw failure(400,'Создателя нельзя понизить');
  const target=c.members.find(x=>x.userId===uid);if(!target)throw failure(404,'Нет такого игрока');
  const b=await readBody(req);if(!['gm','player'].includes(b.role))throw failure(400,'Неизвестная роль');target.role=b.role;save();emit(c.id);return send(res,200,{ok:true});
 }
 if(method==='POST'&&route==='scene'){
  gm(m);const b=await readBody(req);for(const k of ['title','description','status'])if(k in b)c.scene[k]=trim(b[k],k==='description'?3000:120);
  if('difficulty'in b)c.scene.difficulty=integer(b.difficulty,1,5);
  if('round'in b)c.round=integer(b.round,1,10000);
  event(c,u,'system',{text:'Мастер обновил сцену: '+c.scene.title});save();emit(c.id);return send(res,200,{ok:true});
 }
 if(method==='POST'&&route==='gm-notes'){gm(m);const b=await readBody(req);c.gmNotes=trim(b.notes,30000);save();return send(res,200,{ok:true})}
 if(method==='POST'&&route==='characters'){
  const mine=db.characters.filter(x=>x.campaignId===c.id&&x.ownerId===u.id);if(mine.length>=8)throw failure(400,'Не более восьми персонажей');
  const d=cleanData(await readBody(req),null,m.role==='gm');if(!d.name)throw failure(400,'Укажите имя');
  const ch={id:uuid(),campaignId:c.id,ownerId:u.id,data:d};db.characters.push(ch);
  event(c,u,'system',{text:'Создан персонаж «'+d.name+'»'});save();emit(c.id);return send(res,201,{character:getChar(ch,m,u)});
 }
 if(method==='PATCH'&&route.startsWith('characters/')){
  const ch=db.characters.find(x=>x.id===route.slice(11)&&x.campaignId===c.id);if(!ch)throw failure(404,'Персонаж не найден');
  if(m.role!=='gm'&&ch.ownerId!==u.id)throw failure(403,'Нельзя менять чужой чарник');
  ch.data=cleanData(await readBody(req),ch.data,m.role==='gm');save();emit(c.id);return send(res,200,{character:getChar(ch,m,u)});
 }
 if(method==='POST'&&route==='rolls'){
  const b=await readBody(req);let pool=0,name='NPC',attribute=null,skill=null;
  if(b.characterId){
   const ch=db.characters.find(x=>x.id===b.characterId&&x.campaignId===c.id);if(!ch)throw failure(404,'Персонаж не найден');
   if(m.role!=='gm'&&ch.ownerId!==u.id)throw failure(403,'Чужие броски недоступны');
   attribute=trim(b.attribute,30);if(!ATTRS.includes(attribute))throw failure(400,'Неверный атрибут');
   const lv=ch.data.attrs[attribute]||1;skill=trim(b.skill,90);const sk=ch.data.skills.find(x=>x.name===skill);pool=lv+(sk?sk.level:0);name=ch.data.name;
  }else{gm(m);pool=integer(b.pool,0,100);name=trim(b.name,100)||'NPC'}
  const modifier=integer(b.modifier??0,-30,30), difficulty=c.scene.difficulty;
  const r=pool+modifier<0?{pool:pool+modifier,dice:[],bonusDice:0,successes:-1,difficulty,outcome:'critical_failure',truncated:false}:evaluateRoll(pool+modifier,difficulty);
  const visibility=b.visibility==='gm'&&m.role==='gm'?'gm':b.visibility==='private'?'owner':'all';
  event(c,u,'roll',{character:name,attribute,skill,modifier,...r},visibility,u.id);save();emit(c.id);return send(res,200,{roll:r});
 }
 if(method==='POST'&&route==='messages'){
  const b=await readBody(req),txt=trim(b.text,1500);if(!txt)throw failure(400,'Введите сообщение');
  const visibility=b.visibility==='gm'&&m.role==='gm'?'gm':'all';
  event(c,u,'message',{text:txt},visibility);save();emit(c.id);return send(res,201,{ok:true});
 }
 if(method==='POST'&&route==='initiative'){
  gm(m);const b=await readBody(req),name=trim(b.name,100);if(!name)throw failure(400,'Укажите имя');
  c.initiative.push({id:uuid(),name,score:integer(b.score,0,100),hidden:Boolean(b.hidden)});c.initiative.sort((a,b)=>b.score-a.score);save();emit(c.id);return send(res,201,{ok:true});
 }
 if(method==='POST'&&route==='initiative/advance'){
  gm(m);if(c.initiative.length){c.turn++;if(c.turn>=c.initiative.length){c.turn=0;c.round++}}save();emit(c.id);return send(res,200,{ok:true});
 }
 if(method==='DELETE'&&route.startsWith('initiative/')){
  gm(m);c.initiative=c.initiative.filter(x=>x.id!==route.slice(11));c.turn=Math.min(c.turn,Math.max(0,c.initiative.length-1));save();emit(c.id);return send(res,200,{ok:true});
 }
 throw failure(404,'Маршрут не найден');
}catch(e){const code=e.code||500;if(code===500)console.error(e);if(!res.headersSent)send(res,code,{error:code===500?'Ошибка сервера':e.message});else res.end()}});
server.listen(PORT,'0.0.0.0',()=>console.log('Resident 2026: http://localhost:'+PORT));
