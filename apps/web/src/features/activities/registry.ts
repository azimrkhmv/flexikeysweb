import type { ComponentType } from "react";
import type { Activity, ActivityKind } from "@/lib/types";
import { Puzzle, Sentence, Sort, Story } from "./board";
import { Count, FindSame, ListenPick, Scene } from "./choice";
import { TypeActivity } from "./keyboard";
import { LightPath, Missing, Sequence } from "./memory";
import { Color, Dots, Maze, Paint, Trace } from "./draw";
import { Path } from "./path";

// Activity engine registry (PRD §9.6): one engine per activity kind, reused across all levels.
// Engines read profile/languages/telemetry from usePlay() and call onDone() once when finished.
export type EngineProps<K extends ActivityKind = ActivityKind> = { activity: Extract<Activity, { kind: K }>; onDone: () => void };

export const ENGINES: { [K in ActivityKind]: ComponentType<EngineProps<K>> } = {
  find_same: FindSame,
  listen_pick: ListenPick,
  count: Count,
  sort: Sort,
  sequence: Sequence,
  missing: Missing,
  light_path: LightPath,
  path: Path,
  scene: Scene,
  puzzle: Puzzle,
  type: TypeActivity,
  sentence: Sentence,
  story: Story,
  trace: Trace,
  dots: Dots,
  color: Color,
  maze: Maze,
  paint: Paint,
};
