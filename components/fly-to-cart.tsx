import * as React from "react";
import { createPortal } from "react-dom";
import type { RailGarment } from "@/components/ui/product-rail-gallery";
import { GarmentThumbnail } from "@/components/garment-thumbnail";

export interface FlyRequest {
  id: number;
  item: RailGarment;
  color: string;
  fromRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

function FlyingShirt({
  flight,
  targetRef,
  onLand,
}: {
  flight: FlyRequest;
  targetRef: React.RefObject<HTMLElement | null>;
  onLand: (id: number) => void;
}) {
  const nodeRef = React.useRef<HTMLDivElement | null>(null);
  const onLandRef = React.useRef(onLand);
  onLandRef.current = onLand;

  const baseW = Math.max(84, Math.min(132, flight.fromRect.width * 0.56 || 104));
  const baseH = Math.round(baseW * 1.32);
  const startX = flight.fromRect.left + flight.fromRect.width / 2;
  const startY = flight.fromRect.top + flight.fromRect.height / 2;

  React.useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onLandRef.current(flight.id);
      return;
    }

    const targetRect = targetRef.current?.getBoundingClientRect();
    const endX = targetRect
      ? targetRect.left + targetRect.width / 2
      : window.innerWidth - 76;
    const endY = targetRect ? targetRect.top + targetRect.height / 2 : 34;

    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.hypot(dx, dy);
    const arcLift = Math.min(130, Math.max(44, dist * 0.24));
    const ctrlX = startX + dx * 0.45;
    const ctrlY = Math.min(startY, endY) - arcLift;

    const duration = Math.min(680, Math.max(460, 420 + dist * 0.22));
    const startTime = performance.now();
    let raf = 0;
    let finished = false;

    const frame = (now: number) => {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / duration);
      // Smooth cubic ease-in-out for natural flight momentum
      const t = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const inv = 1 - t;

      const x = inv * inv * startX + 2 * inv * t * ctrlX + t * t * endX;
      const y = inv * inv * startY + 2 * inv * t * ctrlY + t * t * endY;

      // Slight initial lift pop then smooth shrink into cart icon
      const pop = p < 0.16 ? 1 + 0.08 * Math.sin((p / 0.16) * Math.PI) : 1;
      const scale = Math.max(0.18, (1 - t * 0.78) * pop);
      const tilt = Math.sin(p * Math.PI) * (dx >= 0 ? 11 : -11);
      const opacity = p > 0.78 ? Math.max(0, 1 - (p - 0.78) / 0.22) : 1;

      node.style.transform = `translate3d(${(x - baseW / 2).toFixed(2)}px, ${(y - baseH / 2).toFixed(2)}px, 0) scale(${scale.toFixed(3)}) rotate(${tilt.toFixed(2)}deg)`;
      node.style.opacity = opacity.toFixed(3);

      if (p < 1) {
        raf = requestAnimationFrame(frame);
      } else if (!finished) {
        finished = true;
        onLandRef.current(flight.id);
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [flight.id, startX, startY, baseW, baseH, targetRef]);

  return (
    <div
      ref={nodeRef}
      style={{
        width: baseW,
        height: baseH,
        transform: `translate3d(${(startX - baseW / 2).toFixed(2)}px, ${(startY - baseH / 2).toFixed(2)}px, 0)`,
        willChange: "transform, opacity",
      }}
      className="pointer-events-none fixed left-0 top-0 drop-shadow-[0_14px_24px_rgba(0,0,0,0.22)]"
    >
      <GarmentThumbnail item={flight.item} colorOverride={flight.color} decorative />
    </div>
  );
}

export function FlyToCartLayer({
  flights,
  targetRef,
  onLand,
}: {
  flights: FlyRequest[];
  targetRef: React.RefObject<HTMLElement | null>;
  onLand: (id: number) => void;
}) {
  if (flights.length === 0 || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
    >
      {flights.map((flight) => (
        <FlyingShirt
          key={flight.id}
          flight={flight}
          targetRef={targetRef}
          onLand={onLand}
        />
      ))}
    </div>,
    document.body,
  );
}
