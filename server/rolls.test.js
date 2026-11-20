import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRoll} from './rolls.js';
const seq=a=>{let i=0;return ()=>a[i++]};
test('взрывные десятки',()=>{const x=evaluateRoll(1,1,seq([10,10,8]));assert.equal(x.bonusDice,2);assert.equal(x.successes,3)});
test('единица отнимает успех',()=>{const x=evaluateRoll(1,1,seq([1]));assert.equal(x.successes,-1);assert.equal(x.outcome,'critical_failure')});
test('успех и критический успех',()=>{assert.equal(evaluateRoll(1,1,seq([8])).outcome,'success');assert.equal(evaluateRoll(4,1,seq([8,8,8,8])).outcome,'critical_success')});
test('нулевой пул',()=>assert.equal(evaluateRoll(0,2).outcome,'failure'));
test('ограничения',()=>{assert.throws(()=>evaluateRoll(-1,1));assert.throws(()=>evaluateRoll(1,6))});
