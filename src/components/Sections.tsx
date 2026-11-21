import Link from 'next/link';
import ProjectShelf from './ProjectShelf';
import type { ReactNode } from 'react';
import {
  about,
  clientWork,
  contact,
  earlyWork,
  education,
  experience,
  flagship,
  profile,
  sideProjects,
  skills,
  stops,
  workshops,
  type StopId,
} from '@/content/content';

function Stop({ id, children, wide = false }: { id: StopId; children: ReactNode; wide?: boolean }) {
  const index = stops.findIndex((s) => s.id === id);
  const stop = stops[index];
  return (
    <section id={id} data-stop={index} aria-labelledby={`${id}-title`} className="stop">
      <div className={`card ${wide ? '!max-w-[42rem]' : ''}`}>
        <p className="kicker">
          Stop {index + 1} · {stop.place}
        </p>
        {children}
      </div>
    </section>
  );
}

const H2 = ({ id, children }: { id: string; children: ReactNode }) => (
  <h2 id={`${id}-title`} tabIndex={-1} className="mt-2 font-display text-[2rem] leading-tight md:text-[2.4rem]">
    {children}
  </h2>
);

const Chips = ({ items, label }: { items: string[]; label: string }) => (
  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={label}>
    {items.map((t) => (
      <li key={t} className="chip">
        {t}
      </li>
    ))}
  </ul>
);

const Points = ({ items }: { items: string[] }) => (
  <ul className="mt-3 space-y-1.5 text-[0.95rem] leading-relaxed text-ink-soft">
    {items.map((p) => (
      <li key={p} className="relative pl-4 before:absolute before:left-0 before:top-[0.6em] before:size-1.5 before:rounded-full before:bg-accent/70">
        {p}
      </li>
    ))}
  </ul>
);

export function Hero() {
  return (
    <section id="city" data-stop={0} aria-labelledby="city-title" className="stop stop-hero">
      <div className="hero-screen">
      <div className="ticket-wrap">
        <div className="ticket-main">
          <p className="kicker">Admit one · A tour of my city</p>
          <h1 id="city-title" className="mt-3 font-display text-[3rem] leading-[0.98] md:text-[4.2rem]">
            {profile.name}
          </h1>
          <p className="mt-2 text-lg font-bold md:text-xl">{profile.role}</p>
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="At a glance">
            <li className="chip !border-ink !bg-ink !text-surface">{profile.years}</li>
            {profile.stack.map((s) => (
              <li key={s} className="chip">
                {s}
              </li>
            ))}
            <li className="chip">Vadodara, India</li>
          </ul>
          <p className="mt-4 text-[0.98rem] leading-relaxed text-ink-soft">{profile.summary}</p>
        </div>
        <div className="ticket-stub">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/resume/" prefetch={false} className="btn btn-primary">
              View résumé
            </Link>
            <a href="#contact" className="btn btn-ghost">
              Get in touch
            </a>
          </div>
          <p className="mt-3.5 text-sm text-ink-soft">
            Scroll to fly down to Vadodara and ride the toy train through the city, or skip ahead to <a className="link" href="#about">the first stop</a>.
          </p>
        </div>
      </div>
      </div>
      {/* the landing plays while this gap scrolls past */}
      <div className="hero-dive" aria-hidden="true" />
      <div className="hero-landing">
        <p className="landing-note">
          <span className="kicker">Vadodara, Gujarat</span>
          <span className="mt-1 block font-display text-2xl leading-tight text-ink">Welcome to my city, in miniature.</span>
          <span className="mt-1 block text-sm text-ink-soft">The toy train’s first stop is home. Keep scrolling.</span>
        </p>
      </div>
    </section>
  );
}

export function About() {
  return (
    <Stop id="about">
      <div className="mt-2 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <H2 id="about">About</H2>
        </div>
        <img
          src={profile.photo.src}
          srcSet={profile.photo.srcSet}
          sizes="112px"
          alt={profile.photo.alt}
          width={112}
          height={140}
          loading="lazy"
          className="-mt-6 h-[140px] w-[112px] flex-none rotate-2 rounded-2xl border-4 border-white object-cover shadow-lg"
        />
      </div>
      <div className="mt-3 space-y-3 text-[0.98rem] leading-relaxed text-ink-soft">
        {about.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p className="rounded-xl bg-subtle px-4 py-3 text-ink">{about.community}</p>
      </div>
    </Stop>
  );
}

export function Experience() {
  return (
    <Stop id="experience" wide>
      <H2 id="experience">Experience</H2>
      <p className="mt-1 text-sm text-ink-soft">Three offices on one street, each a little taller than the last.</p>
      <ol className="mt-5 space-y-6 border-l-2 border-line pl-5">
        {experience.map((r) => (
          <li key={r.company} className="relative">
            <span className="absolute -left-[1.72rem] top-1.5 size-3 rounded-full border-2 border-surface bg-accent" aria-hidden="true" />
            <h3 className="text-[1.05rem] font-extrabold leading-snug">{r.title}</h3>
            <p className="text-sm font-semibold text-ink-soft">
              {r.company} · <span className="whitespace-nowrap">{r.period}</span>
            </p>
            <Points items={r.points} />
          </li>
        ))}
      </ol>
    </Stop>
  );
}

export function Flagship() {
  const p = flagship;
  return (
    <Stop id="epost" wide>
      <H2 id="epost">{p.name}</H2>
      <p className="mt-1 text-sm font-semibold text-ink-soft">
        {p.kind} · {p.period}
      </p>
      <p className="mt-3 text-[1.02rem] leading-relaxed">{p.summary}</p>
      {p.points && <Points items={p.points} />}
      <Chips items={p.stack} label="Technologies" />
      {p.link && (
        <p className="mt-5">
          <a href={p.link.href} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
            Visit {p.link.label} <span aria-hidden="true">↗</span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </p>
      )}
    </Stop>
  );
}

const BUILDING_NAME = { market: 'the market', school: 'the school', clinic: 'the clinic', shop: 'the shop' } as const;

export function ClientWork() {
  return (
    <Stop id="client-work" wide>
      <H2 id="client-work">Client work</H2>
      <p className="mt-1 text-sm text-ink-soft">Very different domains, one frontend toolkit.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {clientWork.map((c) => (
          <li key={c.name} className="flex flex-col rounded-lg border border-line bg-[var(--tile)] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="font-extrabold">{c.name}</h3>
              {c.period && <span className="text-xs text-ink-soft">{c.period}</span>}
            </div>
            <p className="mt-1 text-[0.9rem] leading-relaxed text-ink-soft">{c.summary}</p>
            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2.5">
              {c.stack.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
              {c.building && <span className="text-xs text-ink-soft">· in the city: {BUILDING_NAME[c.building]}</span>}
            </div>
            {c.link && (
              <a href={c.link.href} className="link mt-2 self-start text-sm" target="_blank" rel="noopener noreferrer">
                {c.link.label} <span aria-hidden="true">↗</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </Stop>
  );
}

export function Workshop() {
  return (
    <Stop id="workshop" wide>
      <H2 id="workshop">Side projects &amp; skills</H2>
      <p className="mt-1 text-sm text-ink-soft">What I build when nobody’s asking. Open any project for the full story.</p>
      <ProjectShelf projects={sideProjects} />
      <h3 className="mt-5 font-display text-xl">The tool wall</h3>
      <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {skills.map((g) => (
          <div key={g.group}>
            <dt className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-ink-soft">{g.group}</dt>
            <dd className="text-[0.85rem] leading-snug">{g.items.join(' · ')}</dd>
          </div>
        ))}
      </dl>
    </Stop>
  );
}

export function Education() {
  return (
    <Stop id="education">
      <H2 id="education">Education</H2>
      <ul className="mt-4 space-y-3">
        {education.map((e) => (
          <li key={e.degree}>
            <h3 className="font-extrabold leading-snug">{e.degree}</h3>
            <p className="text-sm text-ink-soft">
              {e.school} · {e.date} · <strong className="text-ink">{e.grade}</strong>
            </p>
          </li>
        ))}
      </ul>
      <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">Workshops</h3>
      <ul className="mt-2 space-y-1 text-[0.95rem] text-ink-soft">
        {workshops.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">Early work</h3>
      <ul className="mt-2 space-y-1 text-[0.95rem] text-ink-soft">
        {earlyWork.map((w) => (
          <li key={w.name}>
            <strong className="text-ink">{w.name}</strong> ({w.year}): {w.note}
          </li>
        ))}
      </ul>
    </Stop>
  );
}

export function Contact() {
  return (
    <Stop id="contact">
      <H2 id="contact">Let’s talk</H2>
      <p className="mt-2 text-[1.02rem] leading-relaxed text-ink-soft">
        Hiring for a senior or lead frontend role? I’d be glad to hear about it.
      </p>
      <p className="mt-4">
        <a href={`mailto:${contact.email}`} className="break-all font-display text-2xl text-accent underline decoration-2 underline-offset-4 md:text-3xl">
          {contact.email}
        </a>
      </p>
      <div className="mt-5 flex flex-wrap gap-2.5">
        {contact.links.map((l) => (
          <a key={l.href} href={l.href} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
            {l.label} <span aria-hidden="true">↗</span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ))}
        <Link href="/resume/" prefetch={false} className="btn btn-primary">
          Résumé view
        </Link>
      </div>
      <p className="mt-6 border-t border-line pt-4 text-xs text-ink-soft">
        © {new Date().getFullYear()} {profile.name} · Built with Next.js and React Three Fiber · The city is code, not a photo.
      </p>
    </Stop>
  );
}
