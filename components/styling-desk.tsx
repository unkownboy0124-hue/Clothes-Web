import * as React from "react";
import { ArrowUpRight, Loader2, RotateCcw, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GarmentThumbnail } from "@/components/garment-thumbnail";
import type { RailGarment } from "@/components/ui/product-rail-gallery";

interface LayerStep {
  itemId: string;
  role: string;
  note: string;
}

interface StylingAdviceResponse {
  headline: string;
  rationale: string;
  recommendedIds: string[];
  layeringOrder: LayerStep[];
  careNote: string;
}

const SAMPLE_PROMPTS = [
  "Build a 4-piece autumn weekend capsule for cool coastal wind and indoor studio work.",
  "Compare the 400 gsm fleece pieces against the lambswool cardigan for temperature layering.",
  "Suggest an understated tonal pairing around the Bone tee and Olive cardigan.",
];

export function StylingDesk({
  items,
  activeItem,
  selectedColors,
  onInspectItem,
  onOpenModal,
  onAddCapsule,
  standalone = false,
}: {
  items: RailGarment[];
  activeItem: RailGarment | null;
  selectedColors?: Record<string, string>;
  onInspectItem: (id: string) => void;
  onOpenModal: (item: RailGarment) => void;
  onAddCapsule: (ids: string[], fromRects?: Record<string, DOMRect>) => void;
  standalone?: boolean;
}) {
  const [query, setQuery] = React.useState(SAMPLE_PROMPTS[0]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [advice, setAdvice] = React.useState<StylingAdviceResponse | null>(null);
  const thumbRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const itemMap = React.useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );

  const submitQuery = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/styling-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          focusId: activeItem?.id ?? null,
          items: items.map(({ id, name, kind, tag, description, details }) => ({
            id,
            name,
            kind,
            tag,
            description,
            details,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to generate styling recommendations.");
      }
      setAdvice(data as StylingAdviceResponse);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reach the styling desk.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitQuery(query);
  };

  const validRecommendedIds = (advice?.recommendedIds ?? []).filter((id) => itemMap.has(id));

  return (
    <section
      id="styling-desk"
      aria-labelledby="styling-desk-heading"
      className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${standalone ? "py-10 sm:py-16" : "py-16 sm:py-24"}`}
    >
      <div className={standalone ? "" : "border-t border-border pt-12 sm:pt-16"}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-14">
          <div className="flex flex-col gap-6">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Wardrobe & Layering Desk
              </p>
              <h2
                id="styling-desk-heading"
                className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl"
              >
                Ask for a capsule build, fabric comparison, or tonal pairing.
              </h2>
              <p className="max-w-[56ch] text-[15px] leading-relaxed text-muted-foreground">
                Describe climate, travel duration, or layering constraints across the ten rail pieces.
                Deep reasoning weighs fabric gsm weights, silhouette proportions, and care.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label htmlFor="styling-query" className="sr-only">
                Styling or capsule question
              </label>
              <textarea
                id="styling-query"
                rows={3}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Describe weather, itinerary, or pieces you want to pair..."
                className="w-full resize-y rounded-lg border border-input bg-card px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-muted-foreground">
                  {activeItem ? `Rail focus: ${activeItem.name}` : "Evaluating all 10 rail garments"}
                </span>
                <div className="flex items-center gap-2">
                  {advice && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setAdvice(null);
                        setError(null);
                      }}
                      className="min-h-[44px] whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="mr-1.5 size-3.5" />
                      Clear
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={loading || !query.trim()}
                    className="min-h-[44px] flex-1 whitespace-nowrap shrink-0 px-5 sm:flex-initial"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Analyzing rail...
                      </>
                    ) : (
                      "Consult Stylist"
                    )}
                  </Button>
                </div>
              </div>
            </form>

            <div className="space-y-2.5 border-t border-border pt-5">
              <p className="text-xs font-medium text-muted-foreground">Suggested briefs</p>
              <div className="flex flex-col items-start gap-2.5">
                {SAMPLE_PROMPTS.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setQuery(sample);
                      void submitQuery(sample);
                    }}
                    className="min-h-[36px] text-left text-xs leading-relaxed text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 sm:p-8">
            {loading ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  Evaluating fabric weights and proportions
                </p>
                <p className="max-w-[38ch] text-xs leading-relaxed text-muted-foreground">
                  Balancing 220–400 gsm textiles, silhouette drape, and tonal contrast across the rail.
                </p>
              </div>
            ) : error ? (
              <div className="flex min-h-[240px] flex-col items-start justify-center gap-4">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-destructive">
                    Styling desk temporarily unavailable
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{error}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void submitQuery(query)}
                  className="min-h-[42px]"
                >
                  <RotateCcw className="mr-1.5 size-3.5" />
                  Try Again
                </Button>
              </div>
            ) : advice ? (
              <div className="flex flex-col gap-6">
                <div className="space-y-2 border-b border-border pb-5">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Recommended Edit
                  </p>
                  <h3 className="text-xl font-semibold tracking-tight">{advice.headline}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{advice.rationale}</p>
                </div>

                {advice.layeringOrder.length > 0 && (
                  <div className="space-y-3">
                    {advice.layeringOrder.map((step) => {
                      const garment = itemMap.get(step.itemId);
                      if (!garment) return null;
                      return (
                        <div
                          key={`${step.itemId}-${step.role}`}
                          className="flex items-center gap-3.5 border-b border-border/70 pb-3.5 last:border-b-0 last:pb-0 sm:gap-4"
                        >
                          <button
                            ref={(node) => {
                              thumbRefs.current[garment.id] = node;
                            }}
                            type="button"
                            onClick={() => onOpenModal(garment)}
                            aria-label={`Rotate and inspect ${garment.name}`}
                            className="h-16 w-14 shrink-0 overflow-hidden rounded-md bg-muted/50 p-1 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <GarmentThumbnail
                              item={garment}
                              colorOverride={selectedColors?.[garment.id]}
                            />
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => onOpenModal(garment)}
                                className="truncate text-left text-sm font-medium text-foreground hover:underline underline-offset-4"
                              >
                                {garment.name}
                              </button>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {garment.tag}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {step.role} · {step.note}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onInspectItem(garment.id)}
                            aria-label={`Locate ${garment.name} on rail`}
                            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <ArrowUpRight className="size-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-relaxed text-muted-foreground">{advice.careNote}</p>
                  {validRecommendedIds.length > 0 && (
                    <Button
                      type="button"
                      onClick={() => {
                        const rects: Record<string, DOMRect> = {};
                        for (const id of validRecommendedIds) {
                          const r = thumbRefs.current[id]?.getBoundingClientRect();
                          if (r) rects[id] = r;
                        }
                        onAddCapsule(validRecommendedIds, rects);
                      }}
                      className="min-h-[44px] whitespace-nowrap shrink-0"
                    >
                      <ShoppingBag className="mr-1.5 size-3.5" />
                      Add Edit ({validRecommendedIds.length})
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[280px] flex-col justify-between gap-6">
                <div className="space-y-2.5">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Stylist Notes Ready
                  </p>
                  <h3 className="text-lg font-medium tracking-tight">
                    Ten seasonal essentials calibrated for layering
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    From 220 gsm boat-neck stripes and 240 gsm organic jersey tees to 400 gsm fleece
                    and chunky lambswool knitwear, submit a brief on the left to build a tailored
                    capsule from the rail.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 border-t border-border pt-5 text-xs">
                  <div>
                    <p className="font-mono text-base font-semibold tabular-nums text-foreground">
                      220–400
                    </p>
                    <p className="text-muted-foreground">Fabric weight (gsm)</p>
                  </div>
                  <div>
                    <p className="font-mono text-base font-semibold tabular-nums text-foreground">
                      10
                    </p>
                    <p className="text-muted-foreground">Pieces on the rail</p>
                  </div>
                  <div>
                    <p className="font-mono text-base font-semibold tabular-nums text-foreground">
                      $48–$96
                    </p>
                    <p className="text-muted-foreground">Studio pricing</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
