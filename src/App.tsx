import * as React from "react";
import { Check, Menu, Minus, Moon, Plus, ShoppingCart, Sun, X } from "lucide-react";
import type { RailGarment } from "@/components/ui/product-rail-gallery";
import { RAIL_DEMO_ITEMS } from "@/components/demo";
import { GarmentThumbnail } from "@/components/garment-thumbnail";
import type { GarmentSize } from "@/components/product-inspector-modal";
import { HomePage } from "@/components/pages/home-page";
import { FlyToCartLayer, type FlyRequest } from "@/components/fly-to-cart";
import {
  FREE_SHIPPING_THRESHOLD,
  matchesCategory,
  parsePrice,
  type CardView,
  type CategoryFilter,
  type SortMode,
} from "@/lib/catalog-data";
import { getColorName, warmGarmentCatalog } from "@/lib/garment-colors";
import { Link, RouterProvider, useRouter } from "@/lib/router";
import { Button } from "@/components/ui/button";

const CollectionPage = React.lazy(() =>
  import("@/components/pages/collection-page").then((m) => ({ default: m.CollectionPage })),
);
const ProductDetailPage = React.lazy(() =>
  import("@/components/pages/product-detail-page").then((m) => ({
    default: m.ProductDetailPage,
  })),
);
const MaterialsPage = React.lazy(() =>
  import("@/components/pages/materials-page").then((m) => ({ default: m.MaterialsPage })),
);
const StylingDeskPage = React.lazy(() =>
  import("@/components/pages/styling-desk-page").then((m) => ({ default: m.StylingDeskPage })),
);
const ProductInspectorModal = React.lazy(() =>
  import("@/components/product-inspector-modal").then((m) => ({
    default: m.ProductInspectorModal,
  })),
);

interface BagEntry {
  item: RailGarment;
  size: GarmentSize;
  color: string;
  quantity: number;
}

const NAV_LINKS = [
  { to: "/", label: "The Rail" },
  { to: "/collection", label: "Collection" },
  { to: "/materials", label: "Materials" },
  { to: "/styling-desk", label: "Styling Desk" },
] as const;

const STORAGE_KEYS = {
  dark: "meridian_dark",
  bag: "meridian_bag_v1",
  colors: "meridian_colors_v1",
  sizes: "meridian_sizes_v1",
} as const;

function readStorageJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function hydrateBag(): BagEntry[] {
  const saved = readStorageJson<Array<{ id: string; size: GarmentSize; color: string; quantity: number }>>(
    STORAGE_KEYS.bag,
    [],
  );
  const itemMap = new Map(RAIL_DEMO_ITEMS.map((it) => [it.id, it]));
  const result: BagEntry[] = [];
  for (const row of saved) {
    const item = itemMap.get(row.id);
    if (item && row.quantity > 0) {
      result.push({ item, size: row.size, color: row.color, quantity: row.quantity });
    }
  }
  return result;
}

function isRouteActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  if (to === "/collection") {
    return pathname === "/collection" || pathname.startsWith("/product/");
  }
  return pathname === to;
}

function StorefrontShell() {
  const { pathname, navigate } = useRouter();

  const [dark, setDark] = React.useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.dark) === "1";
    } catch {
      return false;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [category, setCategory] = React.useState<CategoryFilter>("all");
  const [hangerMode, setHangerMode] = React.useState<"none" | "wood" | "matte">("none");
  const [autoplay, setAutoplay] = React.useState(false);
  const [inspectedIndex, setInspectedIndex] = React.useState<number | null>(null);
  const [selectedSizes, setSelectedSizes] = React.useState<Record<string, GarmentSize>>(() =>
    readStorageJson(STORAGE_KEYS.sizes, {}),
  );
  const [selectedColors, setSelectedColors] = React.useState<Record<string, string>>(() =>
    readStorageJson(STORAGE_KEYS.colors, {}),
  );
  const [bag, setBag] = React.useState<BagEntry[]>(() => hydrateBag());
  const [bagOpen, setBagOpen] = React.useState(false);
  const [cartBadgePop, setCartBadgePop] = React.useState(false);
  const [flights, setFlights] = React.useState<FlyRequest[]>([]);
  const [orderConfirmedId, setOrderConfirmedId] = React.useState<string | null>(null);
  const [atelierImgFailed, setAtelierImgFailed] = React.useState(false);
  const [craftImgFailed, setCraftImgFailed] = React.useState(false);

  const [cardView, setCardView] = React.useState<CardView>("spin");
  const [sortMode, setSortMode] = React.useState<SortMode>("curated");
  const [modalItem, setModalItem] = React.useState<RailGarment | null>(null);
  const [modalInitialAngle, setModalInitialAngle] = React.useState(0);

  const cartButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const flightSeqRef = React.useRef(1);
  const popTimerRef = React.useRef<number | null>(null);

  const handleAtelierError = React.useCallback(() => setAtelierImgFailed(true), []);
  const handleCraftError = React.useCallback(() => setCraftImgFailed(true), []);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(STORAGE_KEYS.dark, dark ? "1" : "0");
    } catch {
      // Ignore storage quota errors
    }
  }, [dark]);

  React.useEffect(() => {
    try {
      const compact = bag.map((e) => ({
        id: e.item.id,
        size: e.size,
        color: e.color,
        quantity: e.quantity,
      }));
      localStorage.setItem(STORAGE_KEYS.bag, JSON.stringify(compact));
    } catch {
      // Ignore storage quota errors
    }
  }, [bag]);

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.colors, JSON.stringify(selectedColors));
    } catch {
      // Ignore
    }
  }, [selectedColors]);

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.sizes, JSON.stringify(selectedSizes));
    } catch {
      // Ignore
    }
  }, [selectedSizes]);

  React.useEffect(() => {
    warmGarmentCatalog(RAIL_DEMO_ITEMS);

    // Preload secondary route chunks during browser idle time for zero-delay route switches
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    const preloadRoutes = () => {
      void import("@/components/pages/collection-page");
      void import("@/components/pages/product-detail-page");
      void import("@/components/pages/materials-page");
      void import("@/components/pages/styling-desk-page");
      void import("@/components/product-inspector-modal");
    };
    if (typeof win.requestIdleCallback === "function") {
      win.requestIdleCallback(preloadRoutes, { timeout: 1500 });
    } else {
      window.setTimeout(preloadRoutes, 900);
    }
  }, []);

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const filteredItems = React.useMemo(
    () => RAIL_DEMO_ITEMS.filter((item) => matchesCategory(item, category)),
    [category],
  );

  const sortedCollectionItems = React.useMemo(() => {
    const list = [...filteredItems];
    if (sortMode === "price-asc") {
      list.sort((a, b) => parsePrice(a.tag) - parsePrice(b.tag));
    } else if (sortMode === "price-desc") {
      list.sort((a, b) => parsePrice(b.tag) - parsePrice(a.tag));
    }
    return list;
  }, [filteredItems, sortMode]);

  const totalItems = React.useMemo(
    () => bag.reduce((sum, entry) => sum + entry.quantity, 0),
    [bag],
  );

  const subtotal = React.useMemo(
    () => bag.reduce((sum, entry) => sum + parsePrice(entry.item.tag) * entry.quantity, 0),
    [bag],
  );

  const handleColorChange = React.useCallback((id: string, colorHex: string) => {
    setSelectedColors((prev) => ({ ...prev, [id]: colorHex }));
  }, []);

  const handleSizeChange = React.useCallback((id: string, size: GarmentSize) => {
    setSelectedSizes((prev) => ({ ...prev, [id]: size }));
  }, []);

  const getItemColor = React.useCallback(
    (item: RailGarment) => selectedColors[item.id] ?? item.color ?? "#EFEBE2",
    [selectedColors],
  );

  const triggerCartPop = React.useCallback(() => {
    setCartBadgePop(true);
    if (popTimerRef.current !== null) window.clearTimeout(popTimerRef.current);
    popTimerRef.current = window.setTimeout(() => setCartBadgePop(false), 320);
  }, []);

  const launchFlight = React.useCallback(
    (item: RailGarment, color: string, fromRect?: DOMRect) => {
      const rect = fromRect
        ? {
            left: fromRect.left,
            top: fromRect.top,
            width: fromRect.width,
            height: fromRect.height,
          }
        : {
            left: window.innerWidth * 0.5 - 48,
            top: window.innerHeight * 0.55 - 60,
            width: 96,
            height: 120,
          };
      const id = flightSeqRef.current++;
      setFlights((prev) => [...prev, { id, item, color, fromRect: rect }]);
    },
    [],
  );

  const handleFlightLand = React.useCallback(
    (flightId: number) => {
      setFlights((prev) => prev.filter((f) => f.id !== flightId));
      triggerCartPop();
    },
    [triggerCartPop],
  );

  const addToBag = React.useCallback(
    (
      item: RailGarment,
      size: GarmentSize = "M",
      colorOverride?: string,
      fromRect?: DOMRect,
    ) => {
      const color = colorOverride ?? getItemColor(item);
      setOrderConfirmedId(null);
      setBag((prev) => {
        const idx = prev.findIndex(
          (e) =>
            e.item.id === item.id &&
            e.size === size &&
            e.color.toUpperCase() === color.toUpperCase(),
        );
        if (idx >= 0) {
          return prev.map((e, i) => (i === idx ? { ...e, quantity: e.quantity + 1 } : e));
        }
        return [...prev, { item, size, color, quantity: 1 }];
      });
      launchFlight(item, color, fromRect);
    },
    [getItemColor, launchFlight],
  );

  const addCapsuleToBag = React.useCallback(
    (ids: string[], fromRects?: Record<string, DOMRect>) => {
      setOrderConfirmedId(null);
      const launched: Array<{ garment: RailGarment; color: string; rect?: DOMRect }> = [];
      setBag((prev) => {
        const next = [...prev];
        for (const id of ids) {
          const garment = RAIL_DEMO_ITEMS.find((it) => it.id === id);
          if (!garment) continue;
          const size: GarmentSize = selectedSizes[id] ?? "M";
          const color = getItemColor(garment);
          launched.push({ garment, color, rect: fromRects?.[id] });
          const idx = next.findIndex(
            (e) =>
              e.item.id === id &&
              e.size === size &&
              e.color.toUpperCase() === color.toUpperCase(),
          );
          if (idx >= 0) {
            next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          } else {
            next.push({ item: garment, size, color, quantity: 1 });
          }
        }
        return next;
      });
      launched.forEach(({ garment, color, rect }, i) => {
        window.setTimeout(() => launchFlight(garment, color, rect), i * 85);
      });
    },
    [getItemColor, selectedSizes, launchFlight],
  );

  const updateQuantity = (id: string, size: GarmentSize, color: string, delta: number) => {
    setBag((prev) =>
      prev
        .map((entry) =>
          entry.item.id === id &&
          entry.size === size &&
          entry.color.toUpperCase() === color.toUpperCase()
            ? { ...entry, quantity: entry.quantity + delta }
            : entry,
        )
        .filter((entry) => entry.quantity > 0),
    );
  };

  const inspectGarmentOnRail = React.useCallback(
    (id: string) => {
      setCategory("all");
      if (pathname !== "/") {
        navigate("/");
      }
      window.setTimeout(() => {
        const targetEl = document.getElementById("rail");
        targetEl?.scrollIntoView({ behavior: "smooth", block: "start" });
        const idx = RAIL_DEMO_ITEMS.findIndex((i) => i.id === id);
        if (idx >= 0) {
          const button = document.querySelector<HTMLButtonElement>(`[data-garment="${idx}"]`);
          button?.focus({ preventScroll: true });
        }
      }, 260);
    },
    [navigate, pathname],
  );

  const openModal = React.useCallback((item: RailGarment, initialAngle = 0) => {
    setModalInitialAngle(initialAngle);
    setModalItem(item);
  }, []);

  const activeItem = inspectedIndex !== null ? filteredItems[inspectedIndex] ?? null : null;
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  const renderPage = () => {
    if (pathname === "/collection") {
      return (
        <CollectionPage
          category={category}
          onCategoryChange={setCategory}
          cardView={cardView}
          onCardViewChange={setCardView}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          selectedSizes={selectedSizes}
          getItemColor={getItemColor}
          onColorChange={handleColorChange}
          onSizeChange={handleSizeChange}
          onAddToBag={addToBag}
          onOpenModal={openModal}
        />
      );
    }

    if (pathname.startsWith("/product/")) {
      const productId = decodeURIComponent(pathname.slice("/product/".length)).replace(/\/+$/, "");
      return (
        <ProductDetailPage
          productId={productId}
          selectedSizes={selectedSizes}
          getItemColor={getItemColor}
          onColorChange={handleColorChange}
          onSizeChange={handleSizeChange}
          onAddToBag={addToBag}
          onInspectOnRail={inspectGarmentOnRail}
          onOpenModal={openModal}
        />
      );
    }

    if (pathname === "/materials") {
      return (
        <MaterialsPage
          atelierImgFailed={atelierImgFailed}
          onAtelierImgError={handleAtelierError}
          craftImgFailed={craftImgFailed}
          onCraftImgError={handleCraftError}
        />
      );
    }

    if (pathname === "/styling-desk") {
      return (
        <StylingDeskPage
          activeItem={activeItem}
          selectedColors={selectedColors}
          onInspectItem={inspectGarmentOnRail}
          onOpenModal={(item) => openModal(item, 0)}
          onAddCapsule={addCapsuleToBag}
        />
      );
    }

    return (
      <HomePage
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
        category={category}
        onCategoryChange={setCategory}
        hangerMode={hangerMode}
        onHangerModeChange={setHangerMode}
        autoplay={autoplay}
        onToggleAutoplay={() => setAutoplay((a) => !a)}
        filteredItems={filteredItems}
        selectedColors={selectedColors}
        selectedSizes={selectedSizes}
        getItemColor={getItemColor}
        onColorChange={handleColorChange}
        onSizeChange={handleSizeChange}
        onAddToBag={addToBag}
        onOpenModal={openModal}
        onInspectIndexChange={setInspectedIndex}
        atelierImgFailed={atelierImgFailed}
        onAtelierImgError={handleAtelierError}
      />
    );
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
      {/* Top Bar: strict 3-zone contract */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:gap-8 sm:px-6 sm:py-4">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight text-foreground whitespace-nowrap shrink-0"
          >
            Meridian Atelier
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground"
          >
            {NAV_LINKS.map((link) => {
              const active = isRouteActive(pathname, link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap shrink-0 underline-offset-4 transition-colors hover:text-foreground hover:underline ${
                    active ? "text-foreground underline" : ""
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              ref={cartButtonRef}
              type="button"
              aria-label={`Open shopping bag (${totalItems} ${totalItems === 1 ? "item" : "items"})`}
              onClick={() => setBagOpen(true)}
              className={`relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-transform duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                cartBadgePop ? "scale-110" : "scale-100"
              }`}
            >
              <ShoppingCart className="size-4.5" />
              <span
                aria-hidden="true"
                className={`absolute -right-1.5 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-semibold leading-none tabular-nums ring-2 ring-background transition-[transform,background-color,color] duration-200 ${
                  cartBadgePop ? "scale-125" : "scale-100"
                } ${
                  totalItems > 0
                    ? "bg-foreground text-background"
                    : "bg-muted text-foreground"
                }`}
              >
                {totalItems}
              </span>
            </button>

            <button
              type="button"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            >
              {mobileMenuOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
            </button>
          </div>
        </div>

        {/* Mobile Multipage Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="border-t border-border bg-background px-4 py-3 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => {
                const active = isRouteActive(pathname, link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-[44px] items-center justify-between rounded-lg px-3 text-sm font-medium transition-colors ${
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <span>{link.label}</span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setDark((d) => !d)}
                className="mt-1 flex min-h-[44px] items-center justify-between rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground"
              >
                <span>{dark ? "Light Appearance" : "Dark Appearance"}</span>
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <React.Suspense
          fallback={<div className="mx-auto min-h-[60vh] max-w-6xl px-4 py-12 sm:px-6" />}
        >
          {renderPage()}
        </React.Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-10 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <p className="font-medium text-foreground">Meridian Atelier</p>
          <div className="flex flex-wrap items-center gap-5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`hover:text-foreground ${
                  isRouteActive(pathname, link.to) ? "font-medium text-foreground" : ""
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              <span>{dark ? "Light" : "Dark"}</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Flying Shirt to Cart Portal */}
      <FlyToCartLayer flights={flights} targetRef={cartButtonRef} onLand={handleFlightLand} />

      {/* 3D Interactive Product Inspector Modal */}
      {modalItem && (
        <React.Suspense fallback={null}>
          <ProductInspectorModal
            item={modalItem}
            items={sortedCollectionItems.length ? sortedCollectionItems : RAIL_DEMO_ITEMS}
            selectedSize={selectedSizes[modalItem.id] ?? "M"}
            selectedColor={getItemColor(modalItem)}
            initialAngle={modalInitialAngle}
            onSelectSize={(size) => handleSizeChange(modalItem.id, size)}
            onSelectColor={(colorHex) => handleColorChange(modalItem.id, colorHex)}
            onSelectItem={(next) => openModal(next, 0)}
            onAddToBag={(it, sz, fromRect) => addToBag(it, sz, getItemColor(it), fromRect)}
            onInspectOnRail={inspectGarmentOnRail}
            onClose={() => setModalItem(null)}
          />
        </React.Suspense>
      )}

      {/* Shopping Bag Drawer */}
      {bagOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Shopping bag"
          className="fixed inset-0 z-50 flex justify-end"
        >
          <div
            aria-hidden="true"
            className="fixed inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setBagOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-card text-card-foreground shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6 sm:py-5">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Shopping Bag</h2>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {totalItems} {totalItems === 1 ? "piece" : "pieces"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close bag"
                onClick={() => setBagOpen(false)}
                className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {orderConfirmedId ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className="flex size-11 items-center justify-center rounded-full border border-border bg-muted text-foreground">
                    <Check className="size-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-semibold tracking-tight">
                      Order #{orderConfirmedId} Confirmed
                    </h3>
                    <p className="max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
                      Your Meridian Atelier parcel is queued for studio dispatch.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setOrderConfirmedId(null);
                      setBagOpen(false);
                    }}
                    className="min-h-[44px]"
                  >
                    Continue Browsing
                  </Button>
                </div>
              ) : bag.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm font-medium text-foreground">Your bag is empty</p>
                  <p className="max-w-[32ch] text-xs leading-relaxed text-muted-foreground">
                    Select any piece from the rail or collection grid to add it here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {bag.map((entry) => (
                    <li
                      key={`${entry.item.id}-${entry.size}-${entry.color}`}
                      className="flex items-center gap-4 py-4 first:pt-0"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setBagOpen(false);
                          navigate(`/product/${entry.item.id}`);
                        }}
                        aria-label={`View ${entry.item.name}`}
                        className="h-20 w-16 shrink-0 overflow-hidden rounded-md bg-muted/40 p-1.5"
                      >
                        <GarmentThumbnail item={entry.item} colorOverride={entry.color} />
                      </button>
                      <div className="min-w-0 flex-1 space-y-1">
                        <Link
                          to={`/product/${entry.item.id}`}
                          onClick={() => setBagOpen(false)}
                          className="block truncate text-sm font-medium text-foreground hover:underline"
                        >
                          {entry.item.name}
                        </Link>
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            className="inline-block size-2.5 rounded-full border border-foreground/20"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span>{getColorName(entry.color)}</span>
                          <span aria-hidden="true">·</span>
                          <span>Size {entry.size}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{entry.item.tag}</span>
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${entry.item.name}`}
                            onClick={() => updateQuantity(entry.item.id, entry.size, entry.color, -1)}
                            className="inline-flex size-9 items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-6 text-center font-mono text-xs tabular-nums">
                            {entry.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${entry.item.name}`}
                            onClick={() => updateQuantity(entry.item.id, entry.size, entry.color, 1)}
                            className="inline-flex size-9 items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="font-mono text-sm font-medium tabular-nums text-foreground">
                        ${parsePrice(entry.item.tag) * entry.quantity}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {bag.length > 0 && !orderConfirmedId && (
              <div className="space-y-4 border-t border-border px-5 py-5 sm:px-6">
                <p className="text-xs text-muted-foreground">
                  {remainingForFreeShipping === 0
                    ? "Complimentary express studio shipping unlocked."
                    : `Add $${remainingForFreeShipping} more for complimentary shipping.`}
                </p>
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">${subtotal}</span>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    const id = String(1040 + Math.floor(Math.random() * 900));
                    setBag([]);
                    setOrderConfirmedId(id);
                  }}
                  className="min-h-[46px] w-full py-2.5"
                >
                  Place Studio Order
                </Button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <StorefrontShell />
    </RouterProvider>
  );
}
