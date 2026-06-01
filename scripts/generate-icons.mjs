import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function insideRoundedRect(x, y, size, radius) {
  const max = size - 1;
  const left = x < radius;
  const right = x > max - radius;
  const top = y < radius;
  const bottom = y > max - radius;

  if ((left || right) && (top || bottom)) {
    const cx = left ? radius : max - radius;
    const cy = top ? radius : max - radius;
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  }

  return true;
}

function rgba(hex, alpha = 255) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
}

function setPixel(buffer, offset, color) {
  buffer[offset] = color[0];
  buffer[offset + 1] = color[1];
  buffer[offset + 2] = color[2];
  buffer[offset + 3] = color[3];
}

function createIcon(size) {
  const channels = 4;
  const stride = size * channels + 1;
  const image = Buffer.alloc(stride * size);
  const transparent = [0, 0, 0, 0];
  const teal = rgba("#0f766e");
  const white = rgba("#ffffff");
  const yellow = rgba("#f2c94c");
  const radius = Math.round(size * 0.18);
  const plusWidth = Math.round(size * 0.18);
  const plusLong = Math.round(size * 0.56);
  const plusStart = Math.round((size - plusLong) / 2);
  const plusEnd = plusStart + plusLong;
  const centerStart = Math.round((size - plusWidth) / 2);
  const centerEnd = centerStart + plusWidth;
  const barTop = Math.round(size * 0.74);
  const barBottom = Math.round(size * 0.8);
  const barLeft = Math.round(size * 0.22);
  const barRight = Math.round(size * 0.78);

  for (let y = 0; y < size; y += 1) {
    image[y * stride] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = y * stride + 1 + x * channels;
      let color = insideRoundedRect(x, y, size, radius) ? teal : transparent;

      const inVertical = x >= centerStart && x <= centerEnd && y >= plusStart && y <= plusEnd;
      const inHorizontal = y >= centerStart && y <= centerEnd && x >= plusStart && x <= plusEnd;
      if (color !== transparent && (inVertical || inHorizontal)) {
        color = white;
      }

      if (color !== transparent && x >= barLeft && x <= barRight && y >= barTop && y <= barBottom) {
        color = yellow;
      }

      setPixel(image, offset, color);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(image, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

await writeFile(join(ROOT, "docs", "apple-touch-icon.png"), createIcon(180));
await writeFile(join(ROOT, "docs", "icon-512.png"), createIcon(512));

