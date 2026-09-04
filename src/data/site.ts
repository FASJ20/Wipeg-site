/* ------------------------------------------------------------------
   WIPEG — single source of truth for site content.

   Everything in this file marked  ✅ FLIER  is taken verbatim from the
   official WIPEG fliers. Everything marked  🔶 PLACEHOLDER  is invented
   and MUST be replaced with real information from the school before the
   site goes live. See REPLACE-ME.md at the project root for the full list.
------------------------------------------------------------------- */

/* ✅ Identity, accreditation and contact — taken from the 2026 campaign
   posters. GAROUA is the main campus; Bamenda is one of five branches. */
export const school = {
  short: "WIPEG",
  name: "Wisdom Institute for Professionalism and Excellent Growth",
  motto: "Professionalism & Excellent Growth",
  /* ✅ POSTER — the ribbon on the official crest */
  ribbon: "Drivers of Professionalism for Excellence and Growth",
  /* ✅ POSTER — the strapline that closes the campaign posters */
  tagline: "WIPEG, a place to be",
  authNumber: "23-07002/NHA/MINESUP/DDES/ESUP/SDA/MF",
  ministry: "Ministry of Higher Education (MINESUP)",
  /* ✅ POSTER — academic backing, shown top-right on the campus poster */
  mentoredBy: "University of Maroua",
  affiliatedTo: "The University of Bamenda",
  awards: [
    "HND / BTS",
    "Bachelors & Masters Degree",
    "Vocational Training",
    "IT Certifications",
  ],
  phones: ["+237 677 487 127", "+237 675 413 814", "+237 690 779 552"],
  /* ✅ POSTER — the institute's real address */
  email: "wipeggaroua@gmail.com",
  website: "WipegGaroua.com",
  campus: {
    name: "Garoua Campus",
    city: "Garoua",
    line: "Plateau, behind Collège de l'Espoir",
    detail:
      "Plateau, behind Collège de l'Espoir (near Collège Bilingue de l'Espoir, behind the Governor's office), Garoua, North Region, Cameroon",
  },
  /* 🔶 PLACEHOLDER — office hours are still not stated on any material */
  hours: "Monday – Friday, 8:00 – 17:00 · Saturday, 9:00 – 13:00",
  /* ✅ POSTER — the posters show Facebook, WhatsApp and Instagram icons.
     🔶 The handles/URLs themselves are not printed, so these still need
     the real links. */
  socials: [
    { label: "Facebook", href: "#" },
    { label: "WhatsApp", href: "https://wa.me/237677487127" },
    { label: "Instagram", href: "#" },
  ],
} as const;

/* ✅ POSTER — "OUR BRANCHES IN CAMEROON", with the number printed
   beneath each city. Garoua is the main campus. */
export const branches = [
  {
    city: "Garoua",
    region: "North Region",
    phone: "+237 677 487 127",
    main: true,
    note: "Plateau, behind Collège de l'Espoir",
  },
  { city: "Yaoundé", region: "Centre Region", phone: "+237 682 832 207", main: false },
  { city: "Maroua", region: "Far North Region", phone: "+237 655 596 057", main: false },
  { city: "Bamenda", region: "North West Region", phone: "+237 677 487 127", main: false },
  { city: "Touboro", region: "North Region", phone: "+237 656 894 203", main: false },
] as const;

/* ------------------------------------------------------------------ */
/* Departments & programmes — ✅ FLIER, every course listed verbatim   */
/* ------------------------------------------------------------------ */

export type Department = {
  slug: string;
  name: string;
  short: string;
  icon: string;
  image: string;
  blurb: string;
  courses: string[];
  levels: string[];
  /* 🔶 PLACEHOLDER — intake sizes are illustrative */
  duration: string;
  mode: string;
};

export const departments: Department[] = [
  {
    slug: "medical-biomedical-sciences",
    name: "Medical & Biomedical Sciences",
    short: "Medical Sciences",
    icon: "Stethoscope",
    image: "/images/medical-lecture.jpg",
    blurb:
      "Clinical training built around supervised practice, so graduates step onto a ward already knowing how it works.",
    courses: ["Nursing", "Laboratory Technician", "Midwifery"],
    levels: ["HND / BTS", "Bachelor"],
    duration: "2 – 3 years",
    mode: "Full-time",
  },
  {
    slug: "computer-engineering",
    name: "Computer Engineering",
    short: "Computer Engineering",
    icon: "Cpu",
    image: "/images/computer-lab.jpg",
    blurb:
      "Software, networks, security and automation taught on real equipment in the WIPEG computer laboratory.",
    courses: [
      "Software Engineering",
      "Network and Security",
      "Computer Science and Networks",
      "Computer Engineering",
      "Data Base Management",
      "Computer Hardware Maintenance",
      "Computer Graphics and Web Design",
      "E-commerce and Digital Marketing",
      "Industrial Computing and Automation",
    ],
    levels: ["HND / BTS", "Bachelor", "Master"],
    duration: "2 – 3 years",
    mode: "Full-time",
  },
  {
    slug: "management",
    name: "Management",
    short: "Management",
    icon: "Briefcase",
    image: "/images/mentoring.jpg",
    blurb:
      "Ten management specialisations covering the public sector, private enterprise, sport, air transport and the NGO world.",
    courses: [
      "Assistant Manager",
      "Project Management",
      "Quality Management",
      "Human Resource Management",
      "Logistics and Transport Management",
      "Operation of Air Transport",
      "Sport Management",
      "Management of Non-Governmental Organisations (NGOs)",
      "Information Systems Management",
      "Local Government Management",
    ],
    levels: ["HND / BTS", "Bachelor", "Master"],
    duration: "2 – 3 years",
    mode: "Full-time · Evening",
  },
  {
    slug: "legal-careers",
    name: "Legal Careers",
    short: "Legal Careers",
    icon: "Scale",
    image: "/images/library-group.jpg",
    blurb:
      "Practical law for chambers, customs desks and corporate offices — drafting, procedure and compliance.",
    courses: [
      "Legal Assistant",
      "Business Law",
      "Land Law",
      "Tax Management",
      "Custom and Transit",
    ],
    levels: ["HND / BTS", "Bachelor"],
    duration: "2 – 3 years",
    mode: "Full-time",
  },
  {
    slug: "it-programs",
    name: "IT Programs",
    short: "IT Programs",
    icon: "Code2",
    image: "/images/lecturer-programmes.jpg",
    blurb:
      "Certification tracks that take a beginner to deployable, production-grade engineering work.",
    courses: [
      "Full Stack Development",
      "DevOps Engineering",
      "Backend Development",
      "Frontend Development",
      "Basic IT",
    ],
    levels: ["IT Certification", "Vocational Training"],
    duration: "3 – 12 months",
    mode: "Full-time · Evening",
  },
  {
    slug: "education",
    name: "Education",
    short: "Education",
    icon: "GraduationCap",
    image: "/images/lecturer-values.jpg",
    blurb:
      "Train the trainers — didactics, school administration and specialist support for learners with additional needs.",
    courses: [
      "Didactics, Curriculum Development and Teaching",
      "Education Management and Administration",
      "Special Needs",
    ],
    levels: ["HND / BTS", "Bachelor", "Master"],
    duration: "2 – 3 years",
    mode: "Full-time",
  },
  {
    slug: "home-economics",
    name: "Home Economics",
    short: "Home Economics",
    icon: "ChefHat",
    image: "/images/library-study.jpg",
    blurb:
      "Studio-based crafts with a direct route to self-employment: bakery, textiles and beauty.",
    courses: [
      "Bakery and Food Processing",
      "Fashion Clothing and Textile",
      "Beauty-Esthetics",
    ],
    levels: ["Vocational Training", "HND / BTS"],
    duration: "1 – 2 years",
    mode: "Full-time",
  },
  {
    slug: "agricultural-food-sciences",
    name: "Agricultural and Food Sciences",
    short: "Agriculture & Food",
    icon: "Sprout",
    image: "/images/graduates.jpg",
    blurb:
      "Agropastoral enterprise from the soil up — production, processing and advisory practice.",
    courses: [
      "Food Technology",
      "Animal Production",
      "Crop Production",
      "Agropastoral Entrepreneurship",
      "Agropastoral Adviser",
    ],
    levels: ["HND / BTS", "Bachelor"],
    duration: "2 – 3 years",
    mode: "Full-time",
  },
  {
    slug: "business-and-finance",
    name: "Business and Finance",
    short: "Business & Finance",
    icon: "LineChart",
    image: "/images/lecturer-banner.jpg",
    blurb:
      "Accounting, banking and commercial practice taught to the standards employers actually audit against.",
    courses: [
      "Accounting",
      "Marketing",
      "Trade-Sale",
      "Banking and Finance",
      "Insurance",
    ],
    levels: ["HND / BTS", "Bachelor", "Master"],
    duration: "2 – 3 years",
    mode: "Full-time · Evening",
  },
  {
    slug: "mining-petroleum-engineering",
    name: "Mining and Petroleum Engineering",
    short: "Mining & Petroleum",
    icon: "Mountain",
    image: "/images/lecturer-career.jpg",
    blurb:
      "Extraction, safety and resource management for Cameroon's growing energy and minerals sector.",
    courses: [
      "Mining Engineering",
      "Petroleum Engineering",
      "Health, Safety and Environment",
    ],
    levels: ["HND / BTS", "Bachelor"],
    duration: "2 – 3 years",
    mode: "Full-time",
  },
];

export const totalCourses = departments.reduce(
  (n, d) => n + d.courses.length,
  0,
);

/* ✅ FLIER — the "OUR FEATURING PARTNERS" institutions, plus HIPTEX, a
   friendly institute in Garoua (Auth. N° 21-00601/N/MINESUP). */
export const partners = [
  "The University of Bamenda",
  "Bamenda University of Science and Technology",
  "Higher Institute for Professionalism and Excellence (HIPTEX), Garoua",
  "Self-Reliance Institute of Vocational Training of Garoua",
  "Institute of Self-Reliance for Business, Science and Technology of Toubouro",
];

/* ✅ FLIER — the "WHY CHOOSE WIPEG?" panel, verbatim offers */
export const advantages = [
  {
    icon: "Car",
    title: "Free driving lessons",
    body: "Every student takes driving lessons at no extra cost and leaves with a Category B licence afterward.",
    tag: "Special offer",
  },
  {
    icon: "Languages",
    title: "Free English lessons",
    body: "Free English classes leading to an English Language Training Certificate alongside your main programme.",
    tag: "Special offer",
  },
  {
    icon: "Wallet",
    title: "Moderate fees, paid in installments",
    body: "Fees are kept moderate and can be spread across the academic year instead of paid in one lump sum.",
    tag: "Fees",
  },
  {
    icon: "Award",
    title: "Scholarships available",
    body: "Scholarship places are offered each intake to students who meet the academic and need criteria.",
    tag: "Funding",
  },
];

/* ✅ FLIER — accreditation facts. 🔶 the counts are derived, the
   student figure is a placeholder. */
export const stats = [
  { value: 10, suffix: "", label: "Academic departments" },
  { value: totalCourses, suffix: "+", label: "Programmes on offer" },
  { value: partners.length, suffix: "", label: "Partner institutions" },
  { value: 1200, suffix: "+", label: "Students enrolled", placeholder: true },
];

/* ------------------------------------------------------------------ */
/* 🔶 PLACEHOLDER — lecturers. Replace names, roles and photos.        */
/* ------------------------------------------------------------------ */
export const lecturers = [
  {
    name: "Dr. Ngwa Emmanuel",
    role: "Head, Medical & Biomedical Sciences",
    image: "/images/medical-lecture.jpg",
  },
  {
    name: "Mr. Tanyi Bertrand",
    role: "Head, Computer Engineering & IT",
    image: "/images/lecturer-values.jpg",
  },
  {
    name: "Mrs. Achu Vivian",
    role: "Head, Business and Finance",
    image: "/images/lecturer-programmes.jpg",
  },
  {
    name: "Mr. Fon Nsom Peter",
    role: "Head, Management & Legal Careers",
    image: "/images/lecturer-career.jpg",
  },
];

/* 🔶 PLACEHOLDER — testimonials. Replace with real student quotes. */
export const testimonials = [
  {
    quote:
      "I came to WIPEG for the HND in Computer Science and Networks and left with the certificate, a driving licence and an English certificate. The lecturers stayed with us until the practicals actually worked.",
    name: "Melvis A.",
    role: "HND, Computer Science and Networks",
    image: "/images/library-study.jpg",
  },
  {
    quote:
      "The nursing programme put me on the ward from the first year. By the time I finished, the hospital I did my placement at already knew my name.",
    name: "Clarisse N.",
    role: "HND, Nursing",
    image: "/images/graduates.jpg",
  },
  {
    quote:
      "Paying in installments is what made it possible for my family. Nobody at WIPEG ever made me feel small about it, and I graduated on time.",
    name: "Bright T.",
    role: "BTS, Accounting",
    image: "/images/mentoring.jpg",
  },
];

/* ✅ FLIER-derived answers, phrased for the web */
export const faqs = [
  {
    q: "Is WIPEG a recognised institution?",
    a: `Yes. WIPEG operates under authorisation N° ${school.authNumber} and is affiliated to the ${school.ministry}.`,
  },
  {
    q: "What qualifications can I earn at WIPEG?",
    a: "HND and BTS diplomas, Bachelors and Masters degrees, vocational training certificates and IT certifications — across ten academic departments.",
  },
  {
    q: "Do you really offer free driving and English lessons?",
    a: "Yes. Every enrolled student is entitled to free driving lessons with a Category B licence afterward, and free English lessons leading to an English Language Training Certificate.",
  },
  {
    q: "Can I pay my fees in installments?",
    a: "Fees at WIPEG are deliberately moderate and can be paid in installments across the academic year. Scholarship places are also available each intake.",
  },
  {
    q: "Which institutions does WIPEG work with?",
    a: `We work with ${partners.length} institutions — ${partners.slice(0, 2).join(", ")}, HIPTEX in Garoua, and the Self-Reliance institutes in Garoua and Touboro.`,
  },
  {
    q: "Where is the main campus and how do I visit?",
    a: `Our main campus is in ${school.campus.city} — ${school.campus.detail}. Call ${school.phones[0]} to arrange a visit.`,
  },
  {
    q: "Does WIPEG have branches outside Garoua?",
    a: `Yes. Alongside the ${school.campus.city} main campus we run branches in ${branches
      .filter((b) => !b.main)
      .map((b) => b.city)
      .join(", ")}. Every branch teaches the same programmes under the same authorisation.`,
  },
  {
    q: "Is WIPEG backed by any university?",
    a: `WIPEG is mentored by the ${school.mentoredBy} and affiliated to ${school.affiliatedTo}, which opens progression routes for our graduates into degree-level study.`,
  },
];

/* 🔶 PLACEHOLDER — news items. Replace with real school news. */
export const news = [
  {
    slug: "new-intake-open",
    category: "Admissions",
    title: "New academic intake now open across all ten departments",
    excerpt:
      "Applications are open for HND/BTS, Bachelors, Masters, vocational and IT certification tracks at the Garoua main campus and every branch.",
    image: "/images/real-graduands-line.jpg",
    date: "12 August 2026",
    author: "WIPEG Admissions",
  },
  {
    slug: "it-certification-lab",
    category: "Campus",
    title: "Expanded IT certification lab opens for full-stack and DevOps tracks",
    excerpt:
      "The computer engineering block adds new workstations for the full-stack, backend, frontend and DevOps certification programmes.",
    image: "/images/computer-lab.jpg",
    date: "29 July 2026",
    author: "WIPEG Communications",
  },
  {
    slug: "partnership-bamenda",
    category: "Partnerships",
    title: "Strengthening our partnership with the University of Bamenda",
    excerpt:
      "Continued collaboration opens further progression routes for WIPEG graduates into degree-level study.",
    image: "/images/real-award.jpg",
    date: "03 July 2026",
    author: "Office of the Director",
  },
];

/* ✅ FLIER-derived admissions journey. 🔶 the specific document list
   should be confirmed with the registry. */
export const admissionSteps = [
  {
    title: "Choose your programme",
    body: "Pick a department and a course from the ten departments listed on this site. Call us if you want to talk it through first.",
  },
  {
    title: "Submit your application",
    body: "Complete the enquiry form or visit the Garoua campus registry — or any branch — with your certificates and identification.",
  },
  {
    title: "Registry review",
    body: "The registry confirms your eligibility for the level you applied to — HND/BTS, Bachelor, Master, vocational or certification.",
  },
  {
    title: "Confirm your place",
    body: "Settle your first installment, collect your student file, and register for the free driving and English lesson programmes.",
  },
];

/* 🔶 PLACEHOLDER — confirm with the registry before publishing */
export const entryRequirements = [
  "GCE Ordinary Level (or equivalent) for vocational and certification programmes",
  "GCE Advanced Level (or equivalent) for HND / BTS entry",
  "HND / BTS or equivalent for Bachelor top-up entry",
  "Bachelor degree in a related field for Master entry",
  "Two passport photographs and a copy of your birth certificate or national ID",
];

export const navigation = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  {
    label: "Programmes",
    href: "/programmes",
    children: departments.map((d) => ({
      label: d.name,
      href: `/programmes/${d.slug}`,
    })),
  },
  { label: "Admissions", href: "/admissions" },
  { label: "Campus", href: "/campus" },
  { label: "Contact", href: "/contact" },
];
