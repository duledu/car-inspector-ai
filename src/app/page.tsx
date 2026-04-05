'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#080c14] text-white overflow-x-hidden">

      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute top-[30%] right-[-15%] w-[500px] h-[500px] rounded-full bg-blue-600/6 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[700px] h-[400px] rounded-full bg-indigo-500/4 blur-[140px]" />
      </div>

      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#080c14]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
          <Link href="/" className="text-white font-semibold tracking-tight text-lg shrink-0">
            <span className="text-cyan-400">Used Car</span> Inspector AI
          </Link>

          <div className="flex flex-wrap gap-1 items-center text-sm text-slate-400">
            {[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Vehicle', href: '/vehicle' },
              { label: 'Inspection', href: '/inspection' },
              { label: 'Report', href: '/report' },
              { label: 'Premium', href: '/premium' },
              { label: 'Community', href: '/community' },
              { label: 'Messages', href: '/messages' },
              { label: 'Profile', href: '/profile' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-all duration-200"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex gap-2 shrink-0">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm text-slate-300 border border-white/10 rounded-xl hover:border-white/20 hover:text-white transition-all duration-200"
            >
              Dashboard
            </Link>
            <Link
              href="/inspection"
              className="px-4 py-2 text-sm font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 rounded-xl hover:bg-cyan-500/20 hover:border-cyan-400/40 transition-all duration-200"
            >
              Start Inspection
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO — full-viewport with cinematic video background */}
      <section className="relative min-h-screen flex items-center overflow-hidden">

        {/* Cinematic video background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1920&q=80&fit=crop"
          className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none"
        >
          {/* Add your video source here, e.g.: <source src="/hero.mp4" type="video/mp4" /> */}
        </video>

        {/* Dark gradient overlays for legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#080c14] via-[#080c14]/90 to-[#080c14]/50 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080c14] via-transparent to-[#080c14]/70 pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 text-xs font-medium tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>AI-Powered Vehicle Intelligence</span>
              </div>

              <h1 className="text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08]">
                Buy used cars<br />
                <span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-indigo-300 bg-clip-text text-transparent">
                  with confidence.
                </span>
              </h1>

              <p className="text-slate-400 text-lg leading-relaxed max-w-lg">
                AI-guided inspection workflow, smart risk analysis, and optional premium vehicle history intelligence — all in one modular platform built for informed buyers.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/inspection"
                  className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-sm rounded-2xl transition-all duration-200 shadow-lg shadow-cyan-500/20"
                >
                  Start Free Inspection
                </Link>
                <Link
                  href="/dashboard"
                  className="px-6 py-3 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white text-sm font-medium rounded-2xl transition-all duration-200 backdrop-blur-sm bg-white/3"
                >
                  View Dashboard
                </Link>
              </div>

              <p className="text-xs text-slate-600">No account required to start. Premium reports available as optional add-ons.</p>
            </div>

            {/* UI Mockup */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-cyan-500/8 blur-3xl rounded-full" />
              <div className="relative space-y-3">
                {/* Main card */}
                <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-5 space-y-4 shadow-xl shadow-black/30">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 font-medium">VEHICLE</div>
                      <div className="text-white font-semibold">2019 BMW 3 Series</div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                      Risk: Low
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>AI Confidence Score</span>
                      <span className="text-cyan-400 font-medium">87 / 100</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full w-[87%] bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Engine', score: '92' },
                      { label: 'Body', score: '78' },
                      { label: 'Interior', score: '88' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-white/4 border border-white/8 p-3 text-center">
                        <div className="text-white font-bold text-lg">{item.score}</div>
                        <div className="text-slate-500 text-xs">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status pills row */}
                <div className="flex gap-2">
                  <div className="flex-1 rounded-2xl border border-white/8 bg-white/4 backdrop-blur-sm p-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs text-slate-400">No major issues found</span>
                  </div>
                  <div className="flex-1 rounded-2xl border border-amber-500/15 bg-amber-500/5 backdrop-blur-sm p-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs text-slate-400">2 minor flags</span>
                  </div>
                </div>

                {/* Premium block */}
                <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/8 to-blue-500/5 backdrop-blur-sm p-5 space-y-3 shadow-lg shadow-cyan-500/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-cyan-300 tracking-wide">PREMIUM HISTORY REPORT</span>
                    <span className="text-xs text-slate-500">Optional add-on</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {['Ownership History', 'Accident Records', 'Service Log', 'Title Check'].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/60" />
                        <span className="text-xs text-slate-400">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="h-px bg-white/5" />
                  <div className="text-xs text-slate-500">Unlock deeper intelligence for this vehicle</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="border-y border-white/5 bg-white/1">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { stat: '124K+', label: 'Inspections Analyzed', desc: 'Across all vehicle types and markets' },
              { stat: '89K', label: 'Risk Signals Identified', desc: 'Hidden issues surfaced before purchase' },
              { stat: '31K', label: 'Premium Reports Unlocked', desc: 'Deep history intelligence accessed' },
              { stat: '96%', label: 'Buyer Confidence Supported', desc: 'Decisions backed by AI data' },
            ].map((item) => (
              <div key={item.stat} className="rounded-2xl border border-white/6 bg-white/2 p-6 space-y-2">
                <div className="text-3xl font-bold text-white tracking-tight">{item.stat}</div>
                <div className="text-sm font-medium text-slate-300">{item.label}</div>
                <div className="text-xs text-slate-600 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-6 py-28">
        <div className="text-center space-y-4 mb-16">
          <div className="text-xs font-medium text-cyan-400 tracking-widest uppercase">Platform Capabilities</div>
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">Built for serious buyers</h2>
          <p className="text-slate-500 max-w-lg mx-auto text-sm leading-relaxed">
            Every layer of the platform is designed to give you a cleaner, more confident view of any used vehicle.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: 'AI Risk Scoring',
              desc: 'Our engine processes inspection inputs across dozens of vectors to produce a calibrated risk score with category breakdowns.',
              href: '/inspection',
              cta: 'Run inspection',
              accent: 'cyan',
            },
            {
              title: 'Guided Vehicle Inspection',
              desc: 'A structured step-by-step inspection flow that surfaces what to look for and records your findings systematically.',
              href: '/inspection',
              cta: 'Start inspecting',
              accent: 'blue',
            },
            {
              title: 'Premium Vehicle History Reports',
              desc: 'Optional deep-dive history intelligence: ownership chain, accident records, service history, and title verification.',
              href: '/premium',
              cta: 'Learn about premium',
              accent: 'indigo',
            },
            {
              title: 'Final Confidence Report',
              desc: 'A compiled, exportable report combining your inspection data and optional history intelligence into one clear verdict.',
              href: '/report',
              cta: 'View report format',
              accent: 'cyan',
            },
            {
              title: 'Community Posts & Advice',
              desc: 'Browse real discussions from other buyers. Share findings, ask questions, get advice on specific makes and models.',
              href: '/community',
              cta: 'Explore community',
              accent: 'blue',
            },
            {
              title: 'Private Messaging',
              desc: 'Connect directly with other users — discuss vehicles, share insights, or coordinate on shared inspection data.',
              href: '/messages',
              cta: 'Open messages',
              accent: 'indigo',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="group rounded-3xl border border-white/6 bg-white/2 hover:bg-white/4 hover:border-white/10 p-6 space-y-4 transition-all duration-300"
            >
              <div className={`w-8 h-1 rounded-full ${
                feature.accent === 'cyan' ? 'bg-cyan-400' :
                feature.accent === 'blue' ? 'bg-blue-400' : 'bg-indigo-400'
              }`} />
              <h3 className="text-white font-semibold text-base">{feature.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{feature.desc}</p>
              <Link
                href={feature.href}
                className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  feature.accent === 'cyan' ? 'text-cyan-400/70 hover:text-cyan-300' :
                  feature.accent === 'blue' ? 'text-blue-400/70 hover:text-blue-300' : 'text-indigo-400/70 hover:text-indigo-300'
                }`}
              >
                {feature.cta}
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y border-white/5 bg-gradient-to-b from-transparent via-white/1 to-transparent">
        <div className="max-w-7xl mx-auto px-6 py-28">
          <div className="text-center space-y-4 mb-16">
            <div className="text-xs font-medium text-cyan-400 tracking-widest uppercase">Workflow</div>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">Four steps to a confident decision</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                step: '01',
                title: 'Add your vehicle',
                desc: 'Enter the vehicle details or select from your saved list. The platform anchors all data to this specific vehicle.',
                href: '/vehicle',
              },
              {
                step: '02',
                title: 'Run the inspection',
                desc: 'Work through the guided inspection flow. Your findings are recorded and scored by the AI engine in real time.',
                href: '/inspection',
              },
              {
                step: '03',
                title: 'Unlock premium history',
                desc: 'Optionally add a premium vehicle history report for deeper intelligence. Separate from your free inspection flow.',
                href: '/premium',
              },
              {
                step: '04',
                title: 'Review your verdict',
                desc: 'A final confidence report synthesizes everything. Clear, structured, and ready to inform your buying decision.',
                href: '/report',
              },
            ].map((item, i) => (
              <Link key={item.step} href={item.href} className="group">
                <div className="rounded-3xl border border-white/6 bg-white/2 group-hover:bg-white/4 group-hover:border-white/10 p-6 space-y-4 transition-all duration-300 h-full">
                  <div className="text-4xl font-bold text-white/6 tracking-tighter">{item.step}</div>
                  <h3 className="text-white font-semibold">{item.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                  {i < 3 && (
                    <div className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 text-white/10 text-2xl">→</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PREMIUM REPORT */}
      <section className="max-w-7xl mx-auto px-6 py-28">
        <div className="rounded-3xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/4 via-transparent to-blue-500/4 overflow-hidden">
          <div className="grid lg:grid-cols-2 gap-0">
            <div className="p-10 lg:p-14 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium">
                Optional Premium Add-on
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
                Go deeper with<br />
                <span className="bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                  premium history intelligence
                </span>
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed max-w-md">
                The free inspection workflow gives you a strong foundation. Premium vehicle history reports are a separate, optional layer — unlocking ownership chains, accident records, service logs, and title verification for the specific vehicle you&apos;re evaluating.
              </p>
              <ul className="space-y-2">
                {[
                  'Not required for the free inspection',
                  'Tied to a specific vehicle record',
                  'Unlocks historical data unavailable in inspections',
                  'Integrated into your final confidence report',
                  'Accessible from vehicle view or report page',
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-slate-400">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/premium"
                  className="px-5 py-2.5 bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-400/40 rounded-xl text-sm font-medium transition-all duration-200"
                >
                  Learn about Premium
                </Link>
                <Link
                  href="/vehicle"
                  className="px-5 py-2.5 border border-white/8 text-slate-400 hover:text-white hover:border-white/16 rounded-xl text-sm font-medium transition-all duration-200"
                >
                  View Your Vehicles
                </Link>
              </div>
            </div>

            <div className="p-10 lg:p-14 flex items-center">
              <div className="w-full space-y-3">
                <div className="text-xs text-slate-600 font-medium tracking-wide mb-4">PREMIUM REPORT INCLUDES</div>
                {[
                  { label: 'Ownership & Title History', available: true },
                  { label: 'Accident & Damage Records', available: true },
                  { label: 'Service & Maintenance Log', available: true },
                  { label: 'Odometer Verification', available: true },
                  { label: 'Theft & Recall Alerts', available: true },
                  { label: 'Market Value Comparison', available: true },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-white/4">
                    <span className="text-sm text-slate-400">{item.label}</span>
                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Included
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM ACCESS */}
      <section className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-28">
          <div className="text-center space-y-4 mb-16">
            <div className="text-xs font-medium text-cyan-400 tracking-widest uppercase">Platform</div>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">Access every layer</h2>
            <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
              The platform is modular. Every section is purpose-built for a different layer of the buying process.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { title: 'Dashboard', href: '/dashboard', desc: 'Overview of your inspections, vehicles, and activity at a glance.' },
              { title: 'Vehicles', href: '/vehicle', desc: 'Manage and track the vehicles you are evaluating or have inspected.' },
              { title: 'Inspection', href: '/inspection', desc: 'Launch a guided AI inspection for any vehicle in your list.' },
              { title: 'Reports', href: '/report', desc: 'View your compiled confidence reports with full inspection breakdowns.' },
              { title: 'Premium', href: '/premium', desc: 'Unlock optional vehicle history intelligence for deeper analysis.' },
              { title: 'Community', href: '/community', desc: 'Join discussions, browse advice, and share inspection findings.' },
              { title: 'Messages', href: '/messages', desc: 'Private conversations with other users on the platform.' },
              { title: 'Profile', href: '/profile', desc: 'Manage your account, preferences, and saved data.' },
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-2xl border border-white/6 bg-white/2 hover:bg-cyan-500/5 hover:border-cyan-500/20 p-5 space-y-3 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-medium text-sm">{card.title}</h3>
                  <span className="text-white/20 group-hover:text-cyan-400/60 transition-colors text-lg">→</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed group-hover:text-slate-500 transition-colors">{card.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* COMMUNITY */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="rounded-3xl border border-white/6 bg-white/2 p-10 lg:p-14">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-5">
              <div className="text-xs font-medium text-cyan-400 tracking-widest uppercase">Community Layer</div>
              <h2 className="text-3xl font-bold tracking-tight">Learn from others buying used cars</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                The platform includes a full community layer — discuss specific vehicles, share your inspection findings, ask questions about makes and models, and message users directly. Collective intelligence improves your individual decisions.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/community"
                  className="px-5 py-2.5 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white text-sm font-medium rounded-xl transition-all duration-200"
                >
                  Browse Community
                </Link>
                <Link
                  href="/messages"
                  className="px-5 py-2.5 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white text-sm font-medium rounded-xl transition-all duration-200"
                >
                  Open Messages
                </Link>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { user: 'M.K.', text: 'Found hidden frame damage on a 2018 Civic using the inspection checklist. Saved me thousands.', time: '2h ago' },
                { user: 'R.A.', text: 'The AI risk score flagged the engine before the mechanic even looked at it. Accurate.', time: '5h ago' },
                { user: 'J.B.', text: 'Premium report showed 3 previous owners that the seller never mentioned. Worth every cent.', time: '1d ago' },
              ].map((post) => (
                <div key={post.user} className="rounded-2xl border border-white/5 bg-white/2 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400/30 to-blue-400/30 border border-white/10 flex items-center justify-center text-xs font-medium text-cyan-300">
                        {post.user[0]}
                      </div>
                      <span className="text-xs font-medium text-slate-400">{post.user}</span>
                    </div>
                    <span className="text-xs text-slate-700">{post.time}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{post.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="max-w-7xl mx-auto px-6 py-28">
        <div className="relative rounded-3xl border border-white/6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/6 via-transparent to-blue-500/6" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-3xl rounded-full" />
          <div className="relative text-center py-20 px-6 space-y-6">
            <div className="text-xs font-medium text-cyan-400 tracking-widest uppercase">Get Started</div>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight max-w-2xl mx-auto leading-tight">
              Your next used car decision<br />
              <span className="bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                deserves better data.
              </span>
            </h2>
            <p className="text-slate-500 max-w-lg mx-auto text-sm leading-relaxed">
              Start with a free AI-guided inspection. Add premium history intelligence when you need it. Know what you&apos;re buying before you sign anything.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link
                href="/inspection"
                className="px-7 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-sm rounded-2xl transition-all duration-200 shadow-lg shadow-cyan-500/20"
              >
                Start Free Inspection
              </Link>
              <Link
                href="/premium"
                className="px-7 py-3.5 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white text-sm font-medium rounded-2xl transition-all duration-200"
              >
                Explore Premium
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div className="space-y-4 lg:col-span-1">
              <div className="text-white font-semibold tracking-tight">
                <span className="text-cyan-400">Used Car</span> Inspector AI
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-xs">
                AI-powered inspection intelligence for smarter used car buying decisions. Free inspection workflow. Optional premium history add-ons.
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Inspect</div>
              {[
                { label: 'Start Inspection', href: '/inspection' },
                { label: 'My Vehicles', href: '/vehicle' },
                { label: 'View Reports', href: '/report' },
                { label: 'Premium History', href: '/premium' },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="block text-sm text-slate-600 hover:text-slate-400 transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="space-y-3">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Platform</div>
              {[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'Community', href: '/community' },
                { label: 'Messages', href: '/messages' },
                { label: 'Profile', href: '/profile' },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="block text-sm text-slate-600 hover:text-slate-400 transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="space-y-3">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Account</div>
              {[
                { label: 'Sign In / Register', href: '/auth' },
                { label: 'Profile Settings', href: '/profile' },
                { label: 'Dashboard', href: '/dashboard' },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="block text-sm text-slate-600 hover:text-slate-400 transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="border-t border-white/5 pt-6 flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs text-slate-700">Used Car Inspector AI — AI-guided automotive intelligence platform.</span>
            <div className="flex gap-4">
              <Link href="/auth" className="text-xs text-slate-700 hover:text-slate-500 transition-colors">Sign In</Link>
              <Link href="/inspection" className="text-xs text-slate-700 hover:text-slate-500 transition-colors">Start Free</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
