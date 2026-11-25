import * as React from "react";
import type { GarmentKind, RailGarment } from "@/components/ui/product-rail-gallery";
import {
  getTintedImageDataSync,
  isCustomTint,
  usePreparedGarment,
} from "@/lib/garment-colors";

function FallbackSilhouette({ kind = "tee", color = "#CFCBC2" }: { kind?: GarmentKind; color?: string }) {
  const isLong = kind !== "tee";
  const isHoodie = kind === "hoodie";
  const isShirt = kind === "shirt";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 140"
      className="h-full w-full max-h-[82%] max-w-[82%] drop-shadow-sm"
    >
      <path
        d="M52 16 L60 4 C60 1 63 1 64 3"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M28 28 Q44 18 60 16 Q76 18 92 28"
        fill="none"
        stroke="#8F6A4A"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {isHoodie && (
        <path
          d="M44 22 C38 10 46 4 60 4 C74 4 82 10 76 22 Z"
          fill={color}
          stroke="rgba(0,0,0,0.14)"
          strokeWidth="1"
        />
      )}
      <path
        d={
          isLong
            ? "M44 20 C52 26 68 26 76 20 L95 30 L104 98 L90 100 L86 52 L86 122 C70 126 50 126 34 122 L34 52 L30 100 L16 98 L25 30 Z"
            : "M44 20 C52 26 68 26 76 20 L95 30 L105 56 L92 62 L85 48 L86 122 C70 126 50 126 34 122 L35 48 L28 62 L15 56 L25 30 Z"
        }
        fill={color}
        stroke="rgba(0,0,0,0.14)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {isShirt && (
        <line
          x1="60"
          y1="25"
          x2="60"
          y2="123"
          stroke="rgba(0,0,0,0.22)"
          strokeWidth="1.1"
        />
      )}
    </svg>
  );
}

export function GarmentThumbnail({
  item,
  view = "front",
  colorOverride,
  className = "",
  decorative = false,
}: {
  item: RailGarment;
  view?: "front" | "side" | "back";
  colorOverride?: string;
  className?: string;
  decorative?: boolean;
}) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const src =
    view === "back"
      ? item.backImage ?? item.image
      : view === "side"
        ? item.sideImage ?? item.image
        : item.image;

  const activeColor = colorOverride ?? item.color;
  const tinted = Boolean(src && activeColor && isCustomTint(item.color, activeColor));
  const prepared = usePreparedGarment(src, item.color, activeColor, 0.11);
  const isFailed = !src || failedSrc === src;

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !prepared || !src || !activeColor || !tinted) return;
    if (canvas.width !== prepared.w) canvas.width = prepared.w;
    if (canvas.height !== prepared.h) canvas.height = prepared.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imageData = getTintedImageDataSync(prepared, src, item.color, activeColor, 0.11);
    ctx.putImageData(imageData, 0, 0);
  }, [prepared, src, item.color, activeColor, tinted]);

  if (isFailed) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-muted/60 text-foreground ${className}`}>
        <FallbackSilhouette kind={item.kind} color={activeColor} />
      </div>
    );
  }

  return (
    <div className={`relative flex h-full w-full items-center justify-center ${className}`}>
      {tinted && prepared ? (
        <canvas
          ref={canvasRef}
          width={prepared.w}
          height={prepared.h}
          aria-label={decorative ? undefined : item.name}
          role={decorative ? undefined : "img"}
          style={{ aspectRatio: `${prepared.w} / ${prepared.h}` }}
          className="h-full w-full object-contain object-center select-none"
        />
      ) : (
        <img
          src={src}
          alt={decorative ? "" : item.name}
          draggable={false}
          loading="eager"
          decoding="async"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
          className="h-full w-full object-contain object-center select-none"
        />
      )}
    </div>
  );
}
