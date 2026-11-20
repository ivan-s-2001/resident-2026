import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const worker = fs.readFileSync(new URL('../cloudflare/resident-paper-worker.js', import.meta.url), 'utf8');
function asset(name) {
  const line = worker.match(new RegExp('^const ' + name + '=(.*);$', 'm'));
  assert.ok(line, name + ' must be defined in Worker');
  return JSON.parse(line[1]);
}
test('Cloudflare paper character sheet has valid client and service worker JS', () => {
  const html = asset('HTML'), sw = asset('SW');
  const js = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(js);
  new vm.Script(js, { filename: 'mobile-sheet.js' });
  new vm.Script(sw, { filename: 'mobile-sw.js' });
  assert.match(html, /<nav class="bottom"/);
  assert.match(html, /class="bsaa-masthead"/);
  assert.match(html, /CLASSIFIED/);
  assert.match(html, /Unutterable/);
  assert.match(html, /pdf-condition-lines/);
  assert.match(html, /portrait-input/);
  assert.match(html, /roll-settings/);
  assert.match(sw, /r26-(?:paper|bsaa-dossier)-v\d+/);
});
test('PDF-inspired character sheet keeps its original terms and no Resident masthead', () => {
  const html = asset('HTML');
  for (const tab of ['Лист', 'Навыки', 'Здоровье', 'Вещи', 'Досье'])
    assert.ok(html.includes(tab), 'Missing tab: ' + tab);
  for (const term of ['ХАРАКТЕРИСТИКИ','НАВЫКИ И ЧЕРТЫ','СНАРЯЖЕНИЕ','ЗАМЕТКИ'])
    assert.ok(html.includes(term), 'Missing section: ' + term);
  assert.match(html, /border-bottom:2px dashed/);
  assert.match(html, /function compactHealth\(\)/);
  assert.doesNotMatch(html, /<div class="paper-title">РЕЗИДЕНТ 2026<\/div>/);
});
