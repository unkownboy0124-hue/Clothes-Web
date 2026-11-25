import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, ShoppingBag, X } from "lucide-react";
import type { RailGarment } from "@/components/ui/product-rail-gallery";
import { GarmentTurntable } from "@/components/garment-turntable";
import { getColorName } from "@/lib/garment-colors";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";

export type GarmentSize = "S" | "M" | "L" | "XL";

const SIZES: GarmentSize[] = ["S", "M", "L", "XL"];

export function ProductInspectorModal({
  item,
  items,
  selectedSize,
  selectedColor,
  initialAngle = 0,
  onSelectSize,
  onSelectColor,
  onSelectItem,
  onAddToBag,
  onInspectOnRail,
  onClose,
}: {
  item: RailGarment;
  items: RailGarment[];
  selectedSize: GarmentSize;
  selectedColor: string;
  initialAngle?: number;
  onSelectSize: (size: GarmentSize) => void;
  onSelectColor: (colorHex: string) => void;
  onSelectItem: (item: RailGarment) => void;
  onAddToBag: (item: RailGarment, size: GarmentSize, fromRect?: DOMRect) => void;
  onInspectOnRail: (id: string) => void;
  onClose: () => void;
}) {
  const closeBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspector-title"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 bg-background/85 backdrop-blur-md transition-opacity"
      />

      <div className="relative z-10 flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-y-auto rounded-t-2xl border border-border bg-card text-card-foreground shadow-2xl sm:rounded-2xl lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:overflow-hidden">
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Close product inspector"
          className="absolute right-3 top-3 z-20 inline-flex size-10 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground backdrop-blur transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-4 sm:top-4"
        >
          <X className="size-4" />
        </button>

        {/* Left: 3D Interactive Turntable Stage */}
        <div
          ref={stageRef}
          className="border-b border-border bg-muted/30 p-4 sm:p-6 lg:border-b-0 lg:border-r"
        >
          <div className="pr-10 lg:pr-0">
            <GarmentTurntable
              item={item}
              items={items}
              selectedColor={selectedColor}
              initialAngle={initialAngle}
              onSelectColor={onSelectColor}
              onSelectItem={onSelectItem}
              stageClassName="h-[280px] sm:h-[390px]"
            />
          </div>
        </div>

        {/* Right: Contiguous Purchase Module */}
        <div className="flex flex-col justify-between gap-6 p-5 sm:p-8">
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {item.kind ?? "Garment"} · {getColorName(selectedColor)}
                </p>
                <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
                  {item.tag}
                </p>
              </div>
              <h2 id="inspector-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {item.name}
              </h2>
              {item.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              )}
            </div>

            {item.details && item.details.length > 0 && (
              <div className="border-y border-border py-3.5">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Construction</p>
                <p className="text-sm text-foreground">{item.details.join(" · ")}</p>
              </div>
            )}

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Select Size</span>
                <span className="text-muted-foreground">Regular studio block</span>
              </div>
              <div className="grid grid-cols-4 gap-2" role="group" aria-label="Select garment size">
                {SIZES.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onSelectSize(sz)}
                    className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
                      selectedSize === sz
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2.5 border-t border-border pt-5">
            <Button
              type="button"
              onClick={() => {
                const rect = stageRef.current?.getBoundingClientRect();
                onAddToBag(item, selectedSize, rect);
                onClose();
              }}
              className="min-h-[46px] w-full text-sm font-medium"
            >
              <ShoppingBag className="mr-2 size-4" />
              Add to Bag — {item.tag}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onClose();
                  onInspectOnRail(item.id);
                }}
                className="min-h-[44px] w-full text-xs sm:text-sm"
              >
                Locate on Rail
              </Button>
              <Link
                to={`/product/${item.id}`}
                onClick={onClose}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:text-sm"
              >
                <span>Full Details</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
