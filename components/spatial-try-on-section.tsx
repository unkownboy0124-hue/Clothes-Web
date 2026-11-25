import * as React from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Rotate3d,
  ShoppingBag,
} from "lucide-react";
import type { RailGarment } from "@/components/ui/product-rail-gallery";
import type { GarmentSize } from "@/components/product-inspector-modal";
import { GarmentThumbnail } from "@/components/garment-thumbnail";
import {
  matchesCategory,
  SIZES,
  type CategoryFilter,
} from "@/lib/catalog-data";
import {
  getColorName,
  getColorOptionsForItem,
  preloadTintedGarmentAngles,
} from "@/lib/garment-colors";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";

type StageView = "front" | "side" | "back";

const CATEGORY_TABS: ReadonlyArray<{ key: CategoryFilter; label: string }> = [
  { key: "all", label: "All (10)" },
  { key: "tee", label: "Tees & Polo" },
  { key: "knit", label: "Knit & Fleece" },
  { key: "shirting", label: "Shirting" },
];

const mod = (n: number, m: number) => ((n % m) + m) % m;

function circularOffset(index: number, pos: number, count: number): number {
  if (count <= 1) return 0;
  const half = count / 2;
  return mod(index - pos + half, count) - half;
}

export function SpatialTryOnSection({
  items,
  selectedColors,
  selectedSizes,
  getItemColor,
  onColorChange,
  onSizeChange,
  onAddToBag,
  onOpenModal,
}: {
  items: RailGarment[];
  selectedColors: Record<string, string>;
  selectedSizes: Record<string, GarmentSize>;
  getItemColor: (item: RailGarment) => string;
  onColorChange: (id: string, colorHex: string) => void;
  onSizeChange: (id: string, size: GarmentSize) => void;
  onAddToBag: (
    item: RailGarment,
    size: GarmentSize,
    color: string,
    fromRect?: DOMRect,
  ) => void;
  onOpenModal: (item: RailGarment, initialAngle?: number) => void;
}) {
  const [tabCategory, setTabCategory] = React.useState<CategoryFilter>("all");
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [stageView, setStageView] = React.useState<StageView>("front");
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [scanCycle, setScanCycle] = React.useState(0);
  const [justAdded, setJustAdded] = React.useState(false);
  const addedTimerRef = React.useRef<number | null>(null);

  const visibleItems = React.useMemo(
    () => items.filter((item) => matchesCategory(item, tabCategory)),
    [items, tabCategory],
  );
  const count = visibleItems.length;
  const safeActiveIdx = count > 0 ? mod(activeIdx, count) : 0;
  const activeItem = visibleItems[safeActiveIdx] ?? items[0];

  const sectionRef = React.useRef<HTMLElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const roomRef = React.useRef<HTMLDivElement | null>(null);
  const cardRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const centerWrapRef = React.useRef<HTMLDivElement | null>(null);
  const scanNextRef = React.useRef<HTMLDivElement | null>(null);
  const scanGridRef = React.useRef<HTMLDivElement | null>(null);
  const scanLineRef = React.useRef<HTMLDivElement | null>(null);
  const thumbDockRef = React.useRef<HTMLDivElement | null>(null);

  const tabsContainerRef = React.useRef<HTMLDivElement | null>(null);
  const tabBtnRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [pillStyle, setPillStyle] = React.useState<{ left: number; width: number }>({
    left: 4,
    width: 72,
  });

  const simRef = React.useRef({
    pos: 0,
    target: 0,
    dragging: false,
    startX: 0,
    startY: 0,
    p0: 0,
    moved: 0,
    lastX: 0,
    lastT: 0,
    vx: 0,
    downIdx: null as number | null,
    sx: 0,
    sy: 0,
    tsx: 0,
    tsy: 0,
    xs: [0, 180, 290, 365, 415, 445],
    cardW: 168,
    stageW: 960,
    stageH: 560,
    settledIdx: 0,
    count: 10,
  });

  // Track reduced motion
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Keep active index and sim count synced when category tabs filter
  React.useEffect(() => {
    const s = simRef.current;
    s.count = count;
    s.pos = 0;
    s.target = 0;
    s.settledIdx = 0;
    cardRefs.current.length = count;
    setActiveIdx(0);
    setStageView("front");
    setScanCycle((c) => c + 1);
  }, [count, tabCategory]);

  React.useEffect(() => {
    return () => {
      if (addedTimerRef.current !== null) window.clearTimeout(addedTimerRef.current);
    };
  }, []);

  // Preload active item angles + active color immediately
  React.useEffect(() => {
    if (!activeItem) return;
    const activeColor = getItemColor(activeItem);
    preloadTintedGarmentAngles(
      [activeItem.image, activeItem.sideImage, activeItem.backImage],
      activeItem.color,
      activeColor,
      0.11,
    );
  }, [activeItem, getItemColor]);

  // Measure sliding tab pill
  const updateTabPill = React.useCallback(() => {
    const btn = tabBtnRefs.current[tabCategory];
    if (!btn) return;
    setPillStyle({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [tabCategory]);

  React.useLayoutEffect(() => {
    updateTabPill();
  }, [updateTabPill]);

  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => {
      const rect = stage.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || 540;
      const phone = w <= 767;
      const cardW = phone ? Math.min(w * 0.34, 152) : Math.min(w * 0.165, h * 0.39, 195);
      const xsRatios = phone ? [0, 0.34, 0.48, 0.56, 0.61, 0.64] : [0, 0.225, 0.36, 0.445, 0.5, 0.53];
      simRef.current.stageW = w;
      simRef.current.stageH = h;
      simRef.current.cardW = cardW;
      simRef.current.xs = xsRatios.map((r) => r * w);
      stage.style.setProperty("--arc-cw", `${cardW.toFixed(1)}px`);
      updateTabPill();
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [updateTabPill]);

  // Scan-line transition animation whenever activeItem, color, or angle changes
  React.useEffect(() => {
    if (reducedMotion || scanCycle === 0) return;
    const nextEl = scanNextRef.current;
    const gridEl = scanGridRef.current;
    const lineEl = scanLineRef.current;
    if (!nextEl || !gridEl || !lineEl) return;

    const anims: Animation[] = [
      nextEl.animate(
        [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)" }],
        { duration: 760, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" },
      ),
      nextEl.animate(
        [{ transform: "scale(1.022)" }, { transform: "scale(1)" }],
        { duration: 920, easing: "ease-out" },
      ),
      gridEl.animate(
        [
          { clipPath: "inset(0 0 100% 0)", opacity: 0.9, offset: 0 },
          { clipPath: "inset(0 0 0 0)", opacity: 0.95, offset: 0.48 },
          { clipPath: "inset(100% 0 0 0)", opacity: 0, offset: 1 },
        ],
        { duration: 860, easing: "cubic-bezier(.65,0,.35,1)" },
      ),
      lineEl.animate(
        [
          { top: "2%", transform: "scaleX(0.25)", opacity: 0, offset: 0 },
          { top: "8%", transform: "scaleX(1)", opacity: 1, offset: 0.1 },
          { top: "92%", transform: "scaleX(1)", opacity: 1, offset: 0.9 },
          { top: "98%", transform: "scaleX(0.25)", opacity: 0, offset: 1 },
        ],
        { duration: 760, easing: "cubic-bezier(.65,0,.35,1)" },
      ),
    ];

    return () => {
      anims.forEach((a) => a.cancel());
    };
  }, [scanCycle, reducedMotion]);

  // Main 3D spatial arc animation loop (runs only while section is in view)
  React.useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let raf = 0;
    let inView = true;

    const xAt = (a: number, xs: number[]) => {
      if (a >= 5) return xs[5] ?? 440;
      const k = Math.floor(a);
      const lo = xs[k] ?? 0;
      const hi = xs[k + 1] ?? lo;
      return lo + (hi - lo) * (a - k);
    };

    const tick = (now: number) => {
      const s = simRef.current;
      const t = now * 0.001;
      const n = s.count;

      if (reducedMotion) {
        if (!s.dragging) s.pos = s.target;
      } else if (!s.dragging) {
        s.pos += (s.target - s.pos) * 0.12;
      }

      s.sx += (s.tsx - s.sx) * 0.06;
      s.sy += (s.tsy - s.sy) * 0.06;

      if (roomRef.current && !reducedMotion) {
        roomRef.current.style.transform = `translate3d(${(-s.sx * 18).toFixed(2)}px, ${(-s.sy * 12).toFixed(2)}px, 0) scale(1.06)`;
      }

      const h = s.stageH;

      for (let i = 0; i < n; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;

        const u = circularOffset(i, s.pos, n);
        const a = Math.abs(u);
        const sg = u < 0 ? -1 : u > 0 ? 1 : 0;

        const x = sg * xAt(a, s.xs);
        let scale = 1;
        let z = 0;
        let ry = 0;
        let op = 1;
        let blur = 0;

        if (a < 1) {
          // Smooth fade-out right into the central spotlight garment
          scale = 0.56 + 0.44 * a;
          z = -240 * (1 - a);
          op = Math.max(0, (a - 0.14) / 0.86);
          ry = -sg * 16 * a;
        } else {
          scale = 1 / (1 + 0.3 * Math.pow(a - 1, 1.15));
          z = -105 * (a - 1);
          ry = -sg * (16 + 9 * Math.min(2, a - 1));
          blur = Math.max(0, a - 1.55) * 2.1;
          op = a > 3.25 ? Math.max(0, 1 - (a - 3.25) / 0.85) : 1;
        }

        ry += s.sx * 9;
        const bob = reducedMotion ? 0 : Math.sin(t * 1.15 + i * 1.37) * h * 0.008 * Math.min(1, a);
        const y = bob - (1 - scale) * h * 0.045;

        if (op < 0.01) {
          el.style.visibility = "hidden";
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
        } else {
          el.style.visibility = "visible";
          el.style.opacity = op.toFixed(4);
          el.style.pointerEvents = a >= 0.72 ? "auto" : "none";
          el.style.zIndex = String(a < 1 ? 2 : Math.round(40 - 8 * a));
          el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "";
          el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) perspective(1300px) translateZ(${z.toFixed(2)}px) rotateY(${ry.toFixed(2)}deg) rotateX(${(-s.sy * 5).toFixed(2)}deg) scale(${scale.toFixed(4)})`;
        }
      }

      if (!s.dragging && n > 0 && Math.abs(s.target - s.pos) < 0.045) {
        const nextSettled = mod(Math.round(s.target), n);
        if (nextSettled !== s.settledIdx) {
          s.settledIdx = nextSettled;
          setActiveIdx(nextSettled);
          setScanCycle((c) => c + 1);
        }
      }

      if (inView && document.visibilityState !== "hidden") {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? true;
        inView = visible;
        if (visible && !raf) {
          raf = requestAnimationFrame(tick);
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(section);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [reducedMotion]);

  const stepArc = React.useCallback((delta: number) => {
    const n = simRef.current.count;
    if (n <= 1) return;
    simRef.current.target += delta;
    const nextIdx = mod(Math.round(simRef.current.target), n);
    simRef.current.settledIdx = nextIdx;
    setActiveIdx(nextIdx);
    setScanCycle((c) => c + 1);
  }, []);

  const focusCardAt = React.useCallback((cardIdx: number) => {
    const s = simRef.current;
    const n = s.count;
    if (n <= 1) return;
    const u = circularOffset(cardIdx, s.pos, n);
    s.target = Math.round(s.pos + u);
    const nextIdx = mod(s.target, n);
    s.settledIdx = nextIdx;
    setActiveIdx(nextIdx);
    setScanCycle((c) => c + 1);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest("[data-arc-control]")) return;

    const s = simRef.current;
    s.dragging = true;
    s.startX = e.clientX;
    s.startY = e.clientY;
    s.p0 = s.pos;
    s.moved = 0;
    s.lastX = e.clientX;
    s.lastT = performance.now();
    s.vx = 0;
    const cardBtn = targetEl.closest<HTMLElement>("[data-arc-card]");
    s.downIdx = cardBtn ? Number(cardBtn.dataset.arcCard) : null;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = simRef.current;
    const stage = stageRef.current;
    if (stage) {
      const rect = stage.getBoundingClientRect();
      s.tsx = (e.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
      s.tsy = (e.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
    }

    if (!s.dragging) return;
    const dx = e.clientX - s.startX;
    s.moved = Math.hypot(dx, e.clientY - s.startY);
    const stepPx = Math.max(80, s.xs[1] ?? 180);
    s.pos = s.p0 - dx / stepPx;
    const now = performance.now();
    const dt = now - s.lastT;
    if (dt > 0) {
      const inst = (e.clientX - s.lastX) / dt;
      s.vx = s.vx * 0.6 + inst * 0.4;
      s.lastX = e.clientX;
      s.lastT = now;
    }
  };

  const handlePointerEnd = () => {
    const s = simRef.current;
    if (!s.dragging) return;
    s.dragging = false;

    if (s.moved < 8 && s.downIdx !== null) {
      focusCardAt(s.downIdx);
    } else if (s.count > 1) {
      if (performance.now() - s.lastT > 80) s.vx = 0;
      s.target = Math.round(s.pos - s.vx * 2.6);
      const nextIdx = mod(s.target, s.count);
      s.settledIdx = nextIdx;
      setActiveIdx(nextIdx);
      setScanCycle((c) => c + 1);
    }
    s.downIdx = null;
  };

  if (!activeItem) return null;

  const activeColor = getItemColor(activeItem);
  const chosenSize = selectedSizes[activeItem.id] ?? "M";
  const colorOptions = activeItem.colors ?? getColorOptionsForItem(activeItem.color);
  const hasSide = Boolean(activeItem.sideImage);
  const effectiveView: StageView = stageView === "side" && !hasSide ? "front" : stageView;

  return (
    <section
      ref={sectionRef}
      id="spatial-studio"
      aria-labelledby="spatial-studio-heading"
      className="relative overflow-hidden border-b border-border bg-muted/30"
    >
      {/* Blurred Warm Atelier Room Backdrop with Subtle Parallax */}
      <div
        ref={roomRef}
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 bg-cover bg-center opacity-35 blur-[6px] saturate-105 transition-opacity dark:opacity-20"
        style={{
          backgroundImage: `url("/src/assets/images/atelier_studio_rail_1795500631906.jpg")`,
          transform: "scale(1.06)",
          willChange: "transform",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/85 via-background/35 to-background/90"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Clean Editorial Header + Sliding Frosted-Glass Category Pill */}
        <div className="flex flex-col items-center justify-between gap-5 text-center md:flex-row md:items-end md:text-left">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Spatial Fitting Arc
            </p>
            <h2
              id="spatial-studio-heading"
              className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Slide the arc to inspect every garment at full scale.
            </h2>
          </div>

          <div
            ref={tabsContainerRef}
            role="tablist"
            aria-label="Filter spatial garment arc"
            className="relative flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-border/80 bg-card/75 p-1 shadow-sm backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1 h-[34px] rounded-full bg-foreground shadow-sm transition-[transform,width] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
              style={{
                width: `${pillStyle.width}px`,
                transform: `translate3d(${pillStyle.left}px, 0, 0)`,
              }}
            />
            {CATEGORY_TABS.map((tab) => {
              const isActive = tabCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  ref={(node) => {
                    tabBtnRefs.current[tab.key] = node;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setTabCategory(tab.key)}
                  className={`relative z-10 h-[34px] whitespace-nowrap shrink-0 rounded-full px-3.5 text-xs font-medium transition-colors sm:px-4 ${
                    isActive
                      ? "text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main 3D Spatial Arc Stage */}
        <div
          ref={stageRef}
          tabIndex={0}
          role="region"
          aria-label="Interactive 3D garment arc"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              stepArc(-1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              stepArc(1);
            }
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onPointerLeave={() => {
            simRef.current.tsx = 0;
            simRef.current.tsy = 0;
          }}
          className="relative mt-6 h-[430px] w-full touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-[500px] lg:h-[540px]"
          style={{ ["--arc-cw" as string]: "172px" }}
        >
          {/* Left Floating Glass Tool Rail (Angle & 360° Controls) */}
          <aside
            data-arc-control
            aria-label="Garment angle and inspector tools"
            className="absolute left-1 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-1.5 rounded-full border border-border/80 bg-card/75 p-1.5 shadow-lg backdrop-blur-xl sm:flex"
          >
            {(
              [
                ["front", "Front"],
                ...(hasSide ? ([["side", "Side"]] as const) : []),
                ["back", "Back"],
              ] as const
            ).map(([viewKey, label]) => {
              const active = effectiveView === viewKey;
              return (
                <button
                  key={viewKey}
                  type="button"
                  onClick={() => {
                    setStageView(viewKey);
                    setScanCycle((c) => c + 1);
                  }}
                  aria-pressed={active}
                  title={`${label} view`}
                  className={`flex h-9 w-12 items-center justify-center rounded-full text-[11px] font-medium transition-colors ${
                    active
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
            <div className="my-0.5 h-px w-6 bg-border" />
            <button
              type="button"
              onClick={() =>
                onOpenModal(activeItem, effectiveView === "back" ? 180 : effectiveView === "side" ? 90 : 0)
              }
              aria-label={`Open 360° turntable for ${activeItem.name}`}
              title="Open 360° Inspector"
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
            >
              <Maximize2 className="size-4" />
            </button>
          </aside>

          {/* Left / Right Arc Navigation Arrows */}
          {count > 1 && (
            <>
              <button
                data-arc-control
                type="button"
                aria-label="Previous garment"
                onClick={() => stepArc(-1)}
                className="absolute left-2 top-1/2 z-40 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-card/80 text-foreground shadow-md backdrop-blur-xl transition-transform hover:scale-105 active:scale-95 sm:left-20 sm:size-11"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                data-arc-control
                type="button"
                aria-label="Next garment"
                onClick={() => stepArc(1)}
                className="absolute right-2 top-1/2 z-40 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-card/80 text-foreground shadow-md backdrop-blur-xl transition-transform hover:scale-105 active:scale-95 sm:right-4 sm:size-11"
              >
                <ChevronRight className="size-4" />
              </button>
            </>
          )}

          {/* 3D Perspective Frosted-Glass Product Arc */}
          <div aria-hidden="false" className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
            {visibleItems.map((item, i) => {
              const itemColor = getItemColor(item);
              return (
                <button
                  key={item.id}
                  ref={(node) => {
                    cardRefs.current[i] = node;
                  }}
                  type="button"
                  data-arc-card={i}
                  aria-label={`Select ${item.name} (${item.tag})`}
                  style={{
                    width: "var(--arc-cw)",
                    height: "calc(var(--arc-cw) * 1.38)",
                    marginLeft: "calc(var(--arc-cw) * -0.5)",
                    marginTop: "calc(var(--arc-cw) * -0.69)",
                    willChange: "transform, opacity, filter",
                  }}
                  className="group/card absolute overflow-hidden rounded-2xl border border-border/80 bg-card/75 p-3 text-center shadow-lg backdrop-blur-xl transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="h-[68%] w-full">
                    <GarmentThumbnail item={item} colorOverride={itemColor} decorative />
                  </div>
                  <p className="mt-1.5 truncate text-xs font-medium text-foreground sm:text-[13px]">
                    {item.name}
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                    {item.tag}
                  </p>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover/card:translate-x-full dark:via-white/15"
                  />
                </button>
              );
            })}
          </div>

          {/* Center Garment Spotlight + Luminous Scan-Line Reveal */}
          <div
            ref={centerWrapRef}
            className="pointer-events-auto relative z-30 mx-auto flex h-full w-[260px] flex-col items-center justify-center sm:w-[320px] lg:w-[360px]"
          >
            <button
              data-arc-control
              type="button"
              onClick={() =>
                onOpenModal(
                  activeItem,
                  effectiveView === "back" ? 180 : effectiveView === "side" ? 90 : 0,
                )
              }
              aria-label={`Inspect ${activeItem.name} in 360 degrees`}
              className="group relative flex h-[86%] w-full cursor-pointer items-center justify-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* Soft studio floor shadow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-4 h-5 w-44 rounded-full bg-foreground/18 blur-lg"
              />

              {/* Garment silhouette reveal layer */}
              <div
                ref={scanNextRef}
                className="relative h-full w-full drop-shadow-[0_18px_28px_rgba(0,0,0,0.18)]"
              >
                <GarmentThumbnail
                  item={activeItem}
                  view={effectiveView}
                  colorOverride={activeColor}
                />
              </div>

              {/* Scan grid overlay */}
              <div
                ref={scanGridRef}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 mix-blend-screen"
                style={{
                  background:
                    "repeating-linear-gradient(0deg, transparent 0 5px, rgba(255,255,255,0.28) 5px 6px)",
                }}
              />

              {/* Luminous travelling scan beam */}
              <div
                ref={scanLineRef}
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-4 top-0 h-[2px] opacity-0"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.95) 20%, rgba(255,255,255,0.95) 80%, transparent)",
                  boxShadow:
                    "0 0 18px 4px rgba(255,255,255,0.75), 0 0 46px 10px rgba(170,220,255,0.45)",
                }}
              />

              <span className="pointer-events-none absolute bottom-3 inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/85 px-3 py-1 text-[11px] font-medium text-foreground opacity-0 shadow-sm backdrop-blur-md transition-opacity group-hover:opacity-100">
                <Rotate3d className="size-3.5" />
                <span>Open 360° View</span>
              </span>
            </button>
          </div>
        </div>

        {/* Mobile View Angle Switcher */}
        <div className="mt-2 flex justify-center sm:hidden">
          <div
            role="group"
            aria-label="Garment angle"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card/85 p-1 backdrop-blur-xl"
          >
            {(
              [
                ["front", "Front"],
                ...(hasSide ? ([["side", "Side"]] as const) : []),
                ["back", "Back"],
              ] as const
            ).map(([viewKey, label]) => (
              <button
                key={viewKey}
                type="button"
                onClick={() => {
                  setStageView(viewKey);
                  setScanCycle((c) => c + 1);
                }}
                className={`min-h-[32px] rounded-full px-3 text-xs font-medium transition-colors ${
                  effectiveView === viewKey
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Floating Frosted-Glass Buy & Color Control Bar */}
        <div className="relative z-40 mx-auto mt-5 max-w-4xl rounded-2xl border border-border/90 bg-card/85 p-3.5 shadow-xl backdrop-blur-2xl sm:mt-6 sm:p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
            {/* Thumb + Title + Price */}
            <div className="flex min-w-0 items-center gap-3.5">
              <div
                ref={thumbDockRef}
                className="h-16 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted/50 p-1.5"
              >
                <GarmentThumbnail item={activeItem} colorOverride={activeColor} decorative />
              </div>

              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <span className="font-mono tabular-nums">
                    {String(safeActiveIdx + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{getColorName(activeColor)}</span>
                </div>
                <Link
                  to={`/product/${activeItem.id}`}
                  className="block truncate text-base font-semibold tracking-tight text-foreground hover:underline underline-offset-4"
                >
                  {activeItem.name}
                </Link>
                <p className="font-mono text-sm font-medium tabular-nums text-muted-foreground">
                  {activeItem.tag}
                  {activeItem.details?.[0] ? ` · ${activeItem.details[0]}` : ""}
                </p>
              </div>
            </div>

            {/* Sizes + Color Swatches + Add to Bag CTA */}
            <div className="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap lg:justify-end">
              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-muted-foreground">Size</span>
                <div className="flex items-center gap-1" role="group" aria-label="Select size">
                  {SIZES.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => onSizeChange(activeItem.id, sz)}
                      className={`inline-flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                        chosenSize === sz
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-muted-foreground">
                  Color · {getColorName(activeColor)}
                </span>
                <div className="flex h-8 items-center gap-2" role="group" aria-label="Select color">
                  {colorOptions.map((opt) => {
                    const isSelected = opt.hex.toUpperCase() === activeColor.toUpperCase();
                    return (
                      <button
                        key={opt.hex}
                        type="button"
                        title={opt.name}
                        aria-label={`Color ${opt.name}`}
                        aria-pressed={isSelected}
                        onClick={() => {
                          onColorChange(activeItem.id, opt.hex);
                          setScanCycle((c) => c + 1);
                        }}
                        className={`inline-flex size-6 items-center justify-center rounded-full border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          isSelected
                            ? "scale-110 border-foreground ring-1 ring-foreground ring-offset-1 ring-offset-card"
                            : "border-transparent"
                        }`}
                      >
                        <span
                          className="size-4 rounded-full border border-foreground/20"
                          style={{ backgroundColor: opt.hex }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex w-full items-center gap-2 sm:w-auto">
                <Button
                  type="button"
                  onClick={() => {
                    const rect =
                      centerWrapRef.current?.getBoundingClientRect() ??
                      thumbDockRef.current?.getBoundingClientRect();
                    onAddToBag(activeItem, chosenSize, activeColor, rect);
                    setJustAdded(true);
                    if (addedTimerRef.current !== null) {
                      window.clearTimeout(addedTimerRef.current);
                    }
                    addedTimerRef.current = window.setTimeout(() => setJustAdded(false), 1200);
                  }}
                  className="min-h-[44px] flex-1 whitespace-nowrap px-5 sm:flex-initial"
                >
                  {justAdded ? (
                    <>
                      <Check className="mr-1.5 size-4" />
                      <span>Added</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="mr-1.5 size-4" />
                      <span>Add to Bag</span>
                    </>
                  )}
                </Button>
                <Link
                  to={`/product/${activeItem.id}`}
                  aria-label={`View full details for ${activeItem.name}`}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-3.5 text-xs font-medium text-foreground transition-colors hover:bg-muted whitespace-nowrap shrink-0"
                >
                  <span>Details</span>
                  <ArrowRight className="ml-1 size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
