import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';

async function freePort(){
 const s=net.createServer();
 await new Promise((ok,fail)=>s.once('error',fail).listen(0,'127.0.0.1',ok));
 const p=s.address().port;
 await new Promise(ok=>s.close(ok));
 return p;
}

test('регистрация, роли, чарник, приватность и броски', {timeout:30000}, async()=>{
 const port=await freePort(),folder=mkdtempSync(path.join(tmpdir(),'r26-test-'));
 const child=spawn(process.execPath,['server/index.js'],{cwd:path.resolve('.'),env:{...process.env,PORT:String(port),DATA_FILE:path.join(folder,'db.json'),NODE_ENV:'test'},stdio:'pipe'});
 const endpoint='http://127.0.0.1:'+port+'/api';
 const send=async(url,method='GET',body,session)=>{
  const res=await fetch(endpoint+url,{method,headers:{'X-Resident-Request':'1',...(body?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session}:{})},body:body?JSON.stringify(body):undefined});
  return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
 };
 try{
  let ready=false;
  for(let i=0;i<80;i++){try{const r=await fetch('http://127.0.0.1:'+port+'/health');if(r.ok){ready=true;break}}catch{}await new Promise(ok=>setTimeout(ok,80))}
  assert.ok(ready,'HTTP сервер должен запуститься');
  const g=await send('/auth/register','POST',{username:'Master',password:'masterpass123'}),p=await send('/auth/register','POST',{username:'Player',password:'playerpass123'});
  assert.equal(g.status,200);assert.equal(p.status,200);
  const gm=g.cookie,player=p.cookie;
  const created=await send('/campaigns','POST',{title:'Операция Тест'},gm);
  assert.equal(created.status,201);
  const id=created.data.campaign.id,code=created.data.campaign.inviteCode;
  assert.ok(code);
  const joined=await send('/campaigns/join','POST',{code},player);assert.equal(joined.status,200);
  const forbidden=await send('/campaigns/'+id+'/scene','POST',{title:'Нельзя'},player);assert.equal(forbidden.status,403);
  const secret=await send('/campaigns/'+id+'/gm-notes','POST',{notes:'Противник за стеной'},gm);assert.equal(secret.status,200);
  const newChar=await send('/campaigns/'+id+'/characters','POST',{name:'Вирусолог',attrs:{knowledge:4,endurance:3},health:{physical:['blunt','lethal']},skills:[{name:'Вирусология',level:3}],notes:'Личный дневник'},player);
  assert.equal(newChar.status,201);
  const chId=newChar.data.character.id;
  const fromGM=await send('/campaigns/'+id,'GET',undefined,gm);
  const fromPlayer=await send('/campaigns/'+id,'GET',undefined,player);
  assert.equal(fromGM.data.campaign.gmNotes,'Противник за стеной');
  assert.equal(fromPlayer.data.campaign.gmNotes,null);
  assert.equal(fromGM.data.campaign.characters[0].data.notes,'Личный дневник');
  assert.equal(fromPlayer.data.campaign.characters[0].data.health.physical[1],'lethal');
  const hide=await send('/campaigns/'+id+'/characters/'+chId,'PATCH',{gmNotes:'Попытка'},player);assert.equal(hide.status,403);
  const roll=await send('/campaigns/'+id+'/rolls','POST',{characterId:chId,attribute:'knowledge',skill:'Вирусология',modifier:0},player);
  assert.equal(roll.status,200);assert.equal(roll.data.roll.pool,7);
  const secretRoll=await send('/campaigns/'+id+'/rolls','POST',{name:'Секретный NPC',pool:4,visibility:'gm'},gm);
  assert.equal(secretRoll.status,200);
  const gmSnap=(await send('/campaigns/'+id,'GET',undefined,gm)).data.campaign;
  const playerSnap=(await send('/campaigns/'+id,'GET',undefined,player)).data.campaign;
  assert.ok(gmSnap.events.some(x=>x.type==='roll'&&x.payload.character==='Секретный NPC'));
  assert.ok(!playerSnap.events.some(x=>x.type==='roll'&&x.payload.character==='Секретный NPC'));
 }finally{
  child.kill('SIGTERM');
  rmSync(folder,{recursive:true,force:true});
 }
});
