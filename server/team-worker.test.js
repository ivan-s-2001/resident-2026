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
 new Script(api.replace(/^import .*?;$/gm,'').replace('export default {','const handler = {'),{filename:'cloudflare-team-worker.js'});
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
test('One-screen character reference and GM quick controls are available',()=>{
 for(const marker of ['function sheetView()','function gmTeamView()','function gmPlanView()','function effectsMarkup(',
  'data-act="quick-effect"','data-act="injury"','class="quick-cols"','class="quick-notes"','id="effect-form"'])
  assert.ok(html.includes(marker),marker);
 assert.match(html,/function markChanged\(key\)/);
 assert.match(html,/setTimeout\(\(\)=>saveChar\(true\),550\)/);
 assert.match(html,/!el\.dirty&&!el\.saving/);
 assert.doesNotMatch(html,/Сначала сохраните изменения в чарнике/);
 assert.match(html,/resident2026-paper-v1/);
 for(const route of ['/api/setup','/api/register','/api/login','/api/logout','/api/state','/api/characters','/api/plans','/api/scene'])
  assert.ok(api.includes(route),route);
 assert.match(api,/__Host-r26/);
 assert.match(api,/PBKDF2/);
});

test('Preview is isolated from production and usable before registration',()=>{
 assert.match(html,/function startDemo\(role\)/);
 assert.match(html,/function demoApi\(method,path,payload/);
 assert.match(html,/if\(el\.preview\)return demoApi\(method,path,payload\)/);
 assert.match(html,/preview==='gm'\|\|preview==='player'/);
 assert.match(html,/data-act="demo-player"/);
 assert.match(html,/data-act="demo-gm"/);
 assert.match(html,/ДЕМО •/);
});
test('Fast tabletop interactions need no digital dice or manual save',()=>{
 assert.match(html,/data-act="jump-notes"/);
 assert.match(html,/setTimeout\(\(\)=>pane\.querySelector\('textarea'\)\?\.focus\(\),90\)/);
 assert.match(html,/data-act="quick-effect"/);
 assert.match(html,/data-act="remove-effect"/);
 assert.match(html,/data-act="injury"/);
 assert.match(html,/setTimeout\(\(\)=>saveChar\(true\),550\)/);
 assert.match(html,/function draftChange\(key,value\)/);
 assert.match(html,/if\(succeeded&&changedKeys\.size&&el\.dirty\)scheduleSave\(\)/);
 assert.doesNotMatch(html,/Сохранить изменения<\/button>/);
 assert.doesNotMatch(api,/Math\.random\(\)\s*\*\s*10/);
});
