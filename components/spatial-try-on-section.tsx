import * as React from "react";
import { createPortal } from "react-dom";
import type { RailGarment } from "@/components/ui/product-rail-gallery";
import type { GarmentSize } from "@/components/product-inspector-modal";
import { GarmentThumbnail } from "@/components/garment-thumbnail";
import { matchesCategory, SIZES, type CategoryFilter } from "@/lib/catalog-data";
import {
  getColorName,
  getColorOptionsForItem,
  preloadTintedGarmentAngles,
} from "@/lib/garment-colors";
import { useRouter } from "@/lib/router";

const MODEL_POSE_X: Record<string, number> = {
  "bone-tee": 0.37,
  "cc-graphic": 99.35,
  "oxford-sky": 49.86,
  "cardigan-olive": 25.0,
  "hoodie-heather": 74.77,
  "sweat-lilac": 25.0,
  "polo-forest": 49.86,
  "henley-brick": 25.0,
  breton: 99.35,
  "oversized-ochre": 0.37,
};

function getModelPoseX(item: RailGarment): number {
  if (item.id in MODEL_POSE_X) return MODEL_POSE_X[item.id];
  if (item.kind === "shirt") return 49.86;
  if (item.kind === "hoodie") return 74.77;
  if (item.kind === "knit") return 25.0;
  return 0.37;
}

const TABS: ReadonlyArray<{ key: CategoryFilter; label: string }> = [
  { key: "all", label: "All (10)" },
  { key: "tee", label: "Tees & Polo" },
  { key: "knit", label: "Knit & Fleece" },
  { key: "shirting", label: "Shirting" },
];

const EASE = "cubic-bezier(.2,.8,.2,1)";
const SCAN_EASE = "cubic-bezier(.65,0,.35,1)";
const mod = (n: number, m: number) => ((n % m) + m) % m;

function circularOffset(index: number, pos: number, count: number): number {
  if (count <= 1) return 1;
  const half = count / 2;
  return mod(index - pos + half, count) - half;
}

export function SpatialTryOnSection({
  items,
  selectedSizes,
  getItemColor,
  onColorChange,
  onSizeChange,
  onAddToBag,
  onOpenModal,
}: {
  items: RailGarment[];
  selectedSizes: Record<string, GarmentSize>;
  getItemColor: (item: RailGarment) => string;
  onColorChange: (id: string, colorHex: string) => void;
  onSizeChange: (id: string, size: GarmentSize) => void;
  onAddToBag: (
    item: RailGarment,
    size: GarmentSize,
    color: string,
    fromRect?: DOMRect,
  ) => void;
  onOpenModal: (item: RailGarment, initialAngle?: number) => void;
}) {
  const { navigate } = useRouter();
  const sectionRef = React.useRef<HTMLElement | null>(null);
  const roomRef = React.useRef<HTMLDivElement | null>(null);
  const ghostRef = React.useRef<HTMLDivElement | null>(null);
  const tabsRef = React.useRef<HTMLElement | null>(null);
  const tabPillRef = React.useRef<HTMLDivElement | null>(null);
  const tabBtnRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const sheenRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const mCurRef = React.useRef<HTMLDivElement | null>(null);
  const mNextRef = React.useRef<HTMLDivElement | null>(null);
  const scanGridRef = React.useRef<HTMLDivElement | null>(null);
  const scanLineRef = React.useRef<HTMLDivElement | null>(null);
  const bThumbWrapRef = React.useRef<HTMLDivElement | null>(null);
  const bThumbRef = React.useRef<HTMLDivElement | null>(null);
  const bNameRef = React.useRef<HTMLDivElement | null>(null);
  const bPriceRef = React.useRef<HTMLDivElement | null>(null);
  const bColorRef = React.useRef<HTMLDivElement | null>(null);
  const curRef = React.useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = React.useState(0);
  const activeTabRef = React.useRef(0);
  const [activeTool, setActiveTool] = React.useState(0);
  const [currentItemIdx, setCurrentItemIdx] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);
  const [justAdded, setJustAdded] = React.useState(false);
  const addedTimerRef = React.useRef<number | null>(null);

  const visibleItems = React.useMemo(() => {
    const cat = TABS[activeTab]?.key ?? "all";
    const list = items.filter((item) => matchesCategory(item, cat));
    return list.length ? list : items;
  }, [activeTab, items]);

  const visibleItemsRef = React.useRef<RailGarment[]>(visibleItems);
  visibleItemsRef.current = visibleItems;

  const count = visibleItems.length;
  const safeIdx = count > 0 ? mod(currentItemIdx, count) : 0;
  const activeItem = visibleItems[safeIdx] ?? items[0];

  const getItemColorRef = React.useRef(getItemColor);
  getItemColorRef.current = getItemColor;

  const engineRef = React.useRef({
    W: 1200,
    H: 800,
    XS: [0, 258, 414, 518, 588, 624],
    reduced: false,
    pos: 0,
    target: 0,
    count: visibleItems.length,
    intro: 0,
    dragging: false,
    startX: 0,
    startY: 0,
    p0: 0,
    moved: 0,
    lastX: 0,
    lastT: 0,
    vx: 0,
    downCardIdx: null as number | null,
    tx: 600,
    ty: 400,
    cx: 600,
    cy: 400,
    tsx: 0,
    tsy: 0,
    sx: 0,
    sy: 0,
    curVisible: false,
    hoverTarget: null as EventTarget | null,
    shownKey: "",
    scanAnims: [] as Animation[],
    scanToken: 0,
    wheelAcc: 0,
    lastWheel: 0,
    inView: false,
    raf: 0,
  });

  React.useEffect(() => {
    setMounted(true);
    return () => {
      if (addedTimerRef.current !== null) window.clearTimeout(addedTimerRef.current);
    };
  }, []);

  const positionTabPill = React.useCallback((idx: number) => {
    const btn = tabBtnRefs.current[idx];
    const pill = tabPillRef.current;
    if (!btn || !pill) return;
    pill.style.width = `${btn.offsetWidth}px`;
    pill.style.transform = `translateX(${btn.offsetLeft}px)`;
  }, []);

  const rollText = React.useCallback((el: HTMLDivElement | null, text: string) => {
    if (!el) return;
    const reduced = engineRef.current.reduced;
    const cur = el.lastElementChild;
    if (cur && cur.textContent === text) return;
    if (reduced || !cur) {
      el.innerHTML = "";
      const s = document.createElement("span");
      s.textContent = text;
      el.appendChild(s);
      return;
    }
    const next = document.createElement("span");
    next.textContent = text;
    el.appendChild(next);

    const oldAnim = cur.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(-110%)" }],
      { duration: 620, easing: EASE, fill: "forwards" },
    );
    oldAnim.onfinish = () => {
      if (cur.parentNode === el) cur.remove();
    };

    next.animate(
      [{ transform: "translateY(110%)" }, { transform: "translateY(0)" }],
      { duration: 620, easing: EASE },
    );
  }, []);

  const updateBuy = React.useCallback(
    (itemIdx: number, item: RailGarment) => {
      const thumb = bThumbRef.current;
      if (thumb && !engineRef.current.reduced) {
        thumb.getAnimations().forEach((a) => a.cancel());
        thumb.animate(
          [{ transform: "translateY(70%) scale(.8)" }, { transform: "translateY(0) scale(1)" }],
          { duration: 650, easing: EASE },
        );
      }
      const activeColorHex = getItemColorRef.current(item);
      rollText(bNameRef.current, item.name);
      rollText(bPriceRef.current, item.tag ?? "$0");
      rollText(bColorRef.current, `Color · ${getColorName(activeColorHex)}`);
      setCurrentItemIdx(itemIdx);
    },
    [rollText],
  );

  const cancelScan = React.useCallback(() => {
    const s = engineRef.current;
    s.scanAnims.forEach((a) => a.cancel());
    s.scanAnims = [];
  }, []);

  const tryOn = React.useCallback(
    (idx: number) => {
      const s = engineRef.current;
      const list = visibleItemsRef.current;
      const item = list[idx];
      const mCur = mCurRef.current;
      const mNext = mNextRef.current;
      const scanGrid = scanGridRef.current;
      const scanLine = scanLineRef.current;
      if (!item || !mCur || !mNext) return;

      const poseX = getModelPoseX(item);
      s.shownKey = `${item.id}:${idx}`;
      const token = ++s.scanToken;
      updateBuy(idx, item);
      cancelScan();

      preloadTintedGarmentAngles(
        [item.image, item.sideImage, item.backImage],
        item.color,
        getItemColorRef.current(item),
        0.11,
      );

      if (s.reduced) {
        mCur.style.backgroundPositionX = `${poseX}%`;
        mCur.style.opacity = "1";
        return;
      }

      mNext.style.backgroundPositionX = `${poseX}%`;

      const aClip = mNext.animate(
        [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)" }],
        { duration: 950, easing: SCAN_EASE, fill: "forwards" },
      );
      const aSettle = mNext.animate(
        [{ transform: "scale(1.012)" }, { transform: "scale(1)" }],
        { duration: 1250, easing: "ease-out" },
      );

      const anims: Animation[] = [aClip, aSettle];
      if (scanGrid) {
        anims.push(
          scanGrid.animate(
            [
              { clipPath: "inset(0 0 100% 0)", offset: 0 },
              { clipPath: "inset(0 0 0 0)", offset: 0.5 },
              { clipPath: "inset(100% 0 0 0)", offset: 1 },
            ],
            { duration: 1092, easing: SCAN_EASE },
          ),
        );
      }
      if (scanLine) {
        anims.push(
          scanLine.animate(
            [
              { top: "0%", transform: "scaleX(.2)", opacity: 0, offset: 0 },
              { top: "6%", transform: "scaleX(1)", opacity: 1, offset: 0.08 },
              { top: "94%", transform: "scaleX(1)", opacity: 1, offset: 0.92 },
              { top: "100%", transform: "scaleX(.2)", opacity: 0, offset: 1 },
            ],
            { duration: 950, easing: SCAN_EASE },
          ),
        );
      }

      s.scanAnims = anims;
      aClip.onfinish = () => {
        if (token !== s.scanToken) return;
        mCur.style.backgroundPositionX = `${poseX}%`;
        mCur.style.opacity = "1";
        cancelScan();
      };
    },
    [cancelScan, updateBuy],
  );

  // Sync engine count when category tab changes
  React.useEffect(() => {
    const s = engineRef.current;
    s.count = count;
    s.pos = 0;
    s.target = 0;
    s.shownKey = "";
    cardRefs.current.length = count;
    sheenRefs.current.length = count;
    setCurrentItemIdx(0);
  }, [count, activeTab]);

  // Keep rolling color label synced if active color changes globally (e.g. from Hero Rail)
  const activeColor = getItemColor(activeItem);
  React.useEffect(() => {
    rollText(bColorRef.current, `Color · ${getColorName(activeColor)}`);
  }, [activeColor, rollText]);

  React.useLayoutEffect(() => {
    activeTabRef.current = activeTab;
    positionTabPill(activeTab);
  }, [activeTab, positionTabPill]);

  React.useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const first = visibleItemsRef.current[0];
    if (first) {
      rollText(bNameRef.current, first.name);
      rollText(bPriceRef.current, first.tag ?? "$0");
      rollText(bColorRef.current, `Color · ${getColorName(getItemColorRef.current(first))}`);
    }

    const rmq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReduced = () => {
      engineRef.current.reduced = rmq.matches;
      if (rmq.matches) engineRef.current.intro = 1;
    };
    syncReduced();
    rmq.addEventListener("change", syncReduced);

    const measure = () => {
      const rect = section.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      const phone = window.innerWidth <= 767;
      const cw = phone ? Math.min(w * 0.3, 170) : Math.min(w * 0.148, h * 0.33);
      section.style.setProperty("--CW", `${cw.toFixed(2)}px`);
      const xs = phone ? [0, 0.36, 0.5, 0.56, 0.6, 0.62] : [0, 0.215, 0.345, 0.432, 0.49, 0.52];
      engineRef.current.W = w;
      engineRef.current.H = h;
      engineRef.current.XS = xs.map((v) => v * w);
      positionTabPill(activeTabRef.current);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(section);

    document.fonts?.ready.then(() => {
      positionTabPill(activeTabRef.current);
    });

    const updateCursorClass = () => {
      const curEl = curRef.current;
      const s = engineRef.current;
      if (!curEl) return;
      curEl.classList.remove("is-try", "is-drag", "is-btn");
      if (s.dragging) {
        curEl.classList.add("is-drag");
        return;
      }
      const el = s.hoverTarget as HTMLElement | null;
      if (!el || typeof el.closest !== "function") return;
      if (el.closest("#spatial-studio button")) {
        curEl.classList.add("is-btn");
      } else if (el.closest(".vf-card")) {
        curEl.classList.add("is-try");
      } else if (el.closest(".vf-stage")) {
        curEl.classList.add("is-drag");
      }
    };

    const onWindowPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && engineRef.current.curVisible) {
        curRef.current?.classList.add("is-down");
      }
    };

    const onWindowPointerMove = (e: PointerEvent) => {
      const s = engineRef.current;
      const curEl = curRef.current;
      const rect = section.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (inside || s.dragging) {
        s.tx = e.clientX;
        s.ty = e.clientY;
        s.tsx = (e.clientX - rect.left) / Math.max(1, s.W) - 0.5;
        s.tsy = (e.clientY - rect.top) / Math.max(1, s.H) - 0.5;
        s.hoverTarget = e.target;

        if (!s.curVisible && e.pointerType === "mouse" && curEl) {
          s.curVisible = true;
          s.cx = s.tx;
          s.cy = s.ty;
          curEl.style.opacity = "1";
        }
      } else if (s.curVisible && curEl) {
        s.curVisible = false;
        curEl.style.opacity = "0";
      }

      if (s.dragging) {
        const dx = e.clientX - s.startX;
        s.moved = Math.hypot(dx, e.clientY - s.startY);
        s.pos = s.p0 - dx / Math.max(1, s.XS[1]);
        const now = performance.now();
        const dt = now - s.lastT;
        if (dt > 0) {
          const inst = (e.clientX - s.lastX) / dt;
          s.vx = s.vx * 0.6 + inst * 0.4;
          s.lastX = e.clientX;
          s.lastT = now;
        }
      }

      updateCursorClass();
    };

    const endDrag = (e?: PointerEvent) => {
      const s = engineRef.current;
      curRef.current?.classList.remove("is-down");
      if (!s.dragging) return;
      s.dragging = false;

      const n = s.count;
      if (s.moved < 6 && s.downCardIdx !== null && n > 1) {
        const u = circularOffset(s.downCardIdx, s.pos, n);
        s.target = Math.round(s.pos + u);
      } else if (n > 1) {
        if (performance.now() - s.lastT > 80) s.vx = 0;
        s.target = Math.round(s.pos - s.vx * 3.2);
      }
      s.downCardIdx = null;
      if (e?.target) s.hoverTarget = e.target;
      updateCursorClass();
    };

    const onMouseLeaveSection = () => {
      const s = engineRef.current;
      if (s.dragging) return;
      s.curVisible = false;
      if (curRef.current) curRef.current.style.opacity = "0";
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!engineRef.current.inView) return;
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") return;
      const focusedOutside =
        document.activeElement &&
        document.activeElement !== document.body &&
        !section.contains(document.activeElement);
      if (focusedOutside) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        engineRef.current.target -= 1;
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        engineRef.current.target += 1;
      }
    };

    window.addEventListener("pointerdown", onWindowPointerDown);
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("keydown", onKeyDown);
    section.addEventListener("mouseleave", onMouseLeaveSection);

    const xAt = (a: number, xs: number[]) => {
      if (a >= 5) return xs[5] ?? 600;
      const k = Math.floor(a);
      return (xs[k] ?? 0) + ((xs[k + 1] ?? 0) - (xs[k] ?? 0)) * (a - k);
    };

    const frame = (now: number) => {
      const s = engineRef.current;
      if (!s.inView || document.visibilityState === "hidden") {
        s.raf = 0;
        return;
      }

      const t = now * 0.001;
      if (s.reduced) {
        s.intro = 1;
        if (!s.dragging) s.pos = s.target;
      } else {
        if (s.intro < 1) s.intro = Math.min(1, s.intro + 0.012);
        if (!s.dragging) s.pos += (s.target - s.pos) * 0.11;
      }

      const ie = 1 - Math.pow(1 - s.intro, 3);

      s.sx += (s.tsx - s.sx) * 0.06;
      s.sy += (s.tsy - s.sy) * 0.06;

      s.cx += (s.tx - s.cx) * 0.22;
      s.cy += (s.ty - s.cy) * 0.22;
      if (curRef.current) {
        curRef.current.style.transform = `translate3d(${s.cx.toFixed(2)}px, ${s.cy.toFixed(2)}px, 0)`;
      }

      if (roomRef.current) {
        roomRef.current.style.transform = `translate3d(${(-s.sx * 22).toFixed(2)}px, ${(-s.sy * 14).toFixed(2)}px, 0) scale(${(1.08 - 0.03 * ie).toFixed(4)})`;
      }

      const ghostEl = ghostRef.current;
      if (ghostEl) {
        ghostEl.style.transform = `translate(calc(-50% - ${(s.sx * 40).toFixed(2)}px), ${(-s.sy * 16).toFixed(2)}px)`;
        const letters = ghostEl.children;
        for (let i = 0; i < letters.length; i++) {
          const span = letters[i] as HTMLElement;
          span.style.transform = `translateY(${((1 - ie) * (60 + 30 * i)).toFixed(2)}px)`;
        }
      }

      const n = s.count;
      for (let i = 0; i < n; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;

        const u = circularOffset(i, s.pos, n);
        const a = Math.abs(u);
        const sg = u < 0 ? -1 : u > 0 ? 1 : 0;

        const x = sg * xAt(a, s.XS) * ie;
        let sc = 1;
        let z = 0;
        let ry = 0;
        let op = 1;
        let blur = 0;

        if (a < 1) {
          sc = 0.55 + 0.45 * a;
          z = -260 * (1 - a);
          op = a;
          ry = -sg * 16 * a;
        } else {
          sc = 1 / (1 + 0.3 * Math.pow(a - 1, 1.15));
          z = -110 * (a - 1);
          ry = -sg * (16 + 9 * Math.min(2, a - 1));
          blur = Math.max(0, a - 1.6) * 2.4;
          op = a > 3.4 ? Math.max(0, 1 - (a - 3.4) / 0.8) : 1;
        }

        ry += s.sx * 10;
        const bob = s.reduced ? 0 : Math.sin(t * 1.1 + i * 1.37) * s.H * 0.006 * Math.min(1, a);
        const y = bob - (1 - sc) * s.H * 0.04;
        const finalOp = op * ie;

        if (finalOp < 0.01) {
          el.style.visibility = "hidden";
          el.style.opacity = "0";
        } else {
          el.style.visibility = "visible";
          el.style.opacity = finalOp.toFixed(4);
          el.style.zIndex = String(a < 1 ? 1 : Math.round(100 - 10 * a));
          el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "";
          el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) perspective(1300px) translateZ(${z.toFixed(2)}px) rotateY(${ry.toFixed(2)}deg) rotateX(${(-s.sy * 6).toFixed(2)}deg) scale(${(sc * (0.6 + 0.4 * ie)).toFixed(4)})`;
        }
      }

      if (!s.dragging && n > 0 && Math.abs(s.target - s.pos) < 0.02) {
        const itemIdx = mod(Math.round(s.target), n);
        const list = visibleItemsRef.current;
        const targetItem = list[itemIdx];
        const nextKey = targetItem ? `${targetItem.id}:${itemIdx}` : "";
        if (nextKey && nextKey !== s.shownKey) {
          tryOn(itemIdx);
        }
      }

      s.raf = requestAnimationFrame(frame);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? false;
        engineRef.current.inView = visible;
        if (visible && !engineRef.current.raf) {
          engineRef.current.raf = requestAnimationFrame(frame);
        }
        if (!visible && curRef.current && !engineRef.current.dragging) {
          engineRef.current.curVisible = false;
          curRef.current.style.opacity = "0";
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(section);

    return () => {
      cancelAnimationFrame(engineRef.current.raf);
      engineRef.current.raf = 0;
      observer.disconnect();
      ro.disconnect();
      rmq.removeEventListener("change", syncReduced);
      window.removeEventListener("pointerdown", onWindowPointerDown);
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("keydown", onKeyDown);
      section.removeEventListener("mouseleave", onMouseLeaveSection);
      cancelScan();
      if (curRef.current) curRef.current.style.opacity = "0";
    };
  }, [cancelScan, positionTabPill, rollText, tryOn]);

  if (!activeItem) return null;

  const chosenSize = selectedSizes[activeItem.id] ?? "M";
  const colorOptions = activeItem.colors ?? getColorOptionsForItem(activeItem.color);

  const handleAddActive = () => {
    const rect = bThumbWrapRef.current?.getBoundingClientRect();
    onAddToBag(activeItem, chosenSize, activeColor, rect);
    setJustAdded(true);
    if (addedTimerRef.current !== null) window.clearTimeout(addedTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <section ref={sectionRef} id="spatial-studio" aria-label="VirtualFit: Spatial Try-On">
      <div ref={roomRef} className="vf-room" />

      <div ref={ghostRef} className="vf-ghost" aria-hidden="true">
        <span>F</span>
        <span>I</span>
        <span>T</span>
      </div>

      <nav ref={tabsRef} className="vf-tabs vf-glass" aria-label="Categories">
        <div ref={tabPillRef} className="vf-tab-pill" />
        {TABS.map((tab, idx) => (
          <button
            key={tab.key}
            ref={(node) => {
              tabBtnRefs.current[idx] = node;
            }}
            type="button"
            className={`vf-tab${activeTab === idx ? " is-active" : ""}`}
            onClick={() => {
              setActiveTab(idx);
              positionTabPill(idx);
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <aside className="vf-rail vf-glass" aria-label="Tools">
        <button
          type="button"
          className={activeTool === 0 ? "is-active" : undefined}
          aria-label="Try On"
          title="Try On"
          onClick={() => {
            setActiveTool(0);
            engineRef.current.shownKey = "";
            tryOn(safeIdx);
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16.2 3.5a1 1 0 0 0-.84.46 3.9 3.9 0 0 1-6.72 0 1 1 0 0 0-.84-.46L3.6 5.2a1 1 0 0 0-.55.56l-1.5 3.8a1 1 0 0 0 .54 1.29l2.41 1.02V20a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-8.13l2.41-1.02a1 1 0 0 0 .54-1.29l-1.5-3.8a1 1 0 0 0-.55-.56l-4.2-1.7Z" />
          </svg>
        </button>
        <button
          type="button"
          className={activeTool === 1 ? "is-active" : undefined}
          aria-label={`Add ${activeItem.name} to Bag`}
          title={`Add ${activeItem.name} to Bag`}
          onClick={() => {
            setActiveTool(1);
            handleAddActive();
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="9" cy="20" r="1.4" />
            <circle cx="17" cy="20" r="1.4" />
            <path d="M3 4h2.5l2.1 10.5a1.5 1.5 0 0 0 1.47 1.2h8.36a1.5 1.5 0 0 0 1.46-1.16L20.5 7.5H6.2" />
          </svg>
        </button>
        <button
          type="button"
          className={activeTool === 2 ? "is-active" : undefined}
          aria-label={`Inspect ${activeItem.name} in 360°`}
          title="Open 360° Turntable"
          onClick={() => {
            setActiveTool(2);
            onOpenModal(activeItem, 0);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
            <path d="M8 3v4M16 3v4M3.5 9.5h17" />
          </svg>
        </button>
        <button
          type="button"
          className={activeTool === 3 ? "is-active" : undefined}
          aria-label={`View ${activeItem.name} Details`}
          title="View Product Page"
          onClick={() => {
            setActiveTool(3);
            navigate(`/product/${activeItem.id}`);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="8.5" r="3.8" />
            <path d="M5 20c.8-3.4 3.6-5.2 7-5.2s6.2 1.8 7 5.2" />
          </svg>
        </button>
      </aside>

      <div
        ref={stageRef}
        className="vf-stage"
        onPointerDown={(e) => {
          if (e.button !== 0 && e.pointerType === "mouse") return;
          const s = engineRef.current;
          s.dragging = true;
          s.startX = e.clientX;
          s.startY = e.clientY;
          s.p0 = s.pos;
          s.moved = 0;
          s.lastX = e.clientX;
          s.lastT = performance.now();
          s.vx = 0;
          const cardEl = (e.target as HTMLElement).closest<HTMLElement>(".vf-card");
          s.downCardIdx = cardEl ? Number(cardEl.dataset.index) : null;
          if (curRef.current) {
            curRef.current.classList.add("is-down");
            curRef.current.classList.remove("is-try", "is-btn");
            curRef.current.classList.add("is-drag");
          }
        }}
        onWheel={(e) => {
          if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
          const s = engineRef.current;
          s.wheelAcc += e.deltaX;
          const now = performance.now();
          if (Math.abs(s.wheelAcc) >= 60 && now - s.lastWheel >= 260) {
            s.target += s.wheelAcc > 0 ? 1 : -1;
            s.wheelAcc = 0;
            s.lastWheel = now;
          }
        }}
      >
        <div className="vf-arc">
          {visibleItems.map((item, i) => {
            const itemColor = getItemColor(item);
            return (
              <div
                key={item.id}
                ref={(node) => {
                  cardRefs.current[i] = node;
                }}
                data-index={i}
                className="vf-card vf-glass"
                onPointerEnter={() => {
                  const s = engineRef.current;
                  const sheen = sheenRefs.current[i];
                  if (s.reduced || !sheen) return;
                  sheen.getAnimations().forEach((a) => a.cancel());
                  sheen.animate(
                    [{ transform: "translateX(-110%)" }, { transform: "translateX(110%)" }],
                    { duration: 1000, easing: EASE },
                  );
                }}
              >
                <div className="vf-card-g">
                  <GarmentThumbnail item={item} colorOverride={itemColor} decorative />
                </div>
                <div className="vf-card-name">{item.name}</div>
                <div className="vf-card-price">{item.tag}</div>
                <div
                  ref={(node) => {
                    sheenRefs.current[i] = node;
                  }}
                  className="vf-sheen"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="vf-model" aria-hidden="true">
        <div ref={mCurRef} className="vf-fig vf-m-cur" />
        <div ref={mNextRef} className="vf-fig vf-m-next" />
        <div ref={scanGridRef} className="vf-grid" />
        <div ref={scanLineRef} className="vf-scan" />
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            className="vf-arrow vf-glass vf-prev"
            aria-label="Previous garment"
            onClick={() => {
              engineRef.current.target -= 1;
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className="vf-arrow vf-glass vf-next"
            aria-label="Next garment"
            onClick={() => {
              engineRef.current.target += 1;
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      <div className="vf-buy vf-glass" role="region" aria-label="Selected garment">
        <div ref={bThumbWrapRef} className="vf-thumb">
          <div ref={bThumbRef} className="vf-thumb-g">
            <GarmentThumbnail item={activeItem} colorOverride={activeColor} decorative />
          </div>
        </div>
        <div className="vf-info">
          <div ref={bNameRef} className="vf-b-name vf-ln" />
          <div ref={bPriceRef} className="vf-b-price vf-ln" />
        </div>
        <div className="vf-sizes-wrap">
          <span className="vf-lbl">Size</span>
          <div className="vf-sizes">
            {SIZES.map((sz) => (
              <button
                key={sz}
                type="button"
                className={`vf-chip${chosenSize === sz ? " is-active" : ""}`}
                onClick={() => onSizeChange(activeItem.id, sz)}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
        <div className="vf-colors-wrap">
          <div ref={bColorRef} className="vf-lbl vf-ln" />
          <div className="vf-dots">
            {colorOptions.map((opt) => {
              const isSelected = opt.hex.toUpperCase() === activeColor.toUpperCase();
              return (
                <button
                  key={`${activeItem.id}-${opt.hex}`}
                  type="button"
                  className={`vf-dot${isSelected ? " is-active" : ""}`}
                  style={{ background: opt.hex }}
                  aria-label={opt.name}
                  title={opt.name}
                  onClick={() => {
                    onColorChange(activeItem.id, opt.hex);
                    rollText(bColorRef.current, `Color · ${opt.name}`);
                  }}
                />
              );
            })}
          </div>
        </div>
        <button
          type="button"
          className="vf-add-btn"
          onClick={handleAddActive}
        >
          {justAdded ? "Added ✓" : "Add to Bag"}
        </button>
      </div>

      {mounted &&
        createPortal(
          <div ref={curRef} className="vf-cur" aria-hidden="true">
            <div className="vf-cur-ring" />
            <div className="vf-cur-dot" />
            <span className="vf-cur-lbl vf-cur-try">TRY ON</span>
            <span className="vf-cur-lbl vf-cur-drag">DRAG</span>
          </div>,
          document.body,
        )}
    </section>
  );
}
