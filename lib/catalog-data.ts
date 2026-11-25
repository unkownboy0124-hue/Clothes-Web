import type { RailGarment } from "@/components/ui/product-rail-gallery";
import type { GarmentSize } from "@/components/product-inspector-modal";

export type CategoryFilter = "all" | "tee" | "knit" | "shirting";
export type CardView = "spin" | "front" | "side" | "back";
export type SortMode = "curated" | "price-asc" | "price-desc";
export type MaterialKey = "jersey" | "fleece" | "lambswool" | "oxford";

export const SIZES: GarmentSize[] = ["S", "M", "L", "XL"];
export const FREE_SHIPPING_THRESHOLD = 150;

export interface MaterialSpec {
  label: string;
  title: string;
  weight: string;
  origin: string;
  weave: string;
  care: string;
  summary: string;
  pieces: { id: string; name: string }[];
}

export const MATERIAL_SPECS: Record<MaterialKey, MaterialSpec> = {
  jersey: {
    label: "240 gsm Jersey",
    title: "Combed organic single-jersey",
    weight: "240 gsm",
    origin: "Porto, Portugal",
    weave: "Compact 20/1 ring-spun cotton",
    care: "Cold wash · Line dry",
    summary:
      "Dense enough to drape cleanly off the shoulder without clinging, finished with pre-shrunk enzyme washing so collars stay flat after repeated laundering.",
    pieces: [
      { id: "bone-tee", name: "Heavyweight tee · Bone" },
      { id: "cc-graphic", name: "Graphic tee · CCgather" },
      { id: "oversized-ochre", name: "Oversized tee · CCgather" },
    ],
  },
  fleece: {
    label: "400 gsm Fleece",
    title: "Unbrushed loop-back French terry",
    weight: "400 gsm",
    origin: "Guimarães, Portugal",
    weave: "Three-end diagonal loop-back",
    care: "30°C gentle · Dry flat",
    summary:
      "Structured heavyweight fleece engineered for year-round breathability, paired with 2×2 ribbed cuffs and hem bands that retain tension over seasons.",
    pieces: [
      { id: "hoodie-heather", name: "Hoodie · Maestiq" },
      { id: "sweat-lilac", name: "Crewneck sweatshirt · Lilac" },
    ],
  },
  lambswool: {
    label: "Lambswool Knit",
    title: "5-gauge carded virgin lambswool",
    weight: "360 gsm",
    origin: "Hawick, Scotland",
    weave: "Full-cardigan rib stitch",
    care: "Hand wash cold · Dry flat",
    summary:
      "Lofty three-ply lambswool spun for natural insulation and soft handfeel, closed with turned horn-finish wood buttons and reinforced buttonholes.",
    pieces: [
      { id: "cardigan-olive", name: "Knit cardigan · Olive" },
      { id: "breton", name: "Breton long sleeve" },
    ],
  },
  oxford: {
    label: "Oxford Cloth",
    title: "Long-staple basketweave shirting",
    weight: "175 gsm",
    origin: "Biella, Italy",
    weave: "2×1 yarn-dyed oxford",
    care: "Machine warm · Steam press",
    summary:
      "Crisp two-ply yarn-dyed oxford cotton softened through a light stone rinse for immediate collar roll and effortless indoor-to-outdoor layering.",
    pieces: [
      { id: "oxford-sky", name: "Oxford shirt · Sky" },
      { id: "polo-forest", name: "Piqué polo · Forest" },
      { id: "henley-brick", name: "Henley · Brick" },
    ],
  },
};

export function parsePrice(tag?: string): number {
  if (!tag) return 0;
  const numeric = Number(tag.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function matchesCategory(item: RailGarment, filter: CategoryFilter): boolean {
  if (filter === "all") return true;
  if (filter === "tee") return item.kind === "tee";
  if (filter === "knit") return item.kind === "knit" || item.kind === "hoodie";
  if (filter === "shirting") return item.kind === "shirt";
  return true;
}

export function getMaterialKeyForItem(item: RailGarment): MaterialKey {
  if (item.id === "hoodie-heather" || item.id === "sweat-lilac") return "fleece";
  if (item.id === "cardigan-olive" || item.id === "breton") return "lambswool";
  if (item.id === "oxford-sky" || item.id === "polo-forest" || item.id === "henley-brick") {
    return "oxford";
  }
  return "jersey";
}
