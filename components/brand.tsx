import Link from "next/link";

export function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="brand-block no-underline" aria-label="Unsolvable home">
      <div className="brand-mark" aria-hidden="true" />
      <div>
        <div className="brand-name">unsolvable</div>
        {!compact && <div className="brand-subtitle">Mathematical thinking studio</div>}
      </div>
    </Link>
  );
}
