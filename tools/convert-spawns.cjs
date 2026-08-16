// Конвертация игровых координат спавнов (L2J Interlude spawnlist) в координаты карты.
// Подбирает линейный transform (масштаб/сдвиг/отражения), максимизируя попадание
// спавнов на светлые (проходимые) ячейки labyrinth_map.png.
// Выход: tools/spawns-map.json — { npcId: [y, x] } для генератора data.js.
const fs = require('fs');
const path = require('path');
const { grid, GRID, fineGrid } = require('./png-light.cjs');
// точная сетка для точек: 100×100, порог ярче — точка должна стоять на белом снегу
const FINE = fineGrid(100, 135);

const CACHE_DIRS = [
  process.env.L2_CACHE,
  path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Temp', 'l2data'),
  '/tmp/l2data',
].filter(Boolean);
function findCache() {
  for (const d of CACHE_DIRS) if (fs.existsSync(path.join(d, 'spawns_raw.json'))) return d;
  throw new Error('spawns_raw.json not found in cache');
}
const rows = JSON.parse(fs.readFileSync(path.join(findCache(), 'spawns_raw.json'), 'utf8'));

const CELL = 1000 / GRID;
function onLight(y, x) {
  const gy = Math.max(0, Math.min(GRID - 1, Math.floor(y / CELL)));
  const gx = Math.max(0, Math.min(GRID - 1, Math.floor(x / CELL)));
  return grid[gy][gx];
}

// базовый bbox по перцентилям (устойчивее к выбросам)
const xs = rows.map(r => r.x).sort((a, b) => a - b);
const ys = rows.map(r => r.y).sort((a, b) => a - b);
const p = (arr, q) => arr[Math.floor((arr.length - 1) * q)];
const minX = p(xs, 0.02), maxX = p(xs, 0.98);
const minY = p(ys, 0.02), maxY = p(ys, 0.98);

function makeT(flipX, flipY, scale, ox, oy) {
  const spanX = (maxX - minX) / scale, spanY = (maxY - minY) / scale;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return function (gx, gy) {
    let mx = ((gx - cx) / spanX) * 1000 + 500 + ox;
    let my = ((gy - cy) / spanY) * 1000 + 500 + oy;
    if (flipX) mx = 1000 - mx;
    if (flipY) my = 1000 - my;
    return [Math.max(0, Math.min(1000, my)), Math.max(0, Math.min(1000, mx))]; // [y, x]
  };
}

function score(T) {
  let hit = 0;
  for (const r of rows) if (onLight(...T(r.x, r.y))) hit++;
  return hit / rows.length;
}

let best = null;
for (const fx of [false, true]) for (const fy of [false, true]) {
  for (let s = 0.6; s <= 1.35; s += 0.05) {
    for (let ox = -120; ox <= 120; ox += 10) for (let oy = -120; oy <= 120; oy += 10) {
      const T = makeT(fx, fy, s, ox, oy);
      const sc = score(T);
      if (!best || sc > best.sc) best = { fx, fy, s, ox, oy, sc, T };
    }
  }
}

console.log('best transform: flipX=' + best.fx + ' flipY=' + best.fy +
  ' scale=' + best.s.toFixed(2) + ' offset=(' + best.ox + ',' + best.oy + ')' +
  ' → light match: ' + Math.round(best.sc * 100) + '% of ' + rows.length + ' spawns');

// центры кластеров: медиана спавнов каждого моба, снап к светлой ячейке
// + полный список точек (для слоя спавн-точек на карте)
const by = {};
rows.forEach(r => (by[r.tpl] = by[r.tpl] || []).push(r));
const out = {};
const points = {};
for (const [tpl, list] of Object.entries(by)) {
  const mx = list.map(r => r.x).sort((a, b) => a - b);
  const my = list.map(r => r.y).sort((a, b) => a - b);
  const med = a => a[Math.floor(a.length / 2)];
  let [y, x] = best.T(med(mx), med(my));
  // снап к ближайшей светлой ячейке
  if (!onLight(y, x)) {
    outer: for (let r = 1; r < GRID; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dy), Math.abs(dx)) !== r) continue;
        const cy = y + dy * CELL, cx = x + dx * CELL;
        if (cy < 0 || cx < 0 || cy > 1000 || cx > 1000) continue;
        if (onLight(cy, cx)) { y = cy + CELL / 2; x = cx + CELL / 2; break outer; }
      }
    }
  }
  out[tpl] = [Math.round(y), Math.round(x)];
  if (list.length > 1) {
    // точная проверка: точка обязана стоять на белом (fine-сетка 100×100, порог 135);
    // если нет — снап к ближайшей белой мелкой ячейке (до 4 клеток = 40 ед.), дальше — выброс
    const seenPts = new Set();
    const pts = [];
    let dropped = 0;
    for (const r of list) {
      const [ty, tx] = best.T(r.x, r.y);
      const snapped = FINE.snap(ty, tx, 4);
      if (!snapped) { dropped++; continue; }
      let py = snapped[0], px = snapped[1];
      if (FINE.isLight(ty, tx)) { py = ty; px = tx; } // была на белом — оставляем как есть
      const ry = Math.round(py), rx = Math.round(px);
      if (!FINE.isLight(ry, rx)) { dropped++; continue; } // край ячейки после округления
      const key = ry + ':' + rx;
      if (seenPts.has(key)) continue;
      seenPts.add(key);
      pts.push([ry, rx]);
    }
    if (dropped) console.log('  npc ' + tpl + ': dropped ' + dropped + ' far-dark points');
    points[tpl] = pts;
  }
}
fs.writeFileSync(path.join(__dirname, 'spawns-map.json'), JSON.stringify({ centers: out, points }, null, 1));
console.log('written spawns-map.json:', Object.keys(out).length, 'npcs |', Object.values(points).reduce((a, b) => a + b.length, 0), 'spawn points');