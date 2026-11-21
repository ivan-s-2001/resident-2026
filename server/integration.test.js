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
  const initial=(await send('/campaigns','GET',undefined,gm)).data;
  assert.equal(initial.setupAvailable,true);
  const created=await send('/campaigns','POST',{title:'Операция Тест'},gm);
  assert.equal(created.status,201);
  const duplicate=await send('/campaigns','POST',{title:'Вторая кампания'},gm);
  assert.equal(duplicate.status,409,'Нельзя создавать вторую кампанию');
  const unjoined=(await send('/campaigns','GET',undefined,player)).data;
  assert.equal(unjoined.setupAvailable,false);
  assert.equal(unjoined.campaigns.length,0,'Игрок не должен видеть закрытые данные до приглашения');
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

  const forbiddenEffect=await send('/campaigns/'+id+'/characters/'+chId+'/effects','POST',{title:'Подмена эффекта'},player);
  assert.equal(forbiddenEffect.status,403);
  const made=await send('/campaigns/'+id+'/characters/'+chId+'/effects','POST',{
   title:'Контузия',kind:'mental',description:'Сложнее сосредоточиться',duration:'До лечения',
   modifier:-1,visibleToPlayer:true
  },gm);
  assert.equal(made.status,201);
  const secretEffect=await send('/campaigns/'+id+'/characters/'+chId+'/effects','POST',{
   title:'Скрытая угроза',kind:'condition',description:'Персонаж пока не знает причину',
   visibleToPlayer:false
  },gm);
  assert.equal(secretEffect.status,201);
  const playerEffects=(await send('/campaigns/'+id,'GET',undefined,player)).data.campaign.characters[0].effects;
  const gmEffects=(await send('/campaigns/'+id,'GET',undefined,gm)).data.campaign.characters[0].effects;
  assert.equal(playerEffects.length,1,'Игрок должен видеть только открытый эффект');
  assert.equal(playerEffects[0].title,'Контузия');
  assert.equal(gmEffects.length,2,'Мастер видит также закрытые эффекты');
  assert.equal((await send('/campaigns/'+id,'GET',undefined,player)).data.campaign.events.some(x=>x.payload.text?.includes('Скрытая угроза')),false);
  const updateByPlayer=await send('/campaigns/'+id+'/characters/'+chId,'PATCH',{name:'Вирусолог 2',effects:[]},player);
  assert.equal(updateByPlayer.status,200);
  const afterUpdate=(await send('/campaigns/'+id,'GET',undefined,gm)).data.campaign.characters[0].effects;
  assert.equal(afterUpdate.length,2,'Обновление листа игроком не может стереть эффекты мастера');
  const injury=await send('/campaigns/'+id+'/characters/'+chId+'/injury','POST',{track:'physical',kind:'lethal',delta:1},gm);
  assert.equal(injury.status,200);
  assert.equal(injury.data.health.physical.length,3);
  assert.equal((await send('/campaigns/'+id+'/characters/'+chId+'/injury','POST',{track:'physical',kind:'blunt',delta:1},player)).status,403);
  const healing=await send('/campaigns/'+id+'/characters/'+chId+'/injury','POST',{track:'physical',delta:-1},gm);
  assert.equal(healing.status,200);
  assert.equal(healing.data.health.physical.length,2);
  const cleared=await send('/campaigns/'+id+'/characters/'+chId+'/effects/'+made.data.effect.id,'DELETE',undefined,gm);
  assert.equal(cleared.status,200);
  const finalEffect=(await send('/campaigns/'+id,'GET',undefined,player)).data.campaign.characters[0].effects;
  assert.equal(finalEffect.length,0,'После снятия открытого эффекта игрок не должен видеть скрытый');

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
