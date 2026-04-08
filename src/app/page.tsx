type SignalCard = {
  event: string;
  probability: string;
  confidence: 'High' | 'Medium' | 'Low';
  trend: string;
  disagreement: 'Low' | 'Moderate' | 'High';
  category: string;
};

const signalCards: SignalCard[] = [
  {
    event: 'Will the Fed cut rates in 2026?',
    probability: '62%',
    confidence: 'High',
    trend: '↑ +8% this week',
    disagreement: 'Moderate',
    category: 'Macro',
  },
  {
    event: 'Will a spot ETH ETF exceed $20B inflows this year?',
    probability: '54%',
    confidence: 'Medium',
    trend: '↑ +5% this week',
    disagreement: 'High',
    category: 'Crypto',
  },
  {
    event: 'Will the incumbent party win the next election?',
    probability: '47%',
    confidence: 'Medium',
    trend: '↓ -3% this week',
    disagreement: 'Moderate',
    category: 'Politics',
  },
];

const productSurfaces = ['API (Core)', 'Research Dashboards', 'Browser Extension (OddsLens)', 'Publisher Embeds'];
const credibilityStats = ['28M+ market updates/day', '12 platforms normalized', '<200ms median API response'];

function EventSignalCard({ card, featured = false }: { card: SignalCard; featured?: boolean }) {
  return (
    <article
      className={`rounded-2xl border p-6 shadow-sm backdrop-blur-sm ${
        featured
          ? 'signal-card-featured border-teal-700/40 bg-white/95 shadow-xl shadow-teal-900/15'
          : 'signal-card border-slate-200/80 bg-white/90'
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-wide text-slate-600 uppercase">
          {card.category}
        </span>
        <span className="text-xs font-medium text-slate-500">Live signal</span>
      </div>
      <h3 className="text-lg leading-tight font-semibold text-slate-900">{card.event}</h3>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-slate-500">Probability</dt>
          <dd className="text-2xl font-bold text-slate-900">{card.probability}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Confidence</dt>
          <dd className="font-semibold text-teal-700">{card.confidence}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Trend</dt>
          <dd className={`font-semibold ${card.trend.startsWith('↑') ? 'text-emerald-700' : 'text-rose-700'}`}>
            {card.trend}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Disagreement</dt>
          <dd className="font-semibold text-amber-700">{card.disagreement}</dd>
        </div>
      </dl>
    </article>
  );
}

export default function Home() {
  return (
    <>
      <main className="relative mx-auto w-full max-w-6xl px-6 py-10 md:px-10 md:py-16">
        <section className="mb-10 flex items-center justify-between rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
            <p className="text-sm font-semibold text-slate-800">Truth Layer</p>
          </div>
          <a
            href="#final-cta"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Request Access
          </a>
        </section>

        <section className="grid items-center gap-10 pb-14 md:grid-cols-2 md:pb-20">
          <div className="hero-reveal">
            <p className="mb-4 inline-flex rounded-full border border-teal-700/20 bg-teal-50 px-3 py-1 text-xs font-semibold tracking-wide text-teal-800 uppercase">
              Real-time probability infrastructure
            </p>
            <h1 className="max-w-xl text-4xl leading-tight font-bold text-slate-900 md:text-6xl">
              Real-time probabilities for the world&apos;s events.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              We aggregate prediction markets into a single, trustworthy signal so you can see what&apos;s likely,
              how confident it is, and where experts disagree.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800">
                Get API Access
              </button>
              <button className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:bg-slate-50">
                Request Early Access
              </button>
              <button className="rounded-lg border border-teal-700/30 bg-teal-50 px-5 py-3 text-sm font-semibold text-teal-800 transition hover:-translate-y-0.5 hover:bg-teal-100">
                See Live Examples
              </button>
            </div>
            <ul className="mt-6 flex flex-wrap gap-2">
              {credibilityStats.map((stat) => (
                <li
                  key={stat}
                  className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {stat}
                </li>
              ))}
            </ul>
          </div>
          <div className="hero-reveal-delay">
            <EventSignalCard card={signalCards[0]} featured />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-8 md:p-10">
          <p className="text-sm font-semibold tracking-wide text-slate-500 uppercase">The Problem</p>
          <h2 className="mt-3 text-3xl leading-tight font-semibold text-slate-900">
            The internet doesn&apos;t tell you what&apos;s true. It tells you what people say.
          </h2>
          <ul className="mt-6 grid gap-3 text-slate-700 md:grid-cols-3">
            <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">Conflicting opinions everywhere</li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              No clear signal of what&apos;s likely
            </li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              Prediction markets exist, but are fragmented and hard to use
            </li>
          </ul>
        </section>

        <section className="py-16">
          <p className="text-sm font-semibold tracking-wide text-slate-500 uppercase">The Solution</p>
          <h2 className="mt-3 max-w-3xl text-3xl leading-tight font-semibold text-slate-900">
            We turn fragmented prediction markets into a single, usable truth signal.
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6">
              <h3 className="text-lg font-semibold text-rose-900">Before</h3>
              <ul className="mt-4 space-y-3 text-rose-900/80">
                <li>Multiple markets</li>
                <li>Different prices</li>
                <li>Hard to interpret</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6">
              <h3 className="text-lg font-semibold text-emerald-900">After</h3>
              <ul className="mt-4 space-y-3 text-emerald-900/80">
                <li>One probability</li>
                <li>One confidence score</li>
                <li>One unified view</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-8 md:p-10">
          <p className="text-sm font-semibold tracking-wide text-slate-500 uppercase">How It Works</p>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              'Ingest markets across platforms',
              'Match them into canonical events',
              'Aggregate probabilities',
              'Compute confidence + integrity',
            ].map((step, index) => (
              <div key={step} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Step {index + 1}</p>
                <p className="mt-2 text-sm font-medium text-slate-800">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16">
          <p className="text-sm font-semibold tracking-wide text-slate-500 uppercase">The Output</p>
          <h2 className="mt-3 text-3xl leading-tight font-semibold text-slate-900">
            For any event, you get probability, confidence, trend, and disagreement.
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {signalCards.map((card) => (
              <EventSignalCard key={card.event} card={card} />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-8 md:p-10">
          <p className="text-sm font-semibold tracking-wide text-slate-500 uppercase">Who It&apos;s For</p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-lg font-semibold text-slate-900">Institutions</h3>
              <ul className="mt-3 space-y-2 text-slate-700">
                <li>Better forecasting signals</li>
                <li>API for models and decision-making</li>
                <li>Normalized data layer</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-lg font-semibold text-slate-900">Power Users</h3>
              <ul className="mt-3 space-y-2 text-slate-700">
                <li>Understand what&apos;s actually likely</li>
                <li>Cut through noise</li>
                <li>Make better decisions</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="py-16">
          <p className="text-sm font-semibold tracking-wide text-slate-500 uppercase">Product Surfaces</p>
          <h2 className="mt-3 max-w-3xl text-3xl leading-tight font-semibold text-slate-900">
            This isn&apos;t just a dashboard. It&apos;s a platform layer for probability.
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {productSurfaces.map((surface) => (
              <div
                key={surface}
                className="rounded-xl border border-slate-200 bg-white/85 p-4 text-slate-800 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {surface}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-slate-900 p-8 text-slate-50 md:p-10">
          <p className="text-sm font-semibold tracking-wide text-slate-300 uppercase">Why Now</p>
          <h2 className="mt-3 max-w-3xl text-3xl leading-tight font-semibold">
            Prediction markets are becoming a core signal, but the infrastructure layer doesn&apos;t exist yet.
          </h2>
          <ul className="mt-6 grid gap-3 text-slate-200 md:grid-cols-3">
            <li className="rounded-xl border border-white/15 bg-white/5 p-4">Markets growing fast</li>
            <li className="rounded-xl border border-white/15 bg-white/5 p-4">Adoption increasing</li>
            <li className="rounded-xl border border-white/15 bg-white/5 p-4">No canonical data layer</li>
          </ul>
        </section>

        <section className="py-16">
          <p className="text-sm font-semibold tracking-wide text-slate-500 uppercase">Vision</p>
          <h2 className="mt-3 max-w-3xl text-3xl leading-tight font-semibold text-slate-900">
            A world where every claim has a probability, every signal has a confidence score, and every source has a
            track record.
          </h2>
        </section>

        <section
          id="final-cta"
          className="rounded-2xl border border-teal-300/50 bg-gradient-to-r from-teal-100 to-cyan-100 p-8 md:p-10"
        >
          <h2 className="text-3xl leading-tight font-bold text-slate-900">Build on the truth layer.</h2>
          <p className="mt-3 max-w-2xl text-slate-700">
            Get early access to real-time event probabilities and confidence signals your team can use today.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800">
              Get API Access
            </button>
            <button className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:bg-slate-50">
              Join Early Access
            </button>
          </div>
        </section>
      </main>

      <div className="fixed right-4 bottom-4 z-40 md:hidden">
        <a
          href="#final-cta"
          className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          Get API Access
        </a>
      </div>
    </>
  );
}
