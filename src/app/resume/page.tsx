import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import PrintButton from './PrintButton';
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
  workshops,
} from '@/content/content';

export const metadata: Metadata = {
  title: `Résumé · ${profile.name}`,
  description: `${profile.name}: ${profile.role}. Experience, projects, skills and education on one printable page.`,
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mt-8">
    <h2 className="border-b-2 border-ink pb-1 text-xs font-extrabold uppercase tracking-[0.16em]">{title}</h2>
    <div className="mt-3">{children}</div>
  </section>
);

export default function ResumePage() {
  return (
    <div className="resume-page">
      <main className="mx-auto max-w-[50rem] px-5 py-8 md:px-10 md:py-12">
        <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="link">
            ← Back to the city
          </Link>
          <PrintButton />
        </div>

        <header className="flex items-start justify-between gap-6">
          <div>
            <h1 className="font-display text-4xl md:text-5xl">{profile.name}</h1>
            <p className="mt-1 text-lg font-bold">{profile.role}</p>
            <p className="mt-2 text-sm text-ink-soft">
              {profile.location} ·{' '}
              <a className="link" href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
              {contact.links.map((l) => (
                <span key={l.href}>
                  {' · '}
                  <a className="link" href={l.href}>
                    {l.href.replace(/^https:\/\/(www\.)?/, '')}
                  </a>
                </span>
              ))}
            </p>
          </div>
          <img
            src={profile.photo.src}
            alt={profile.photo.alt}
            width={88}
            height={110}
            className="hidden h-[110px] w-[88px] flex-none rounded-xl object-cover sm:block"
          />
        </header>

        <p className="mt-5 leading-relaxed">{profile.summary}</p>

        <Section title="Experience">
          <ol className="space-y-5">
            {experience.map((r) => (
              <li key={r.company}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <h3 className="font-extrabold">{r.title}</h3>
                  <span className="text-sm text-ink-soft">{r.period}</span>
                </div>
                <p className="text-sm font-semibold text-ink-soft">
                  {r.company}, {r.place}
                </p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[0.95rem] leading-relaxed">
                  {r.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Selected work">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h3 className="font-extrabold">{flagship.name}</h3>
              <span className="text-sm text-ink-soft">{flagship.period}</span>
            </div>
            <p className="text-sm font-semibold text-ink-soft">{flagship.kind}</p>
            <p className="mt-1 text-[0.95rem]">{flagship.summary}</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[0.95rem] leading-relaxed">
              {flagship.points?.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="mt-1 text-sm text-ink-soft">{flagship.stack.join(' · ')}</p>
          </div>
          <ul className="mt-4 space-y-2 text-[0.95rem]">
            {clientWork.map((c) => (
              <li key={c.name}>
                <strong>{c.name}</strong> ({c.period}): {c.summary} <span className="text-ink-soft">{c.stack.join(' · ')}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-4 space-y-2 text-[0.95rem]">
            {sideProjects.map((p) => (
              <li key={p.name}>
                <strong>{p.name}</strong> ({p.kind.toLowerCase()}, {p.period}): {p.summary}{' '}
                <span className="text-ink-soft">{p.stack.join(' · ')}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Skills">
          <dl className="grid gap-x-6 gap-y-1.5 text-[0.95rem] sm:grid-cols-[10rem_1fr]">
            {skills.map((g) => (
              <div key={g.group} className="contents">
                <dt className="font-bold">{g.group}</dt>
                <dd className="text-ink-soft">{g.items.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Education">
          <ul className="space-y-1.5 text-[0.95rem]">
            {education.map((e) => (
              <li key={e.degree}>
                <strong>{e.degree}</strong>, {e.school} · {e.date} · {e.grade}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Workshops & community">
          <ul className="list-disc space-y-0.5 pl-5 text-[0.95rem]">
            {workshops.map((w) => (
              <li key={w}>{w}</li>
            ))}
            <li>{about.community.replace('Outside work I’m active', 'Active')}</li>
          </ul>
        </Section>

        <Section title="Early work">
          <ul className="list-disc space-y-0.5 pl-5 text-[0.95rem]">
            {earlyWork.map((w) => (
              <li key={w.name}>
                <strong>{w.name}</strong> ({w.year}): {w.note}
              </li>
            ))}
          </ul>
        </Section>
      </main>
    </div>
  );
}
