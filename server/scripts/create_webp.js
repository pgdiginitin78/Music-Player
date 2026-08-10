import fs from 'fs';
import path from 'path';

// Valid WebP binary buffer (transparent/gradient WebP image)
const webpBase64 = "UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAgAAAAAAAAAWE5JR0lMAAAAQVBMUEMAAAAAAAAAAGZmAABmAAD/gAAZ/wAZmQAZZgAY/wAY/wAA/wAAAAAAAAD/AACZAAAAMwAAZgAAzAAA/wAAACVSSUY";
// Minimal valid WebP 1x1 lossy image
const validWebpHex = "524946462a00000057454250565038201e000000d000009d012a0100010002003425a400037000fefbfd6f0000";

const targetDir = path.resolve('../client/public/images');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const targetPath = path.join(targetDir, 'default-album.webp');
fs.writeFileSync(targetPath, Buffer.from(validWebpHex, 'hex'));
console.log('Created valid default-album.webp at:', targetPath);
