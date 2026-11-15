"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Cloudy, CloudShape, CLOUDY_FACES, type CloudyFace, type CloudyForm } from "@/components/Cloudy";
import { useT } from "@/lib/i18n";
import { markTourOffered, setCloudyMoves, tourNotOffered, useCloudyMoves, useTourAsked } from "./cloudyStore";

/**
 * Cloudy on the parent pages (B102, spec 5.2–5.4), after the approved demo (docs/demo-2026-11-15, `Cloudy`).
 *
 * Five outlined clouds drift to the right behind the cards, fixed to the screen. Cloudy rides one and, about every
 * five seconds, hops to another cloud and changes form, slips behind his cloud and peeks out, flies to a visible
 * main button and sits on it, makes his cloud rain, pops it, or blows it away. He is surprised when the mouse comes
 * close and comes to sit on a main button the mouse rests on.
 *
 * Layers: the clouds and a hiding Cloudy are behind all content; a riding, sitting or flying Cloudy is in front. He
 * never takes a click from a control (`pointer-events: none`; his own press is found by position).
 * Where: parent pages only. On the questionnaire he sits still in the corner with no clouds; on the payment page he
 * is not drawn at all. He is never part of a child's screen (those are other layouts).
 * "Cloudy moves: Off" (or reduced motion at first): he sits in the bottom-right corner as a cloud; pressing him still
 * changes his form and face with a small jump. With reduced motion the clouds do not drift.
 * The movement is `transform` only, set straight on the elements (no React render per frame); the loop stops while
 * the tab is hidden. `window.fkCloudyMs` holds the average cost of a frame, for measuring.
 */
const ROAM: CloudyForm[] = ["cloud", "bunny", "cat", "fox", "tiger", "bear"];
const SIZE = 112;
const OFF = { ride: -86, peek: -52, hide: -12, fall: -34 } as const;
type Mode = keyof typeof OFF | "perch" | "blow";
const CLOUDS = [
  { w: 190, v: 9, by: 0.27, sx: 0.7 },
  { w: 130, v: 14, by: 0.13, sx: 0.08 },
  { w: 160, v: 7, by: 0.6, sx: 0.3 },
  { w: 110, v: 16, by: 0.44, sx: 0.9 },
  { w: 150, v: 11, by: 0.8, sx: 0.02 },
];
/** The tour: page, what gets the dashed ring (the first of the `|` choices that is on the page), Cloudy's form. */
const TOUR: [href: string, ring: string, form: CloudyForm][] = [
  ["/parent", "[data-tour='start']|main a[href='/parent/children/new']|main h1", "bunny"],
  ["/parent/plan", "main h1", "bear"],
  ["/parent/games", "main h1", "fox"],
  ["/parent/exercises", "main h1", "cat"],
];
const rnd = (n: number) => Math.floor(Math.random() * n);

type Bubble = { text: string; buttons?: { label: string; run: () => void; quiet?: boolean }[] } | null;
declare global {
  interface Window {
    fkCloudyMs?: number;
  }
}

export function CloudyRoam() {
  const t = useT();
  const path = usePathname();
  const router = useRouter();
  const moves = useCloudyMoves();
  const asked = useTourAsked();
  const absent = path.startsWith("/parent/billing"); // the payment screen
  const still = path.startsWith("/parent/children/new"); // the questionnaire: he sits still in the corner
  const on = moves && !still;

  const [form, setForm] = useState<CloudyForm>("cloud");
  const [face, setFace] = useState<CloudyFace>("happy");
  const [walk, setWalk] = useState(false);
  const [bubble, setBubble] = useState<Bubble>(null);
  const [tour, setTour] = useState<number | null>(null);
  // "Off" parks him as a cloud.
  const [wasOn, setWasOn] = useState(on);
  if (wasOn !== on) {
    setWasOn(on);
    if (!on) setForm("cloud");
  }

  const pet = useRef<HTMLDivElement>(null);
  const cloudEls = useRef<(HTMLDivElement | null)[]>([]);
  // What the frame loop reads; React state is only what is drawn.
  const live = useRef({ on, touring: false, form: "cloud" as CloudyForm, face: "happy" as CloudyFace, jump: 0, tap: () => {} });
  const timers = useRef({ face: 0, bubble: 0 });

  const say = (text: string, buttons?: NonNullable<Bubble>["buttons"], ms?: number) => {
    clearTimeout(timers.current.bubble);
    setBubble({ text, buttons });
    if (ms) timers.current.bubble = window.setTimeout(() => setBubble(null), ms);
  };
  const mood = (f: CloudyFace, ms?: number) => {
    live.current.face = f;
    setFace(f);
    clearTimeout(timers.current.face);
    if (ms) timers.current.face = window.setTimeout(() => mood("happy"), ms);
  };
  const shape = (f: CloudyForm) => {
    live.current.form = f;
    setForm(f);
  };

  const endTour = (text: string) => {
    live.current.touring = false;
    setTour(null);
    say(text, undefined, 5000);
  };
  const step = (i: number) => {
    if (i >= TOUR.length) return endTour(t("cloudy.tour.done"));
    live.current.touring = true;
    setTour(i);
    shape(TOUR[i][2]);
    say(t("cloudy.tour.count", { n: i + 1, total: TOUR.length, text: t(`cloudy.tour.${i + 1}`) }), [
      { label: t(i === TOUR.length - 1 ? "cloudy.tour.finish" : "cloudy.tour.next"), run: () => step(i + 1) },
      { label: t("cloudy.tour.stop"), run: () => endTour(t("cloudy.tour.stopped")), quiet: true },
    ]);
  };
  // Pressing Cloudy, moving or parked: a new form, a new face, a small jump, and the way into the tour.
  const tap = () => {
    const next = ROAM[(ROAM.indexOf(live.current.form) + 1) % ROAM.length];
    shape(next);
    mood(CLOUDY_FACES[(CLOUDY_FACES.indexOf(live.current.face) + 1) % CLOUDY_FACES.length]);
    live.current.jump = 38;
    if (!live.current.touring) say(t("cloudy.now", { form: t(`cloudy.form.${next}`) }), still ? undefined : [{ label: t("cloudy.tour.yes"), run: () => step(0) }], 6000);
  };
  useEffect(() => {
    live.current.on = on;
    live.current.form = form;
    live.current.tap = tap;
  });

  // The tour is offered once, on a parent's first visit; Account's "Show me around" starts it again.
  useEffect(() => {
    if (absent || still || !tourNotOffered()) return;
    const id = window.setTimeout(() => {
      markTourOffered();
      say(t("cloudy.tour.offer"), [
        { label: t("cloudy.tour.yes"), run: () => step(0) },
        { label: t("cloudy.tour.no"), run: () => endTour(t("cloudy.tour.stopped")), quiet: true },
      ]);
    }, 900);
    return () => clearTimeout(id);
    // once, on the first page this device opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lastAsked = useRef(asked);
  useEffect(() => {
    if (asked === lastAsked.current) return;
    lastAsked.current = asked;
    step(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked]);

  // A tour step: go to its page, then ring the place and scroll to it. Escape stops the tour.
  useEffect(() => {
    if (tour === null) return;
    const [href, ring] = TOUR[tour];
    if (path !== href) return router.push(href);
    let el: Element | null = null;
    const id = window.setTimeout(() => {
      el = ring.split("|").reduce<Element | null>((found, q) => found ?? document.querySelector(q), null);
      el?.classList.add("fk-spot");
      el?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, 350);
    return () => {
      clearTimeout(id);
      el?.classList.remove("fk-spot");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, path]);
  const touring = tour !== null;
  useEffect(() => {
    if (!touring) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && endTour(t("cloudy.tour.stopped"));
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touring]);

  // The frame loop and Cloudy's actions.
  useEffect(() => {
    const c = pet.current;
    if (absent || !c) return;
    const L = live.current;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clouds = CLOUDS.map((k, i) => ({ ...k, e: cloudEls.current[i], x: 0, y: 0, yy: 0, boost: 0, ph: i * 1.3 }));
    let at = 0;
    let mode: Mode = "ride";
    let x = 0;
    let y = 0;
    let last = 0;
    let hopAt = 0;
    let trailAt = 0;
    let nearAt = 0;
    let hoverAt = 0;
    let perchEl: Element | null = null;
    let sat = false;
    let blowPos: [number, number] = [0, 0];
    let walking = false;
    let raf = 0;
    let cost = 0;
    let frames = 0;
    const later: number[] = [];
    const wait = (f: () => void, ms: number) => later.push(window.setTimeout(f, ms));
    const flash = (e: Element | null, cls: string, ms: number) => {
      e?.classList.add(cls);
      wait(() => e?.classList.remove(cls), ms);
    };

    const lay = () => {
      const W = innerWidth;
      const H = innerHeight;
      clouds.forEach((k) => {
        k.x = k.sx * W - k.w / 2;
        k.y = k.by * H;
        k.yy = k.y;
      });
    };
    const target = (): [number, number] => {
      // Parked: the bottom-right corner, above the feedback button (and the bottom bar on a phone).
      if (!L.on) return [innerWidth - 126, innerHeight - (innerWidth < 1024 ? 272 : 204)];
      if (L.touring) return [innerWidth - 128, 84];
      if (mode === "perch" && perchEl) {
        const r = perchEl.getBoundingClientRect();
        return [r.left + r.width / 2 - 56, r.top - 99];
      }
      if (mode === "blow") return blowPos;
      const k = clouds[at];
      return [k.x + k.w / 2 - 56, k.yy + OFF[mode as keyof typeof OFF]];
    };
    const draw = () => {
      clouds.forEach((k) => k.e && (k.e.style.transform = `translate(${k.x}px, ${k.yy}px)`));
      c.style.transform = `translate(${x}px, ${y}px)`;
      // Behind his cloud (and all content) when hiding; in front of content otherwise.
      c.style.zIndex = L.on && !L.touring && (mode === "hide" || mode === "peek") ? "0" : "25";
    };
    const trail = () => {
      const s = document.createElement("span");
      s.className = "fk-trail";
      s.style.left = `${x + 46 + rnd(18)}px`;
      s.style.top = `${y + 56 + rnd(20)}px`;
      c.parentElement?.append(s);
      wait(() => s.remove(), 800);
    };
    const leave = () => {
      perchEl?.classList.remove("fk-sat");
      perchEl = null;
      sat = false;
    };
    const hop = (f?: CloudyForm) => {
      leave();
      const W = innerWidth;
      const ok = clouds.map((_, i) => i).filter((i) => i !== at && clouds[i].x > 10 && clouds[i].x < W - 260);
      at = ok.length ? ok[rnd(ok.length)] : clouds.reduce((b, k, i) => (Math.abs(k.x - W * 0.3) < Math.abs(clouds[b].x - W * 0.3) ? i : b), 0);
      mode = "ride";
      const others = ROAM.filter((k) => k !== L.form);
      shape(f ?? others[rnd(others.length)]);
      const k = clouds[at];
      wait(() => flash(k.e, "kick", 800), 1100);
    };
    const perch = (b: Element) => {
      leave();
      perchEl = b;
      mode = "perch";
      wait(() => perchEl === b && mode === "perch" && hop(), 4400);
    };
    const pickBtn = () => {
      const H = innerHeight;
      const l = [...document.querySelectorAll(".fk-btn:not(:disabled)")].filter((b) => {
        const r = b.getBoundingClientRect();
        return r.top > 170 && r.bottom < H - 30 && r.width > 0;
      });
      return l[rnd(l.length)];
    };
    const rain = () => {
      flash(clouds[at].e, "rainy", 2700);
      mood("wow", 2600);
    };
    const pop = () => {
      const k = clouds[at];
      k.e?.classList.add("pop");
      mode = "fall";
      mood("wow", 1300);
      wait(() => {
        k.e?.classList.remove("pop");
        flash(k.e, "kick", 800);
        if (mode === "fall") {
          mode = "ride";
          mood("laugh", 1200);
        }
      }, 1400);
    };
    const blow = () => {
      const k = clouds[at];
      blowPos = [k.x + k.w / 2 - 150, k.yy - 44];
      mode = "blow";
      k.boost = 1.8;
      mood("wow", 1900);
      wait(() => mode === "blow" && hop(), 2100);
    };
    // About every five seconds he does one thing (the demo's weights).
    const act = () => {
      if (!L.on || L.touring || document.hidden || mode === "perch" || mode === "blow" || mode === "fall") return;
      if (mode === "hide") {
        if (Math.random() < 0.6) {
          mode = "peek";
          wait(() => mode === "peek" && (mode = "hide"), 1700);
        } else hop();
        return;
      }
      if (mode === "peek") return;
      const r = Math.random();
      if (r < 0.2) hop();
      else if (r < 0.36) mode = "hide";
      else if (r < 0.58) {
        const b = pickBtn();
        if (b) perch(b);
        else hop();
      } else if (r < 0.72) rain();
      else if (r < 0.86) pop();
      else blow();
    };

    const frame = (now: number) => {
      const t0 = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      const W = innerWidth;
      if (!reduce)
        clouds.forEach((k) => {
          k.x += k.v * (k.boost > 0 ? 8 : 1) * dt;
          k.boost -= dt;
          if (k.x > W + 20) k.x = -k.w - 20;
          k.yy = k.y + Math.sin(now / 1800 + k.ph) * 8;
        });
      if (!L.on && mode !== "ride") {
        leave();
        mode = "ride";
      }
      if (L.on && !L.touring && mode !== "perch" && mode !== "blow" && clouds[at].x > W - 150 && now - hopAt > 3000) {
        hopAt = now;
        hop();
      }
      if (L.jump) {
        y -= L.jump;
        L.jump = 0;
      }
      const [tx, ty] = target();
      const px = x;
      const py = y;
      const ease = reduce ? 1 : Math.min(1, dt * 2.6);
      x += (tx - x) * ease;
      y += (ty - y) * ease;
      const speed = dt ? Math.hypot(x - px, y - py) / dt : 0;
      if (speed > 50 !== walking) {
        walking = speed > 50;
        setWalk(walking);
      }
      if (!reduce && speed > 130 && now - trailAt > 40) {
        trailAt = now;
        trail();
      }
      if (mode === "perch" && perchEl && !sat && Math.hypot(tx - x, ty - y) < 8) {
        sat = true;
        perchEl.classList.add("fk-sat");
        mood("laugh", 1600);
      }
      draw();
      cost += performance.now() - t0;
      if (++frames === 120) {
        window.fkCloudyMs = cost / frames;
        cost = frames = 0;
      }
      raf = requestAnimationFrame(frame);
    };

    const click = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest("button,a,input,select,textarea,label,[role='status'],dialog")) return;
      const r = c.getBoundingClientRect();
      if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) L.tap();
    };
    // Surprised when the mouse comes within about 70 px.
    const move = (e: PointerEvent) => {
      if (!L.on || L.touring || e.pointerType !== "mouse") return;
      const now = performance.now();
      if (now - nearAt > 2500 && Math.hypot(e.clientX - x - 56, e.clientY - y - 60) < 70) {
        nearAt = now;
        mood("wow", 1000);
        y -= 30;
      }
    };
    // The mouse rests on a main button: he comes and sits on it, at most once every 5 seconds.
    const over = (e: PointerEvent) => {
      if (!L.on || L.touring || e.pointerType !== "mouse" || !(e.target instanceof Element)) return;
      const b = e.target.closest(".fk-btn:not(:disabled)");
      const now = performance.now();
      if (b && b !== perchEl && now - hoverAt > 5000) {
        hoverAt = now;
        perch(b);
      }
    };
    const resize = () => lay();
    // The loop stops while the tab is hidden.
    const visible = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    lay();
    [x, y] = target();
    draw();
    raf = requestAnimationFrame(frame);
    const roam = window.setInterval(act, 4800);
    document.addEventListener("click", click);
    addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", over);
    addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(roam);
      later.forEach(clearTimeout);
      leave();
      document.removeEventListener("click", click);
      removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", over);
      removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visible);
    };
    // `still` changes which clouds exist; everything else is read through `live`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absent, still]);

  useEffect(() => {
    const tm = timers.current;
    return () => {
      clearTimeout(tm.face);
      clearTimeout(tm.bubble);
    };
  }, []);

  if (absent) return null;
  return (
    <>
      {/* Decoration: hidden from screen readers. Cloudy first, so a cloud at the same layer is drawn over him. */}
      <div aria-hidden className="print:hidden">
        <div ref={pet} className="fk-cloudy">
          <span className="fk-cloudy-bob">
            <Cloudy size={SIZE} form={form} face={face} walk={walk} />
          </span>
        </div>
        {!still &&
          CLOUDS.map((k, i) => (
            <div
              key={i}
              ref={(e) => {
                cloudEls.current[i] = e;
              }}
              className="fk-skycloud"
              style={{ width: k.w }}
            >
              <CloudShape />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          ))}
      </div>
      {/* What Cloudy says: the tour text is a polite live region. */}
      <div role="status" aria-live="polite" className="fk-bubble print:hidden" hidden={!bubble}>
        {bubble && (
          <>
            <small>Cloudy</small>
            <p>{bubble.text}</p>
            {bubble.buttons && (
              <div className="flex flex-wrap gap-2">
                {bubble.buttons.map((b) => (
                  <button key={b.label} type="button" className={b.quiet ? "q" : ""} onClick={b.run}>
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** "Cloudy moves: On / Off" (spec 5.3): in the header of the parent pages and in Account. */
export function CloudySwitch({ className = "" }: { className?: string }) {
  const t = useT();
  const moves = useCloudyMoves();
  return (
    <button
      type="button"
      aria-pressed={moves}
      onClick={() => setCloudyMoves(!moves)}
      className={`fk-btn-2 inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold ${className}`}
    >
      <span className="hidden sm:inline">{t("cloudy.moves")}:</span>
      <span className="sm:hidden" aria-hidden>
        ☁️
      </span>
      <span className="sr-only sm:hidden">{t("cloudy.moves")}:</span>
      <b className={moves ? "text-teal" : "text-muted"}>{t(moves ? "cloudy.on" : "cloudy.off")}</b>
    </button>
  );
}
