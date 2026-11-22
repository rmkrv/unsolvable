import type { ReactNode } from "react";

const INLINE_MATH = /\blog_([A-Za-z0-9]+)\(([^()]*)\)|\bsqrt\(([^()]*)\)/g;

export function MathText({ children }: { children: string }) {
  const content: ReactNode[] = [];
  let cursor = 0;

  for (const match of children.matchAll(INLINE_MATH)) {
    const index = match.index ?? 0;
    if (index > cursor) content.push(children.slice(cursor, index));

    const [source, logarithmBase, logarithmArgument, squareRootArgument] = match;
    content.push(
      logarithmBase ? (
        <span
          aria-label={`log base ${logarithmBase} of ${logarithmArgument}`}
          className="inline-flex whitespace-nowrap align-baseline"
          key={`${index}-${source}`}
          role="math"
        >
          <span>log</span>
          <sub className="text-[0.7em] leading-none">{logarithmBase}</sub>
          <span>({logarithmArgument})</span>
        </span>
      ) : (
        <span
          aria-label={`square root of ${squareRootArgument}`}
          className="inline-flex items-start whitespace-nowrap align-[-0.08em]"
          key={`${index}-${source}`}
          role="math"
        >
          <span className="text-[1.12em] leading-none">√</span>
          <span className="border-t border-current px-0.5 leading-none">{squareRootArgument}</span>
        </span>
      ),
    );
    cursor = index + source.length;
  }

  if (cursor < children.length) content.push(children.slice(cursor));
  return <>{content.length ? content : children}</>;
}
