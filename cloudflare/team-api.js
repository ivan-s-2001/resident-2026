// Resident 2026 • shared tabletop campaign backend (Cloudflare Workers + D1)
// The game uses physical dice only. No dice generator is implemented.
import { PAGE } from './team-page.js';
import { V2_PAGE, V2_FAVICON } from './v2-page.js';
import { V2_APP } from './v2-app.js';
import { V2_KIT } from './v2-kit.js';
import { V2_CSS } from './v2-style.js';
import { V2_VENDOR_CSS } from './v2-sheetbound-css.js';

const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const A=['knowledge','imagination','will','strength','agility','endurance','manipulation','presence','insight'];
const GROUPS={mind:['knowledge','imagination','will'],body:['strength','agility','endurance'],charisma:['manipulation','presence','insight']};
const KINDS=['condition','injury','mental','information','other'];
const text=(x,max=250)=>String(x??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const j=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{...JSON_HEADERS,...headers}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const hex=a=>Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');
const random=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
const sha=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
const safeEq=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0};
const derive=async(pass,salt)=>{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/.{1,2}/g).map(h=>parseInt(h,16))),iterations:175000,hash:'SHA-256'},key,256);return hex(new Uint8Array(bits))};
const get=(db,sql,...p)=>db.prepare(sql).bind(...p).first();
const run=(db,sql,...p)=>db.prepare(sql).bind(...p).run();
const all=(db,sql,...p)=>db.prepare(sql).bind(...p).all().then(r=>r.results||[]);
async function body(req){const t=req.headers.get('content-length');if(t&&Number(t)>400000)fail('Слишком большой запрос',413);const s=await req.text();if(s.length>400000)fail('Данные превышают лимит',413);try{return JSON.parse(s)}catch{fail('Некорректный JSON')}}
function defaults(){return {name:'Новый оперативник',role:'Новобранец BSAA',attrs:Object.fromEntries(A.map(a=>[a,1])),strongest:'mind',weakest:'body',skills:[],items:[],abilities:[],health:{physical:[],mental:[]},notes:'',story:'',serviceId:'',citizenship:'',speciality:'',division:'',born:'',birthplace:'',inclination:'',purpose:'',portrait:''}}
function cleanData(raw,current,master){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('Некорректный чарник');
 const result={...current};
 for(const k of ['name','role','notes','story','serviceId','citizenship','speciality','division','born','birthplace','inclination','purpose'])if(k in raw)result[k]=text(raw[k],k==='notes'||k==='story'?4500:160);
 if('portrait' in raw){
  if(typeof raw.portrait==='string'&&raw.portrait.length<=280000&&(!raw.portrait||/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw.portrait)))result.portrait=raw.portrait;
  else fail('Неподходящий формат или размер фотографии');
 }
 if(!result.name)fail('Укажите имя персонажа');
 if(raw.attrs&&typeof raw.attrs==='object'){
  result.attrs={...current.attrs};for(const key of A)if(key in raw.attrs){const value=Number(raw.attrs[key]);if(!Number.isInteger(value)||value<1||value>5)fail('Характеристики должны быть от 1 до 5');result.attrs[key]=value}
 }
 for(const key of ['strongest','weakest'])if(key in raw){if(!Object.keys(GROUPS).includes(raw[key]))fail('Неизвестная группа атрибутов');result[key]=raw[key]}
 if(result.strongest===result.weakest)fail('Сильная и слабая группы должны различаться');
 for(const key of ['skills','items','abilities'])if(key in raw){
  if(!Array.isArray(raw[key])||raw[key].length>90)fail('Слишком много записей');
  result[key]=raw[key].map((x,i)=>({id:text(x.id,60)||crypto.randomUUID(),catalogId:text(x.catalogId,100),name:text(x.name,100),level:Math.max(0,Math.min(5,Math.trunc(Number(x.level)||0))),cost:Math.max(0,Math.min(21,Math.trunc(Number(x.cost)||0))),quantity:Math.max(0,Math.min(999,Math.trunc(Number(x.quantity)||1)))})).filter(x=>x.name);
 }
 // Only GM can change health. Effects are stored in a separate table.
 if(master&&raw.health){
  const health={...current.health};
  for(const type of ['physical','mental'])if(type in raw.health){
   const max=5+result.attrs[type==='physical'?'endurance':'will'];
   if(!Array.isArray(raw.health[type])||raw.health[type].length>max)fail('Недопустимая шкала здоровья');
   health[type]=raw.health[type].map(x=>x==='lethal'?'lethal':'blunt');
  }
  result.health=health;
 }
 return result;
}
async function auth(req,db){
 const cookie=req.headers.get('Cookie')||'';
 const token=cookie.match(/(?:^|;\s*)__Host-r26=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(!token)return null;
 const hash=await sha(token);
 const user=await get(db,'SELECT u.id,u.username,u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?',hash,Date.now());
 return user||null;
}
async function createSession(db,user){
 const token=random(32),hash=await sha(token);
 await run(db,'INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',hash,user.id,Date.now()+30*86400000);
 return {cookie:'__Host-r26='+token+'; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax',user:{id:user.id,username:user.username,role:user.role}};
}
async function event(db,actor,character,kind,description,visibility='all'){
 await run(db,'INSERT INTO events(actor_id,character_id,kind,description,visibility,created_at) VALUES(?,?,?,?,?,?)',actor||null,character||null,kind,text(description,380),visibility,now());
}
async function makeAccount(db,p,role){
 const username=text(p.username,32),password=String(p.password||'');
 if(username.length<3||!/^[\p{L}\p{N}_.-]+$/u.test(username))fail('Логин: от 3 до 32 букв, цифр или символов _ . -');
 if(password.length<10||password.length>128)fail('Пароль должен содержать от 10 до 128 символов');
 const salt=random(16),hash=await derive(password,salt),id=crypto.randomUUID();
 try{await run(db,'INSERT INTO users(id,username,password_salt,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',id,username,salt,hash,role,now())}
 catch(e){if(String(e).includes('UNIQUE'))fail('Такой логин уже занят',409);throw e}
 return{id,username,role};
}
const requireGM=user=>{if(user.role!=='gm')fail('Действие доступно только мастеру',403)};
const lookupCharacter=async(db,id)=>{const row=await get(db,'SELECT * FROM characters WHERE id=?',id);if(!row)fail('Персонаж не найден',404);return row};
const owned=(user,c)=>{if(user.role!=='gm'&&c.owner_id!==user.id)fail('Недостаточно прав',403)};
function redactEventForUser(row,user,owners){
 if(user.role==='gm')return true;
 if(row.visibility==='all')return true;
 if(row.visibility==='owner'&&owners[row.character_id]===user.id)return true;
 return false;
}
async function state(db,user){
 const people=await all(db,'SELECT id,username,role FROM users ORDER BY created_at,id');
 const rows=await all(db,'SELECT id,owner_id,data,updated_at FROM characters ORDER BY updated_at DESC');
 const owners=Object.fromEntries(rows.map(x=>[x.id,x.owner_id]));
 const chosen=rows.filter(c=>user.role==='gm'||c.owner_id===user.id);
 const effects=chosen.length?await all(db,'SELECT * FROM effects WHERE character_id IN ('+chosen.map(()=>'?').join(',')+') ORDER BY created_at DESC',...chosen.map(c=>c.id)):[];
 const characters=chosen.map(c=>({id:c.id,ownerId:c.owner_id,data:JSON.parse(c.data),updatedAt:c.updated_at,
  effects:effects.filter(e=>e.character_id===c.id&&(user.role==='gm'||e.visible===1)).map(e=>({id:e.id,title:e.title,kind:e.kind,description:e.description,modifier:e.modifier,visibleToPlayer:e.visible===1,createdAt:e.created_at}))}));
 const plans=user.role==='gm'?await all(db,'SELECT * FROM plans ORDER BY updated_at DESC'):[];
 const recent=await all(db,'SELECT id,actor_id,character_id,kind,description,visibility,created_at FROM events ORDER BY id DESC LIMIT 60');
 const setting=null;
 const scene=await get(db,"SELECT value FROM meta WHERE key='published_scene'");
 return {me:user,people:user.role==='gm'?people:people.map(x=>({id:x.id,username:x.username})),characters,plans:plans.map(p=>({...p,blocks:JSON.parse(p.blocks)})),inviteCode:setting?.value||null,publishedScene:scene?JSON.parse(scene.value):null,
  events:recent.filter(r=>redactEventForUser(r,user,owners))};
}
function validateBlocks(blocks){
 if(!Array.isArray(blocks)||blocks.length>100)fail('Максимум 100 блоков в плане');
 return blocks.map(b=>({id:text(b.id,80)||crypto.randomUUID(),type:['scene','note','check','heading'].includes(b.type)?b.type:'note',title:text(b.title,180),content:text(b.content,8000),done:Boolean(b.done)}));
}
async function fetchUnutterable(){
 const response=await fetch('https://dl.dafont.com/dl/?f=unutterable');
 if(!response.ok)throw Error('Font download failed');
 const zip=await response.arrayBuffer(),v=new DataView(zip);let end=-1;
 for(let i=zip.byteLength-22;i>=Math.max(0,zip.byteLength-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break}
 if(end<0)throw Error('Invalid font ZIP');
 let at=v.getUint32(end+16,true);
 for(let i=0;i<v.getUint16(end+10,true);i++){
  if(v.getUint32(at,true)!==0x02014b50)throw Error('Corrupted ZIP');
  const method=v.getUint16(at+10,true),size=v.getUint32(at+20,true);
  const n=v.getUint16(at+28,true),ext=v.getUint16(at+30,true),comment=v.getUint16(at+32,true);
  const name=new TextDecoder().decode(new Uint8Array(zip,at+46,n));
  if(name.toLowerCase().endsWith('unutterable-italic.ttf')){
   const local=v.getUint32(at+42,true);
   if(v.getUint32(local,true)!==0x04034b50)throw Error('Corrupted font');
   const off=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true),bytes=zip.slice(off,off+size);
   return method===0?bytes:method===8?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer():null;
  }
  at+=46+n+ext+comment;
 }
 throw Error('Unutterable Italic unavailable');
}
export default {
 async fetch(req,env){
  const url=new URL(req.url),path=url.pathname,method=req.method;
  // Fieldbook v2: standalone self-hosted UI using existing same-origin API.
   if(path==='/next'||path==='/next/'){
    return new Response(V2_PAGE,{headers:{
     'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
     'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
     'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    }});
   }
   if(path==='/next/app.js'||path==='/next/kit.js')
    return new Response(path==='/next/app.js'?V2_APP:V2_KIT,{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'public,max-age=300','X-Content-Type-Options':'nosniff'}});
   if(path==='/next/theme.css'||path==='/next/vendor.css')
    return new Response(path==='/next/theme.css'?V2_CSS:V2_VENDOR_CSS,{headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'public,max-age=300','X-Content-Type-Options':'nosniff'}});
   if(path==='/next/favicon.svg')
    return new Response(V2_FAVICON,{headers:{'Content-Type':'image/svg+xml','Cache-Control':'public,max-age=86400'}});
   if(path==='/unutterable.ttf'){
    try{const cache=caches.default,old=await cache.match(req);if(old)return old;
     const bytes=await fetchUnutterable();if(!bytes||bytes.byteLength<20000)throw Error('Font missing');
     const response=new Response(bytes,{headers:{'Content-Type':'font/ttf','Cache-Control':'public,max-age=604800','X-Content-Type-Options':'nosniff'}});
     await cache.put(req,response.clone());return response;
    }catch(e){console.error(e);return new Response('Font unavailable',{status:502})}
   }
   if(path==='/manifest.webmanifest')return new Response(JSON.stringify({name:'BSAA · Resident 2026',short_name:'BSAA',start_url:'/',display:'standalone',background_color:'#111917',theme_color:'#111917',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml'}]}),{headers:{'Content-Type':'application/manifest+json','Cache-Control':'public,max-age=3600'}});
  if(path==='/icon.svg')return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="28" fill="#18231f"/><text x="96" y="104" fill="#d9e5d7" text-anchor="middle" font-size="56" font-family="Arial" font-weight="900">BSAA</text><path d="M30 129h132" stroke="#b16a56" stroke-width="4"/></svg>',{headers:{'Content-Type':'image/svg+xml'}});
  if(path==='/sw.js')return new Response("const C='bsaa-team-v1';self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['/','/icon.svg','/manifest.webmanifest'])));self.skipWaiting()});self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).pathname.startsWith('/api/'))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok)caches.open(C).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>caches.match(e.request)))})",{headers:{'Content-Type':'application/javascript','Cache-Control':'no-store'}});
  if(path==='/'||path==='/index.html')return new Response(PAGE,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self';img-src 'self' data:;style-src 'self' 'unsafe-inline';script-src 'self' 'unsafe-inline';connect-src 'self';font-src 'self';object-src 'none';frame-ancestors 'none'"}});
  if(!path.startsWith('/api/'))return new Response('Not found',{status:404});
  if(!env.DB)return j({error:'База данных не подключена'},503);
  if(method==='OPTIONS')return j({error:'Not available'},405);
  // Deny cross-origin modifications even if the browser sends cookies.
  if(!['GET','HEAD'].includes(method)){
   const origin=req.headers.get('Origin');
   if(origin!==url.origin)return j({error:'Недопустимый источник запроса'},403);
  }
  const db=env.DB;
  try{
   if(method==='GET'&&path==='/api/session'){
    const user=await auth(req,db);
    return j({user,setupRequired:false});
   }
   if(method==='POST'&&(path==='/api/setup'||path==='/api/register'||path==='/api/invite/rotate'))fail('Учётные записи создаёт только мастер',403);
   if(method==='POST'&&path==='/api/login'){
    const p=await body(req),name=text(p.username,32);
    const user=await get(db,'SELECT * FROM users WHERE username=?',name);
    if(!user){await derive('placeholder_password_0000',random(16));fail('Неверный логин или пароль',401)}
    const hash=await derive(String(p.password||''),user.password_salt);
    if(!safeEq(hash,user.password_hash))fail('Неверный логин или пароль',401);
    const session=await createSession(db,user);
    return j({user:session.user},200,{'Set-Cookie':session.cookie});
   }
   const user=await auth(req,db);
   if(!user)fail('Требуется вход',401);
   if(method==='POST'&&path==='/api/logout'){
    const token=(req.headers.get('Cookie')||'').match(/__Host-r26=([a-f0-9]{64})/)?.[1];
    if(token)await run(db,'DELETE FROM sessions WHERE token_hash=?',await sha(token));
    return j({ok:true},200,{'Set-Cookie':'__Host-r26=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'});
   }
   if(method==='POST'&&path==='/api/players'){
    requireGM(user);const p=await body(req),member=await makeAccount(db,p,'player');
    await event(db,user.id,null,'member','Мастер добавил игрока '+member.username,'gm');
    return j({id:member.id,username:member.username},201);
   }
   if(method==='POST'&&path==='/api/password'){
    const p=await body(req),row=await get(db,'SELECT password_salt,password_hash FROM users WHERE id=?',user.id);
    if(!safeEq(await derive(String(p.currentPassword||''),row.password_salt),row.password_hash))fail('Неверный текущий пароль',403);
    const password=String(p.newPassword||'');if(password.length<10||password.length>128)fail('Новый пароль: 10–128 символов');
    const salt=random(16),hash=await derive(password,salt);
    await run(db,'UPDATE users SET password_salt=?,password_hash=? WHERE id=?',salt,hash,user.id);
    await event(db,user.id,null,'password','Пользователь изменил пароль','gm');return j({ok:true});
   }
   if(method==='GET'&&path==='/api/catalog'){
    const category=url.searchParams.get('category');
    if(category&&(!['weapon_ranged','weapon_melee','consumable','armor','skill','ability','item'].includes(category)))fail('Неизвестный раздел справочника');
    const entries=category?await all(db,'SELECT * FROM catalog_entries WHERE category=? ORDER BY title LIMIT 350',category):await all(db,'SELECT * FROM catalog_entries ORDER BY category,title LIMIT 500');
    return j({entries:entries.map(x=>({id:x.id,category:x.category,title:x.title,subtitle:x.subtitle,cost:x.cost,payload:JSON.parse(x.payload),source:x.source,updatedAt:x.updated_at}))});
   }
   if(method==='POST'&&path==='/api/catalog'){
    requireGM(user);const p=await body(req);
    if(!['weapon_ranged','weapon_melee','consumable','armor','skill','ability','item'].includes(p.category))fail('Неизвестный тип');
    const title=text(p.title,120),subtitle=text(p.subtitle,220);
    if(!title)fail('Укажите название');
    const cost=Number(p.cost||0);if(!Number.isInteger(cost)||cost<0||cost>21)fail('Недопустимая ценность');
    if(p.payload==null||typeof p.payload!=='object'||Array.isArray(p.payload))fail('Некорректные параметры');
    const payload=JSON.stringify(p.payload);if(payload.length>6000)fail('Слишком подробная запись');
    const id=crypto.randomUUID(),source=text(p.source,220)||'Добавлено мастером',updated=now();
    await run(db,'INSERT INTO catalog_entries(id,category,title,subtitle,cost,payload,source,updated_at) VALUES(?,?,?,?,?,?,?,?)',id,p.category,title,subtitle,cost,payload,source,updated);
    await event(db,user.id,null,'catalog','Мастер добавил запись справочника '+title,'gm');
    return j({id},201);
   }
   if(method==='GET'&&path==='/api/state')return j(await state(db,user));
   if(method==='POST'&&path==='/api/characters'){
    const p=await body(req);
    const owner=user.role==='gm'&&p.ownerId?text(p.ownerId,60):user.id;
    if(!(await get(db,'SELECT id FROM users WHERE id=?',owner)))fail('Игрок не найден');
    const quantity=await get(db,'SELECT count(*) as n FROM characters WHERE owner_id=?',owner);
    if(quantity.n>=4)fail('Не более 4 персонажей на участника');
    const data=cleanData({name:p.name||'Новый оперативник',role:p.role||'Новобранец BSAA'},defaults(),user.role==='gm');
    const id=crypto.randomUUID(),date=now();
    await run(db,'INSERT INTO characters(id,owner_id,data,updated_at) VALUES(?,?,?,?)',id,owner,JSON.stringify(data),date);
    await event(db,user.id,id,'character','Создан персонаж '+data.name);
    return j({id},201);
   }
   const match=path.match(/^\/api\/characters\/([^/]+)(?:\/(injury|effects))?$/);
   if(match){
    const c=await lookupCharacter(db,match[1]);
    if(method==='PATCH'&&!match[2]){
     owned(user,c);const p=await body(req);
     const prev=JSON.parse(c.data),data=cleanData(p,prev,user.role==='gm');
     await run(db,'UPDATE characters SET data=?,updated_at=? WHERE id=?',JSON.stringify(data),now(),c.id);
     return j({ok:true});
    }
    if(method==='POST'&&match[2]==='injury'){
     requireGM(user);const p=await body(req),track=p.track;
     if(!['physical','mental'].includes(track))fail('Неизвестная шкала здоровья');
     const delta=Number(p.delta);if(![-1,1].includes(delta))fail('Недопустимое изменение здоровья');
     const d=JSON.parse(c.data),list=d.health[track],max=5+Number(d.attrs[track==='physical'?'endurance':'will']);
     if(delta===1){if(list.length>=max)fail('Шкала уже заполнена');list.push(p.kind==='lethal'?'lethal':'blunt')}
     else{if(!list.length)fail('Нет повреждений для снятия');list.pop()}
     await run(db,'UPDATE characters SET data=?,updated_at=? WHERE id=?',JSON.stringify(d),now(),c.id);
     await event(db,user.id,c.id,'injury',delta===1?('Мастер назначил '+(p.kind==='lethal'?'летальное':'тупое')+' повреждение'):('Мастер снял повреждение'),'owner');
     return j({ok:true,health:d.health});
    }
    if(method==='POST'&&match[2]==='effects'){
     requireGM(user);const p=await body(req);
     const title=text(p.title,110);if(!title)fail('Введите название эффекта');
     const kind=KINDS.includes(p.kind)?p.kind:'condition',description=text(p.description,2000);
     const modifier=Math.max(-5,Math.min(5,Math.trunc(Number(p.modifier)||0))),visible=p.visibleToPlayer!==false?1:0;
     const effectId=crypto.randomUUID();
     await run(db,'INSERT INTO effects(id,character_id,kind,title,description,modifier,visible,created_at) VALUES(?,?,?,?,?,?,?,?)',effectId,c.id,kind,title,description,modifier,visible,now());
     await event(db,user.id,c.id,'effect',visible?'Мастер назначил «'+title+'»':'Мастер добавил закрытый эффект',visible?'owner':'gm');
     return j({ok:true,id:effectId},201);
    }
   }
   if(method==='DELETE'&&path.startsWith('/api/effects/')){
    requireGM(user);const id=path.slice('/api/effects/'.length);
    const effect=await get(db,'SELECT * FROM effects WHERE id=?',id);if(!effect)fail('Эффект не найден',404);
    await run(db,'DELETE FROM effects WHERE id=?',id);
    await event(db,user.id,effect.character_id,'effect',effect.visible?'Мастер снял «'+effect.title+'»':'Мастер снял закрытый эффект',effect.visible?'owner':'gm');
    return j({ok:true});
   }
   if(method==='POST'&&path==='/api/plans'){
    requireGM(user);const p=await body(req),id=crypto.randomUUID(),title=text(p.title,140);if(!title)fail('Введите название вечера');
    await run(db,'INSERT INTO plans(id,title,date,blocks,status,updated_at) VALUES(?,?,?,?,?,?)',id,title,text(p.date,20),'[]','planned',now());
    return j({id},201);
   }
   const plan=path.match(/^\/api\/plans\/([^/]+)$/);
   if(plan&&method==='PATCH'){
    requireGM(user);const current=await get(db,'SELECT * FROM plans WHERE id=?',plan[1]);if(!current)fail('План не найден',404);
    const p=await body(req),title='title'in p?text(p.title,140):current.title,date='date'in p?text(p.date,20):current.date;
    if(!title)fail('Введите название вечера');
    const status=['planned','running','completed'].includes(p.status)?p.status:current.status;
    const blocks='blocks'in p?validateBlocks(p.blocks):JSON.parse(current.blocks);
    await run(db,'UPDATE plans SET title=?,date=?,status=?,blocks=?,updated_at=? WHERE id=?',title,date,status,JSON.stringify(blocks),now(),current.id);
    return j({ok:true});
   }
   if(method==='POST'&&path==='/api/scene'){
    requireGM(user);const p=await body(req),title=text(p.title,180),content=text(p.content,2000);
    if(!title)fail('Название сцены обязательно');
    const scene={title,content,at:now()};
    await run(db,"INSERT OR REPLACE INTO meta(key,value) VALUES('published_scene',?)",JSON.stringify(scene));
    await event(db,user.id,null,'scene','Мастер открыл сцену «'+title+'»');
    return j({ok:true});
   }
   return j({error:'Маршрут не найден'},404);
  }catch(error){
   const status=error.status||500;
   if(status===500)console.error('Resident2026',error);
   return j({error:status===500?'Серверная ошибка':error.message},status);
  }
 }
};
