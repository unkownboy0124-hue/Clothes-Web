import * as React from "react";
import { ArrowRight, ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import type { RailGarment } from "@/components/ui/product-rail-gallery";
import type { GarmentSize } from "@/components/product-inspector-modal";
import { GarmentThumbnail } from "@/components/garment-thumbnail";
import { RAIL_DEMO_ITEMS } from "@/components/demo";
import { matchesCategory, SIZES, type CategoryFilter } from "@/lib/catalog-data";
import {
  getColorName,
  getColorOptionsForItem,
  getTintedImageDataSync,
  isCustomTint,
  preloadTintedGarmentAngles,
  usePreparedGarment,
} from "@/lib/garment-colors";
import { Link } from "@/lib/router";

import MODEL_IMAGE_SRC from "@/src/assets/images/male_studio_model_1795516846316.jpg";

let CLEAN_MODEL_CACHE: string | null = null;
let CLEAN_MODEL_PROMISE: Promise<string> | null = null;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Cleans ONLY the small white tank-top shoulder straps & upper trap peeks (y: 17.4%..24.5%)
 * on the standing model photo. Everything else (neck, lower arms, hands, watch, belt, trousers)
 * stays 100% untouched so garments layer naturally without any rectangular erase seams.
 */
async function loadCleanStudioModel(): Promise<string> {
  if (CLEAN_MODEL_CACHE) return CLEAN_MODEL_CACHE;
  if (CLEAN_MODEL_PROMISE) return CLEAN_MODEL_PROMISE;

  CLEAN_MODEL_PROMISE = new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth || 896;
        const h = img.naturalHeight || 1200;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(MODEL_IMAGE_SRC);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const frame = ctx.getImageData(0, 0, w, h);
        const data = frame.data;

        const yStart = Math.floor(h * 0.172);
        const yEnd = Math.floor(h * 0.252);
        const xSampleL = Math.floor(w * 0.185);
        const xSampleR = Math.floor(w * 0.815);
        const xMin = Math.floor(w * 0.325);
        const xMax = Math.floor(w * 0.675);

        for (let y = yStart; y <= yEnd; y++) {
          const ny = y / h;
          let lr = 0, lg = 0, lb = 0;
          let rr = 0, rg = 0, rb = 0;
          for (let dx = -1; dx <= 1; dx++) {
            const li = (y * w + (xSampleL + dx)) * 4;
            const ri = (y * w + (xSampleR + dx)) * 4;
            lr += data[li] ?? 236;
            lg += data[li + 1] ?? 231;
            lb += data[li + 2] ?? 222;
            rr += data[ri] ?? 236;
            rg += data[ri + 1] ?? 231;
            rb += data[ri + 2] ?? 222;
          }
          lr /= 3; lg /= 3; lb /= 3;
          rr /= 3; rg /= 3; rb /= 3;

          for (let x = xMin; x <= xMax; x++) {
            const nx = x / w;

            // Preserve central neck, throat, and collarbone skin
            const neckDist =
              ((nx - 0.5) / 0.056) ** 2 + ((ny - 0.16) / 0.055) ** 2;
            if (neckDist <= 1.0) continue;

            // Only clean the upper shoulder trap & tank strap wedge above y = 0.245
            const topFade = smoothstep(0.174, 0.186, ny);
            const botFade = 1 - smoothstep(0.22, 0.248, ny);
            const leftFade = smoothstep(0.325, 0.348, nx);
            const rightFade = 1 - smoothstep(0.652, 0.675, nx);
            const neckFeather = smoothstep(1.0, 1.35, neckDist);

            // Narrow slightly inward as y approaches sleeve cap so bicep skin stays crisp
            const strapZone =
              (nx >= 0.385 && nx <= 0.46) || (nx >= 0.54 && nx <= 0.615) ? 1 : 0.85;

            const blend = topFade * botFade * leftFade * rightFade * neckFeather * strapZone;
            if (blend <= 0.01) continue;

            const t = (x - xSampleL) / (xSampleR - xSampleL);
            const grain = ((((x * 374761393 + y * 668265263) ^ 0x5bf03635) & 3) - 1.5) * 0.6;
            const wr = lr + (rr - lr) * t + grain;
            const wg = lg + (rg - lg) * t + grain;
            const wb = lb + (rb - lb) * t + grain;

            const idx = (y * w + x) * 4;
            data[idx] = Math.round(data[idx] * (1 - blend) + wr * blend);
            data[idx + 1] = Math.round(data[idx + 1] * (1 - blend) + wg * blend);
            data[idx + 2] = Math.round(data[idx + 2] * (1 - blend) + wb * blend);
          }
        }

        ctx.putImageData(frame, 0, 0);
        const url = canvas.toDataURL("image/jpeg", 0.94);
        CLEAN_MODEL_CACHE = url;
        resolve(url);
      } catch {
        resolve(MODEL_IMAGE_SRC);
      }
    };
    img.onerror = () => resolve(MODEL_IMAGE_SRC);
    img.src = MODEL_IMAGE_SRC;
  });

  return CLEAN_MODEL_PROMISE;
}

const TAILORED_GARMENT_CACHE = new Map<string, ImageData>();
const RAW_GARMENT_IMAGE_CACHE = new Map<string, HTMLImageElement>();

function sampleBilinear(
  srcData: Uint8ClampedArray,
  sw: number,
  sh: number,
  sx: number,
  sy: number,
): [number, number, number, number] {
  if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) return [0, 0, 0, 0];
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const fx = sx - x0;
  const fy = sy - y0;

  const i00 = (y0 * sw + x0) * 4;
  const i10 = i00 + 4;
  const i01 = i00 + sw * 4;
  const i11 = i01 + 4;

  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  const a =
    srcData[i00 + 3] * w00 +
    srcData[i10 + 3] * w10 +
    srcData[i01 + 3] * w01 +
    srcData[i11 + 3] * w11;
  if (a < 1) return [0, 0, 0, 0];

  const r =
    srcData[i00] * w00 +
    srcData[i10] * w10 +
    srcData[i01] * w01 +
    srcData[i11] * w11;
  const g =
    srcData[i00 + 1] * w00 +
    srcData[i10 + 1] * w10 +
    srcData[i01 + 1] * w01 +
    srcData[i11 + 1] * w11;
  const b =
    srcData[i00 + 2] * w00 +
    srcData[i10 + 2] * w10 +
    srcData[i01 + 2] * w01 +
    srcData[i11 + 2] * w11;

  return [r, g, b, a];
}

function buildTailoredGarmentImageData(
  srcImageData: ImageData,
  item: RailGarment,
  cacheKey: string,
): ImageData {
  const cached = TAILORED_GARMENT_CACHE.get(cacheKey);
  if (cached) return cached;

  const sw = srcImageData.width;
  const sh = srcImageData.height;
  const srcData = srcImageData.data;

  const isLongSleeve = item.kind !== "tee";
  const dstW = sw;
  const dstH = sh;
  const out = new ImageData(dstW, dstH);
  const dst = out.data;

  for (let dy = 0; dy < dstH; dy++) {
    const v = dy / dstH; // 0..1 on 200x310 grid
    for (let dx = 0; dx < dstW; dx++) {
      const u = dx / dstW;
      const distCenter = Math.abs(u - 0.5);

      // 1. Clean collar/hanger/inner-neck cutout so the model's real throat sits naturally inside
      let neckAlpha = 1;
      if (item.kind === "hoodie") {
        // Keep the hood silhouette intact; only remove wire hook & deep inner throat wedge
        if (v < 0.032) neckAlpha = 0;
        else if (distCenter < 0.085) {
          const curve = 0.095 + 0.045 * (1 - (distCenter / 0.085) ** 2);
          neckAlpha = smoothstep(curve - 0.008, curve + 0.008, v);
        }
      } else if (item.id === "polo-forest" || item.kind === "shirt") {
        const topCut = 0.104;
        if (v < topCut) neckAlpha = 0;
        else if (distCenter < 0.105) {
          const curve = topCut + 0.048 * (1 - (distCenter / 0.105) ** 2);
          neckAlpha = smoothstep(curve - 0.008, curve + 0.008, v);
        }
      } else if (item.id === "cardigan-olive") {
        const topCut = 0.106;
        if (v < topCut) neckAlpha = 0;
        else if (distCenter < 0.125) {
          const curve = topCut + 0.072 * (1 - distCenter / 0.125);
          neckAlpha = smoothstep(curve - 0.008, curve + 0.008, v);
        }
      } else {
        const topCut = 0.106;
        if (v < topCut) neckAlpha = 0;
        else if (distCenter < 0.115) {
          const curve = topCut + 0.042 * (1 - (distCenter / 0.115) ** 2);
          neckAlpha = smoothstep(curve - 0.008, curve + 0.008, v);
        }
      }

      if (neckAlpha <= 0.01) continue;

      let sx = u * sw;
      let sy = v * sh;

      // 2. For long-sleeve garments, tuck splayed hanger sleeves straight down over the model's
      //    real hanging arms and bring cuffs down to his wrists without distorting chest/hem.
      if (isLongSleeve) {
        const sleeveMask = smoothstep(0.22, 0.28, distCenter);
        if (sleeveMask > 0.001) {
          const armDrop = smoothstep(0.22, 0.78, v);
          // Shift outer sleeve sample slightly further outward -> pulls sleeve visually inward onto arm
          const tuckU = Math.sign(u - 0.5) * 0.068 * armDrop * sleeveMask;
          sx = (u + tuckU) * sw;

          // Elongate sleeves downward so cuffs meet real wrists (~v=0.88) while hem stays at ~v=0.75
          if (v > 0.24) {
            const cuffReachV = 0.24 + (v - 0.24) * 0.69;
            sy = (v * (1 - sleeveMask) + cuffReachV * sleeveMask) * sh;
          }
        }
      }

      const [r, g, b, a] = sampleBilinear(srcData, sw, sh, sx, sy);
      if (a <= 1) continue;

      const idx = (dy * dstW + dx) * 4;
      dst[idx] = Math.round(r);
      dst[idx + 1] = Math.round(g);
      dst[idx + 2] = Math.round(b);
      dst[idx + 3] = Math.round(a * neckAlpha);
    }
  }

  TAILORED_GARMENT_CACHE.set(cacheKey, out);
  return out;
}

function FittedGarmentCanvas({
  item,
  activeColor,
}: {
  item: RailGarment;
  activeColor: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const src = item.image;
  const tinted = Boolean(src && isCustomTint(item.color, activeColor));
  const prepared = usePreparedGarment(src, item.color, activeColor, 0.11);
  const [rawImg, setRawImg] = React.useState<HTMLImageElement | null>(() =>
    src ? RAW_GARMENT_IMAGE_CACHE.get(src) ?? null : null,
  );

  React.useEffect(() => {
    if (!src) return;
    const cached = RAW_GARMENT_IMAGE_CACHE.get(src);
    if (cached && cached.complete) {
      setRawImg(cached);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      RAW_GARMENT_IMAGE_CACHE.set(src, img);
      if (!cancelled) setRawImg(img);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;

    let sourceData: ImageData | null = null;
    if (tinted && prepared) {
      sourceData = getTintedImageDataSync(prepared, src, item.color, activeColor, 0.11);
    } else if (rawImg && rawImg.complete && rawImg.naturalWidth > 0) {
      const scale = rawImg.naturalHeight > 360 ? 360 / rawImg.naturalHeight : 1;
      const tmp = document.createElement("canvas");
      tmp.width = Math.max(1, Math.round(rawImg.naturalWidth * scale));
      tmp.height = Math.max(1, Math.round(rawImg.naturalHeight * scale));
      const tctx = tmp.getContext("2d");
      if (tctx) {
        tctx.drawImage(rawImg, 0, 0, tmp.width, tmp.height);
        sourceData = tctx.getImageData(0, 0, tmp.width, tmp.height);
      }
    } else if (prepared) {
      sourceData = getTintedImageDataSync(prepared, src, item.color, item.color ?? activeColor, 0.11);
    }

    if (!sourceData) return;

    if (TAILORED_GARMENT_CACHE.size > 60) TAILORED_GARMENT_CACHE.clear();
    const cacheKey = `${item.id}:${activeColor}:${sourceData.width}x${sourceData.height}`;
    const tailored = buildTailoredGarmentImageData(sourceData, item, cacheKey);
    if (canvas.width !== tailored.width) canvas.width = tailored.width;
    if (canvas.height !== tailored.height) canvas.height = tailored.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(tailored, 0, 0);
  }, [item, src, activeColor, tinted, prepared, rawImg]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={310}
      aria-hidden="true"
      className="h-full w-full object-fill select-none"
    />
  );
}

function getTryOnPlacement(item: RailGarment): {
  top: string;
  height: string;
  width: string;
} {
  if (item.id === "hoodie-heather") {
    return { top: "12.0%", height: "41.5%", width: "44.5%" };
  }
  if (item.id === "polo-forest") {
    return { top: "13.4%", height: "39.5%", width: "45.5%" };
  }
  if (item.id === "oxford-sky") {
    return { top: "13.5%", height: "39.5%", width: "45.0%" };
  }
  if (item.id === "cardigan-olive") {
    return { top: "13.7%", height: "39.5%", width: "44.5%" };
  }
  if (item.kind === "knit") {
    return { top: "13.7%", height: "39.5%", width: "45.0%" };
  }
  return { top: "13.8%", height: "39.5%", width: "45.5%" };
}

const STUDIO_CATEGORIES: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tee", label: "Tees & Polo" },
  { key: "knit", label: "Knit & Fleece" },
  { key: "shirting", label: "Shirting" },
];

export function ModelFitStudio({
  selectedColors,
  selectedSizes,
  getItemColor,
  onColorChange,
  onSizeChange,
  onAddToBag,
}: {
  selectedColors: Record<string, string>;
  selectedSizes: Record<string, GarmentSize>;
  getItemColor: (item: RailGarment) => string;
  onColorChange: (id: string, hex: string) => void;
  onSizeChange: (id: string, size: GarmentSize) => void;
  onAddToBag: (item: RailGarment, size: GarmentSize, color: string, fromRect?: DOMRect) => void;
}) {
  const [studioCategory, setStudioCategory] = React.useState<CategoryFilter>("all");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [swipeOffset, setSwipeOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [modelImgFailed, setModelImgFailed] = React.useState(false);
  const [justAdded, setJustAdded] = React.useState(false);
  const [cleanModelSrc, setCleanModelSrc] = React.useState<string>(
    () => CLEAN_MODEL_CACHE ?? MODEL_IMAGE_SRC,
  );

  const wornOverlayRef = React.useRef<HTMLDivElement | null>(null);
  const addedTimerRef = React.useRef<number | null>(null);
  const dragRef = React.useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    dx: 0,
    moved: false,
  });

  const studioItems = React.useMemo(
    () => RAIL_DEMO_ITEMS.filter((it) => matchesCategory(it, studioCategory)),
    [studioCategory],
  );

  const count = studioItems.length;
  const safeIndex = count > 0 ? activeIndex % count : 0;
  const activeItem = studioItems[safeIndex] ?? RAIL_DEMO_ITEMS[0];
  const activeColor = selectedColors[activeItem.id] ?? getItemColor(activeItem);
  const chosenSize = selectedSizes[activeItem.id] ?? "M";
  const colorOptions = activeItem.colors ?? getColorOptionsForItem(activeItem.color);
  const placement = getTryOnPlacement(activeItem);

  React.useEffect(() => {
    let cancelled = false;
    void loadCleanStudioModel().then((url) => {
      if (!cancelled) setCleanModelSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-warm adjacent items so swiping left/right swaps onto the model immediately
  React.useEffect(() => {
    if (count === 0) return;
    const prev = studioItems[(safeIndex - 1 + count) % count];
    const next = studioItems[(safeIndex + 1) % count];
    for (const candidate of [activeItem, prev, next]) {
      preloadTintedGarmentAngles(
        [candidate.image],
        candidate.color,
        selectedColors[candidate.id] ?? candidate.color,
        0.11,
      );
    }
  }, [safeIndex, activeItem, count, studioItems, selectedColors]);

  React.useEffect(() => {
    return () => {
      if (addedTimerRef.current !== null) window.clearTimeout(addedTimerRef.current);
    };
  }, []);

  const stepIndex = React.useCallback(
    (delta: number) => {
      if (count <= 1) return;
      setActiveIndex((prev) => (prev + delta + count) % count);
    },
    [count],
  );

  const handleCategoryChange = (cat: CategoryFilter) => {
    setStudioCategory(cat);
    setActiveIndex(0);
  };

  const handleSwipeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, a")) return;
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      moved: false,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleSwipeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      d.moved = true;
    }
    if (d.moved) {
      d.dx = dx;
      setSwipeOffset(Math.max(-96, Math.min(96, dx)));
    }
  };

  const handleSwipeEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active || d.pointerId !== e.pointerId) return;
    d.active = false;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (Math.abs(d.dx) > 38) {
      stepIndex(d.dx < 0 ? 1 : -1);
    }
    setSwipeOffset(0);
  };

  const handleStageKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepIndex(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      stepIndex(1);
    }
  };

  const handleTryOnAdd = () => {
    onAddToBag(
      activeItem,
      chosenSize,
      activeColor,
      wornOverlayRef.current?.getBoundingClientRect(),
    );
    setJustAdded(true);
    if (addedTimerRef.current !== null) window.clearTimeout(addedTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => setJustAdded(false), 1200);
  };

  const getRelativeItem = (offset: number) => {
    const idx = (safeIndex + offset + count * 4) % count;
    return { item: studioItems[idx], idx };
  };

  const flankingSlots = React.useMemo(() => {
    if (count <= 1) return [];
    if (count === 2) {
      return [{ offset: 1, ...getRelativeItem(1) }];
    }
    if (count < 5) {
      return [
        { offset: -1, ...getRelativeItem(-1) },
        { offset: 1, ...getRelativeItem(1) },
      ];
    }
    return [
      { offset: -2, ...getRelativeItem(-2) },
      { offset: -1, ...getRelativeItem(-1) },
      { offset: 1, ...getRelativeItem(1) },
      { offset: 2, ...getRelativeItem(2) },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, safeIndex, studioItems]);

  return (
    <section
      id="fit-studio"
      aria-labelledby="fit-studio-heading"
      className="mx-auto max-w-6xl px-3 py-10 sm:px-6 sm:py-16"
    >
      <div className="mb-5 flex flex-col justify-between gap-2 sm:mb-6 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Interactive Fit Studio
          </p>
          <h2
            id="fit-studio-heading"
            className="text-balance text-xl font-semibold tracking-tight sm:text-3xl"
          >
            Swipe garments onto the studio model.
          </h2>
        </div>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {String(safeIndex + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </p>
      </div>

      {/* Main Architectural Studio Try-On Stage */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Virtual try-on studio stage"
        onKeyDown={handleStageKeyDown}
        onPointerDown={handleSwipeStart}
        onPointerMove={handleSwipeMove}
        onPointerUp={handleSwipeEnd}
        onPointerCancel={handleSwipeEnd}
        className={`relative w-full touch-pan-y select-none overflow-hidden rounded-2xl border border-border bg-[#EFEAE1] outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-[#191816] ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {/* Warm Architectural Studio Wall + Floor Horizon Backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(65% 60% at 50% 42%, rgba(255,255,255,0.45), transparent 72%), linear-gradient(to bottom, transparent 0%, transparent 78%, rgba(0,0,0,0.08) 78.2%, rgba(0,0,0,0.04) 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden dark:block"
          style={{
            background:
              "radial-gradient(58% 62% at 50% 44%, rgba(242,235,222,0.14), rgba(24,23,21,0.5) 70%), linear-gradient(to bottom, transparent 0%, transparent 78%, rgba(0,0,0,0.45) 78.2%, rgba(0,0,0,0.28) 100%)",
          }}
        />

        {/* Subtle Architectural Arch + Studio Watermark */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-12 flex flex-col items-center justify-center sm:top-14"
        >
          <span className="font-heading text-[28px] font-semibold uppercase tracking-[0.34em] text-foreground/[0.06] dark:text-white/[0.08] sm:text-[54px]">
            Meridian
          </span>
        </div>

        {/* Top Studio Category Filter Pills */}
        <div className="relative z-30 flex items-center justify-center px-3 pt-4 sm:px-6 sm:pt-5">
          <div
            role="group"
            aria-label="Filter fit studio garments"
            className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-black/10 bg-white/75 p-1 shadow-xs backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-white/10 dark:bg-black/45"
          >
            {STUDIO_CATEGORIES.map((cat) => {
              const active = studioCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleCategoryChange(cat.key)}
                  className={`min-h-[32px] whitespace-nowrap shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors sm:px-4 sm:text-xs ${
                    active
                      ? "bg-foreground text-background shadow-xs"
                      : "text-foreground/70 hover:text-foreground dark:text-white/70 dark:hover:text-white"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Model + Flanking Garment Cards Arena */}
        <div className="relative flex min-h-[395px] w-full items-end justify-center pt-3 sm:min-h-[500px] lg:min-h-[545px]">
          {/* Left / Right Swipe Stepper Controls */}
          {count > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous shirt"
                onClick={() => stepIndex(-1)}
                className="absolute left-2.5 top-1/2 z-30 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/85 text-foreground shadow-sm backdrop-blur transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/15 dark:bg-black/55 dark:text-white sm:left-4 sm:size-10"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next shirt"
                onClick={() => stepIndex(1)}
                className="absolute right-2.5 top-1/2 z-30 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/85 text-foreground shadow-sm backdrop-blur transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/15 dark:bg-black/55 dark:text-white sm:right-4 sm:size-10"
              >
                <ChevronRight className="size-4" />
              </button>
            </>
          )}

          {/* Flanking Left & Right Garment Cards */}
          {flankingSlots.map(({ offset, item, idx }) => {
            const itemColor = selectedColors[item.id] ?? getItemColor(item);
            const isOuter = Math.abs(offset) === 2;
            const posClass =
              offset === -2
                ? "hidden lg:flex left-[3%] xl:left-[5%] opacity-55 scale-[0.82] z-0"
                : offset === -1
                  ? "flex -left-7 sm:left-[7%] md:left-[12%] lg:left-[17%] opacity-60 sm:opacity-95 scale-[0.76] sm:scale-100 z-10"
                  : offset === 1
                    ? "flex -right-7 sm:right-[7%] md:right-[12%] lg:right-[17%] opacity-60 sm:opacity-95 scale-[0.76] sm:scale-100 z-10"
                    : "hidden lg:flex right-[3%] xl:right-[5%] opacity-55 scale-[0.82] z-0";

            return (
              <button
                key={`${offset}-${item.id}`}
                type="button"
                aria-label={`Try on ${item.name}`}
                onClick={() => setActiveIndex(idx)}
                style={{
                  transform: `translate3d(${(swipeOffset * 0.45).toFixed(1)}px, -50%, 0)`,
                  transition: isDragging
                    ? "none"
                    : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms ease",
                }}
                className={`group absolute top-[46%] flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${posClass}`}
              >
                <div
                  className={`relative flex aspect-[200/270] items-center justify-center rounded-xl border border-black/8 bg-white/60 p-2 shadow-sm backdrop-blur-xs transition-all duration-300 group-hover:-translate-y-1 group-hover:bg-white/85 group-hover:shadow-md dark:border-white/10 dark:bg-white/[0.06] dark:group-hover:bg-white/[0.12] ${
                    isOuter ? "w-[116px] xl:w-[132px]" : "w-[110px] sm:w-[142px] lg:w-[168px]"
                  }`}
                >
                  <GarmentThumbnail item={item} view="front" colorOverride={itemColor} decorative />
                </div>
                <div className="mt-2 hidden max-w-[148px] text-center sm:block">
                  <p className="truncate text-xs font-medium text-foreground dark:text-white/90">
                    {item.name}
                  </p>
                  <p className="font-mono text-[11px] tabular-nums text-muted-foreground dark:text-white/60">
                    {item.tag}
                  </p>
                </div>
              </button>
            );
          })}

          {/* Centered Standing Male Model + Fitted Tailored Garment */}
          <div
            className="relative z-20 mx-auto w-[78%] max-w-[295px] aspect-[896/1200] sm:w-[360px] sm:max-w-none lg:w-[395px]"
            style={{
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, black 13%, black 87%, transparent 100%)",
              maskImage:
                "linear-gradient(to right, transparent 0%, black 13%, black 87%, transparent 100%)",
            }}
          >
            {!modelImgFailed ? (
              <img
                src={cleanModelSrc}
                alt="Male model wearing charcoal pleated trousers fitted with studio garment"
                referrerPolicy="no-referrer"
                draggable={false}
                onError={() => setModelImgFailed(true)}
                className="h-full w-full object-contain object-bottom"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted/40 p-8 text-sm text-muted-foreground">
                Meridian Atelier Fit Model
              </div>
            )}

            {/* Tailored Live Garment Composite aligned to collar, shoulders, hanging arms & waist */}
            <div
              key={`${activeItem.id}-${activeColor}`}
              ref={wornOverlayRef}
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 z-10 animate-in fade-in duration-200"
              style={{
                top: placement.top,
                height: placement.height,
                width: placement.width,
                transform: `translate3d(calc(-50% + ${(swipeOffset * 0.22).toFixed(1)}px), 0, 0)`,
                transition: isDragging ? "none" : "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
                filter: "drop-shadow(0 6px 12px rgba(0, 0, 0, 0.18))",
              }}
            >
              <FittedGarmentCanvas item={activeItem} activeColor={activeColor} />
            </div>
          </div>
        </div>

        {/* Floating Bottom Studio Control Dock */}
        <div className="relative z-30 mx-2.5 mb-2.5 sm:mx-auto sm:mb-4 sm:-mt-2 sm:max-w-3xl sm:px-4">
          <div className="flex flex-col gap-2.5 rounded-2xl border border-white/15 bg-[#161614]/90 p-3 text-white shadow-xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-2.5">
            <div className="flex items-center justify-between gap-3 sm:min-w-0 sm:flex-1">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-white/10 p-1">
                  <GarmentThumbnail item={activeItem} view="front" colorOverride={activeColor} decorative />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold tracking-tight sm:text-sm">
                    {activeItem.name}
                  </p>
                  <p className="flex items-center gap-1.5 text-[11px] text-white/70">
                    <span className="font-mono tabular-nums text-white/95">{activeItem.tag}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{getColorName(activeColor)}</span>
                  </p>
                </div>
              </div>

              <div
                role="group"
                aria-label={`Color for ${activeItem.name}`}
                className="flex shrink-0 items-center gap-1.5"
              >
                {colorOptions.map((opt) => {
                  const isSelected = opt.hex.toUpperCase() === activeColor.toUpperCase();
                  return (
                    <button
                      key={opt.hex}
                      type="button"
                      title={opt.name}
                      aria-label={`Try ${opt.name} color on model`}
                      aria-pressed={isSelected}
                      onClick={() => onColorChange(activeItem.id, opt.hex)}
                      className={`inline-flex size-6 items-center justify-center rounded-full border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        isSelected
                          ? "scale-110 border-white ring-1 ring-white/80"
                          : "border-white/25"
                      }`}
                    >
                      <span
                        className="size-4 rounded-full border border-black/20"
                        style={{ backgroundColor: opt.hex }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2 sm:border-t-0 sm:border-l sm:pl-3 sm:pt-0">
              <div
                className="flex items-center gap-0.5"
                role="group"
                aria-label={`Size for ${activeItem.name}`}
              >
                {SIZES.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onSizeChange(activeItem.id, sz)}
                    className={`min-h-[34px] min-w-[32px] rounded-md px-1.5 text-[11px] font-medium transition-colors ${
                      chosenSize === sz
                        ? "bg-white text-[#161614]"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleTryOnAdd}
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-semibold text-[#161614] shadow-xs transition-transform hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                >
                  <ShoppingBag className="size-3.5" />
                  <span>{justAdded ? "Added" : "Add to Bag"}</span>
                </button>
                <Link
                  to={`/product/${activeItem.id}`}
                  aria-label={`View full details for ${activeItem.name}`}
                  className="inline-flex size-[38px] shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white transition-colors hover:bg-white/15"
                >
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
