
window.__testBattle = async function() {
  var b = window.game.scene.getScene('Battle');
  if (!b || !b.scene.isActive()) { console.log('NO_BATTLE'); return; }
  b.enemies[1].hp = 1;
  b.updateEnemyLabels();
  console.log('HP2:' + b.enemies[1].hp);
  
  function dk(t, k, c, n) {
    window.dispatchEvent(new KeyboardEvent(t, {key: k, code: c, keyCode: n, which: n, bubbles: true}));
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  
  // Press Z to select FIGHT
  dk('keydown', 'z', 'KeyZ', 90);
  await sleep(100);
  dk('keyup', 'z', 'KeyZ', 90);
  await sleep(200);
  console.log('Z1:' + b.battleState);
  
  // Press Down to target second slime
  dk('keydown', 'ArrowDown', 'ArrowDown', 40);
  await sleep(100);
  dk('keyup', 'ArrowDown', 'ArrowDown', 40);
  await sleep(200);
  var al = b.enemies.filter(function(e) {return e.alive});
  console.log('TGT:' + al[b.selectedTarget].name + '_i:' + al[b.selectedTarget].index);
  
  // Press Z to attack
  dk('keydown', 'z', 'KeyZ', 90);
  await sleep(100);
  dk('keyup', 'z', 'KeyZ', 90);
  await sleep(3000);
  
  console.log('FINAL:' + JSON.stringify({
    st: b.battleState,
    ti: b.currentTurnIndex,
    e1: b.enemies[0].alive,
    e2: b.enemies[1].alive,
    php: b.player.hp,
    log: b.battleLog.slice(-3)
  }));
  console.log('DONE');
};
