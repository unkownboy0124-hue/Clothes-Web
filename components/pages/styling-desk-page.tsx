import type { RailGarment } from "@/components/ui/product-rail-gallery";
import { StylingDesk } from "@/components/styling-desk";
import { RAIL_DEMO_ITEMS } from "@/components/demo";

export function StylingDeskPage({
  activeItem,
  selectedColors,
  onInspectItem,
  onOpenModal,
  onAddCapsule,
}: {
  activeItem: RailGarment | null;
  selectedColors: Record<string, string>;
  onInspectItem: (id: string) => void;
  onOpenModal: (item: RailGarment) => void;
  onAddCapsule: (ids: string[]) => void;
}) {
  return (
    <StylingDesk
      standalone
      items={RAIL_DEMO_ITEMS}
      activeItem={activeItem}
      selectedColors={selectedColors}
      onInspectItem={onInspectItem}
      onOpenModal={onOpenModal}
      onAddCapsule={onAddCapsule}
    />
  );
}
