// Модуль анализа светлых (проходимых) зон labyrinth_map.png.
// Используется генератором data.js: снап координат к ближайшей светлой ячейке.
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const GRID = 50;            // ячеек по каждой оси (координаты 0..1000)
const LIGHT = 110;          // порог средней яркости ячейки

function decodePng(file) {
  const buf = fs.readFileSync(file);
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
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr[9]];
  if (ihdr[8] !== 8 || ihdr[12] !== 0) throw new Error('unsupported PNG');
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
  return { px, width, height, channels };
}

const MAP = decodePng(path.join(__dirname, '..', 'labyrinth_map.png'));

// Средняя яркость ячейки сетки (gy 0 = юг/низ, gx 0 = запад/лево)
function cellMean(gy, gx) {
  const cell = 1000 / GRID;
  const y0 = Math.floor((1000 - (gy + 1) * cell) / 1000 * MAP.height);
  const y1 = Math.ceil((1000 - gy * cell) / 1000 * MAP.height);
  const x0 = Math.floor(gx * cell / 1000 * MAP.width);
  const x1 = Math.ceil((gx + 1) * cell / 1000 * MAP.width);
  let sum = 0, n = 0;
  for (let py = Math.max(0, y0); py < Math.min(MAP.height, y1); py += 3) {
    for (let pxx = Math.max(0, x0); pxx < Math.min(MAP.width, x1); pxx += 3) {
      const o = (py * MAP.width + pxx) * MAP.channels;
      const r = MAP.px[o], g = MAP.px[o + (MAP.channels > 2 ? 1 : 0)], b = MAP.px[o + (MAP.channels > 2 ? 2 : 0)];
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
      n++;
    }
  }
  return n ? sum / n : 0;
}

const grid = [];
for (let gy = 0; gy < GRID; gy++) {
  grid[gy] = [];
  for (let gx = 0; gx < GRID; gx++) grid[gy][gx] = cellMean(gy, gx) >= LIGHT;
}

// Точная сетка для размещения точек: N ячеек и порог задаются явно.
// Возвращает { grid, cell, isLight(y,x), snap(y,x,maxCells) → [y,x]|null }
function fineGrid(n, threshold) {
  const step = 1000 / n;
  const g = [];
  for (let gy = 0; gy < n; gy++) {
    g[gy] = [];
    for (let gx = 0; gx < n; gx++) {
      // пересчёт по мелкой ячейке
      const y0 = Math.floor((1000 - (gy + 1) * step) / 1000 * MAP.height);
      const y1 = Math.ceil((1000 - gy * step) / 1000 * MAP.height);
      const x0 = Math.floor(gx * step / 1000 * MAP.width);
      const x1 = Math.ceil((gx + 1) * step / 1000 * MAP.width);
      let s = 0, c = 0;
      for (let py = Math.max(0, y0); py < Math.min(MAP.height, y1); py += 2) {
        for (let pxx = Math.max(0, x0); pxx < Math.min(MAP.width, x1); pxx += 2) {
          const o = (py * MAP.width + pxx) * MAP.channels;
          s += 0.299 * MAP.px[o] + 0.587 * MAP.px[o + (MAP.channels > 2 ? 1 : 0)] + 0.114 * MAP.px[o + (MAP.channels > 2 ? 2 : 0)];
          c++;
        }
      }
      g[gy][gx] = (c ? s / c : 0) >= threshold;
    }
  }
  const isLight = (y, x) => {
    const gy = Math.max(0, Math.min(n - 1, Math.floor(y / step)));
    const gx = Math.max(0, Math.min(n - 1, Math.floor(x / step)));
    return g[gy][gx];
  };
  // ближайшая светлая мелкая ячейка не дальше maxCells (чебышев), иначе null
  const snap = (y, x, maxCells) => {
    if (isLight(y, x)) return [y, x];
    const gy = Math.floor(y / step), gx = Math.floor(x / step);
    for (let r = 1; r <= maxCells; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dy), Math.abs(dx)) !== r) continue;
        const cy = gy + dy, cx = gx + dx;
        if (cy < 0 || cx < 0 || cy >= n || cx >= n) continue;
        if (g[cy][cx]) return [(cy + 0.5) * step, (cx + 0.5) * step];
      }
    }
    return null;
  };
  return { grid: g, step, isLight, snap };
}

// Ближайшая светлая ячейка к [y, x]; возвращает координаты [y, x] центра ячейки.
function nearestLight(y, x) {
  const cell = 1000 / GRID;
  const gy = Math.max(0, Math.min(GRID - 1, Math.round(y / cell - 0.5)));
  const gx = Math.max(0, Math.min(GRID - 1, Math.round(x / cell - 0.5)));
  if (grid[gy][gx]) return [Math.round((gy + 0.5) * cell), Math.round((gx + 0.5) * cell)];
  for (let r = 1; r < GRID; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dy), Math.abs(dx)) !== r) continue;
      const cy = gy + dy, cx = gx + dx;
      if (cy < 0 || cx < 0 || cy >= GRID || cx >= GRID) continue;
      if (grid[cy][cx]) return [Math.round((cy + 0.5) * cell), Math.round((cx + 0.5) * cell)];
    }
  }
  return [y, x];
}

module.exports = { nearestLight, grid, GRID, LIGHT, fineGrid };
