import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const unwrap=path=>{
 const file=read('../cloudflare/'+path),match=file.match(/^export const \w+=(.*);$/m);
 assert.ok(match,path+' exports text asset');return JSON.parse(match[1]);
};
const app=unwrap('v2-app.js'),kit=unwrap('v2-kit.js'),theme=unwrap('v2-style.js'),vendor=unwrap('v2-sheetbound-css.js');
const page=unwrap('v2-page.js'),worker=read('../cloudflare/team-api.js');

test('v2: each JavaScript module parses without network dependencies',()=>{
 new Script(kit.replace(/^export /gm,''));
 new Script(app.replace(/^import .*?;$/m,''));
 new Script(worker.replace(/^import .*?;$/gm,'').replace('export default {','const handler={'));
 assert.match(page,/<script type="module" src="\/next\/app\.js"/);
 assert.match(page,/\/next\/vendor\.css/);
 assert.match(page,/\/next\/theme\.css/);
});
test('v2: existing same-origin D1 backend, authentication, and demo remain isolated',()=>{
 for(const route of ['/next','/next/app.js','/next/kit.js','/next/vendor.css','/next/theme.css'])
  assert.ok(worker.includes(route),route);
 assert.match(worker,/X-Frame-Options/);
 assert.match(worker,/form-action 'self'/);
 assert.match(worker,/requireGM\(user\)/);
 assert.match(worker,/path==='\/api\/players'/);
 assert.match(worker,/path==='\/api\/password'/);
 assert.doesNotMatch(worker,/if\(method==='POST'&&path==='\/api\/setup'\)\{/);
 assert.match(app,/function previewRequest\(/);
 assert.match(app,/function request\(/);
 assert.match(app,/await request\('POST','\/login'/);
 assert.match(app,/await request\('GET','\/session'/);
 assert.match(app,/await request\('GET','\/state'/);
});
test('v2: screens are fully componentized with GM and player roles',()=>{
 for(const name of ['sheet','stats','gear','bio','gmTeam','gmPlan','gmLog','modalView','healthTrack','appShell']){
  assert.ok(app.includes(name)||kit.includes(name),name);
 }
 assert.match(kit,/function appShell\(/);
 assert.match(kit,/function healthTrack\(/);
 assert.match(kit,/export function statBlock\(/);
 assert.match(app,/queuePatch\(/);
 assert.match(app,/flush\(/);
 assert.match(app,/const d=ch\.data,spent=GROUPS\.map/); // group budgets displayed
});
test('v2: preserves physical dice, GM-controlled wounds, and author terms',()=>{
 assert.match(app,/Заражение/);
 assert.match(app,/Группа BSAA/);
 assert.match(app,/Шмотьё/);
 assert.match(kit,/Сила воли/);
 assert.match(kit,/Выносливость/);
 assert.match(kit,/max=5\+Number/);
 assert.match(app,/Первый пункт атрибута бесплатный/);
 assert.doesNotMatch(app,/data-action="roll"|Бросить куб|Math\.floor\(Math\.random\(\)\*10\)/);
 assert.match(app,/if\(a==='injury'\)/);
 assert.match(app,/if\(a==='remove-effect'\)/);
});
test('v2: genuine open-source foundation and responsive layout',()=>{
 assert.match(vendor,/SheetBound/);
 assert.match(vendor,/\.btn-primary/);
 assert.match(theme,/\.sidebar/);
 assert.match(theme,/\.mobile-bottom/);
 assert.match(theme,/@media\(max-width:720px\)/);
 assert.match(kit,/Selected Lucide/);
 assert.match(page,/lang="ru"/);
});
