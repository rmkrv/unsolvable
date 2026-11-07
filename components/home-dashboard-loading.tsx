import { Brand } from "@/components/brand";

export function HomeHeaderSkeleton() {
  return (
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end" aria-label="Loading your greeting">
      <div className="w-full max-w-2xl">
        <div className="skeleton h-3 w-44" />
        <div className="skeleton mt-4 h-12 w-3/4 sm:h-14" />
        <div className="skeleton mt-4 h-4 w-2/3" />
      </div>
      <div className="skeleton hidden h-10 w-32 sm:block" />
    </div>
  );
}

export function PrimarySectionSkeleton() {
  return (
    <section className="mt-9 grid gap-5 xl:grid-cols-[1.45fr_0.85fr]" aria-label="Loading your practice summary">
      <article className="card min-h-[330px] bg-neutral p-7 sm:p-9">
        <div className="skeleton h-5 w-32 opacity-20" />
        <div className="skeleton mt-6 h-12 w-4/5 opacity-20" />
        <div className="skeleton mt-3 h-12 w-2/3 opacity-20" />
        <div className="mt-auto flex items-end justify-between gap-4 pt-10">
          <div className="skeleton h-3 w-36 opacity-20" />
          <div className="skeleton h-12 w-40 opacity-20" />
        </div>
      </article>
      <article className="card card-border bg-base-100 p-6 sm:p-7">
        <div className="flex items-center gap-3"><div className="skeleton size-10" /><div className="flex-1"><div className="skeleton h-3 w-20" /><div className="skeleton mt-2 h-5 w-36" /></div></div>
        <div className="skeleton mt-7 h-28 w-full" />
        <div className="skeleton mt-5 h-4 w-5/6" />
      </article>
    </section>
  );
}

export function FriendsCardSkeleton() {
  return (
    <article className="card card-border min-h-52 bg-base-100 p-6 sm:p-7" aria-label="Loading study partners">
      <div className="skeleton h-3 w-28" />
      <div className="skeleton mt-3 h-6 w-20" />
      <div className="mt-6 flex items-center gap-4"><div className="skeleton size-11 rounded-full" /><div className="flex-1"><div className="skeleton h-4 w-2/3" /><div className="skeleton mt-2 h-3 w-full" /></div></div>
      <div className="skeleton mt-6 h-8 w-full" />
    </article>
  );
}

export function RecentBoardsSkeleton() {
  return (
    <article className="card card-border min-h-52 bg-base-100 p-6 sm:p-7" aria-label="Loading recent boards">
      <div className="flex items-center justify-between"><div><div className="skeleton h-3 w-28" /><div className="skeleton mt-3 h-6 w-36" /></div><div className="skeleton h-8 w-24" /></div>
      <div className="mt-5 space-y-3">
        {[0, 1, 2].map((item) => <div className="flex items-center gap-3" key={item}><div className="skeleton size-11" /><div className="flex-1"><div className="skeleton h-4 w-1/2" /><div className="skeleton mt-2 h-3 w-1/3" /></div></div>)}
      </div>
    </article>
  );
}

export function HomeRouteLoading() {
  return (
    <div className="min-h-screen bg-base-100">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-base-300 bg-base-200 px-6 py-5 lg:block">
        <Brand compact />
        <div className="mt-10 space-y-3">{[0, 1, 2, 3, 4].map((item) => <div className="skeleton h-10 w-full" key={item} />)}</div>
      </aside>
      <div className="lg:pl-72">
        <header className="h-16 border-b border-base-300 bg-base-100 px-5 py-4 sm:px-8"><div className="skeleton h-8 w-32" /></header>
        <main className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 sm:py-10 xl:px-12">
          <HomeHeaderSkeleton />
          <PrimarySectionSkeleton />
          <section className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><FriendsCardSkeleton /><RecentBoardsSkeleton /></section>
        </main>
      </div>
    </div>
  );
}
