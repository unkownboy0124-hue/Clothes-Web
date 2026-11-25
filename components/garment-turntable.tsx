import * as React from "react";
import { ChevronLeft, ChevronRight, Hand, MousePointer2, RotateCw } from "lucide-react";
import type { RailGarment } from "@/components/ui/product-rail-gallery";
import { GarmentThumbnail } from "@/components/garment-thumbnail";
import { getColorOptionsForItem, preloadTintedGarmentAngles } from "@/lib/garment-colors";

type OrbitMode = "drag" | "cursor" | "auto";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function normalizeAngle(deg: number) {
  return ((deg % 360) + 360) % 360;
}

export function GarmentTurntable({
  item,
  items,
  selectedColor,
  initialAngle = 0,
  onSelectColor,
  onSelectItem,
  enableArrowKeys = true,
  stageClassName = "h-[280px] sm:h-[390px]",
}: {
  item: RailGarment;
  items?: RailGarment[];
  selectedColor: string;
  initialAngle?: number;
  onSelectColor: (colorHex: string) => void;
  onSelectItem?: (item: RailGarment) => void;
  enableArrowKeys?: boolean;
  stageClassName?: string;
}) {
  const [angle, setAngle] = React.useState(initialAngle);
  const [tiltX, setTiltX] = React.useState(0);
  const [mode, setMode] = React.useState<OrbitMode>("drag");
  const [isDragging, setIsDragging] = React.useState(false);

  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const phys = React.useRef({
    angle: initialAngle,
    target: null as number | null,
    velocity: 0,
    dragging: false,
    pointerId: -1,
    startX: 0,
    lastX: 0,
    lastT: 0,
  });

  const catalog = items && items.length > 0 ? items : [item];
  const index = Math.max(0, catalog.findIndex((entry) => entry.id === item.id));
  const prevItem = catalog[(index - 1 + catalog.length) % catalog.length];
  const nextItem = catalog[(index + 1) % catalog.length];
  const colorOptions = React.useMemo(
    () => item.colors ?? getColorOptionsForItem(item.color),
    [item.colors, item.color],
  );

  React.useEffect(() => {
    phys.current.angle = initialAngle;
    phys.current.target = null;
    phys.current.velocity = 0;
    setAngle(initialAngle);
    setTiltX(0);

    const urls = [item.image, item.sideImage, item.backImage].filter(Boolean) as string[];
    preloadTintedGarmentAngles(urls, item.color, selectedColor, 0.11);
  }, [item.id, item.image, item.sideImage, item.backImage, item.color, selectedColor, initialAngle]);

  React.useEffect(() => {
    if (!enableArrowKeys) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setMode("drag");
        phys.current.target = phys.current.angle - 45;
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setMode("drag");
        phys.current.target = phys.current.angle + 45;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enableArrowKeys]);

  React.useEffect(() => {
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      const p = phys.current;

      if (!p.dragging) {
        if (p.target !== null) {
          const diff = p.target - p.angle;
          p.angle += diff * Math.min(1, dt * 11);
          p.velocity = 0;
          if (Math.abs(diff) < 0.15) {
            p.angle = p.target;
            p.target = null;
          }
          setAngle(p.angle);
        } else if (mode === "auto") {
          p.angle += dt * 42;
          setAngle(p.angle);
        } else if (Math.abs(p.velocity) > 0.4) {
          p.angle += p.velocity * dt;
          p.velocity *= Math.pow(0.06, dt);
          setAngle(p.angle);
        } else {
          p.velocity = 0;
        }
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  const snapToAngle = (targetDeg: number) => {
    setMode("drag");
    const p = phys.current;
    const currentNorm = normalizeAngle(p.angle);
    let delta = targetDeg - currentNorm;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    p.velocity = 0;
    p.target = p.angle + delta;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const p = phys.current;
    p.dragging = true;
    p.pointerId = e.pointerId;
    p.startX = e.clientX;
    p.lastX = e.clientX;
    p.lastT = performance.now();
    p.velocity = 0;
    p.target = null;
    setIsDragging(true);
    if (mode === "auto") setMode("drag");
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const relY = (e.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
    setTiltX(clamp(-relY * 14, -7, 7));

    const p = phys.current;
    if (p.dragging && p.pointerId === e.pointerId) {
      const now = performance.now();
      const dx = e.clientX - p.lastX;
      const dt = Math.max(4, now - p.lastT) / 1000;
      const stepDeg = dx * 0.9;
      p.angle += stepDeg;
      p.velocity = clamp(stepDeg / dt, -540, 540);
      p.lastX = e.clientX;
      p.lastT = now;
      setAngle(p.angle);
      return;
    }

    if (mode === "cursor" && e.pointerType === "mouse") {
      const relX = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      const targetDeg = (relX - 0.5) * 360;
      p.target = targetDeg;
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = phys.current;
    if (!p.dragging || p.pointerId !== e.pointerId) return;
    p.dragging = false;
    p.pointerId = -1;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hasSide = Boolean(item.sideImage);

  const frontOpacity = hasSide ? clamp((cos - 0.02) / 0.2, 0, 1) : cos >= 0 ? 1 : 0;
  const backOpacity = hasSide ? clamp((-cos - 0.02) / 0.2, 0, 1) : cos < 0 ? 1 : 0;
  const sideOpacity = hasSide ? clamp(1 - (Math.abs(cos) - 0.22) / 0.24, 0, 1) : 0;

  const sideSign = sin >= 0 ? 1 : -1;
  const sideRotateY = angle - sideSign * 90;
  const norm = Math.round(normalizeAngle(angle));
  const activeViewLabel =
    norm <= 55 || norm >= 305 ? "Front" : norm >= 125 && norm <= 235 ? "Back" : "Side";

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">
            {String(index + 1).padStart(2, "0")} / {String(catalog.length).padStart(2, "0")}
          </span>
          <span aria-hidden="true">·</span>
          <span>{activeViewLabel} view</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{norm}°</span>
        </div>

        {onSelectItem && catalog.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`Previous piece: ${prevItem.name}`}
              onClick={() => onSelectItem(prevItem)}
              className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`Next piece: ${nextItem.name}`}
              onClick={() => onSelectItem(nextItem)}
              className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={stageRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={() => setTiltX(0)}
        className={`relative mx-auto my-3 flex w-full max-w-[380px] touch-none select-none items-center justify-center sm:my-4 ${stageClassName} ${
          isDragging ? "cursor-grabbing" : mode === "cursor" ? "cursor-ew-resize" : "cursor-grab"
        }`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 h-5 w-44 rounded-full bg-foreground/15 blur-md transition-transform duration-150"
          style={{
            transform: `scaleX(${clamp(0.45 + Math.abs(cos) * 0.55, 0.45, 1).toFixed(3)})`,
          }}
        />

        {hasSide && (
          <div
            aria-hidden={sideOpacity < 0.05}
            className="pointer-events-none absolute inset-4 z-10 flex items-center justify-center"
            style={{
              opacity: sideOpacity,
              visibility: sideOpacity <= 0.01 ? "hidden" : "visible",
              transform: `perspective(1300px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${sideRotateY.toFixed(2)}deg) scaleX(${sideSign < 0 ? -1 : 1})`,
            }}
          >
            <GarmentThumbnail item={item} view="side" colorOverride={selectedColor} decorative />
          </div>
        )}

        <div
          aria-hidden={frontOpacity < 0.05}
          className="pointer-events-none absolute inset-4 z-20 flex items-center justify-center"
          style={{
            opacity: frontOpacity,
            visibility: frontOpacity <= 0.01 ? "hidden" : "visible",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: `perspective(1300px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${angle.toFixed(2)}deg)`,
          }}
        >
          <GarmentThumbnail item={item} view="front" colorOverride={selectedColor} />
        </div>

        <div
          aria-hidden={backOpacity < 0.05}
          className="pointer-events-none absolute inset-4 z-20 flex items-center justify-center"
          style={{
            opacity: backOpacity,
            visibility: backOpacity <= 0.01 ? "hidden" : "visible",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: `perspective(1300px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${(angle - 180).toFixed(2)}deg)`,
          }}
        >
          <GarmentThumbnail item={item} view="back" colorOverride={selectedColor} decorative />
        </div>

        {/* Vertical color swatch line on the right side of the shirt */}
        <div
          role="group"
          aria-label="Select garment color"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="absolute right-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-full border border-border bg-card/95 p-1.5 shadow-md backdrop-blur"
        >
          {colorOptions.map((opt) => {
            const active = opt.hex.toUpperCase() === selectedColor.toUpperCase();
            return (
              <button
                key={opt.hex}
                type="button"
                title={opt.name}
                aria-label={`Color ${opt.name}`}
                aria-pressed={active}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectColor(opt.hex);
                }}
                className={`inline-flex size-7 items-center justify-center rounded-full border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "scale-105 border-foreground ring-1 ring-foreground ring-offset-1 ring-offset-card"
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

      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">0°</span>
          <input
            type="range"
            min={0}
            max={360}
            value={norm}
            aria-label="Rotate garment 360 degrees"
            onChange={(e) => {
              setMode("drag");
              const next = Number(e.target.value);
              phys.current.target = null;
              phys.current.velocity = 0;
              phys.current.angle = next;
              setAngle(next);
            }}
            className="h-2 w-full cursor-pointer accent-foreground"
          />
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">360°</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label="Quick garment angles"
            className="flex items-center gap-1 rounded-lg bg-muted p-1"
          >
            {(
              [
                ["Front", 0],
                ...(hasSide ? ([["Side", 90]] as const) : []),
                ["Back", 180],
              ] as const
            ).map(([label, deg]) => {
              const isCurrent = Math.abs(norm - deg) < 25 || (deg === 0 && norm > 335);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => snapToAngle(deg)}
                  className={`min-h-8 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    isCurrent
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div
            role="group"
            aria-label="Rotation control mode"
            className="flex items-center gap-1 rounded-lg bg-muted p-1"
          >
            <button
              type="button"
              onClick={() => setMode("drag")}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === "drag"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Hand className="size-3.5" />
              <span>Drag</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("cursor")}
              className={`hidden min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:inline-flex ${
                mode === "cursor"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MousePointer2 className="size-3.5" />
              <span>Cursor</span>
            </button>
            <button
              type="button"
              onClick={() => setMode((m) => (m === "auto" ? "drag" : "auto"))}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === "auto"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <RotateCw className={`size-3.5 ${mode === "auto" ? "animate-spin" : ""}`} />
              <span>Spin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
