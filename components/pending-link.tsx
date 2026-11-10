"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, type ComponentProps, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

type PendingLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  indicatorClassName?: string;
};

export function PendingLink({
  href,
  children,
  className,
  indicatorClassName,
  prefetch = true,
  onClick,
  ...props
}: PendingLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      pathname === href
    ) return;

    event.preventDefault();
    startTransition(() => router.push(href));
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-busy={isPending || undefined}
      data-pending={isPending || undefined}
      className={cn("relative", className)}
      onClick={navigate}
      onMouseEnter={() => { if (prefetch) router.prefetch(href); }}
      onFocus={() => { if (prefetch) router.prefetch(href); }}
      {...props}
    >
      {children}
      {isPending && (
        <span
          aria-hidden="true"
          className={cn("loading loading-spinner loading-xs shrink-0", indicatorClassName)}
        />
      )}
    </Link>
  );
}
