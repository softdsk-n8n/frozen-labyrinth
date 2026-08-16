// Анализ яркости labyrinth_map.png → ASCII-карта светлых/тёмных зон.
// Node без зависимостей: декодер PNG (8-bit RGB/RGBA/gray, без интерлейса).
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const file = path.join(__dirname, '..', 'labyrinth_map.png');
const buf = fs.readFileSync(file);

// --- разбор чанков ---
let pos = 8, ihdr = null, idat = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString('ascii', pos + 4, pos + 8);
  const data = buf.subarray(pos + 8, pos + 8 + len);
  if (type === 'IHDR') ihdr = data;
  if (type === 'IDAT') idat.push(data);
  pos += len + 12;
  if (type === 'IEND') break;
}
const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4);
const bitDepth = ihdr[8], colorType = ihdr[9], interlace = ihdr[12];
const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
if (bitDepth !== 8 || interlace !== 0) throw new Error('unsupported PNG: depth ' + bitDepth + ' interlace ' + interlace);

// --- inflate + де-фильтрация сканлайнов ---
const raw = zlib.inflateSync(Buffer.concat(idat));
const stride = width * channels;
const px = Buffer.alloc(height * stride);
for (let y = 0; y < height; y++) {
  const f = raw[y * (stride + 1)];
  const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
  const cur = px.subarray(y * stride, (y + 1) * stride);
  for (let x = 0; x < stride; x++) {
    const a = x >= channels ? cur[x - channels] : 0;
    const b = prev ? prev[x] : 0;
    const c = (x >= channels && prev) ? prev[x - channels] : 0;
    let v = line[x];
    if (f === 1) v += a;
    else if (f === 2) v += b;
    else if (f === 3) v += Math.floor((a + b) / 2);
    else if (f === 4) {
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
    }
    cur[x] = v & 255;
  }
}

// --- сетка яркости: GRID×GRID ячеек в координатах карты [[0,0],[1000,1000]] ---
// y координата: 0 = низ карты = нижние пиксели (py = height).
const GRID = 50;
const cell = 1000 / GRID;
function cellInfo(gy, gx) {
  // gy=0 → низ (py от height до height - cell*height/1000)
  const y0 = Math.floor((1000 - (gy + 1) * cell) / 1000 * height);
  const y1 = Math.ceil((1000 - gy * cell) / 1000 * height);
  const x0 = Math.floor(gx * cell / 1000 * width);
  const x1 = Math.ceil((gx + 1) * cell / 1000 * width);
  let sum = 0, n = 0;
  for (let py = Math.max(0, y0); py < Math.min(height, y1); py += 3) {
    for (let pxx = Math.max(0, x0); pxx < Math.min(width, x1); pxx += 3) {
      const o = (py * width + pxx) * channels;
      const r = px[o], g = px[o + (channels > 2 ? 1 : 0)], b = px[o + (channels > 2 ? 2 : 0)];
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
      n++;
    }
  }
  return { mean: n ? sum / n : 0 };
}

const LIGHT = 110; // порог: светлее — проходимо
let light = 0, total = 0;
const rows = [];
for (let gy = GRID - 1; gy >= 0; gy--) { // печатаем сверху (север) вниз
  let row = '';
  for (let gx = 0; gx < GRID; gx++) {
    const { mean } = cellInfo(gy, gx);
    total++;
    if (mean >= LIGHT) { row += '.'; light++; }
    else if (mean >= LIGHT - 35) row += '+';
    else row += '#';
  }
  rows.push(row);
}
console.log('map ' + width + 'x' + height + ' | grid ' + GRID + 'x' + GRID + ' | light cells: ' + light + '/' + total + ' (' + Math.round(100 * light / total) + '%)');
console.log('    ' + ''.padEnd(0) + 'x: 0 .... 1000 (вывод: север сверху, юг снизу)');
rows.forEach((r, i) => console.log(String(GRID - i).padStart(3) + ' ' + r));

// --- ближайшая светлая клетка к [y, x] ---
function nearestLight(y, x, label) {
  const gy = Math.round(y / cell - 0.5), gx = Math.round(x / cell - 0.5);
  for (let r = 0; r < GRID; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dy), Math.abs(dx)) !== r) continue;
      const cy = gy + dy, cx = gx + dx;
      if (cy < 0 || cx < 0 || cy >= GRID || cx >= GRID) continue;
      if (cellInfo(cy, cx).mean >= LIGHT) {
        return { y: Math.round((cy + 0.5) * cell), x: Math.round((cx + 0.5) * cell), moved: r > 0 };
      }
    }
  }
  return null;
}

// текущие координаты сущностей из data.js
const src = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const APP = (new Function(src + '; return APP;'))();
const fix = {};
for (const e of APP.entities) {
  const nl = nearestLight(e.coords[0], e.coords[1]);
  if (nl && (nl.y !== e.coords[0] || nl.x !== e.coords[1])) {
    fix[e.npcId || e.id] = { from: e.coords, to: [nl.y, nl.x] };
  }
}
fs.writeFileSync(path.join(__dirname, 'coord-fix.json'), JSON.stringify(fix, null, 1));
console.log('\ncells to move:', Object.keys(fix).length, '→ coord-fix.json');
