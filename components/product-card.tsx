import * as React from "react";
import { Check, Rotate3d } from "lucide-react";
import type { RailGarment } from "@/components/ui/product-rail-gallery";
import type { GarmentSize } from "@/components/product-inspector-modal";
import { SpinningGarmentStage } from "@/components/spinning-garment-stage";
import { SIZES, type CardView } from "@/lib/catalog-data";
import {
  getColorName,
  getColorOptionsForItem,
  preloadTintedGarmentAngles,
} from "@/lib/garment-colors";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";

export function ProductCard({
  item,
  index,
  cardView = "spin",
  chosenSize,
  activeColor,
  onSelectSize,
  onSelectColor,
  onAddToBag,
  onOpenModal,
}: {
  item: RailGarment;
  index: number;
  cardView?: CardView;
  chosenSize: GarmentSize;
  activeColor: string;
  onSelectSize: (size: GarmentSize) => void;
  onSelectColor: (colorHex: string) => void;
  onAddToBag: (fromRect?: DOMRect) => void;
  onOpenModal: () => void;
}) {
  const [justAdded, setJustAdded] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);
  const stageBoxRef = React.useRef<HTMLDivElement | null>(null);
  const colorOptions = item.colors ?? getColorOptionsForItem(item.color);

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleAddClick = () => {
    onAddToBag(stageBoxRef.current?.getBoundingClientRect());
    setJustAdded(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <article
      onPointerEnter={() =>
        preloadTintedGarmentAngles(
          [item.image, item.sideImage, item.backImage],
          item.color,
          activeColor,
          0.11,
        )
      }
      className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5"
    >
      <div>
        <div
          ref={stageBoxRef}
          className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-muted/45"
        >
          <button
            type="button"
            onClick={onOpenModal}
            aria-label={`Open interactive 3D view for ${item.name}`}
            className="block h-full w-full cursor-pointer p-5 pr-12 text-left outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="pointer-events-none absolute left-3 top-3 z-10 font-mono text-[11px] tabular-nums text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-md bg-background/85 px-2 py-1 text-[11px] font-medium text-foreground opacity-90 backdrop-blur transition-opacity group-hover:opacity-100">
              <Rotate3d className="size-3.5" />
              <span>360°</span>
            </span>
            <div className="h-full w-full">
              <SpinningGarmentStage
                item={item}
                index={index}
                mode={cardView}
                colorOverride={activeColor}
              />
            </div>
          </button>

          {/* Vertical color swatch line on the right side of the card */}
          <div
            role="group"
            aria-label={`Color for ${item.name}`}
            className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-full border border-border bg-card/90 p-1.5 shadow-sm backdrop-blur"
          >
            {colorOptions.map((opt) => {
              const isSelected = opt.hex.toUpperCase() === activeColor.toUpperCase();
              return (
                <button
                  key={opt.hex}
                  type="button"
                  title={opt.name}
                  aria-label={`Select color ${opt.name} for ${item.name}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelectColor(opt.hex)}
                  className={`inline-flex size-6 items-center justify-center rounded-full border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isSelected
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

        <div className="mt-5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {item.kind ?? "Garment"} · {getColorName(activeColor)}
            </span>
            <span className="font-mono text-[15px] font-medium tabular-nums text-foreground">
              {item.tag}
            </span>
          </div>

          <h3 className="text-base font-semibold tracking-tight text-foreground">
            <Link
              to={`/product/${item.id}`}
              className="text-left hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.name}
            </Link>
          </h3>

          {item.details && item.details.length > 0 && (
            <p className="text-xs text-muted-foreground">{item.details.join(" · ")}</p>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Size</span>
          <div className="flex items-center gap-1" role="group" aria-label={`Size for ${item.name}`}>
            {SIZES.map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => onSelectSize(sz)}
                className={`min-h-[38px] min-w-[38px] rounded-md text-xs font-medium transition-colors sm:min-h-[34px] sm:min-w-[34px] ${
                  chosenSize === sz
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleAddClick}
            className="min-h-[44px] flex-1 whitespace-nowrap"
          >
            {justAdded ? (
              <>
                <Check className="mr-1.5 size-3.5" />
                <span>Added</span>
              </>
            ) : (
              "Add to Bag"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onOpenModal}
            className="min-h-[44px] whitespace-nowrap shrink-0"
          >
            Rotate
          </Button>
        </div>
      </div>
    </article>
  );
}
