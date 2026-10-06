"use client";

import { useState } from "react";
import { Mascot } from "@/components/Mascot";
import { sel, useDb } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Child } from "@/lib/types";
import { GROUP_EMOJI, activityLabelKey, tasksByGroup, type GroupId } from "./gameGroups";
import { Target } from "./Target";

const GROUPED = tasksByGroup();

/**
 * Every game, sorted by type, beside the world map (above it on narrow screens). The child picks a group
 * ("Letters and words", "Drawing", …) and starts any game in it with one tap. Finished games show a star and
 * can be played again; games of a level without access (plan) are sleeping clouds.
 */
export function TaskGroups({ child, onPlay }: { child: Child; onPlay: (levelId: string, activityId: string) => void }) {
  const db = useDb();
  const t = useT(child.uiLang);
  const [open, setOpen] = useState<GroupId>(GROUPED[0].id);
  const group = GROUPED.find((g) => g.id === open)!;
  const isDone = (levelId: string, activityId: string) => sel.levelProgress(db, child.id, levelId).completed.includes(activityId);

  return (
    <section aria-labelledby="fk-groups-title" className="rounded-fk-lg border border-line bg-surface/90 p-3 shadow-soft">
      <h2 id="fk-groups-title" className="mb-3 px-1 text-xl font-extrabold text-ink">
        {t("play.groups.title")}
      </h2>

      <div role="group" aria-label={t("play.groups.title")} className="mb-3 flex flex-wrap gap-2">
        {GROUPED.map((g) => {
          const done = g.tasks.filter((x) => isDone(x.level.id, x.activity.id)).length;
          const label = `${t(`play.group.${g.id}`)} — ${t("play.groups.count", { n: done, total: g.tasks.length })}`;
          return (
            <Target
              key={g.id}
              label={label}
              selected={g.id === open}
              onSelect={() => setOpen(g.id)}
              className={`flex flex-col items-center justify-center rounded-3xl border-4 px-3 font-bold text-ink ${g.id === open ? "border-teal bg-teal-soft" : "border-white bg-surface"}`}
            >
              <span className="text-2xl" aria-hidden>
                {GROUP_EMOJI[g.id]}
              </span>
              <span className="text-xs text-ink-2" aria-hidden>
                {done}/{g.tasks.length}
              </span>
            </Target>
          );
        })}
      </div>

      <p className="mb-2 px-1 text-lg font-extrabold text-ink">
        {GROUP_EMOJI[group.id]} {t(`play.group.${group.id}`)}
      </p>
      <ul className="flex gap-2 overflow-x-auto pb-1 lg:max-h-[60dvh] lg:flex-col lg:overflow-y-auto lg:overflow-x-visible">
        {group.tasks.map(({ level, activity }) => {
          const done = isDone(level.id, activity.id);
          const asleep = !!sel.lockReason(db, child.id, level.id);
          const name = t(activityLabelKey(activity));
          const title = level.title[child.uiLang];
          return (
            <li key={activity.id} className="shrink-0 lg:shrink">
              <Target
                label={`${name} — ${title}${done ? ` — ${t("play.map.state.done")}` : ""}`}
                onSelect={() => onPlay(level.id, activity.id)}
                className={`flex w-56 items-center gap-3 rounded-3xl px-3 py-2 text-left text-ink lg:w-full ${asleep ? "bg-[#eef2f8]" : done ? "bg-sun-soft" : "bg-surface-2"}`}
              >
                {asleep ? (
                  <Mascot mood="sleepy" size={44} float={false} label="" />
                ) : (
                  <span className="grid size-11 shrink-0 place-items-center text-3xl" aria-hidden>
                    {level.emoji}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold">{name}</span>
                  <span className="block truncate text-sm text-ink-2">
                    {level.n}. {title}
                  </span>
                </span>
                {done && (
                  <span className="shrink-0 text-xl" aria-hidden>
                    ⭐
                  </span>
                )}
              </Target>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
