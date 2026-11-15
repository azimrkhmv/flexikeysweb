"use client";

import { Vista } from "@/components/Scenery";
import { LinkButton } from "@/components/ui";
import { useT } from "@/lib/i18n";

/** Where "Start, 2 minutes" goes: the questionnaire in quick mode (B103). */
export const QUICK_START = "/parent/children/new?quick=1";
/** Where "Play with Cloudy" goes: the games demo, on the first Cloudy game (B104). */
export const CLOUDY_GAMES = "/demo/games?game=find_cloudy&from=parent";

/**
 * The first screen of a parent with no child (B100, spec 2.3): what FlexiKeys is, two buttons, four numbered chips
 * and the scenery card. The heading promises no number of questions (it can change after the physio's review).
 */
export function FirstScreen() {
  const t = useT();
  return (
    <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]" data-tour="start">
      <div>
        <h2 className="text-[clamp(2rem,4.4vw,3.2rem)] font-semibold leading-[1.15] text-ink [text-wrap:balance]">{t("first.title")}</h2>
        <p className="mt-3 max-w-[58ch] text-ink-2">{t("first.text")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href={QUICK_START} size="lg">
            {t("first.start")}
          </LinkButton>
          <LinkButton href={CLOUDY_GAMES} size="lg" variant="outline">
            {t("first.play")}
          </LinkButton>
        </div>
        <ol className="fk-steps mt-6 flex list-none flex-wrap gap-2.5 p-0">
          {(["answer", "plan", "play", "move"] as const).map((k) => (
            <li key={k} className="flex items-center gap-2 rounded-full border-[1.5px] border-line bg-surface py-1.5 pl-2 pr-3.5 text-[15px] font-bold text-ink">
              {t(`first.step.${k}`)}
            </li>
          ))}
        </ol>
      </div>
      <Vista />
    </section>
  );
}
