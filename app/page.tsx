import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Check,
  Circle,
  MousePointer2,
  PenLine,
  Sparkles,
  Users,
} from "lucide-react";
import { Brand } from "@/components/brand";

export default function StartPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-base-100 text-base-content">
      <header className="navbar relative z-20 mx-auto max-w-7xl px-5 py-4 sm:px-8 lg:px-10">
        <div className="navbar-start"><Brand /></div>
        <nav className="navbar-center hidden lg:flex" aria-label="Public navigation">
          <ul className="menu menu-horizontal gap-1 px-1 text-sm font-medium text-base-content/65">
            <li><a href="#practice">Practice</a></li>
            <li><a href="#insight">How it helps</a></li>
            <li><a href="#collaboration">Collaboration</a></li>
          </ul>
        </nav>
        <div className="navbar-end gap-2">
          <Link className="btn btn-ghost btn-sm" href="/auth/sign-in?redirectTo=/home">Sign in</Link>
          <Link className="btn btn-neutral btn-sm hidden sm:inline-flex" href="/auth/sign-up?redirectTo=/home">Create account</Link>
        </div>
      </header>

      <section className="hero min-h-[calc(100svh-76px)] px-5 pb-16 pt-8 sm:px-8 lg:px-10">
        <div className="hero-content mx-auto grid w-full max-w-7xl items-center gap-14 p-0 lg:grid-cols-[0.88fr_1.12fr] lg:gap-20">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-200 px-3 py-1.5 text-xs font-semibold text-base-content/65">
              <Sparkles size={14} className="text-primary" />
              An AI tutor that works on the page with you
            </div>
            <h1 className="text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Stay with the problem long enough to <span className="text-primary">understand it.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-base-content/62 sm:text-xl">
              Think on an open whiteboard. Get precise help at the step that broke down. Build understanding you can use on the next problem.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link className="btn btn-neutral btn-lg" href="/auth/sign-up?redirectTo=/home">
                Start practicing <ArrowRight size={18} />
              </Link>
              <a className="btn btn-ghost btn-lg" href="#practice">See how it works</a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-base-content/55">
              <span className="inline-flex items-center gap-2"><Check size={15} className="text-success" /> No rigid worksheets</span>
              <span className="inline-flex items-center gap-2"><Check size={15} className="text-success" /> Your reasoning stays visible</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-3xl lg:mx-0">
            <div className="absolute -left-10 -top-12 size-52 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-8 size-48 rounded-full bg-warning/10 blur-3xl" />
            <div className="card card-border relative overflow-hidden border-base-300 bg-base-100 shadow-2xl shadow-neutral/10">
              <div className="flex items-center justify-between border-b border-base-300 bg-base-200/80 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5" aria-hidden="true"><Circle size={8} fill="currentColor" className="text-error/60" /><Circle size={8} fill="currentColor" className="text-warning/70" /><Circle size={8} fill="currentColor" className="text-success/70" /></div>
                  <span className="text-xs font-semibold text-base-content/60">Limits and continuity · Board 3</span>
                </div>
                <span className="badge badge-success badge-soft badge-sm gap-1"><span className="status status-success" /> AI ready</span>
              </div>

              <div className="grid min-h-[460px] grid-cols-[52px_1fr] sm:min-h-[520px] sm:grid-cols-[62px_1fr]">
                <div className="flex flex-col items-center gap-3 border-r border-base-300 bg-base-200/55 py-5 text-base-content/55">
                  <button className="btn btn-primary btn-square btn-sm" type="button" aria-label="Pen selected"><PenLine size={17} /></button>
                  <button className="btn btn-ghost btn-square btn-sm" type="button" aria-label="Select"><MousePointer2 size={17} /></button>
                  <button className="btn btn-ghost btn-square btn-sm" type="button" aria-label="Add annotation"><BrainCircuit size={17} /></button>
                </div>

                <div
                  className="relative overflow-hidden p-6 sm:p-9"
                  style={{
                    backgroundImage: "linear-gradient(rgba(23,32,54,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(23,32,54,.035) 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                  }}
                >
                  <div className="max-w-lg font-mono text-[1.05rem] leading-8 text-base-content sm:text-xl sm:leading-9">
                    <p className="mb-6 font-sans text-xs font-bold uppercase tracking-[0.16em] text-base-content/38">Show that the limit exists</p>
                    <p>lim <span className="text-sm">x→2</span> <span className="ml-2">(x² − 4) / (x − 2)</span></p>
                    <p className="mt-5">= <span className="ml-3 line-through decoration-error/70 decoration-2">(x − 2)² / (x − 2)</span></p>
                    <p className="mt-6 text-primary">= (x − 2)(x + 2) / (x − 2)</p>
                    <p className="mt-3 text-primary">= x + 2 → 4</p>
                  </div>

                  <div className="absolute bottom-5 left-5 right-5 rounded-box border border-primary/20 bg-base-100/95 p-4 shadow-lg shadow-neutral/8 backdrop-blur sm:bottom-7 sm:left-auto sm:right-7 sm:max-w-sm">
                    <div className="flex gap-3">
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-content"><Sparkles size={15} /></div>
                      <div>
                        <p className="text-sm font-semibold">The factorization changed one term.</p>
                        <p className="mt-1 text-xs leading-5 text-base-content/60">Try factoring the difference of squares before cancelling. Your limit idea is right.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="practice" className="border-y border-base-300 bg-base-200/55 px-5 py-24 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">One learning loop</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Think freely. Diagnose precisely. Practice deliberately.</h2>
            <p className="mt-5 text-base leading-7 text-base-content/60">Unsolvable keeps the board, the evidence, and the next useful problem in one place—without replacing the work of thinking.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <article className="card card-border bg-base-100 sm:col-span-2">
              <div className="card-body sm:flex-row sm:items-center sm:gap-8">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-box bg-neutral text-neutral-content"><PenLine size={22} /></div>
                <div className="flex-1"><h3 className="card-title text-lg">Practice on a real whiteboard</h3><p className="mt-2 leading-6 text-base-content/58">Draw, write, rearrange, explain aloud, and ask for a check without converting your reasoning into a form.</p></div>
                <ArrowRight className="hidden text-base-content/35 sm:block" size={20} />
              </div>
            </article>
            <article id="insight" className="card card-border bg-base-100">
              <div className="card-body">
                <div className="flex size-10 items-center justify-center rounded-box bg-warning/12 text-warning"><BrainCircuit size={20} /></div>
                <h3 className="card-title mt-3">Find the step, not a label</h3>
                <p className="leading-6 text-base-content/58">See the evidence behind a weak spot and the exact kind of problem that can strengthen it.</p>
              </div>
            </article>
            <article id="collaboration" className="card card-border bg-base-100">
              <div className="card-body">
                <div className="flex size-10 items-center justify-center rounded-box bg-success/12 text-success"><Users size={20} /></div>
                <h3 className="card-title mt-3">Work beside another mind</h3>
                <p className="leading-6 text-base-content/58">Invite a study partner to the same board and keep every correction connected to the work.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl text-center">
          <BadgeCheck className="mx-auto text-primary" size={30} />
          <h2 className="mt-5 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Serious help for difficult material.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-base-content/60">Built for the stretch from upper-secondary mathematics into the first demanding university courses—and clear enough to meet a younger learner where they are.</p>
          <Link className="btn mt-8" href="/auth/sign-up?redirectTo=/home">Create your workspace <ArrowRight size={17} /></Link>
        </div>
      </section>

      <footer className="footer footer-center border-t border-base-300 bg-base-200 px-6 py-10 text-center text-base-content/55">
        <Brand compact />
        <nav className="flex flex-wrap justify-center gap-5 text-sm">
          <a className="link link-hover" href="#practice">Product</a>
          <a className="link link-hover" href="#">Privacy</a>
          <a className="link link-hover" href="#">Terms</a>
        </nav>
        <p className="text-xs">© 2026 Unsolvable</p>
      </footer>
    </main>
  );
}
