"use client";

import { AnimatePresence, motion, MotionConfig, type Variants } from "motion/react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

// The shared movement of every game (games spec 8 Nov 2026, §4). Only `transform` and `opacity` move, so a round stays
// smooth on a slow tablet. `PlayMotion` turns all of it off for reduced motion and for a child's calm screen.

/** Wraps the play screens: the device's reduced-motion setting, or an adult's calm screen, stops every movement. */
export function PlayMotion({ calm, children }: { calm?: boolean; children: ReactNode }) {
  return <MotionConfig reducedMotion={calm ? "always" : "user"}>{children}</MotionConfig>;
}

/** Enter: a group whose cards and options slide and fade in one after another, about 40 ms apart. */
export const enterGroup: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.04 } } };
/**
 * One card or option of an entering group (every `Target` carries it, so every engine gets it). Its opacity moves
 * through `--fk-enter` (globals.css), so a faded or tried option keeps its own look.
 */
export const enterItem: Variants = {
  hidden: { "--fk-enter": 0, y: 14 },
  show: { "--fk-enter": 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
};

export function Enter({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <motion.div initial="hidden" animate="show" variants={enterGroup} className={className} style={style}>
      {children}
    </motion.div>
  );
}

/** Correct: a short bounce and a soft glow in the brand colour (about 300 ms). */
export function Correct({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <motion.span className="relative grid place-items-center" animate={on ? { scale: [1, 1.14, 1] } : { scale: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-3 rounded-full"
        style={{ background: "radial-gradient(circle, rgb(38 120 112 / .35) 0%, rgb(38 120 112 / 0) 70%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: on ? [0, 1, 0.55] : 0 }}
        transition={{ duration: 0.3 }}
      />
      {children}
    </motion.span>
  );
}

/** Hint pulse: a ring that gently breathes around the right answer after 2 mistakes (the dashed outline stays). */
export function HintPulse() {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute -inset-1.5 rounded-[inherit] border-4 border-teal"
      initial={{ opacity: 0, scale: 1 }}
      animate={{ opacity: [0.85, 0.25, 0.85], scale: [1, 1.07, 1] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/** Flip: a card turning over (Card Pairs, Odd One Out). `up` shows the front. */
export function Flip({ up, front, back, size }: { up: boolean; front: ReactNode; back: ReactNode; size: number }) {
  const face = "absolute inset-0 grid place-items-center rounded-[inherit] [backface-visibility:hidden]";
  return (
    <span className="relative block rounded-fk-lg" style={{ width: size, height: size, perspective: 800 }}>
      <motion.span className="absolute inset-0 rounded-[inherit] [transform-style:preserve-3d]" initial={false} animate={{ rotateY: up ? 0 : 180 }} transition={{ duration: 0.35, ease: "easeInOut" }}>
        <span className={face}>{front}</span>
        <span className={face} style={{ transform: "rotateY(180deg)" }}>
          {back}
        </span>
      </motion.span>
    </span>
  );
}

const STARS = [-60, -28, 0, 28, 60];
/**
 * Round done: a few stars float up (about 1 s), then go. Silent: the engines' own chime follows the sound setting.
 * Mount it with a new `key` for each round done.
 */
export function RoundDone() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setShow(false), 1100);
    return () => clearTimeout(id);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center">
          {STARS.map((x, i) => (
            <motion.span
              key={i}
              className="absolute text-3xl"
              initial={{ opacity: 0, x, y: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 0], y: -110 - (i % 2) * 30, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, delay: i * 0.05, ease: "easeOut" }}
            >
              ⭐
            </motion.span>
          ))}
        </span>
      )}
    </AnimatePresence>
  );
}
