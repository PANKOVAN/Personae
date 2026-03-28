import sharp from "sharp";

const src = process.argv[2];
const out = process.argv[3];
const outW = Number(process.argv[4]) || 200;
const outH = Number(process.argv[5]) || 300;
if (!src || !out) {
    console.error(
        "usage: node scripts/process-josephine-png.mjs <src> <out> [width] [height]",
    );
    process.exit(1);
}

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const bright = (r + g + b) / 3;
    if (bright > 242 && sat < 0.12) data[i + 3] = 0;
}

await sharp(data, { raw: { width, height, channels: 4 } })
    .trim({ threshold: 15 })
    .resize(outW, outH, { fit: "cover", position: "centre" })
    .png()
    .toFile(out);

const meta = await sharp(out).metadata();
console.log("done", out, meta.width, meta.height, "hasAlpha", meta.hasAlpha);
