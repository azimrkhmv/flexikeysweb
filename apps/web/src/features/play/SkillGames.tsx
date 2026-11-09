"use client";

import { SKILL_GAMES, type SkillGame } from "@/content/skillGames";
import { sel, useDb } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { FREE_TIER, SHOWN_AREAS, type Area } from "@/lib/skill";
import type { Child } from "@/lib/types";
import { Target } from "./Target";
import { KIND_EMOJI, MapTabs } from "./WorldMap";

/** The four tiers as the child sees them: a picture and a name, never a number (rule 1). */
export const TIER_ICON = ["", "🌰", "🌱", "🌳", "⛰️"] as const;
const TIER_TONE = ["", "var(--fk-sun-soft)", "var(--fk-leaf-soft)", "var(--fk-teal-soft)", "var(--fk-lavender-soft)"];
const AREA_ICON: Partial<Record<Area, string>> = { attention: "👀", memory: "🧠", flexibility: "🔀", reasoning: "💡", literacy: "🔤", numeracy: "🔢", speed: "⚡" };

/** A tier the child may play now: open by success in its area (games spec §3.2), and above Seed only with Pro. */
export function tierOpen(top: number, tier: number, pro: boolean) {
  return tier <= top && (pro || tier <= FREE_TIER);
}

/**
 * The "Skill games" tab (games spec §9): one card per area with its games, each game with its four tiers. A tier that
 * is not open yet, or needs Pro, is a sleeping cloud — the same soft lock as the world map; no red, no "failed".
 */
export function SkillGames({ child, onPlay, onTab }: { child: Child; onPlay: (game: SkillGame, tier: number, open: boolean) => void; onTab: (tab: "map" | "skills") => void }) {
  const db = useDb();
  const t = useT(child.uiLang);
  const tops = sel.tiers(db, child.id);
  const pro = sel.isPro(db, child.id);
  const areas = SHOWN_AREAS.filter((a) => SKILL_GAMES.some((g) => g.area === a));
  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="sr-only">{t("play.nav.skills")}</h1>
      <MapTabs child={child} tab="skills" onTab={onTab} />
      <div className="flex flex-col gap-4">
        {areas.map((area) => (
          <section key={area} className="rounded-fk-lg border-4 border-white bg-surface/90 p-2 shadow-soft sm:p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold text-ink">
              <span aria-hidden>{AREA_ICON[area]}</span> {t(`skill.area.${area}`)}
            </h2>
            <div className="flex flex-col gap-3">
              {SKILL_GAMES.filter((g) => g.area === area).map((g) => (
                <div key={g.id} className="flex min-w-0 flex-col gap-2 rounded-3xl bg-surface-2/60 p-2 sm:flex-row sm:items-center">
                  <p className="flex min-w-0 items-center gap-2 px-1 font-extrabold text-ink sm:w-36 sm:flex-col sm:text-center">
                    <span className="text-3xl" aria-hidden>
                      {KIND_EMOJI[g.kind]}
                    </span>
                    <span className="text-sm leading-tight">{t(`skill.game.${g.kind}`)}</span>
                  </p>
                  <div className="flex flex-1 flex-wrap gap-1.5 sm:gap-2">
                    {[1, 2, 3, 4].map((tier) => {
                      const open = tierOpen(tops[area], tier, pro);
                      const name = t(`skill.tier.${tier}`);
                      return (
                        <Target
                          key={tier}
                          label={open ? `${t(`skill.game.${g.kind}`)}, ${name}` : `${name}. ${t("play.skills.sleeping")}`}
                          onSelect={() => onPlay(g, tier, open)}
                          scanSkip={!open}
                          className={`flex flex-1 basis-[76px] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-1 font-bold shadow-soft ${open ? "border-white text-ink" : "border-white/70 bg-[#eef2f8] text-muted"}`}
                          style={{ background: open ? TIER_TONE[tier] : undefined }}
                        >
                          <span className="text-2xl leading-none" aria-hidden>
                            {open ? TIER_ICON[tier] : "☁️"}
                          </span>
                          <span className="max-w-full truncate text-xs">{name}</span>
                        </Target>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
