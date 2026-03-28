import sharp from "sharp";
import { readFileSync } from "fs";

const src = process.argv[2] ?? "C:/Users/panko/.cursor/projects/d-MProjects-Personae/assets/c__Users_panko_AppData_Roaming_Cursor_User_workspaceStorage_442a4f903951dea216c85fddeaed1b4c_images_josephine-baker-book-060e9764-3a69-483a-b4e5-b0a1a990e68d.png";
const out = process.argv[3] ?? "public/josephine-baker-book-300x200.png";
const W = 300;
const H = 200;

async function removeSkyBlueBg(buf) {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    for (let i = 0; i < data.length; i += channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;
        const bright = (r + g + b) / 3;
        const blueish = b > r + 18 && b > g + 8;
        if (blueish && bright > 120 && sat < 0.45) {
            data[i + 3] = 0;
            continue;
        }
        if (bright > 248 && sat < 0.06) data[i + 3] = 0;
    }
    return sharp(data, { raw: { width, height, channels: 4 } })
        .trim({ threshold: 12 })
        .png()
        .toBuffer();
}

function bookSvg() {
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <path fill="#d4c4a8" stroke="#9a7b4f" stroke-width="1" d="M8 130 L8 188 L142 175 L142 118 Z"/>
  <path fill="#efe6d8" stroke="#9a7b4f" stroke-width="1" d="M158 118 L158 175 L292 188 L292 130 Z"/>
  <path fill="#b8956a" stroke="#6b4c2a" stroke-width="1" d="M145 118 H155 V175 H145 Z"/>
</svg>`);
}

const womanBuf = await removeSkyBlueBg(readFileSync(src));
const targetH = 125;
const scaled = await sharp(womanBuf)
    .resize({ height: targetH, fit: "inside" })
    .ensureAlpha()
    .png()
    .toBuffer();
const sm = await sharp(scaled).metadata();
const bookBase = await sharp(bookSvg()).png().toBuffer();

const pageTopY = 118;
const left = Math.round((W - sm.width) / 2);
const top = Math.max(4, pageTopY - sm.height + 22);

await sharp(bookBase)
    .composite([{ input: scaled, left: Math.max(0, left), top: Math.max(0, top) }])
    .png()
    .toFile(out);

const meta = await sharp(out).metadata();
console.log("written", out, meta.width, meta.height, "hasAlpha", meta.hasAlpha);
