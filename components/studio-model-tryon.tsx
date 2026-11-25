import * as React from "react";
import type { RailGarment } from "@/components/ui/product-rail-gallery";
import {
  getTintedImageDataSync,
  isCustomTint,
  prepareGarmentSource,
  prepareGarmentSync,
  type PreparedGarment,
} from "@/lib/garment-colors";

const STUDIO_MODEL_SRC = "/src/assets/images/male_studio_model_1795516846316.jpg";

// Out Canvas dimensions matching 896x1200 model ratio (224:300 = 0.7467)
const OUT_W = 560;
const OUT_H = 750;

interface GarmentFitSpec {
  widthPct: number;
  heightPct: number;
  topPct: number;
  tuck: number;
  neckRx: number;
  neckRy: number;
  neckCy: number;
  collarType: "crew" | "collar" | "vneck" | "hood" | "boat";
}

function getFitSpec(item: RailGarment): GarmentFitSpec {
  switch (item.id) {
    case "oversized-ochre":
      return {
        widthPct: 0.425,
        heightPct: 0.455,
        topPct: 0.118,
        tuck: 0.14,
        neckRx: 0.088,
        neckRy: 0.056,
        neckCy: 0.136,
        collarType: "crew",
      };
    case "oxford-sky":
      return {
        widthPct: 0.415,
        heightPct: 0.46,
        topPct: 0.114,
        tuck: 0.42,
        neckRx: 0.068,
        neckRy: 0.048,
        neckCy: 0.128,
        collarType: "collar",
      };
    case "polo-forest":
      return {
        widthPct: 0.39,
        heightPct: 0.44,
        topPct: 0.116,
        tuck: 0.22,
        neckRx: 0.072,
        neckRy: 0.05,
        neckCy: 0.13,
        collarType: "collar",
      };
    case "cardigan-olive":
      return {
        widthPct: 0.425,
        heightPct: 0.465,
        topPct: 0.114,
        tuck: 0.38,
        neckRx: 0.078,
        neckRy: 0.068,
        neckCy: 0.144,
        collarType: "vneck",
      };
    case "hoodie-heather":
      return {
        widthPct: 0.43,
        heightPct: 0.47,
        topPct: 0.112,
        tuck: 0.4,
        neckRx: 0.076,
        neckRy: 0.052,
        neckCy: 0.132,
        collarType: "hood",
      };
    case "sweat-lilac":
      return {
        widthPct: 0.42,
        heightPct: 0.458,
        topPct: 0.115,
        tuck: 0.4,
        neckRx: 0.084,
        neckRy: 0.054,
        neckCy: 0.134,
        collarType: "crew",
      };
    case "henley-brick":
      return {
        widthPct: 0.405,
        heightPct: 0.455,
        topPct: 0.115,
        tuck: 0.38,
        neckRx: 0.08,
        neckRy: 0.058,
        neckCy: 0.136,
        collarType: "crew",
      };
    case "breton":
      return {
        widthPct: 0.405,
        heightPct: 0.452,
        topPct: 0.118,
        tuck: 0.38,
        neckRx: 0.092,
        neckRy: 0.054,
        neckCy: 0.134,
        collarType: "boat",
      };
    case "cc-graphic":
    case "bone-tee":
    default:
      return {
        widthPct: 0.392,
        heightPct: 0.445,
        topPct: 0.116,
        tuck: 0.22,
        neckRx: 0.084,
        neckRy: 0.054,
        neckCy: 0.134,
        collarType: "crew",
      };
  }
}

let modelCutoutPromise: Promise<HTMLCanvasElement | null> | null = null;
let modelCutoutCached: HTMLCanvasElement | null = null;

/**
 * Loads the studio model photo once and performs a border-seeded studio backdrop
 * removal so the model stands naturally inside the dressing room with crisp hair,
 * skin, trousers, and white sneaker soles preserved.
 */
function getStudioModelCutout(): Promise<HTMLCanvasElement | null> {
  if (modelCutoutCached) return Promise.resolve(modelCutoutCached);
  if (modelCutoutPromise) return modelCutoutPromise;

  modelCutoutPromise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = OUT_W;
        canvas.height = OUT_H;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, OUT_W, OUT_H);
        const frame = ctx.getImageData(0, 0, OUT_W, OUT_H);
        const data = frame.data;

        const rowBgR = new Float32Array(OUT_H);
        const rowBgG = new Float32Array(OUT_H);
        const rowBgB = new Float32Array(OUT_H);
        for (let y = 0; y < OUT_H; y++) {
          const iL = (y * OUT_W + 3) * 4;
          const iR = (y * OUT_W + (OUT_W - 4)) * 4;
          rowBgR[y] = (data[iL] + data[iR]) * 0.5;
          rowBgG[y] = (data[iL + 1] + data[iR + 1]) * 0.5;
          rowBgB[y] = (data[iL + 2] + data[iR + 2]) * 0.5;
        }

        const total = OUT_W * OUT_H;
        const bgMask = new Uint8Array(total);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;

        const isBackdropPixel = (x: number, y: number): boolean => {
          const idx = (y * OUT_W + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const chroma = maxC - minC;
          const lum = (r + g + b) / 3;

          // Keep bright white sneaker soles in lower shoe region intact
          if (y > OUT_H * 0.87 && x > OUT_W * 0.36 && x < OUT_W * 0.64 && lum > 224) {
            return false;
          }
          // Protect warm skin tones and dark hair/trousers
          if (chroma > 22 && r > b + 14) return false;
          if (lum < 145) return false;

          const dr = r - rowBgR[y];
          const dg = g - rowBgG[y];
          const db = b - rowBgB[y];
          const dist = Math.hypot(dr, dg, db);
          const tol = y > OUT_H * 0.81 ? 30 : 34;
          return dist < tol && chroma < 20;
        };

        const enqueue = (x: number, y: number) => {
          if (x < 0 || x >= OUT_W || y < 0 || y >= OUT_H) return;
          const p = y * OUT_W + x;
          if (bgMask[p] !== 0) return;
          if (isBackdropPixel(x, y)) {
            bgMask[p] = 1;
            queue[tail++] = p;
          }
        };

        for (let y = 0; y < OUT_H; y++) {
          enqueue(0, y);
          enqueue(OUT_W - 1, y);
        }
        for (let x = 0; x < OUT_W; x++) {
          enqueue(x, 0);
          enqueue(x, OUT_H - 1);
        }
        // Seed openings between arms and hips on the horizontal level above wrists
        for (let sx of [Math.round(OUT_W * 0.365), Math.round(OUT_W * 0.635)]) {
          for (let sy = Math.round(OUT_H * 0.42); sy < Math.round(OUT_H * 0.48); sy += 4) {
            enqueue(sx, sy);
          }
        }

        while (head < tail) {
          const p = queue[head++];
          const px = p % OUT_W;
          const py = (p - px) / OUT_W;
          if (px > 0) enqueue(px - 1, py);
          if (px + 1 < OUT_W) enqueue(px + 1, py);
          if (py > 0) enqueue(px, py - 1);
          if (py + 1 < OUT_H) enqueue(px, py + 1);
        }

        // Apply alpha + soft 1px anti-aliased fringe smoothing
        for (let y = 0; y < OUT_H; y++) {
          for (let x = 0; x < OUT_W; x++) {
            const p = y * OUT_W + x;
            const idx = p * 4;
            if (bgMask[p] === 1) {
              data[idx + 3] = 0;
            } else if (x > 0 && x < OUT_W - 1 && y > 0 && y < OUT_H - 1) {
              const adjBg =
                bgMask[p - 1] +
                bgMask[p + 1] +
                bgMask[p - OUT_W] +
                bgMask[p + OUT_W];
              if (adjBg > 0) {
                data[idx + 3] = Math.round(255 * (1 - adjBg * 0.16));
              }
            }
          }
        }

        ctx.putImageData(frame, 0, 0);
        modelCutoutCached = canvas;
        resolve(canvas);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = STUDIO_MODEL_SRC;
  });

  return modelCutoutPromise;
}

const rawGarmentCache = new Map<string, HTMLCanvasElement>();
const rawGarmentPromises = new Map<string, Promise<HTMLCanvasElement | null>>();

function getGarmentCanvas(
  item: RailGarment,
  activeColor: string,
): Promise<HTMLCanvasElement | null> {
  const src = item.image;
  if (!src) return Promise.resolve(null);

  const tinted = isCustomTint(item.color, activeColor);
  const key = `${item.id}|${activeColor.toUpperCase()}`;
  const syncCached = rawGarmentCache.get(key);
  if (syncCached) return Promise.resolve(syncCached);

  const buildFromPrepared = (prepared: PreparedGarment): HTMLCanvasElement | null => {
    const c = document.createElement("canvas");
    c.width = prepared.w;
    c.height = prepared.h;
    const ctx = c.getContext("2d");
    if (!ctx) return null;

    if (tinted) {
      const imgData = getTintedImageDataSync(prepared, src, item.color, activeColor, 0.11);
      ctx.putImageData(imgData, 0, 0);
    } else {
      const imgData = new ImageData(new Uint8ClampedArray(prepared.baseData), prepared.w, prepared.h);
      ctx.putImageData(imgData, 0, 0);
    }

    if (rawGarmentCache.size > 48) {
      const firstKey = rawGarmentCache.keys().next().value;
      if (firstKey) rawGarmentCache.delete(firstKey);
    }
    rawGarmentCache.set(key, c);
    return c;
  };

  const syncPrepared = prepareGarmentSync(src, item.color, 0.11);
  if (syncPrepared) {
    return Promise.resolve(buildFromPrepared(syncPrepared));
  }

  const inflight = rawGarmentPromises.get(key);
  if (inflight) return inflight;

  const task = prepareGarmentSource(src, item.color, 0.11)
    .then((prepared) => (prepared ? buildFromPrepared(prepared) : null))
    .finally(() => {
      rawGarmentPromises.delete(key);
    });

  rawGarmentPromises.set(key, task);
  return task;
}

/**
 * Strips the metal hook & central coat hanger inside the collar opening and gently
 * drapes outer sleeves inward so the garment fits naturally over the model's body.
 */
function renderDressedComposite(
  targetCanvas: HTMLCanvasElement,
  modelCanvas: HTMLCanvasElement,
  garmentCanvas: HTMLCanvasElement | null,
  item: RailGarment,
) {
  targetCanvas.width = OUT_W;
  targetCanvas.height = OUT_H;
  const ctx = targetCanvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, OUT_W, OUT_H);

  // Subtle floor ground shadow beneath sneakers
  ctx.save();
  const shadowGrad = ctx.createRadialGradient(
    OUT_W * 0.5,
    OUT_H * 0.942,
    8,
    OUT_W * 0.5,
    OUT_H * 0.942,
    OUT_W * 0.22,
  );
  shadowGrad.addColorStop(0, "rgba(18, 14, 10, 0.34)");
  shadowGrad.addColorStop(0.65, "rgba(18, 14, 10, 0.12)");
  shadowGrad.addColorStop(1, "rgba(18, 14, 10, 0)");
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(OUT_W * 0.5, OUT_H * 0.942, OUT_W * 0.22, OUT_H * 0.022, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Layer 1: Full clean studio model base
  ctx.drawImage(modelCanvas, 0, 0, OUT_W, OUT_H);

  if (!garmentCanvas) return;

  const fit = getFitSpec(item);
  const gw = garmentCanvas.width;
  const gh = garmentCanvas.height;

  // Prepare cropped garment without hanger hook / inner collar hanger bar
  const prep = document.createElement("canvas");
  prep.width = gw;
  prep.height = gh;
  const pCtx = prep.getContext("2d");
  if (!pCtx) return;
  pCtx.drawImage(garmentCanvas, 0, 0);

  const gImg = pCtx.getImageData(0, 0, gw, gh);
  const gd = gImg.data;
  const topCutY = Math.floor(gh * 0.108);

  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const idx = (y * gw + x) * 4;
      if (gd[idx + 3] === 0) continue;

      const u = x / gw;
      const v = y / gh;

      // Remove top metal hanger hook entirely
      if (y < topCutY) {
        gd[idx + 3] = 0;
        continue;
      }

      // Carve anatomical neck opening inside upper-center so neck emerges cleanly & wood hanger disappears
      const dx = (u - 0.5) / fit.neckRx;
      const dy = (v - fit.neckCy) / fit.neckRy;
      const ell = dx * dx + dy * dy;

      if (v < fit.neckCy + fit.neckRy * 0.72) {
        if (ell < 0.72) {
          gd[idx + 3] = 0;
          continue;
        }
        // Soften hanger wood tone in the collar pocket (tan wood pixels above chest)
        const r = gd[idx];
        const g = gd[idx + 1];
        const b = gd[idx + 2];
        const isWoodHanger =
          v < 0.175 &&
          u > 0.35 &&
          u < 0.65 &&
          r > g + 10 &&
          g > b + 12 &&
          r > 95 &&
          item.id !== "oversized-ochre" &&
          item.id !== "henley-brick";
        if (isWoodHanger || (ell < 1.0 && v < fit.neckCy + 0.01)) {
          gd[idx + 3] = 0;
          continue;
        }
        if (ell < 1.05) {
          const edgeAlpha = (ell - 0.72) / (1.05 - 0.72);
          gd[idx + 3] = Math.round(gd[idx + 3] * Math.max(0, Math.min(1, edgeAlpha)));
        }
      }
    }
  }
  pCtx.putImageData(gImg, 0, 0);

  // Subtle cylindrical 3D body shading clipped to garment alpha so fabric hugs chest
  pCtx.save();
  pCtx.globalCompositeOperation = "source-atop";
  const bodyShade = pCtx.createLinearGradient(0, 0, gw, 0);
  bodyShade.addColorStop(0, "rgba(0, 0, 0, 0.15)");
  bodyShade.addColorStop(0.24, "rgba(0, 0, 0, 0.02)");
  bodyShade.addColorStop(0.5, "rgba(255, 255, 255, 0.06)");
  bodyShade.addColorStop(0.76, "rgba(0, 0, 0, 0.02)");
  bodyShade.addColorStop(1, "rgba(0, 0, 0, 0.16)");
  pCtx.fillStyle = bodyShade;
  pCtx.fillRect(0, 0, gw, gh);
  pCtx.restore();

  // Map garment onto model torso & gently wrap sleeves inward toward natural arm posture
  const destW = OUT_W * fit.widthPct;
  const destH = OUT_H * fit.heightPct;
  const destX = (OUT_W - destW) * 0.5;
  const destY = OUT_H * fit.topPct;

  const draped = document.createElement("canvas");
  draped.width = OUT_W;
  draped.height = OUT_H;
  const dCtx = draped.getContext("2d");
  if (!dCtx) return;

  // Render horizontal strips from shoulder down to hem to taper flared sleeves softly inward
  const strips = 42;
  const shoulderStartV = 0.14;
  for (let s = 0; s < strips; s++) {
    const v0 = s / strips;
    const v1 = (s + 1) / strips;
    const sy = v0 * gh;
    const sh = Math.max(1, (v1 - v0) * gh + 0.6);
    const dy = destY + v0 * destH;
    const dh = (v1 - v0) * destH + 0.7;

    const progress = Math.max(0, (v0 - shoulderStartV) / (1 - shoulderStartV));
    const scaleX = 1 - fit.tuck * 0.24 * Math.pow(progress, 1.15);
    const wStrip = destW * scaleX;
    const xStrip = (OUT_W - wStrip) * 0.5;

    dCtx.drawImage(prep, 0, sy, gw, sh, xStrip, dy, wStrip, dh);
  }

  // Paint soft ambient contact shadow underneath the shirt hem onto the trousers/body
  ctx.save();
  ctx.shadowColor = "rgba(18, 14, 10, 0.26)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  ctx.drawImage(draped, 0, 0);
  ctx.restore();

  // Re-composite the model's jawline/chin cleanly above tall hoodie hoods or shirt collars
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    OUT_W * 0.5,
    OUT_H * 0.105,
    OUT_W * 0.068,
    OUT_H * 0.061,
    0,
    0,
    Math.PI * 2,
  );
  ctx.clip();
  ctx.drawImage(modelCanvas, 0, 0, OUT_W, OUT_H);
  ctx.restore();
}

export function StudioModelTryOn({
  item,
  activeColor,
  reducedMotion,
}: {
  item: RailGarment;
  activeColor: string;
  reducedMotion: boolean;
}) {
  const curCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const nextCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const scanGridRef = React.useRef<HTMLDivElement | null>(null);
  const scanLineRef = React.useRef<HTMLDivElement | null>(null);

  const lastKeyRef = React.useRef<string | null>(null);
  const scanTokenRef = React.useRef(0);
  const animsRef = React.useRef<Animation[]>([]);
  const [modelReady, setModelReady] = React.useState(Boolean(modelCutoutCached));

  React.useEffect(() => {
    if (modelCutoutCached) {
      setModelReady(true);
      return;
    }
    let cancelled = false;
    void getStudioModelCutout().then((res) => {
      if (!cancelled && res) setModelReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    return () => {
      animsRef.current.forEach((a) => a.cancel());
    };
  }, []);

  React.useEffect(() => {
    if (!modelReady) return;
    let cancelled = false;
    const renderKey = `${item.id}|${activeColor.toUpperCase()}`;

    void Promise.all([getStudioModelCutout(), getGarmentCanvas(item, activeColor)]).then(
      ([modelCanvas, garmentCanvas]) => {
        if (cancelled || !modelCanvas) return;
        const curEl = curCanvasRef.current;
        const nextEl = nextCanvasRef.current;
        const gridEl = scanGridRef.current;
        const lineEl = scanLineRef.current;
        if (!curEl || !nextEl) return;

        if (lastKeyRef.current === null || reducedMotion || lastKeyRef.current === renderKey) {
          renderDressedComposite(curEl, modelCanvas, garmentCanvas, item);
          nextEl.style.clipPath = "inset(0 0 100% 0)";
          lastKeyRef.current = renderKey;
          return;
        }

        // Render incoming dressed outfit onto nextEl and trigger VirtualFit scan-line sweep
        animsRef.current.forEach((a) => a.cancel());
        animsRef.current = [];
        const token = ++scanTokenRef.current;

        renderDressedComposite(nextEl, modelCanvas, garmentCanvas, item);

        const SCAN_EASE = "cubic-bezier(.65,0,.35,1)";
        const aClip = nextEl.animate(
          [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)" }],
          { duration: 760, easing: SCAN_EASE, fill: "forwards" },
        );
        const aSettle = nextEl.animate(
          [{ transform: "scale(1.01)" }, { transform: "scale(1)" }],
          { duration: 920, easing: "ease-out" },
        );

        const anims: Animation[] = [aClip, aSettle];
        if (gridEl) {
          anims.push(
            gridEl.animate(
              [
                { clipPath: "inset(0 0 100% 0)", opacity: 0.88, offset: 0 },
                { clipPath: "inset(0 0 0% 0)", opacity: 0.92, offset: 0.5 },
                { clipPath: "inset(100% 0 0% 0)", opacity: 0, offset: 1 },
              ],
              { duration: 840, easing: SCAN_EASE },
            ),
          );
        }
        if (lineEl) {
          anims.push(
            lineEl.animate(
              [
                { top: "6%", transform: "scaleX(0.25)", opacity: 0, offset: 0 },
                { top: "14%", transform: "scaleX(1)", opacity: 1, offset: 0.08 },
                { top: "86%", transform: "scaleX(1)", opacity: 1, offset: 0.92 },
                { top: "94%", transform: "scaleX(0.25)", opacity: 0, offset: 1 },
              ],
              { duration: 760, easing: SCAN_EASE },
            ),
          );
        }

        animsRef.current = anims;
        aClip.onfinish = () => {
          if (token !== scanTokenRef.current) return;
          renderDressedComposite(curEl, modelCanvas, garmentCanvas, item);
          lastKeyRef.current = renderKey;
          animsRef.current.forEach((a) => a.cancel());
          animsRef.current = [];
        };
      },
    );

    return () => {
      cancelled = true;
    };
  }, [modelReady, item, activeColor, reducedMotion]);

  return (
    <div
      aria-label={`Studio model wearing ${item.name}`}
      className="relative h-full max-h-[560px]"
      style={{ aspectRatio: `${OUT_W} / ${OUT_H}` }}
    >
      <canvas
        ref={curCanvasRef}
        width={OUT_W}
        height={OUT_H}
        className="absolute inset-0 h-full w-full object-contain"
      />
      <canvas
        ref={nextCanvasRef}
        width={OUT_W}
        height={OUT_H}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ clipPath: "inset(0 0 100% 0)" }}
      />
      <div
        ref={scanGridRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 mix-blend-screen"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent 0 5px, rgba(255,255,255,0.22) 5px 6px)",
          clipPath: "inset(0 0 100% 0)",
        }}
      />
      <div
        ref={scanLineRef}
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-[10%] top-0 h-[2px] opacity-0"
        style={{
          background:
            "linear-gradient(90deg, transparent, #fff 18%, #fff 82%, transparent)",
          boxShadow:
            "0 0 18px 4px rgba(255,255,255,0.75), 0 0 52px 10px rgba(190,225,255,0.45)",
        }}
      />
    </div>
  );
}
