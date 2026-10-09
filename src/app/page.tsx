import Link from "next/link";

const PRICE_NAIRA = "₦5,000";

export default function LandingPage() {
  return (
    <main>
      <SiteHeader />
      <Hero />
      <WhySection />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <PrivacyNote />
      <SiteFooter />
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-serif text-lg text-navy">myHealthcareCV</span>
        <nav className="flex items-center gap-6 text-sm">
          <a href="#how-it-works" className="hidden text-ink/70 hover:text-ink sm:inline">
            How it works
          </a>
          <a href="#pricing" className="hidden text-ink/70 hover:text-ink sm:inline">
            Pricing
          </a>
          <Link
            href="/login"
            className="rounded-sm border border-navy px-4 py-2 text-navy hover:bg-navy hover:text-paper"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
      <div>
        <h1 className="font-serif text-4xl leading-[1.1] text-ink md:text-5xl">
          Tailor your CV to the job you&rsquo;re actually applying for.
        </h1>
        <p className="mt-6 max-w-prose text-lg text-ink/75">
          Upload your CV, paste the job description, and myHealthcareCV rewrites your
          experience to match it — without inventing a job, a certification, or a
          number you haven&rsquo;t earned.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/signup"
            className="rounded-sm bg-amber px-6 py-3 font-medium text-paper hover:bg-amber-dark"
          >
            Optimize my CV
          </Link>
          <a href="#how-it-works" className="text-sm font-medium text-navy underline underline-offset-4">
            See how it works
          </a>
        </div>
        <p className="mt-4 text-sm text-ink/50">
          Built for nurses, HMO and health-insurance staff, clinicians, and any
          other professional moving toward a new role.
        </p>
      </div>

      <CvMockup />
    </section>
  );
}

/** A grounded stand-in for the product itself — a CV fragment with matched
 * phrases highlighted — rather than an abstract dashboard screenshot. */
function CvMockup() {
  return (
    <div className="rounded-sm border border-line bg-white p-6 shadow-[0_1px_0_0_rgba(20,24,31,0.06)]">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <p className="font-serif text-base text-ink">Adaeze Okonkwo</p>
          <p className="text-xs text-ink/50">Claims &amp; Provider Operations</p>
        </div>
        <span className="rounded-sm bg-verdant-light px-2.5 py-1 text-xs font-medium text-verdant">
          84% match
        </span>
      </div>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink/80">
        <p>
          Managed pre-authorization and{" "}
          <mark className="bg-amber/20 px-0.5 text-ink">claims adjudication</mark> for a
          panel of 40+ HMO-enrolled facilities.
        </p>
        <p>
          Reduced average{" "}
          <mark className="bg-amber/20 px-0.5 text-ink">turnaround time on provider queries</mark> through a
          revised escalation workflow.
        </p>
        <p className="text-ink/50">Certifications — not found in CV (flagged as a gap, not assumed absent)</p>
      </div>
    </div>
  );
}

function WhySection() {
  const points = [
    {
      title: "Never fabricates",
      body: "Every rewrite stays inside what your CV actually supports. Missing requirements are flagged as gaps, not quietly invented.",
    },
    {
      title: "Reads the job, not just the title",
      body: "When you paste a real job description, it outranks any generic assumption about what your role \u201cusually\u201d needs.",
    },
    {
      title: "Healthcare-fluent, not healthcare-only",
      body: "Built with deep healthcare and HMO context, but works the same way for any legitimate role, industry, or country.",
    },
    {
      title: "Country-aware, not one-size-fits-all",
      body: "Formatting and conventions adjust to where you\u2019re applying \u2014 offered as guidance, never as legal or immigration advice.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl border-t border-line px-6 py-20">
      <h2 className="font-serif text-3xl text-ink">Why myHealthcareCV</h2>
      <div className="mt-10 grid gap-x-10 gap-y-10 md:grid-cols-2">
        {points.map((p) => (
          <div key={p.title} className="border-t border-line pt-5">
            <h3 className="font-medium text-navy">{p.title}</h3>
            <p className="mt-2 max-w-prose text-ink/70">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: "Upload your CV",
      body: "PDF or Word. We extract your history into a structured profile and let you review it before anything is rewritten.",
    },
    {
      title: "Tell us what you\u2019re applying for",
      body: "Job title, the job description if you have it, target country, and experience level \u2014 all free text, never a restrictive dropdown.",
    },
    {
      title: "We analyze the match",
      body: "Strong matches, partial matches, and real gaps \u2014 with \u201cnot in your CV\u201d always kept separate from \u201cyou don\u2019t have this.\u201d",
    },
    {
      title: "Get your optimized CV",
      body: `Rewritten to align with the role. Preview the analysis for free; download the finished CV for ${PRICE_NAIRA}.`,
    },
  ];

  return (
    <section id="how-it-works" className="mx-auto max-w-6xl border-t border-line px-6 py-20">
      <h2 className="font-serif text-3xl text-ink">How it works</h2>
      <ol className="mt-10 space-y-8">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-6 border-l-2 border-navy/20 pl-6">
            <span className="font-serif text-2xl text-navy/40">{i + 1}</span>
            <div>
              <h3 className="font-medium text-ink">{step.title}</h3>
              <p className="mt-1 max-w-prose text-ink/70">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl border-t border-line px-6 py-20">
      <h2 className="font-serif text-3xl text-ink">Pricing</h2>
      <div className="mt-10 max-w-md rounded-sm border border-navy/20 bg-navy-dark p-8 text-paper">
        <p className="text-sm text-paper/70">Per CV optimization</p>
        <p className="mt-2 font-serif text-4xl">{PRICE_NAIRA}</p>
        <ul className="mt-6 space-y-2 text-sm text-paper/80">
          <li>Full analysis and match preview before you pay</li>
          <li>Optimized, downloadable CV in PDF and Word</li>
          <li>Reuse your uploaded CV for as many separate applications as you like</li>
        </ul>
        <Link
          href="/signup"
          className="mt-8 inline-block rounded-sm bg-amber px-6 py-3 font-medium text-paper hover:bg-amber-dark"
        >
          Get started
        </Link>
      </div>
      <p className="mt-4 text-sm text-ink/50">Paid securely through Paystack.</p>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "Will it invent things I haven\u2019t done?",
      a: "No. The optimization only rewrites and reframes what\u2019s already in your CV. Anything the job needs that your CV doesn\u2019t support is shown to you as a gap, not filled in.",
    },
    {
      q: "Do I have to be a nurse or work in healthcare?",
      a: "No. Healthcare is where myHealthcareCV started, but the target job, industry, and country are always free text \u2014 it works for any legitimate role.",
    },
    {
      q: "What if I don\u2019t have a job description yet?",
      a: "You can optimize using just your target job title and profession. Pasting a real job description gives a more precise result, since it\u2019s treated as the strongest signal.",
    },
    {
      q: "What do I get at the end?",
      a: "An optimized CV as a downloadable PDF and Word document, plus an AI-estimated CV-to-job alignment score and a breakdown of matches and gaps.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl border-t border-line px-6 py-20">
      <h2 className="font-serif text-3xl text-ink">Frequently asked</h2>
      <div className="mt-10 max-w-prose divide-y divide-line">
        {faqs.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="cursor-pointer list-none font-medium text-ink marker:content-none">
              {item.q}
            </summary>
            <p className="mt-3 text-ink/70">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function PrivacyNote() {
  return (
    <section className="mx-auto max-w-6xl border-t border-line px-6 py-20">
      <h2 className="font-serif text-3xl text-ink">Privacy &amp; security</h2>
      <p className="mt-6 max-w-prose text-ink/70">
        Your CV is stored securely and is only ever readable by you and, where
        needed for support, an administrator. It is never shared with
        employers or third parties. Country-specific guidance reflects common
        conventions, not legal or immigration advice — check requirements for
        your situation with a qualified source. Please don&rsquo;t upload a CV
        or any personal information you don&rsquo;t have the right to share.
      </p>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-10 text-sm text-ink/50 sm:flex-row sm:items-center sm:justify-between">
        <p>myHealthcareCV &mdash; operated by Find Nurses NG</p>
        <div className="flex gap-6">
          <Link href="/privacy" className="hover:text-ink">Privacy policy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
        </div>
      </div>
    </footer>
  );
} "Fix homepage"
