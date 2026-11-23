import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const api=readFileSync(new URL('../cloudflare/team-api.js',import.meta.url),'utf8');
const raw=readFileSync(new URL('../cloudflare/team-page.js',import.meta.url),'utf8');
const match=raw.match(/^export const PAGE=(.*);$/m);
assert.ok(match,'HTML bundle export must be present');
const html=JSON.parse(match[1]);
const browser=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('PDF-inspired page and Worker scripts parse',()=>{
 assert.ok(browser);
 new Script(browser,{filename:'resident-2026-paper-browser.js'});
 new Script(api.replace("import { PAGE } from './team-page.js';","const PAGE = '';").replace('export default {','const handler = {'),{filename:'resident-2026-worker.js'});
 assert.match(html,/viewport-fit=cover/);
 assert.match(html,/paper-sheet/);
 assert.match(html,/pdf-gridtop/);
 assert.match(html,/@media\(max-width:660px\)/);
});
test('Printed sheet structure is reproduced',()=>{
 for(const phrase of ['РЕЗИДЕНТ','ХАРАКТЕРИСТИКИ','НАВЫКИ И ЧЕРТЫ','ШМОТЬЕ','ВЫЯВЛЕННЫЕ ПРОБЛЕМЫ СО ЗДОРОВЬЕМ','ДЛЯ ЗАМЕТОК','pdf-hrow','pdf-attrs','pdf-inline'])assert.ok(html.includes(phrase),phrase);
 assert.match(html,/Unutterable/);
 assert.match(api,/\/unutterable.ttf/);
});
test('Only GM can provision accounts; no setup or invite code',()=>{
 assert.match(api,/requireGM\(user\)/);
 assert.match(api,/path==='\/api\/players'/);
 assert.match(api,/path==='\/api\/password'/);
 assert.match(api,/path==='\/api\/setup'/);
 assert.match(api,/path==='\/api\/register'/);
 assert.doesNotMatch(api,/if\(method==='POST'&&path==='\/api\/setup'\)\{/);
 assert.doesNotMatch(api,/if\(method==='POST'&&path==='\/api\/register'\)\{/);
 assert.doesNotMatch(html,/name="setupCode"|name="inviteCode"/);
 assert.match(html,/id="add-player"/);
 assert.match(html,/id="password-form"/);
});
test('Character access, hidden effects, and physical dice remain enforced',()=>{
 assert.match(api,/const owned=\(user,c\)/);
 assert.match(api,/visible===1|e.visible===1/);
 assert.match(api,/cleanData\(p,prev,user.role==='gm'\)/);
 assert.match(api,/__Host-r26/);
 assert.match(api,/PBKDF2/);
 assert.doesNotMatch(api,/Math\.random\(\)\s*\*\s*10/);
 assert.doesNotMatch(html,/БРОСИТЬ КУБЫ|data-act="roll"|Бросить d10/);
});
test('Fast auto-save, physical and mental damage, and isolated demo',()=>{
 assert.match(html,/function sheetView\(\)/);
 assert.match(html,/function gmTeamView\(\)/);
 assert.match(html,/function gmPlanView\(\)/);
 assert.match(html,/function startDemo\(role\)/);
 assert.match(html,/function demoApi\(method,path,payload/);
 assert.match(html,/data-act="injury"/);
 assert.match(html,/data-act="skill-level"/);
 assert.match(html,/data-act="item-qty"/);
 assert.match(html,/data-char="notes"/);
 assert.match(html,/setTimeout\(\(\)=>saveChar\(true\),550\)/);
});

test('All character and GM tabs share paper rendering',()=>{
 const sections={
  stats:['function statsView()','function gearView()'],
  gear:['function gearView()','function bioView()'],
  bio:['function bioView()','function savePanel()'],
  team:['function gmTeamView()','function invites()'],
  plans:['function gmPlanView()','function historyView()'],
  history:['function historyView()','function mainView()']
 };
 for(const [name,[start,end]] of Object.entries(sections)){
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,name+' section exists');
  const source=html.slice(a,b);
  assert.ok(source.includes('paperPage('),name+' uses paper layout');
 }
 for(const marker of ['function paperPage(','.paper-page .paper-document-head','.paper-page .paper-section','.paper-page .paper-grid','.paper-page .paper-entry','.paper-page .paper-plan-block','.paper-page .paper-log']){
  assert.ok(html.includes(marker),marker);
 }
 assert.match(html,/\['team','Группа'\],\['plan','План'\],\['history','Журнал'\],\['sheet','Лист'\],\['stats','Параметры'\],\['gear','Вещи'\],\['bio','Досье'\]/);
});
test('Phone screens show all tabs instead of hiding dossier offscreen',()=>{
 assert.match(html,/\.nav\{position:sticky;top:0;z-index:15;display:flex;flex-wrap:wrap/);
 assert.match(html,/\.paper-page \.monogram\{/);
 assert.match(html,/id="photo-file"/);
 assert.match(html,/data-act="upload-photo"/);
});

test('True compact paper source proportions and readable controls',()=>{
 assert.match(html,/class="pdf-heading"/);
 assert.match(html,/class="pdf-brand"/);
 assert.match(html,/class="pdf-biography"/);
 assert.match(html,/class="pdf-bottom"/);
 assert.match(html,/\.pdf-sheet \.pdf-gridtop\{display:grid;grid-template-columns/);
 assert.match(html,/\.paper-page \.paper-entry \.entry-name\{font:600 13px/);
});
