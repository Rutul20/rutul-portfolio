/**
 * Every word on the site lives in this file. Edit here, not in the components.
 *
 * Source of truth: Rutul's résumé plus answers he confirmed while planning the site.
 * Nothing here is invented. A missing detail stays missing (e.g. no metrics, no client names).
 *
 * After changing anything in this file, run `npm run renders` so the mobile/no-WebGL
 * pictures of the city match. `npm run build` refuses to build with stale renders.
 */

export type LinkItem = { label: string; href: string };

export type Role = {
  company: string;
  title: string;
  period: string;
  place: string;
  points: string[];
};

export type Project = {
  name: string;
  kind: string;
  /** Leave out when unknown: nothing is shown rather than a guess. */
  period?: string;
  summary: string;
  stack: string[];
  points?: string[];
  link?: LinkItem;
  /** Screenshots in /public/shots. Leave empty when there are none. */
  shots?: { src: string; alt: string }[];
  /** Hidden while null; set the URL once the demo is published and a "Try the live demo" button appears. */
  demoUrl?: string | null;
  /** Which building represents it in the city (client work only; the city has one slot per type). */
  building?: 'market' | 'school' | 'clinic' | 'shop';
  /** Colour of the project's tile on the shelf when it has no screenshot. */
  tint?: string;
};

export const profile = {
  name: 'Rutul Dave',
  initials: 'RD',
  role: 'Senior / Lead Frontend Engineer',
  currentTitle: 'Scrum Master & Lead Front-End Developer at AV Devs Solutions',
  location: 'Vadodara, Gujarat, India',
  years: '6+ years',
  stack: ['Next.js', 'React', 'TypeScript'],
  summary:
    'I lead frontend work in Next.js and React: reusable component libraries and design systems, pixel-perfect UI from Figma with a focus on performance and accessibility, and the build pipelines that ship it. I also run my team’s Scrum ceremonies and client conversations.',
  photo: {
    src: '/photo/rutul-640.webp',
    srcSet: '/photo/rutul-320.webp 320w, /photo/rutul-640.webp 640w',
    alt: 'Rutul Dave smiling, in a blue checked shirt, in an office',
  },
};

export const about = {
  paragraphs: [
    'I’m a frontend developer from Vadodara. Since 2021 I’ve led frontend work at AV Devs Solutions, where I’m also the team’s Scrum Master and the main point of contact for client communication and requirement gathering.',
    'Before that I built React applications at OpenEyes Technologies. Across six years I’ve worked on e-commerce, learning, healthcare and survey platforms, and since 2023 on ePost, a digital mail app.',
  ],
  community: 'Outside work I’m active in Vadodara’s Google Cloud and AWS developer communities.',
};

/** Newest first. The city shows them as three buildings growing taller over time. */
export const experience: Role[] = [
  {
    company: 'AV Devs Solutions Pvt. Ltd.',
    title: 'Scrum Master & Lead Front-End Developer',
    period: 'Nov 2021 – Present',
    place: 'Vadodara',
    points: [
      'Lead front-end architecture and feature development in Next.js and React with TypeScript.',
      'Architect and maintain reusable component libraries and front-end design systems.',
      'Turn Figma designs and wireframes into pixel-perfect code, with a focus on performance and accessibility.',
      'Provide middleware support between the UI and RESTful APIs.',
      'As Scrum Master, run stand-ups, sprint planning, retrospectives and backlog grooming.',
      'Primary point of contact for client communication and requirement gathering.',
    ],
  },
  {
    company: 'OpenEyes Technologies',
    title: 'Software Developer',
    period: 'Jul 2020 – Nov 2021',
    place: 'Vadodara',
    points: [
      'Built and maintained React applications with dynamic, component-driven UIs.',
      'Built testable, reusable components integrated with back-end APIs.',
      'Upgraded legacy systems to improve performance and reliability.',
      'Worked with UX designers, business analysts and back-end developers on end-to-end solutions.',
    ],
  },
  {
    company: 'Odysseus Solutions Pvt. Ltd.',
    title: 'Software Developer Intern',
    period: 'Dec 2019 – Mar 2020',
    place: 'Vadodara',
    points: [
      'Built web application forms and validation with .NET MVC.',
      'Worked in Git-based workflows on UI tasks and took part in code reviews.',
    ],
  },
];

export const flagship: Project = {
  name: 'ePost',
  kind: 'Lead Frontend Developer, through AV Devs',
  period: '2023 – present',
  summary:
    'A digital mail app: people receive letters, pay bills, sign contracts and file documents, all in one place.',
  stack: ['Next.js', 'TypeScript', 'React', 'Nx monorepo', 'Docker', 'Kaniko', 'Cloud Build'],
  points: [
    'Build and maintain the ePost web app in Next.js and TypeScript inside an Nx monorepo: user-facing features, translations and unit tests.',
    'Work on SmartSend, a second app in the same monorepo: the order flow, address checking, and access checks on server entry points.',
    'Maintain the shared libraries (utilities, UI components and service layers) used across the apps.',
    'Sped up CI image builds: moved them to Kaniko, split shared libraries into separate Docker layers for caching, added a Turbo remote cache to Cloud Build, and run unit tests before images are built.',
  ],
  link: { label: 'epost.ch', href: 'https://www.epost.ch' },
};

export const clientWork: Project[] = [
  {
    name: 'E-commerce web application',
    kind: 'Client project',
    period: '2021 – present',
    summary: 'A full-featured online store with a dynamic product catalogue, cart and checkout.',
    stack: ['Next.js'],
    building: 'market',
  },
  {
    name: 'Learning management system',
    kind: 'Client project',
    period: '2021 – present',
    summary: 'Course delivery, progress tracking and assessments.',
    stack: ['React'],
    building: 'school',
  },
  {
    name: 'Healthcare & survey platform',
    kind: 'Client project',
    period: '2021 – present',
    summary: 'Data-driven healthcare and survey tools with REST API integration and real-time reporting.',
    stack: ['React'],
    building: 'clinic',
  },
  {
    name: 'Pinter',
    kind: 'Client project',
    summary:
      'A direct-to-consumer store for home-brewing kit and fresh beer packs: product collections, cart, subscriptions and checkout, plus product guides and customer support.',
    stack: ['JavaScript', 'PHP', 'Shopify'],
    link: { label: 'pinter.co.uk', href: 'https://pinter.co.uk/' },
    building: 'shop',
  },
];

export const sideProjects: Project[] = [
  {
    name: 'NEXORA',
    kind: 'Personal project',
    period: '2026',
    summary: 'An explorable 3D shopping universe.',
    stack: ['React 19', 'TypeScript', 'Three.js', 'React Three Fiber', 'GSAP', 'Zustand', 'Tailwind'],
    points: [
      'Fly from a space hub through portals into a Fashion dimension: pull garments off their fixtures into a 360° viewer with detail hotspots, try them on an avatar, put outfits together and watch them walk a runway. A second “Tech” dimension runs on the same engine.',
      'Every 3D model is generated in code, with no downloaded assets.',
      'Render-quality tiers are detected automatically and step down on weaker GPUs.',
      'Devices without WebGL get a 2D catalogue instead; keyboard and touch controls work throughout.',
    ],
    shots: [
      { src: '/shots/nexora-universe.webp', alt: 'NEXORA’s space hub: floating islands and glowing portals to the Fashion and Tech dimensions' },
      { src: '/shots/nexora-viewer.webp', alt: 'The Streetwear zone in NEXORA’s Fashion dimension, with garments on a floating rail' },
    ],
    demoUrl: null,
  },
  {
    name: 'Sasta',
    kind: 'Personal project',
    period: '2026',
    summary: 'Live price comparison for Indian shopping platforms.',
    stack: ['React', 'Vite', 'Tailwind', 'Express', 'Server-Sent Events', 'Playwright'],
    points: [
      'Search once and results stream in from each platform as it answers, priced for your PIN code.',
      'Listings are compared like for like: only the same pack size and variant get ranked, so 2 × 500 g doesn’t count as 1 kg.',
      'Honest by design: it never shows a guessed or stale price, and if a platform can’t be read it says so and links out.',
      'Stores nothing: no database and no accounts.',
    ],
    shots: [
      { src: '/shots/sasta-compare.webp', alt: 'Sasta comparing only the 500 g pack of a product, showing the one platform that returned that size' },
    ],
  },
  {
    name: 'Wedmantram',
    kind: 'Team project',
    summary: 'Wedding planning in one place: guest lists, budgets and vendor coordination.',
    stack: ['Core PHP', 'HTML', 'CSS', 'JavaScript'],
    points: [
      'Tools for managing guest lists, tracking budgets and coordinating vendors, to keep planning organised.',
      'Responsive on phones, tablets and desktops.',
    ],
    link: { label: 'wedmantram.com', href: 'https://www.wedmantram.com' },
    tint: '#a94a62',
  },
  {
    name: 'Fitorrbit',
    kind: 'Freelance website',
    summary: 'A website for a gym on Vasna Road, Vadodara: its brand, fitness offerings and facility.',
    stack: ['React'],
    points: [
      'Showcases the gym’s brand and offerings and helps prospective members explore the facility.',
      'Frontend development and deployment, creating an online presence for a local fitness business.',
    ],
    tint: '#2c6b66',
  },
  {
    name: 'SmartBoard',
    kind: 'MCA major project',
    period: '2019',
    summary: 'An Android app to monitor and control home lighting and connected devices over IoT.',
    stack: ['Android (Kotlin)', 'ESP8266', 'Arduino'],
    points: [
      'Uses connected sensors and IoT communication to monitor and control lights and devices at home.',
      'Brings mobile app development together with hardware.',
    ],
    tint: '#6e5a9c',
  },
  {
    name: 'Resellers',
    kind: 'BCA major project',
    period: '2018',
    summary: 'A peer-to-peer barter platform: list what you own, find what others offer and swap, no money involved.',
    stack: ['PHP', 'MySQL', 'HTML', 'CSS', 'Bootstrap', 'JavaScript'],
    points: [
      'People list items they own, discover what others offer and connect to arrange an exchange.',
      'Explores a collaborative marketplace built around sharing and trading.',
    ],
    tint: '#9c5038',
  },
];

export const skills: { group: string; items: string[] }[] = [
  { group: 'Frontend', items: ['React (TypeScript)', 'Next.js (App Router)', 'JavaScript (ES6+)', 'HTML5', 'CSS3'] },
  { group: 'UI', items: ['Tailwind CSS', 'Bootstrap', 'Kendo UI', 'Design systems', 'Component libraries'] },
  { group: '3D', items: ['Three.js', 'React Three Fiber'] },
  { group: 'APIs & back end', items: ['REST API integration', 'Middleware', 'Node.js (basic)', 'Express'] },
  { group: 'Data', items: ['MySQL', 'MongoDB'] },
  { group: 'Cloud & DevOps', items: ['AWS', 'Google Cloud', 'Docker', 'CI/CD', 'Kaniko', 'Cloud Build', 'Nx monorepos'] },
  { group: 'Tools', items: ['Git', 'Postman', 'Swagger', 'Playwright'] },
  { group: 'Ways of working', items: ['Scrum (Scrum Master)', 'Client communication', 'Requirement gathering'] },
];

export const education = [
  { degree: 'Master of Computer Applications (MCA)', school: 'Charusat University, Gujarat', date: 'Apr 2020', grade: 'CGPA 8.96 / 10' },
  { degree: 'Bachelor of Computer Applications (BCA)', school: 'Charusat University, Gujarat', date: 'May 2018', grade: 'CGPA 8.43 / 10' },
];

export const workshops = [
  'Cloud Computing using AWS',
  'Ethical Hacking, organised by Gujarat Forensic Science University, Gandhinagar',
  'Internet of Things, sponsored by Gujcost',
];

/** SmartBoard and Resellers live in Side projects; only what isn't there is listed here. */
export const earlyWork = [{ name: 'CVMaker', note: 'Online résumé builder, MCA mini project', year: '2019' }];

export const contact = {
  email: 'dave.rutul@gmail.com',
  links: [
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/rutul-dave-b73181140' },
    { label: 'GitHub', href: 'https://github.com/Rutul20' },
  ] as LinkItem[],
};

/**
 * The toy-train tour. Order = scroll order = order of buildings around the track.
 * `id` is the section's anchor (#about etc.).
 */
export const stops = [
  { id: 'city', label: 'Start', place: 'From Earth to Vadodara' },
  { id: 'about', label: 'About', place: 'Home' },
  { id: 'experience', label: 'Experience', place: 'Office street' },
  { id: 'epost', label: 'ePost', place: 'Post office' },
  { id: 'client-work', label: 'Client work', place: 'Market, school & clinic' },
  { id: 'workshop', label: 'Side projects & skills', place: 'The workshop' },
  { id: 'education', label: 'Education', place: 'College' },
  { id: 'contact', label: 'Contact', place: 'Last stop: the station' },
] as const;

export type StopId = (typeof stops)[number]['id'];

export const site = {
  title: `${profile.name} · ${profile.role}`,
  description:
    'Rutul Dave is a Senior / Lead Frontend Engineer in Vadodara with 6+ years of Next.js, React and TypeScript: component libraries, design systems and the pipelines that ship them.',
};
