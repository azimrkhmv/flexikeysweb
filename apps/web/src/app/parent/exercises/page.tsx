"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Avatar, PageHeader, useAction } from "@/components/ui";
import { SLOTS } from "@/content/exercises";
import { FormError } from "@/features/auth/parts";
import { api, sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import type { ExerciseVideo } from "@/lib/types";

// B106 (Warm Hills spec §7): one card per exercise of the library. A video plays only once the physiotherapist has
// approved it in this language (product rule 3); every other card says "Waiting for physio check" and cannot be
// played. The child's plan comes first ("In the plan"), then the spec's seven slots, then the rest of the library.

export default function Exercises() {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const me = sel.me(db);
  const kids = me ? sel.childrenOf(db, me.id) : [];
  const [picked, setPicked] = useState<string | null>(null);
  const child = kids.find((c) => c.id === picked) ?? kids[0];
  const plan = child ? sel.roadmap(db, child.id) : null;
  const inPlan = new Set(plan?.days.flatMap((d) => d.exercises.map((e) => e.videoId)) ?? []);
  const rank = (v: ExerciseVideo) => (inPlan.has(v.id) ? 0 : (SLOTS as readonly string[]).includes(v.id) ? 1 : 2);
  const slotAt = (v: ExerciseVideo) => (SLOTS as readonly string[]).indexOf(v.id);
  const list = sel
    .videos(db)
    .map((v, k) => ({ v, k }))
    .sort((a, b) => rank(a.v) - rank(b.v) || (rank(a.v) === 1 ? slotAt(a.v) - slotAt(b.v) : a.k - b.k))
    .map(({ v }) => v);

  return (
    <>
      <PageHeader title={t("exercises.title")} subtitle={<span className="block max-w-[58ch]">{t("exercises.subtitle")}</span>} />
      {kids.length > 1 && (
        <div className="mb-5 flex gap-2 overflow-x-auto" role="radiogroup" aria-label={t("parent.ai.child")}>
          {kids.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === child?.id}
              onClick={() => setPicked(c.id)}
              className={`flex shrink-0 items-center gap-3 rounded-2xl p-3 text-left font-bold transition ${c.id === child?.id ? "bg-surface shadow-soft ring-2 ring-teal" : "hover:bg-surface/70"}`}
            >
              <Avatar emoji={c.avatar} size={40} tone="lavender" /> {c.name}
            </button>
          ))}
        </div>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((v) => (
          <ExerciseCard key={`${v.id}-${lang}`} video={v} inPlan={inPlan.has(v.id)} />
        ))}
      </ul>
    </>
  );
}

function ExerciseCard({ video, inPlan }: { video: ExerciseVideo; inPlan: boolean }) {
  const t = useT();
  const [lang] = useLang();
  const ready = video.versions[lang]?.status === "approved";
  const [url, setUrl] = useState<string | null>(null);
  const watch = useAction(api.watchVideo);
  const title = video.title[lang];
  const play = async () => {
    const link = await watch.run(video.id, lang);
    if (link) setUrl(link);
  };

  return (
    <li className="flex flex-col overflow-hidden rounded-fk-lg border-[1.5px] border-edge bg-surface shadow-soft">
      {url ? (
        <video controls autoPlay preload="metadata" src={url} className="aspect-video w-full bg-ink" aria-label={title} />
      ) : (
        <div className="relative grid aspect-video place-items-center" style={{ background: "linear-gradient(160deg, var(--paper), var(--sky))" }}>
          {ready ? (
            <button
              type="button"
              onClick={play}
              disabled={watch.pending}
              aria-label={t("exercises.play", { name: title })}
              className="grid size-16 place-items-center rounded-full border-[1.5px] border-edge bg-surface text-ink shadow-soft transition hover:scale-105 disabled:opacity-60"
            >
              <Play className="size-7 translate-x-0.5" aria-hidden />
            </button>
          ) : (
            <span className="grid size-16 place-items-center rounded-full border-[1.5px] border-dashed border-edge/60 bg-surface/60 text-muted" aria-hidden>
              <Play className="size-7 translate-x-0.5" />
            </span>
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="font-extrabold text-ink">{title}</h2>
        <p className="text-sm text-ink-2">
          {t(`area.${video.bodyArea}`)} · {t("exercises.minutes")}
        </p>
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {inPlan && <span className="rounded-full bg-leaf-soft px-3 py-1 text-xs font-bold text-ink">{t("exercises.inPlan")}</span>}
          {!ready && <span className="rounded-full bg-sun-soft px-3 py-1 text-xs font-bold text-ink">{t("exercises.waiting")}</span>}
        </div>
        <FormError>{watch.error}</FormError>
      </div>
    </li>
  );
}
