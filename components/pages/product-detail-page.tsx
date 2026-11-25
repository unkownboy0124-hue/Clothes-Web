import * as React from "react";
import { ArrowLeft, ArrowRight, Check, ShoppingBag } from "lucide-react";
import type { RailGarment } from "@/components/ui/product-rail-gallery";
import type { GarmentSize } from "@/components/product-inspector-modal";
import { GarmentTurntable } from "@/components/garment-turntable";
import { ProductCard } from "@/components/product-card";
import { RAIL_DEMO_ITEMS } from "@/components/demo";
import { MATERIAL_SPECS, SIZES, getMaterialKeyForItem } from "@/lib/catalog-data";
import { getColorName } from "@/lib/garment-colors";
import { Link, useRouter } from "@/lib/router";
import { Button } from "@/components/ui/button";

export function ProductDetailPage({
  productId,
  selectedSizes,
  getItemColor,
  onColorChange,
  onSizeChange,
  onAddToBag,
  onInspectOnRail,
  onOpenModal,
}: {
  productId: string;
  selectedSizes: Record<string, GarmentSize>;
  getItemColor: (item: RailGarment) => string;
  onColorChange: (id: string, hex: string) => void;
  onSizeChange: (id: string, size: GarmentSize) => void;
  onAddToBag: (item: RailGarment, size: GarmentSize, color: string, fromRect?: DOMRect) => void;
  onInspectOnRail: (id: string) => void;
  onOpenModal: (item: RailGarment, initialAngle?: number) => void;
}) {
  const { navigate } = useRouter();
  const [justAdded, setJustAdded] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const item = RAIL_DEMO_ITEMS.find((it) => it.id === productId);

  React.useEffect(() => {
    setJustAdded(false);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [productId]);

  if (!item) {
    return (
      <section className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-4 py-24 text-center sm:px-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Garment Not Found
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          That piece is no longer on the studio rail.
        </h1>
        <Link
          to="/collection"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background"
        >
          <ArrowLeft className="size-4" />
          <span>Return to Collection</span>
        </Link>
      </section>
    );
  }

  const chosenSize = selectedSizes[item.id] ?? "M";
  const activeColor = getItemColor(item);
  const material = MATERIAL_SPECS[getMaterialKeyForItem(item)];

  const currentIdx = RAIL_DEMO_ITEMS.findIndex((it) => it.id === item.id);
  const relatedItems = [
    RAIL_DEMO_ITEMS[(currentIdx + 1) % RAIL_DEMO_ITEMS.length],
    RAIL_DEMO_ITEMS[(currentIdx + 2) % RAIL_DEMO_ITEMS.length],
    RAIL_DEMO_ITEMS[(currentIdx + 3) % RAIL_DEMO_ITEMS.length],
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
      >
        <Link to="/" className="hover:text-foreground">
          The Rail
        </Link>
        <span aria-hidden="true">/</span>
        <Link to="/collection" className="hover:text-foreground">
          Collection
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-foreground">{item.name}</span>
      </nav>

      {/* Main Sticky Split Layout */}
      <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
        {/* Left: Interactive 360° Turntable */}
        <div
          ref={stageRef}
          className="rounded-xl border border-border bg-muted/30 p-4 sm:p-6 lg:sticky lg:top-24 lg:col-span-7"
        >
          <GarmentTurntable
            item={item}
            items={RAIL_DEMO_ITEMS}
            selectedColor={activeColor}
            onSelectColor={(hex) => onColorChange(item.id, hex)}
            onSelectItem={(next) => navigate(`/product/${next.id}`)}
            stageClassName="h-[320px] sm:h-[440px]"
          />
        </div>

        {/* Right: Contiguous Purchase Module */}
        <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 sm:p-8 lg:sticky lg:top-24 lg:col-span-5">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {item.kind ?? "Garment"} · {getColorName(activeColor)}
              </p>
              <p className="font-mono text-xl font-semibold tabular-nums text-foreground">
                {item.tag}
              </p>
            </div>
            <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              {item.name}
            </h1>
            {item.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            )}
          </div>

          {item.details && item.details.length > 0 && (
            <div className="border-y border-border py-4">
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
                  onClick={() => onSizeChange(item.id, sz)}
                  className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
                    chosenSize === sz
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 border-t border-border pt-5">
            <Button
              type="button"
              onClick={() => {
                onAddToBag(
                  item,
                  chosenSize,
                  activeColor,
                  stageRef.current?.getBoundingClientRect(),
                );
                setJustAdded(true);
                if (timerRef.current !== null) window.clearTimeout(timerRef.current);
                timerRef.current = window.setTimeout(() => setJustAdded(false), 1200);
              }}
              className="min-h-[48px] w-full text-sm font-medium"
            >
              {justAdded ? (
                <>
                  <Check className="mr-2 size-4" />
                  <span>Added to Bag</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="mr-2 size-4" />
                  <span>Add to Bag — {item.tag}</span>
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onInspectOnRail(item.id)}
              className="min-h-[44px] w-full text-sm"
            >
              View Hanging on Studio Rail
            </Button>
          </div>

          {/* Fabric & Care Summary */}
          <div className="space-y-3 border-t border-border pt-5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{material.title}</span>
              <Link
                to="/materials"
                className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <span>Materials Dossier</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Density</dt>
                <dd className="mt-0.5 font-mono font-medium tabular-nums text-foreground">
                  {material.weight}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Origin</dt>
                <dd className="mt-0.5 font-medium text-foreground">{material.origin}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Weave</dt>
                <dd className="mt-0.5 font-medium text-foreground">{material.weave}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Care</dt>
                <dd className="mt-0.5 font-medium text-foreground">{material.care}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Complementary Pieces */}
      <div className="mt-16 border-t border-border pt-12">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Pair with other rail pieces
          </h2>
          <Link
            to="/collection"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <span>All pieces</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {relatedItems.map((rel, idx) => {
            const relSize = selectedSizes[rel.id] ?? "M";
            const relColor = getItemColor(rel);
            return (
              <ProductCard
                key={rel.id}
                item={rel}
                index={idx}
                cardView="spin"
                chosenSize={relSize}
                activeColor={relColor}
                onSelectSize={(sz) => onSizeChange(rel.id, sz)}
                onSelectColor={(hex) => onColorChange(rel.id, hex)}
                onAddToBag={(rect) => onAddToBag(rel, relSize, relColor, rect)}
                onOpenModal={() => onOpenModal(rel, 0)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
