import * as React from "react";
import { ArrowRight } from "lucide-react";
import { StudioBreezeScene } from "@/components/studio-breeze-scene";
import { MATERIAL_SPECS, type MaterialKey } from "@/lib/catalog-data";
import { Link } from "@/lib/router";

export function MaterialsPage({
  atelierImgFailed,
  onAtelierImgError,
  craftImgFailed,
  onCraftImgError,
}: {
  atelierImgFailed: boolean;
  onAtelierImgError: () => void;
  craftImgFailed: boolean;
  onCraftImgError: () => void;
}) {
  const [activeMaterial, setActiveMaterial] = React.useState<MaterialKey>("jersey");
  const currentMaterial = MATERIAL_SPECS[activeMaterial];

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="space-y-3 border-b border-border pb-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Fabric & Construction Dossier
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Weighted cottons, brushed loop-back, and honest lambswool.
        </h1>
        <p className="max-w-[58ch] text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          Every piece on the Meridian Atelier rail is milled for clean architectural drape and
          multi-season durability. Inspect each textile specification and jump straight to the
          garments cut from it.
        </p>
      </div>

      <div className="mt-10 grid items-stretch gap-8 lg:grid-cols-12">
        <div className="flex flex-col justify-between gap-6 lg:col-span-6">
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div
              role="tablist"
              aria-label="Material specifications"
              className="flex flex-wrap gap-1.5 rounded-lg bg-muted p-1"
            >
              {(Object.keys(MATERIAL_SPECS) as MaterialKey[]).map((key) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={activeMaterial === key}
                  type="button"
                  onClick={() => setActiveMaterial(key)}
                  className={`min-h-[38px] flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeMaterial === key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {MATERIAL_SPECS[key].label}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{currentMaterial.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {currentMaterial.summary}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Density</dt>
                  <dd className="mt-0.5 font-mono font-medium tabular-nums text-foreground">
                    {currentMaterial.weight}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Mill Origin</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{currentMaterial.origin}</dd>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <dt className="text-muted-foreground">Care</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{currentMaterial.care}</dd>
                </div>
              </dl>

              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground">Garments in this cloth</p>
                <div className="flex flex-wrap gap-2">
                  {currentMaterial.pieces.map((piece) => (
                    <Link
                      key={piece.id}
                      to={`/product/${piece.id}`}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <span>{piece.name}</span>
                      <ArrowRight className="size-3 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h3 className="text-sm font-semibold tracking-tight">Mill Provenance Matrix</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2.5 pr-4 font-medium">Textile</th>
                    <th className="pb-2.5 pr-4 font-medium">Weight</th>
                    <th className="pb-2.5 pr-4 font-medium">Origin</th>
                    <th className="pb-2.5 font-medium">Weave</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {(Object.keys(MATERIAL_SPECS) as MaterialKey[]).map((key) => {
                    const spec = MATERIAL_SPECS[key];
                    return (
                      <tr key={key}>
                        <td className="py-2.5 pr-4 font-medium text-foreground">{spec.label}</td>
                        <td className="py-2.5 pr-4 font-mono tabular-nums text-muted-foreground">
                          {spec.weight}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{spec.origin}</td>
                        <td className="py-2.5 text-muted-foreground">{spec.weave}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:col-span-6 lg:grid-cols-1">
          <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
            {!atelierImgFailed ? (
              <StudioBreezeScene
                src="/src/assets/images/atelier_studio_rail_1795500631906.jpg"
                alt="Meridian Atelier design studio clothing rail and raw linen worktable"
                onError={onAtelierImgError}
                className="aspect-[16/10] w-full"
              />
            ) : (
              <div className="flex aspect-[16/10] items-center justify-center p-8 text-sm text-muted-foreground">
                Meridian Atelier Studio Rail
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
            {!craftImgFailed ? (
              <img
                src="/src/assets/images/heavyweight_textile_craft_1795500632505.jpg"
                alt="Folded bone cotton jersey, olive lambswool cardigan, and sky oxford shirting"
                referrerPolicy="no-referrer"
                onError={onCraftImgError}
                className="aspect-[16/10] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[16/10] items-center justify-center p-6 text-xs text-muted-foreground">
                240 gsm organic cotton · Lambswool knit · Oxford shirting
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
