import Link from "next/link";

import AppShell from "@/components/AppShell";
import FeatureCard from "@/components/FeatureCard";
import GeometricBackground from "@/components/GeometricBackground";
import NoticeBanner from "@/components/NoticeBanner";

const BANKS = ["AUB", "PNB", "Landbank", "Metrobank", "BDO", "Security Bank"];

export default function Home() {
  return (
    <>
      <GeometricBackground />
      <AppShell>
        {/* Left-aligned hero */}
        <div className="animate-fade-up max-w-2xl pt-8">
          <p
            className="label-micro animate-fade-up text-ink-muted"
            style={{ animationDelay: "40ms" }}
          >
            Philippines · PHP
          </p>
          <h1
            className="animate-fade-up mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl"
            style={{ animationDelay: "100ms" }}
          >
            PH Cheque Writer
          </h1>
          <p
            className="animate-fade-up mt-4 text-base leading-relaxed text-ink-muted"
            style={{ animationDelay: "160ms" }}
          >
            Fill in your cheque details once and print them exactly where your
            bank&apos;s pre-printed form expects them.
          </p>
          <div className="animate-fade-up mt-8" style={{ animationDelay: "220ms" }}>
            <Link
              href="/system"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-red px-8 text-base font-semibold text-cream shadow-sm transition-all hover:-translate-y-0.5 hover:bg-red/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
            >
              Get Started
            </Link>
          </div>
          <div
            className="animate-fade-up mt-10 flex flex-wrap items-center gap-2"
            style={{ animationDelay: "280ms" }}
          >
            {BANKS.map((bank) => (
              <span
                key={bank}
                className="rounded-full border border-line bg-surface px-4 py-1.5 font-mono text-xs text-ink-muted"
              >
                {bank}
              </span>
            ))}
          </div>
        </div>

        {/* Feature cards */}
        <div
          className="animate-fade-up mt-14 grid gap-4 sm:grid-cols-3"
          style={{ animationDelay: "340ms" }}
        >
          <FeatureCard accent="red" title="Visual editor">
            Edit the date, payee, amount, and crossing directly on your own
            cheque scan — drag any field into place.
          </FeatureCard>
          <FeatureCard accent="teal" title="Printer calibration">
            Per-bank offsets and a test grid make every printer line up with
            your stock.
          </FeatureCard>
          <FeatureCard accent="navy" title="Local & private">
            Payees, images, and calibrations never leave this browser. Export a
            JSON backup anytime.
          </FeatureCard>
        </div>

        <div
          className="animate-fade-up mt-10"
          style={{ animationDelay: "400ms" }}
        >
          <NoticeBanner>
            Print at 100% / Actual Size, margins None. Test on plain paper
            first. Not affiliated with any bank.
          </NoticeBanner>
        </div>
      </AppShell>
    </>
  );
}
