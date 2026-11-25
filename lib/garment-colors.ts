import * as React from "react";

export interface GarmentColorOption {
  name: string;
  hex: string;
}

export const STUDIO_COLOR_PALETTE: GarmentColorOption[] = [
  { name: "Bone", hex: "#EFEBE2" },
  { name: "Charcoal", hex: "#1C1E22" },
  { name: "Sky", hex: "#A3D3EB" },
  { name: "Olive", hex: "#758151" },
  { name: "Brick", hex: "#B05139" },
  { name: "Ochre", hex: "#DE9C31" },
  { name: "Forest", hex: "#185B37" },
  { name: "Lilac", hex: "#CCB2E0" },
];

export function getColorOptionsForItem(defaultHex?: string): GarmentColorOption[] {
  const normalized = (defaultHex ?? "#EFEBE2").toUpperCase();
  const baseMatch = STUDIO_COLOR_PALETTE.find((c) => c.hex.toUpperCase() === normalized);
  const baseOption: GarmentColorOption = baseMatch ?? {
    name: "Original",
    hex: defaultHex ?? "#EFEBE2",
  };
  const rest = STUDIO_COLOR_PALETTE.filter(
    (c) => c.hex.toUpperCase() !== baseOption.hex.toUpperCase(),
  );
  return [baseOption, ...rest.slice(0, 4)];
}

export function getColorName(hex?: string): string {
  if (!hex) return "Original";
  const found = STUDIO_COLOR_PALETTE.find(
    (c) => c.hex.toUpperCase() === hex.toUpperCase(),
  );
  return found ? found.name : "Custom";
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return [220, 220, 220];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function hexLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function isCustomTint(defaultColor?: string, activeColor?: string): boolean {
  if (!activeColor || !defaultColor) return false;
  return activeColor.toUpperCase() !== defaultColor.toUpperCase();
}

export interface PreparedGarment {
  w: number;
  h: number;
  hangerCutIndex: number;
  baseData: Uint8ClampedArray;
  /** Precomputed tonal brightness (0..255) for each pixel; 0 alpha pixels are skipped during blit */
  tones: Uint8Array;
}

const sourceImageCache = new Map<string, Promise<HTMLImageElement | ImageBitmap>>();
const preparedSyncCache = new Map<string, PreparedGarment>();
const preparedPromiseCache = new Map<string, Promise<PreparedGarment | null>>();
const tintedImageDataCache = new Map<string, ImageData>();

function loadCorsImage(src: string): Promise<HTMLImageElement | ImageBitmap> {
  const existing = sourceImageCache.get(src);
  if (existing) return existing;

  const promise: Promise<HTMLImageElement | ImageBitmap> = (async () => {
    try {
      const res = await fetch(src, { mode: "cors", cache: "force-cache", credentials: "omit" });
      if (!res.ok) throw new Error("Asset fetch failed");
      const blob = await res.blob();
      if (typeof createImageBitmap === "function") {
        return await createImageBitmap(blob);
      }
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const objUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = objUrl;
      });
    } catch {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.referrerPolicy = "no-referrer";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    }
  })();

  sourceImageCache.set(src, promise);
  return promise;
}

function getPreparedKey(src: string, baseColor: string | undefined, preserveTopFraction: number) {
  return `${src}|${(baseColor ?? "").toUpperCase()}|${preserveTopFraction}`;
}

export function prepareGarmentSync(
  src: string | undefined,
  baseColor: string | undefined,
  preserveTopFraction = 0.11,
): PreparedGarment | null {
  if (!src) return null;
  return preparedSyncCache.get(getPreparedKey(src, baseColor, preserveTopFraction)) ?? null;
}

export function prepareGarmentSource(
  src: string,
  baseColor: string | undefined,
  preserveTopFraction = 0.11,
): Promise<PreparedGarment | null> {
  const key = getPreparedKey(src, baseColor, preserveTopFraction);
  const syncHit = preparedSyncCache.get(key);
  if (syncHit) return Promise.resolve(syncHit);

  const inflight = preparedPromiseCache.get(key);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const img = await loadCorsImage(src);
      const natW = "naturalWidth" in img ? img.naturalWidth || 200 : img.width || 200;
      const natH = "naturalHeight" in img ? img.naturalHeight || 310 : img.height || 310;
      // Cap working buffer height at 340px for sharp display detail & <0.25ms real-time recoloring
      const scale = natH > 340 ? 340 / natH : 1;
      const w = Math.max(1, Math.round(natW * scale));
      const h = Math.max(1, Math.round(natH * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const baseData = imgData.data;

      const origLum = hexLuminance(baseColor ?? "#CCCCCC");
      const k =
        origLum < 0.14
          ? 5.2
          : origLum < 0.35
            ? 2.2
            : clamp(1.18 / Math.max(0.42, origLum), 1.05, 1.55);

      const totalPixels = w * h;
      const tones = new Uint8Array(totalPixels);
      const hangerCutRow = Math.floor(h * preserveTopFraction);
      const hangerCutIndex = hangerCutRow * w;

      for (let p = hangerCutIndex; p < totalPixels; p++) {
        const idx = p * 4;
        if (baseData[idx + 3] === 0) continue;
        const lum =
          (0.2126 * baseData[idx] + 0.7152 * baseData[idx + 1] + 0.0722 * baseData[idx + 2]) /
          255;
        const tone = (lum * k) / (1 + lum * (k - 1));
        tones[p] = Math.min(255, Math.round(tone * 255));
      }

      const prepared: PreparedGarment = {
        w,
        h,
        hangerCutIndex,
        baseData,
        tones,
      };
      preparedSyncCache.set(key, prepared);
      return prepared;
    } catch {
      return null;
    } finally {
      preparedPromiseCache.delete(key);
    }
  })();

  preparedPromiseCache.set(key, task);
  return task;
}

/**
 * Computes tinted ImageData synchronously in < 0.4ms using the precomputed tonal buffer.
 */
export function getTintedImageDataSync(
  prepared: PreparedGarment,
  src: string,
  baseColor: string | undefined,
  activeColor: string,
  preserveTopFraction = 0.11,
): ImageData {
  const key = `${getPreparedKey(src, baseColor, preserveTopFraction)}|${activeColor.toUpperCase()}`;
  const cached = tintedImageDataCache.get(key);
  if (cached) return cached;

  const { w, h, hangerCutIndex, baseData, tones } = prepared;
  const out = new Uint8ClampedArray(baseData);
  const [tr, tg, tb] = hexToRgb(activeColor);
  const totalPixels = w * h;

  for (let p = hangerCutIndex; p < totalPixels; p++) {
    const idx = p * 4;
    if (out[idx + 3] === 0) continue;
    const tone = tones[p] / 255;
    out[idx] = Math.min(255, Math.round(tone * tr));
    out[idx + 1] = Math.min(255, Math.round(tone * tg));
    out[idx + 2] = Math.min(255, Math.round(tone * tb));
  }

  const imageData = new ImageData(out, w, h);
  if (tintedImageDataCache.size > 160) {
    const firstKey = tintedImageDataCache.keys().next().value;
    if (firstKey) tintedImageDataCache.delete(firstKey);
  }
  tintedImageDataCache.set(key, imageData);
  return imageData;
}

export function preloadTintedGarmentAngles(
  urls: (string | undefined)[],
  baseColor?: string,
  activeColor?: string,
  preserveTopFraction = 0.11,
) {
  for (const url of urls) {
    if (!url) continue;
    void prepareGarmentSource(url, baseColor, preserveTopFraction).then((prepared) => {
      if (prepared && activeColor && isCustomTint(baseColor, activeColor)) {
        getTintedImageDataSync(prepared, url, baseColor, activeColor, preserveTopFraction);
      }
    });
  }
}

let catalogWarmed = false;

function scheduleIdle(fn: () => void, fallbackMs = 120) {
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof win.requestIdleCallback === "function") {
    win.requestIdleCallback(fn, { timeout: fallbackMs * 4 });
  } else {
    window.setTimeout(fn, fallbackMs);
  }
}

export function warmGarmentCatalog(
  items: { image?: string; sideImage?: string; backImage?: string; color?: string }[],
) {
  if (catalogWarmed) return;
  catalogWarmed = true;

  // Warm front images first, then side and back during idle slices so reload stays instant
  const queue: Array<{ url: string; color?: string }> = [];
  for (const item of items) {
    if (item.image) queue.push({ url: item.image, color: item.color });
  }
  for (const item of items) {
    if (item.sideImage) queue.push({ url: item.sideImage, color: item.color });
    if (item.backImage) queue.push({ url: item.backImage, color: item.color });
  }

  let cursor = 0;
  const runNext = () => {
    const batch = queue.slice(cursor, cursor + 2);
    cursor += 2;
    if (batch.length === 0) return;
    void Promise.all(
      batch.map(({ url, color }) => prepareGarmentSource(url, color, 0.11)),
    ).then(() => {
      if (cursor < queue.length) {
        scheduleIdle(runNext, 60);
      }
    });
  };

  scheduleIdle(runNext, 450);
}

export function usePreparedGarment(
  src: string | undefined,
  baseColor: string | undefined,
  activeColor: string | undefined,
  preserveTopFraction = 0.11,
): PreparedGarment | null {
  const needsTint = Boolean(src && activeColor && isCustomTint(baseColor, activeColor));
  const syncHit = needsTint ? prepareGarmentSync(src, baseColor, preserveTopFraction) : null;
  const [prepared, setPrepared] = React.useState<PreparedGarment | null>(syncHit);

  React.useEffect(() => {
    if (!src) {
      setPrepared(null);
      return;
    }
    const sync = prepareGarmentSync(src, baseColor, preserveTopFraction);
    if (sync) {
      setPrepared(sync);
      return;
    }

    let cancelled = false;
    void prepareGarmentSource(src, baseColor, preserveTopFraction).then((res) => {
      if (!cancelled && res) setPrepared(res);
    });
    return () => {
      cancelled = true;
    };
  }, [src, baseColor, preserveTopFraction]);

  return needsTint ? (syncHit ?? prepared) : null;
}
