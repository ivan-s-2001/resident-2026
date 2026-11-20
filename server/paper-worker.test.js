import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../cloudflare/resident-paper-worker.js', import.meta.url), 'utf8');
const asset = name => {
  const match = source.match(new RegExp('^const '+name+'=(.*);

test('Cloudflare character sheet packs valid HTML and JavaScript', () => {
  const html = asset('HTML');
  const sw = asset('SW');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  new vm.Script(script, { filename: 'mobile-sheet.js' });
  new vm.Script(sw, { filename: 'mobile-sw.js' });
  assert.match(html, /<nav class="bottom"/);
  assert.match(html, /Unutterable/);
  assert.match(html, /pdf-condition-lines/);
  assert.match(html, /portrait-input/);
  assert.match(html, /roll-settings/);
  assert.match(sw, /r26-paper-v\d+/);
  assert.match(sw, /unutterable\.ttf/);
});

test('PDF-style sheet keeps five mobile tabs and authored rule terminology', () => {
  const html = asset('HTML');
  for (const name of ['Лист','Навыки','Здоровье','Вещи','Досье']) {
    assert.ok(html.includes(name), `Missing tab ${name}`);
  }
  for (const term of ['ХАРАКТЕРИСТИКИ','НАВЫКИ И ЧЕРТЫ','СНАРЯЖЕНИЕ','ЗАМЕТКИ']) {
    assert.ok(html.includes(term), `Missing original term ${term}`);
  }
  assert.match(html, /border-bottom:2px dashed/);
  assert.match(html, /function compactHealth\(\)/);
  assert.doesNotMatch(html, /<div class="paper-title">РЕЗИДЕНТ 2026<\/div>/);
});
, 'm'));
  assert.ok(match, name+' is missing');
  return JSON.parse(match[1]);
};

test('Cloudflare character sheet packs valid HTML and JavaScript', () => {
  assert.ok(strings, 'Worker must contain serialized resources');
  const html = JSON.parse(strings[1]);
  const sw = JSON.parse(strings[4]);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  new vm.Script(script, { filename: 'mobile-sheet.js' });
  new vm.Script(sw, { filename: 'mobile-sw.js' });
  assert.match(html, /<nav class="bottom"/);
  assert.match(html, /Unutterable/);
  assert.match(html, /pdf-condition-lines/);
  assert.match(html, /portrait-input/);
  assert.match(html, /roll-settings/);
  assert.match(sw, /r26-paper-v2/);
});

test('PDF-style sheet keeps five mobile tabs and authored rule terminology', () => {
  const html = JSON.parse(strings[1]);
  for (const name of ['Лист','Навыки','Здоровье','Вещи','Досье']) {
    assert.ok(html.includes(name), `Missing tab ${name}`);
  }
  for (const term of ['ХАРАКТЕРИСТИКИ','НАВЫКИ И ЧЕРТЫ','СНАРЯЖЕНИЕ','ЗАМЕТКИ']) {
    assert.ok(html.includes(term), `Missing original term ${term}`);
  }
  assert.match(html, /border-bottom:2px dashed/);
  assert.match(html, /function compactHealth\(\)/);
  assert.doesNotMatch(html, /<h1 class="heading">ЛИЧНОЕ ДЕЛО<\/h1>/);
});
