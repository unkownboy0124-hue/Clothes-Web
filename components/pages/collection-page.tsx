import * as React from "react";
import { Search, X } from "lucide-react";
import type { RailGarment } from "@/components/ui/product-rail-gallery";
import type { GarmentSize } from "@/components/product-inspector-modal";
import { ProductCard } from "@/components/product-card";
import { RAIL_DEMO_ITEMS } from "@/components/demo";
import {
  matchesCategory,
  parsePrice,
  type CardView,
  type CategoryFilter,
  type SortMode,
} from "@/lib/catalog-data";
import { Button } from "@/components/ui/button";

export function CollectionPage({
  category,
  onCategoryChange,
  cardView,
  onCardViewChange,
  sortMode,
  onSortModeChange,
  selectedSizes,
  getItemColor,
  onColorChange,
  onSizeChange,
  onAddToBag,
  onOpenModal,
}: {
  category: CategoryFilter;
  onCategoryChange: (c: CategoryFilter) => void;
  cardView: CardView;
  onCardViewChange: (v: CardView) => void;
  sortMode: SortMode;
  onSortModeChange: (s: SortMode) => void;
  selectedSizes: Record<string, GarmentSize>;
  getItemColor: (item: RailGarment) => string;
  onColorChange: (id: string, hex: string) => void;
  onSizeChange: (id: string, size: GarmentSize) => void;
  onAddToBag: (item: RailGarment, size: GarmentSize, color: string, fromRect?: DOMRect) => void;
  onOpenModal: (item: RailGarment, initialAngle?: number) => void;
}) {
  const [searchQuery, setSearchQuery] = React.useState("");

  const visibleItems = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = RAIL_DEMO_ITEMS.filter((item) => {
      if (!matchesCategory(item, category)) return false;
      if (!q) return true;
      const hay = [item.name, item.kind ?? "", item.description ?? "", ...(item.details ?? [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    if (sortMode === "price-asc") {
      filtered.sort((a, b) => parsePrice(a.tag) - parsePrice(b.tag));
    } else if (sortMode === "price-desc") {
      filtered.sort((a, b) => parsePrice(b.tag) - parsePrice(a.tag));
    }
    return filtered;
  }, [category, searchQuery, sortMode]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="flex flex-col justify-between gap-6 border-b border-border pb-8 lg:flex-row lg:items-end">
        <div className="space-y-2.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Season Archive · {visibleItems.length} of {RAIL_DEMO_ITEMS.length} pieces
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Full Studio Collection
          </h1>
          <p className="max-w-[54ch] text-sm leading-relaxed text-muted-foreground">
            Compare silhouettes in 360°, pick bespoke dye shades on each card, or click any garment
            title for full fabric provenance and turntable inspection.
          </p>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by fabric, cut, or name..."
            aria-label="Filter collection garments"
            className="min-h-[42px] w-full rounded-lg border border-border bg-card pl-9 pr-9 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category, Angle & Sort Controls */}
      <div className="mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div
          role="group"
          aria-label="Filter collection by category"
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
              className={`min-h-[34px] flex-1 whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors sm:flex-initial sm:px-3 sm:text-xs ${
                category === key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
          <div
            role="group"
            aria-label="Preview garment angle"
            className="flex w-full items-center gap-1 rounded-lg bg-muted p-1 sm:w-auto"
          >
            {(
              [
                ["spin", "Auto Spin"],
                ["front", "Front"],
                ["side", "Side"],
                ["back", "Back"],
              ] as const
            ).map(([view, label]) => (
              <button
                key={view}
                type="button"
                onClick={() => onCardViewChange(view)}
                className={`min-h-[36px] flex-1 whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:flex-initial sm:px-3 ${
                  cardView === view
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="flex w-full items-center gap-2 text-xs text-muted-foreground sm:w-auto">
            <span className="sr-only">Sort collection</span>
            <select
              aria-label="Sort collection"
              value={sortMode}
              onChange={(e) => onSortModeChange(e.target.value as SortMode)}
              className="min-h-[42px] w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
            >
              <option value="curated">Sort: Curated</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </label>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <p className="text-base font-medium text-foreground">No pieces match those filters</p>
          <p className="max-w-[40ch] text-sm text-muted-foreground">
            Clear your search term or reset the category selection to inspect all ten studio
            pieces.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearchQuery("");
              onCategoryChange("all");
            }}
            className="mt-2 min-h-[42px]"
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
          {visibleItems.map((item, idx) => {
            const chosenSize = selectedSizes[item.id] ?? "M";
            const activeColor = getItemColor(item);
            return (
              <ProductCard
                key={item.id}
                item={item}
                index={idx}
                cardView={cardView}
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
      )}
    </section>
  );
}
