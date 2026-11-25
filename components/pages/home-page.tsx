import { ArrowRight, Moon, Sun } from "lucide-react";
import { ClothingRailHero } from "@/components/ui/product-rail-gallery";
import type { RailGarment } from "@/components/ui/product-rail-gallery";
import type { GarmentSize } from "@/components/product-inspector-modal";
import { ProductCard } from "@/components/product-card";
import { SpatialTryOnSection } from "@/components/spatial-try-on-section";
import { StudioBreezeScene } from "@/components/studio-breeze-scene";
import { RAIL_DEMO_ITEMS } from "@/components/demo";
import type { CategoryFilter } from "@/lib/catalog-data";
import { Link } from "@/lib/router";

const FEATURED_IDS = ["bone-tee", "cardigan-olive", "oxford-sky"];

export function HomePage({
  dark,
  onToggleDark,
  category,
  onCategoryChange,
  hangerMode,
  onHangerModeChange,
  autoplay,
  onToggleAutoplay,
  filteredItems,
  selectedColors,
  selectedSizes,
  getItemColor,
  onColorChange,
  onSizeChange,
  onAddToBag,
  onOpenModal,
  onInspectIndexChange,
  atelierImgFailed,
  onAtelierImgError,
}: {
  dark: boolean;
  onToggleDark: () => void;
  category: CategoryFilter;
  onCategoryChange: (c: CategoryFilter) => void;
  hangerMode: "none" | "wood" | "matte";
  onHangerModeChange: (m: "none" | "wood" | "matte") => void;
  autoplay: boolean;
  onToggleAutoplay: () => void;
  filteredItems: RailGarment[];
  selectedColors: Record<string, string>;
  selectedSizes: Record<string, GarmentSize>;
  getItemColor: (item: RailGarment) => string;
  onColorChange: (id: string, hex: string) => void;
  onSizeChange: (id: string, size: GarmentSize) => void;
  onAddToBag: (item: RailGarment, size: GarmentSize, color: string, fromRect?: DOMRect) => void;
  onOpenModal: (item: RailGarment, initialAngle?: number) => void;
  onInspectIndexChange: (index: number | null) => void;
  atelierImgFailed: boolean;
  onAtelierImgError: () => void;
}) {
  const featuredItems = FEATURED_IDS.map((id) =>
    RAIL_DEMO_ITEMS.find((it) => it.id === id),
  ).filter((it): it is RailGarment => Boolean(it));

  return (
    <>
      {/* Section 1: Interactive Product Rail Hero */}
      <section id="rail" className="border-b border-border">
        <div className="border-b border-border/60 bg-background">
          <div className="mx-auto flex max-w-6xl flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-3.5">
            <div
              role="group"
              aria-label="Filter rail by category"
              className="flex w-full items-center justify-between gap-1 overflow-x-auto rounded-lg bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto sm:justify-start"
            >
              {(
                [
                  ["all", "All (10)"],
                  ["tee", "Tees & Polo"],
                  ["knit", "Knit & Fleece"],
                  ["shirting", "Shirting"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onCategoryChange(key)}
                  className={`min-h-[32px] flex-1 whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors sm:flex-initial sm:px-3 sm:text-xs ${
                    category === key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
              <div
                role="group"
                aria-label="Hanger style"
                className="flex flex-1 items-center gap-1 rounded-lg bg-muted p-1 sm:flex-initial"
              >
                {(
                  [
                    ["none", "Studio Hook"],
                    ["wood", "Wood"],
                    ["matte", "Matte"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onHangerModeChange(mode)}
                    className={`min-h-[32px] flex-1 whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors sm:flex-initial sm:text-xs ${
                      hangerMode === mode
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                onClick={onToggleDark}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:w-9"
              >
                {dark ? <Sun className="size-4 sm:size-3.5" /> : <Moon className="size-4 sm:size-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <ClothingRailHero
          key={category}
          items={filteredItems}
          hanger={hangerMode}
          eyebrow="New season · Pieces on the rail"
          heading="A clothing rail you can handle, right on the page."
          caption="Brush along the rail, slide a hanger, or lift a piece to turn front and back."
          autoplay={autoplay}
          selectedColors={selectedColors}
          onColorChange={onColorChange}
          onItemClick={(item, index, face) => {
            onInspectIndexChange(index);
            onOpenModal(item, face === "back" ? 180 : 0);
          }}
          onOpenChange={onInspectIndexChange}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/collection"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background shadow-sm outline-none transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none whitespace-nowrap shrink-0"
              >
                <span>Explore Collection</span>
                <ArrowRight className="size-4" />
              </Link>
              <button
                type="button"
                onClick={onToggleAutoplay}
                className="rounded-full border border-border bg-card px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap shrink-0"
              >
                {autoplay ? "Pause rotation" : "Resume rotation"}
              </button>
            </div>
          }
        />
      </section>

      {/* Section 2: VirtualFit Spatial Try-On Arc (all 10 products synchronized) */}
      <SpatialTryOnSection
        items={RAIL_DEMO_ITEMS}
        selectedSizes={selectedSizes}
        getItemColor={getItemColor}
        onColorChange={onColorChange}
        onSizeChange={onSizeChange}
        onAddToBag={onAddToBag}
        onOpenModal={onOpenModal}
      />

      {/* Section 3: Highlighted Trio + Link to Full Collection Page */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="border-b border-border pb-6">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Curated Highlights
            </p>
            <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              Core seasonal silhouettes
            </h2>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
          {featuredItems.map((item, idx) => {
            const chosenSize = selectedSizes[item.id] ?? "M";
            const activeColor = getItemColor(item);
            return (
              <ProductCard
                key={item.id}
                item={item}
                index={idx}
                cardView="spin"
                chosenSize={chosenSize}
                activeColor={activeColor}
                onSelectSize={(sz) => onSizeChange(item.id, sz)}
                onSelectColor={(hex) => onColorChange(item.id, hex)}
                onAddToBag={(rect) => onAddToBag(item, chosenSize, activeColor, rect)}
                onOpenModal={() => onOpenModal(item, 0)}
              />
            );
          })}
        </div>

        <div className="mt-8 flex justify-center sm:mt-10">
          <Link
            to="/collection"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap shrink-0"
          >
            <span>Browse all 10 pieces</span>
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Section 3: Studio Chapters (Materials + Styling Desk routes) */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="grid items-stretch gap-8 border-t border-border pt-12 lg:grid-cols-12">
          <div className="overflow-hidden rounded-xl border border-border bg-muted/30 lg:col-span-7">
            {!atelierImgFailed ? (
              <StudioBreezeScene
                src="/src/assets/images/atelier_studio_rail_1795500631906.jpg"
                alt="Meridian Atelier design studio clothing rail and raw linen worktable"
                onError={onAtelierImgError}
                className="aspect-[16/10] w-full lg:h-full"
              />
            ) : (
              <div className="flex aspect-[16/10] items-center justify-center p-8 text-sm text-muted-foreground lg:h-full">
                Meridian Atelier Studio Rail
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between gap-6 rounded-xl border border-border bg-card p-6 sm:p-8 lg:col-span-5">
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Inside the Atelier
              </p>
              <h2 className="text-balance text-2xl font-semibold tracking-tight">
                Textiles from 175 gsm oxford to 400 gsm fleece.
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Explore mill provenance, weave specs, and garment care in the Materials Dossier, or
                build a weather-calibrated capsule at the Styling Desk.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 border-t border-border pt-5">
              <Link
                to="/materials"
                className="inline-flex min-h-[44px] items-center justify-between rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <span>Fabric & Materials Dossier</span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
              <Link
                to="/styling-desk"
                className="inline-flex min-h-[44px] items-center justify-between rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                <span>Consult the Styling Desk</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
