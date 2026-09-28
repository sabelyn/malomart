import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";

type Rect = { x: number; y: number; width: number; height: number };

type Manifest = {
  sheet: string;
  background?: string;
  trim?: boolean;
  square?: boolean;
  sprites: Record<string, Rect>;
};

type Pixels = {
  data: Buffer;
  width: number;
  height: number;
};

const usage = `Usage:
  pnpm --filter @mm/tools sprites detect <sheet.png> [options]
    Finds sprites on a sheet and writes a manifest of their positions.
    --grid <size>        The sheet is laid out on a grid of square cells. Each shape joins the cell
                         holding its center, so sprites may be larger than a cell.
    --gap <px>           Merge shapes this close together into one sprite (default 2, ignored with --grid).
    --min <px>           Ignore shapes smaller than this in both dimensions (default 4).
    --background <hex>   Treat this color as empty space, or "auto" to use the top-left pixel.
    --manifest <path>    Where to write the manifest (default: <sheet>.sprites.json).
    --force              Overwrite an existing manifest.

  pnpm --filter @mm/tools sprites slice <manifest.json> [options]
    Crops each sprite in the manifest into its own PNG, named after its manifest key.
    --out <dir>          Output directory (default: a folder named after the manifest).
    --trim               Trim transparent edges from each sprite.
    --square             Pad each sprite with transparency into a centered square.
    Both can also be set as "trim" and "square" in the manifest.

Rename the manifest keys between detect and slice to give the files meaningful names.
Delete entries you don't want. Keys can include "/" to sort sprites into subfolders.`;

const fromCwd = (target: string) => path.resolve(process.env.INIT_CWD ?? process.cwd(), target);

const loadPixels = async (file: string): Promise<Pixels> => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};

const parseHex = (hex: string): [number, number, number] => {
  const value = hex.replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(value)) throw new Error(`Invalid background color: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
};

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

const resolveBackground = (pixels: Pixels, background?: string) => {
  if (!background) return undefined;
  if (background === "auto") return toHex(pixels.data[0], pixels.data[1], pixels.data[2]);
  return toHex(...parseHex(background));
};

const occupancy = (pixels: Pixels, background?: string) => {
  const bg = background ? parseHex(background) : undefined;
  const filled = new Uint8Array(pixels.width * pixels.height);
  for (let i = 0; i < filled.length; i++) {
    const o = i * 4;
    const [r, g, b, a] = [pixels.data[o], pixels.data[o + 1], pixels.data[o + 2], pixels.data[o + 3]];
    const isBackground = bg !== undefined && r === bg[0] && g === bg[1] && b === bg[2];
    filled[i] = a > 8 && !isBackground ? 1 : 0;
  }
  return filled;
};

const detectGrid = (filled: Uint8Array, width: number, height: number, size: number, min: number) => {
  const cells = new Map<string, Rect>();
  const pad = String(Math.ceil(Math.max(width, height) / size)).length;
  for (const shape of findShapes(filled, width, height)) {
    const row = Math.floor((shape.y + shape.height / 2) / size);
    const col = Math.floor((shape.x + shape.width / 2) / size);
    const key = `r${String(row).padStart(pad, "0")}-c${String(col).padStart(pad, "0")}`;
    const existing = cells.get(key);
    cells.set(key, existing ? union(existing, shape) : shape);
  }
  const sprites = [...cells.entries()]
    .filter(([, rect]) => rect.width >= min || rect.height >= min)
    .sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(sprites);
};

const findShapes = (filled: Uint8Array, width: number, height: number) => {
  const seen = new Uint8Array(filled.length);
  const shapes: Rect[] = [];
  const stack: number[] = [];
  for (let start = 0; start < filled.length; start++) {
    if (!filled[start] || seen[start]) continue;
    let [minX, minY, maxX, maxY] = [width, height, 0, 0];
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % width;
      const y = (i - x) / width;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
          if (filled[n] && !seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        }
      }
    }
    shapes.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 });
  }
  return shapes;
};

const near = (a: Rect, b: Rect, gap: number) =>
  a.x - gap <= b.x + b.width && b.x - gap <= a.x + a.width && a.y - gap <= b.y + b.height && b.y - gap <= a.y + a.height;

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y
  };
};

const mergeShapes = (shapes: Rect[], gap: number) => {
  const merged = [...shapes];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < merged.length && !changed; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        if (near(merged[i], merged[j], gap)) {
          merged[i] = union(merged[i], merged[j]);
          merged.splice(j, 1);
          changed = true;
          break;
        }
      }
    }
  }
  return merged;
};

const readingOrder = (rects: Rect[]) =>
  [...rects].sort((a, b) => {
    const sameLine = a.y < b.y + b.height / 2 && b.y < a.y + a.height / 2;
    return sameLine ? a.x - b.x : a.y - b.y;
  });

const detectShapes = (filled: Uint8Array, width: number, height: number, gap: number, min: number) => {
  const shapes = mergeShapes(findShapes(filled, width, height), gap).filter(
    (r) => r.width >= min || r.height >= min
  );
  const ordered = readingOrder(shapes);
  const pad = String(ordered.length).length;
  return Object.fromEntries(ordered.map((rect, i) => [`sprite-${String(i + 1).padStart(pad, "0")}`, rect]));
};

const detect = async (sheet: string, options: Record<string, string | boolean | undefined>) => {
  const manifestPath = options.manifest ? fromCwd(options.manifest as string) : sheet.replace(/\.png$/i, "") + ".sprites.json";
  if (existsSync(manifestPath) && !options.force) {
    throw new Error(`${manifestPath} already exists. Pass --force to overwrite it.`);
  }
  const pixels = await loadPixels(sheet);
  const background = resolveBackground(pixels, options.background as string | undefined);
  const filled = occupancy(pixels, background);
  const sprites = options.grid
    ? detectGrid(filled, pixels.width, pixels.height, Number(options.grid), Number(options.min ?? 4))
    : detectShapes(filled, pixels.width, pixels.height, Number(options.gap ?? 2), Number(options.min ?? 4));
  const manifest: Manifest = {
    sheet: path.relative(path.dirname(path.resolve(manifestPath)), path.resolve(sheet)).replaceAll("\\", "/"),
    ...(background && { background }),
    sprites
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Found ${Object.keys(sprites).length} sprites. Wrote ${manifestPath}`);
};

const clearBackground = (pixels: Pixels, background: string) => {
  const [r, g, b] = parseHex(background);
  const data = Buffer.from(pixels.data);
  for (let o = 0; o < data.length; o += 4) {
    if (data[o] === r && data[o + 1] === g && data[o + 2] === b) data[o + 3] = 0;
  }
  return data;
};

const padToSquare = async (image: sharp.Sharp) => {
  const { data, info } = await image.png().toBuffer({ resolveWithObject: true });
  const size = Math.max(info.width, info.height);
  const left = Math.floor((size - info.width) / 2);
  const top = Math.floor((size - info.height) / 2);
  return sharp(data).extend({
    left,
    right: size - info.width - left,
    top,
    bottom: size - info.height - top,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  });
};

const slice = async (manifestPath: string, options: Record<string, string | boolean | undefined>) => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  const sheetPath = path.resolve(path.dirname(manifestPath), manifest.sheet);
  const outDir = options.out ? fromCwd(options.out as string) : manifestPath.replace(/(\.sprites)?\.json$/i, "");
  const trim = Boolean(options.trim ?? manifest.trim);
  const square = Boolean(options.square ?? manifest.square);
  const pixels = await loadPixels(sheetPath);
  const data = manifest.background ? clearBackground(pixels, manifest.background) : pixels.data;
  const raw = { raw: { width: pixels.width, height: pixels.height, channels: 4 as const } };

  for (const [name, rect] of Object.entries(manifest.sprites)) {
    const file = path.join(outDir, `${name}.png`);
    await mkdir(path.dirname(file), { recursive: true });
    let image = sharp(data, raw).extract({ left: rect.x, top: rect.y, width: rect.width, height: rect.height });
    if (trim) image = sharp(await image.png().toBuffer()).trim();
    if (square) image = await padToSquare(image);
    await image.png().toFile(file);
  }
  console.log(`Wrote ${Object.keys(manifest.sprites).length} sprites to ${outDir}`);
};

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    grid: { type: "string" },
    gap: { type: "string" },
    min: { type: "string" },
    background: { type: "string" },
    manifest: { type: "string" },
    force: { type: "boolean" },
    out: { type: "string" },
    trim: { type: "boolean" },
    square: { type: "boolean" },
    help: { type: "boolean", short: "h" }
  }
});

const [command, target] = positionals;
const commands: Record<string, typeof detect> = { detect, slice };

if (values.help || !command || !target || !commands[command]) {
  console.log(usage);
  process.exit(values.help ? 0 : 1);
}

try {
  await commands[command](fromCwd(target), values);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
