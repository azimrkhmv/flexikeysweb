"use client";

import { useState } from "react";
import { CLOUDY_FACES, CLOUDY_FORMS, Cloudy, CloudShape, type CloudyFace, type CloudyForm } from "@/components/Cloudy";
import { SCHEMES } from "@/lib/scheme";

// Test page for Cloudy (B101): every form in every colour scheme, the four faces, and a change of form with its
// sparkles. Labels are English on purpose: it is a page for checking the drawing, like /dev/design.

const NEXT = (f: CloudyForm) => CLOUDY_FORMS[(CLOUDY_FORMS.indexOf(f) + 1) % CLOUDY_FORMS.length];

export default function CloudyTest() {
  const [form, setForm] = useState<CloudyForm>("cloud");
  const [face, setFace] = useState<CloudyFace>("happy");
  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <h1 className="text-3xl font-semibold text-ink">Cloudy: every form in every colour scheme</h1>
      {SCHEMES.map((s) => (
        <section key={s} data-pal={s === "hills" ? undefined : s} className="rounded-[24px] border-[1.5px] p-5" style={{ background: "var(--sky)", borderColor: "var(--edge)", color: "var(--ink)" }}>
          <h2 className="mb-3 text-xl font-semibold capitalize">{s}</h2>
          <ul className="flex flex-wrap items-end gap-6">
            {CLOUDY_FORMS.map((f) => (
              <li key={f} className="text-center text-sm font-bold">
                <Cloudy size={112} form={f} label={`Cloudy as a ${f}, ${s}`} />
                <span className="mt-3 block">{f}</span>
              </li>
            ))}
            <li className="w-28 text-center text-sm font-bold">
              <CloudShape />
              <span className="mt-3 block">page cloud</span>
            </li>
          </ul>
        </section>
      ))}
      <section className="fk-card p-5">
        <h2 className="mb-3 text-xl font-semibold text-ink">Faces</h2>
        <ul className="flex flex-wrap gap-6">
          {CLOUDY_FACES.map((f) => (
            <li key={f} className="text-center text-sm font-bold text-ink">
              <Cloudy size={112} face={f} label={`Cloudy, ${f} face`} />
              <span className="mt-3 block">{f}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="fk-card flex flex-wrap items-center gap-6 p-5">
        <Cloudy size={168} form={form} face={face} label={`Cloudy as a ${form}`} />
        <div className="flex flex-wrap gap-3">
          <button type="button" className="fk-btn h-11 rounded-full px-5 font-bold" onClick={() => setForm(NEXT(form))}>
            Change form (now: {form})
          </button>
          <button type="button" className="fk-btn-2 h-11 rounded-full px-5 font-bold" onClick={() => setFace(CLOUDY_FACES[(CLOUDY_FACES.indexOf(face) + 1) % CLOUDY_FACES.length])}>
            Change face (now: {face})
          </button>
        </div>
      </section>
    </main>
  );
}
