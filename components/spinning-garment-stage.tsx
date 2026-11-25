import * as React from "react";
import type { RailGarment } from "@/components/ui/product-rail-gallery";
import { GarmentThumbnail } from "@/components/garment-thumbnail";
import { preloadTintedGarmentAngles } from "@/lib/garment-colors";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function SpinningGarmentStage({
  item,
  index,
  mode = "spin",
  colorOverride,
}: {
  item: RailGarment;
  index: number;
  mode?: "spin" | "front" | "side" | "back";
  colorOverride?: string;
}) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const frontRef = React.useRef<HTMLDivElement | null>(null);
  const sideRef = React.useRef<HTMLDivElement | null>(null);
  const backRef = React.useRef<HTMLDivElement | null>(null);
  const shadowRef = React.useRef<HTMLDivElement | null>(null);
  const hasSide = Boolean(item.sideImage);

  React.useEffect(() => {
    const urls = [item.image, item.sideImage, item.backImage].filter(Boolean) as string[];
    preloadTintedGarmentAngles(urls, item.color, colorOverride, 0.11);
  }, [item.image, item.sideImage, item.backImage, item.color, colorOverride]);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    const paint = (deg: number) => {
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Guaranteed 100%-coverage handoff: side reaches full opacity before front/back fade out,
      // eliminating alpha-hole background bleed and double-silhouette ghosting at 90° / 270°.
      const frontOp = hasSide ? clamp((cos - 0.02) / 0.2, 0, 1) : cos >= 0 ? 1 : 0;
      const backOp = hasSide ? clamp((-cos - 0.02) / 0.2, 0, 1) : cos < 0 ? 1 : 0;
      const sideOp = hasSide ? clamp(1 - (Math.abs(cos) - 0.22) / 0.24, 0, 1) : 0;
      const sideSign = sin >= 0 ? 1 : -1;
      const sideRotY = deg - sideSign * 90;

      if (frontRef.current) {
        frontRef.current.style.opacity = frontOp.toFixed(3);
        frontRef.current.style.visibility = frontOp <= 0.01 ? "hidden" : "visible";
        frontRef.current.style.transform = `perspective(1000px) rotateY(${deg.toFixed(2)}deg)`;
      }
      if (sideRef.current) {
        sideRef.current.style.opacity = sideOp.toFixed(3);
        sideRef.current.style.visibility = sideOp <= 0.01 ? "hidden" : "visible";
        sideRef.current.style.transform = `perspective(1000px) rotateY(${sideRotY.toFixed(2)}deg) scaleX(${sideSign < 0 ? -1 : 1})`;
      }
      if (backRef.current) {
        backRef.current.style.opacity = backOp.toFixed(3);
        backRef.current.style.visibility = backOp <= 0.01 ? "hidden" : "visible";
        backRef.current.style.transform = `perspective(1000px) rotateY(${(deg - 180).toFixed(2)}deg)`;
      }
      if (shadowRef.current) {
        shadowRef.current.style.transform = `scaleX(${clamp(0.42 + Math.abs(cos) * 0.58, 0.42, 1).toFixed(3)})`;
      }
    };

    if (mode !== "spin" || media.matches) {
      const fixedAngle = mode === "back" ? 180 : mode === "side" ? 90 : 0;
      paint(fixedAngle);
      return;
    }

    const phaseOffset = index * 32;
    let angle = phaseOffset;
    let last = performance.now();
    let raf = 0;
    let inView = true;

    const tick = (now: number) => {
      if (inView && document.visibilityState !== "hidden") {
        const dt = Math.min(0.05, (now - last) / 1000);
        angle = (angle + dt * 36) % 360;
        paint(angle);
      }
      last = now;
      if (inView) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const el = rootRef.current;
    const observer = el
      ? new IntersectionObserver(
          (entries) => {
            const visible = entries[0]?.isIntersecting ?? true;
            inView = visible;
            if (visible && !raf) {
              last = performance.now();
              raf = requestAnimationFrame(tick);
            }
          },
          { rootMargin: "120px" },
        )
      : null;
    if (el && observer) observer.observe(el);

    paint(angle);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [mode, index, hasSide]);

  return (
    <div ref={rootRef} className="relative h-full w-full select-none">
      <div
        ref={shadowRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 bottom-1 h-3.5 rounded-full bg-foreground/12 blur-md"
      />

      {hasSide && (
        <div
          ref={sideRef}
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
        >
          <GarmentThumbnail item={item} view="side" colorOverride={colorOverride} decorative />
        </div>
      )}

      <div
        ref={frontRef}
        style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      >
        <GarmentThumbnail item={item} view="front" colorOverride={colorOverride} />
      </div>

      <div
        ref={backRef}
        style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      >
        <GarmentThumbnail item={item} view="back" colorOverride={colorOverride} decorative />
      </div>
    </div>
  );
}
