import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const api=readFileSync(new URL('../cloudflare/team-api.js',import.meta.url),'utf8');
const pageModule=readFileSync(new URL('../cloudflare/team-page.js',import.meta.url),'utf8');
const match=pageModule.match(/^export const PAGE=(.*);$/m);
assert.ok(match,'Embedded page export is required');
const html=JSON.parse(match[1]);
const browser=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
test('Unified GM + player interface parses without dependencies',()=>{
 assert.ok(browser,'Browser application script is present');
 new Script(browser,{filename:'shared-team-browser.js'});
 new Script(api.replace("import { PAGE } from './team-page.js';",'const PAGE = "";').replace('export default {','const handler = {'),{filename:'cloudflare-team-worker.js'});
 assert.match(html,/viewport-fit=cover/);
 assert.match(html,/@media\(max-width:650px\)/);
});
test('Roles and physical dice constraints are hard boundaries',()=>{
 assert.match(api,/const requireGM=user=>/);
 assert.match(api,/requireGM\(user\)/);
 assert.match(api,/visible===1|e.visible===1/);
 assert.match(api,/const owned=\(user,c\)/);
 assert.match(api,/cleanData\(p,prev,user.role==='gm'\)/);
 assert.doesNotMatch(api,/evaluateRoll|rollDice|Math\.random\(\)\s*\*\s*10/);
 assert.doesNotMatch(html,/БРОСИТЬ КУБЫ|Бросить d10|data-act="roll"/);
});
test('Player has character sheet, GM has effects and planning',()=>{
 for(const word of ['Пульт мастера','Активные эффекты','Назначить эффект','Подготовка вечера','Личный чарник','Перенести данные'])assert.ok(html.includes(word),word);
 for(const route of ['/api/setup','/api/register','/api/login','/api/logout','/api/state','/api/characters','/api/plans','/api/scene'])assert.ok(api.includes(route),route);
 assert.ok(html.includes('resident2026-paper-v1'),'Import must read the existing local sheet on the same origin');
 assert.match(api,/__Host-r26/);
 assert.match(api,/PBKDF2/);
});
