import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/**
 * Minimal pure-Node PNG generator without external dependencies.
 */
function createPng(width, height, drawPixel) {
  // RGBA buffer with filter byte 0 at start of each scanline
  const rowSize = 1 + width * 4;
  const buffer = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    buffer[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      buffer[pxOffset] = r;
      buffer[pxOffset + 1] = g;
      buffer[pxOffset + 2] = b;
      buffer[pxOffset + 3] = a;
    }
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression: Deflate
  ihdrData[11] = 0; // Filter: Standard
  ihdrData[12] = 0; // Interlace: None
  const ihdrChunk = createChunk("IHDR", ihdrData);

  // IDAT chunk
  const compressed = zlib.deflateSync(buffer);
  const idatChunk = createChunk("IDAT", compressed);

  // IEND chunk
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(4 + 4 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, "ascii");
  data.copy(chunk, 8);

  // Calculate CRC32 on type + data
  const crcTarget = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = crc32(crcTarget);
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

// Standard CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function distToArc(px, py, cx, cy, r, startAngle, endAngle) {
  let angle = Math.atan2(py - cy, px - cx);
  while (angle < startAngle) angle += Math.PI * 2;
  while (angle > startAngle + Math.PI * 2) angle -= Math.PI * 2;

  const dRadial = Math.abs(Math.hypot(px - cx, py - cy) - r);
  if (angle <= endAngle) {
    return dRadial;
  }
  const p1x = cx + r * Math.cos(startAngle);
  const p1y = cy + r * Math.sin(startAngle);
  const p2x = cx + r * Math.cos(endAngle);
  const p2y = cy + r * Math.sin(endAngle);
  return Math.min(Math.hypot(px - p1x, py - p1y), Math.hypot(px - p2x, py - p2y));
}

// Minimalist developer badge icon for Extensible (inspired by Express.js monochrome elegance)
function iconDrawer(x, y, w, h) {
  const px = ((x + 0.5) / w) * 24;
  const py = ((y + 0.5) / h) * 24;

  // Outer Squircle Badge (dark matte background #0f172a)
  const rad = 5;
  const boxW = 22.8;
  const boxH = 22.8;
  const dx = Math.max(0, Math.abs(px - 12) - (boxW / 2 - rad));
  const dy = Math.max(0, Math.abs(py - 12) - (boxH / 2 - rad));
  const badgeDist = Math.hypot(dx, dy) - rad;

  if (badgeDist > 0.5) {
    return [0, 0, 0, 0];
  }
  const badgeAlpha = Math.max(0, Math.min(1, 0.5 - badgeDist));

  // Geometric 'e'
  const deBar = distToSegment(px, py, 4.5, 12, 11, 12);
  const deArc = distToArc(px, py, 7.7, 12, 3.2, -1.8 * Math.PI, 0.75 * Math.PI);

  // Geometric 'x'
  const dx1 = distToSegment(px, py, 13.5, 9, 19, 15);
  const dx2 = distToSegment(px, py, 13.5, 15, 19, 9);

  const minDist = Math.min(deBar, deArc, dx1, dx2);
  const strokeRadius = 0.95;
  const glyphCoverage = Math.max(0, Math.min(1, strokeRadius + 0.5 - minDist));

  // Background #0f172a (15, 23, 42), Glyph #ffffff (255, 255, 255)
  const r = Math.round(15 + (255 - 15) * glyphCoverage);
  const g = Math.round(23 + (255 - 23) * glyphCoverage);
  const b = Math.round(42 + (255 - 42) * glyphCoverage);
  const a = Math.round(255 * badgeAlpha);

  return [r, g, b, a];
}

const outDir = path.resolve("assets/icons");
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const png = createPng(size, size, iconDrawer);
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
  console.log(`Generated icon-${size}.png`);
}
