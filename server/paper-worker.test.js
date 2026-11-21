import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const worker=fs.readFileSync(new URL('../cloudflare/resident-paper-worker.js',import.meta.url),'utf8');
const asset=name=>{
 const line=worker.match(new RegExp('^const '+name+'=(.*);$','m'));
 assert.ok(line,name+' is missing from Worker');
 return JSON.parse(line[1]);
};
test('Offline mobile character sheet JavaScript is valid',()=>{
 const html=asset('HTML'),sw=asset('SW');
 const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js);
 new vm.Script(js,{filename:'mobile-sheet.js'});
 new vm.Script(sw,{filename:'mobile-sw.js'});
 assert.match(html,/class="bsaa-masthead"/);
 assert.match(html,/portrait-input/);
 assert.match(html,/roll-settings/);
 assert.match(sw,/r26-physical-dice-v\d+/);
 assert.doesNotMatch(html,/roll-submit|quick-roll|rollComposer|function rollDice|ПРОВЕРКА D10/);
});
test('Official ready-made icon kit and paper texture are wired',()=>{
 const kit=asset('KIT_ICONS'),html=asset('HTML'),sw=asset('SW');
 const expected=['file-description','clipboard-list','heart-rate-monitor','backpack','id-badge-2','camera'];
 for(const icon of expected){
  assert.match(kit[icon],/^<svg/,'Missing genuine Tabler icon '+icon);
  assert.match(kit[icon],/<path|<circle|<rect/);
  assert.ok(sw.includes('/assets/icons/'+icon+'.svg'),'Missing icon in precache '+icon);
 }
 assert.match(worker,/ambientcg\.com\/get\?file=Paper001_1K-JPG\.zip/);
 assert.match(html,/url\('\/assets\/paper\.png'\)/);
 assert.match(html,/class="kit-icon"/);
 assert.doesNotMatch(html,/<div class="paperclip"/);
 assert.doesNotMatch(html,/class="portrait-symbol"/);
 assert.doesNotMatch(html,/class="bsaa-mark"/);
});
test('Reference dossier uses Cyrillic fonts and live identity details',()=>{
 const html=asset('HTML'),sw=asset('SW');
 for(const font of ['oswald.ttf','roboto-condensed.ttf','ibm-plex-mono.ttf']){
  assert.ok(html.includes('/assets/fonts/'+font));
  assert.ok(sw.includes('/assets/fonts/'+font),'Missing offline cache for '+font);
 }
 for(const key of ['serviceId','citizenship','speciality','division']){
  assert.ok(html.includes(key),'Missing dossier data '+key);
 }
 assert.match(html,/function code39\(value\)/);
 assert.match(html,/assets\/bsaa-reference.jpg/);
 assert.match(html,/assets\/fingerprint.svg/);
 assert.doesNotMatch(html,/РЕЗИДЕНТ 2026<\/div>/);
});
test('Character system retains author terms and the five tabs',()=>{
 const html=asset('HTML');
 for(const tab of ['Лист','Навыки','Здоровье','Вещи','Досье'])
  assert.ok(html.includes(tab),'Missing tab: '+tab);
 for(const term of ['ХАРАКТЕРИСТИКИ','НАВЫКИ И ЧЕРТЫ','СНАРЯЖЕНИЕ','ЗАМЕТКИ'])
  assert.ok(html.includes(term),'Missing section: '+term);
 assert.match(html,/function compactHealth\(\)/);
 assert.doesNotMatch(html,/<div class="paper-title">РЕЗИДЕНТ 2026<\/div>/);
});
