import {randomInt} from 'node:crypto';
// Из архива «Резидент 2026»: 1 = -1 успех, 8–10 = +1, 10 добавляет куб.
export function evaluateRoll(pool, difficulty, die=()=>randomInt(1,11)) {
  if(!Number.isInteger(pool)||pool<0||pool>100)throw new RangeError('Неверный пул');
  if(!Number.isInteger(difficulty)||difficulty<1||difficulty>5)throw new RangeError('Неверная сложность');
  let successes=0, bonusDice=0;
  const dice=[];
  for(let i=0;i<pool+bonusDice&&dice.length<500;i++){
    const value=die();
    if(!Number.isInteger(value)||value<1||value>10)throw new Error('Недопустимая грань');
    dice.push(value);
    if(value===1)successes--;
    if(value>=8)successes++;
    if(value===10)bonusDice++;
  }
  const outcome=successes<0?'critical_failure':successes>=difficulty+3?'critical_success':successes>=difficulty?'success':'failure';
  return {pool,dice,bonusDice,successes,difficulty,outcome,truncated:dice.length>=500};
}
