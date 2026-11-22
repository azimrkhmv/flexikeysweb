"use client";

import "@/messages/public";
import { LIVE } from "@/lib/api/mode";
import { useT } from "@/lib/i18n";
import { useSessionRole } from "@/lib/session";

// The privacy policy (B112), written from what the code really stores (messages/launch.ts "privacy.*"). Each kind of
// data says what is kept, who can see it and how long; where it lives is said once, at the top.

const KINDS = ["account", "child", "answers", "plan", "play", "files", "share", "ai", "pay", "other"] as const;
const TASKS_Q20 = "https://github.com/azimrkhmv/flexikeysweb/blob/main/TASKS.md#6-ask-and-collect";

/** "Draft — needs lawyer/mentor check": only in the demo (mock mode) and for admins, never for parents. */
function DraftNote() {
  const t = useT();
  const role = useSessionRole();
  if (LIVE && role !== "admin") return null;
  return (
    <p role="note" className="mt-4 rounded-fk border border-line bg-sun-soft px-4 py-3 text-sm font-bold text-ink">
      {t("privacy.draft")} ·{" "}
      <a href={TASKS_Q20} target="_blank" rel="noreferrer" className="text-primary underline">
        {t("privacy.draft.q")}
      </a>
    </p>
  );
}

function Plain({ id }: { id: string }) {
  const t = useT();
  return (
    <section aria-labelledby={`privacy-${id}`} className="fk-card p-6">
      <h2 id={`privacy-${id}`} className="text-lg font-extrabold text-ink">{t(`privacy.${id}.t`)}</h2>
      <p className="mt-2 leading-relaxed text-muted">{t(`privacy.${id}.d`)}</p>
    </section>
  );
}

export function PrivacyPolicy() {
  const t = useT();
  return (
    <article className="mx-auto max-w-3xl px-4 pt-12">
      <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{t("privacy.title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("privacy.updated")}</p>
      <DraftNote />
      <p className="mt-6 text-lg text-muted">{t("privacy.intro")}</p>
      <div className="mt-10 space-y-4">
        <Plain id="where" />
        {KINDS.map((k) => (
          <section key={k} aria-labelledby={`privacy-${k}`} className="fk-card p-6">
            <h2 id={`privacy-${k}`} className="text-lg font-extrabold text-ink">{t(`privacy.${k}.t`)}</h2>
            <dl className="mt-3 space-y-3 leading-relaxed">
              {(["what", "who", "kept"] as const).map((f) => (
                <div key={f}>
                  <dt className="text-sm font-extrabold text-ink">{t(`privacy.${f}`)}</dt>
                  <dd className="text-muted">{t(`privacy.${k}.${f}`)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <Plain id="device" />
        <Plain id="rights" />
        <Plain id="contact" />
      </div>
    </article>
  );
}
