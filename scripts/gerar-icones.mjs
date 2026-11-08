// Gera os PNGs do app (sem dependências): "R" branco sobre o azul do tema. Uso: node scripts/gerar-icones.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const COR = [0x1d, 0x5b, 0x85];
const W = 0.34, H = 0.5, T = 0.085, BH = 0.30, R = BH / 2, CX = W - R;

function noGlifo(x, y) { // x,y em fração do ícone
  const gx = x - (1 - W) / 2, gy = y - (1 - H) / 2;
  if (gx < 0 || gy < 0 || gx > W || gy > H) return false;
  if (gx <= T) return true; // haste
  const dc = Math.hypot(gx - CX, gy - R);
  const fora = gx <= CX ? gy <= BH : dc <= R;
  const dentro = gx <= CX ? gy > T && gy < BH - T : dc < R - T;
  if (fora && !dentro) return true; // bojo
  // perna: segmento de (0.15, BH-T/2) a (W, H)
  const [ax, ay, bx, by] = [0.15, BH - T / 2, W - T * 0.4, H];
  const t = Math.max(0, Math.min(1, ((gx - ax) * (bx - ax) + (gy - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(gx - (ax + t * (bx - ax)), gy - (ay + t * (by - ay))) <= T / 2;
}

function crc32(buf) {
  let c, crc = ~0;
  for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}
function chunk(tipo, dados) {
  const t = Buffer.from(tipo), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(dados.length); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([len, t, dados, crc]);
}

function png(n, circulo) {
  const SS = 3, linhas = [];
  for (let j = 0; j < n; j++) {
    const lin = Buffer.alloc(1 + n * 4); // filtro 0
    for (let i = 0; i < n; i++) {
      let fundo = 0, glifo = 0;
      for (let a = 0; a < SS; a++) for (let b = 0; b < SS; b++) {
        const x = (i + (a + 0.5) / SS) / n, y = (j + (b + 0.5) / SS) / n;
        if (!circulo || Math.hypot(x - 0.5, y - 0.5) <= 0.5) { fundo++; if (noGlifo(x, y)) glifo++; }
      }
      const tot = SS * SS, af = fundo / tot, g = glifo / Math.max(fundo, 1);
      const o = 1 + i * 4;
      for (let c = 0; c < 3; c++) lin[o + c] = Math.round(COR[c] * (1 - g) + 255 * g);
      lin[o + 3] = Math.round(255 * af);
    }
    linhas.push(lin);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(linhas))), chunk('IEND', Buffer.alloc(0))]);
}

writeFileSync('icons/icon-192.png', png(192, true));
writeFileSync('icons/icon-512.png', png(512, true));
writeFileSync('icons/icon-512-maskable.png', png(512, false)); // sangra até a borda; glifo dentro da zona segura
writeFileSync('icons/apple-touch-icon.png', png(180, false)); // opaco (iOS pinta transparência de preto)
