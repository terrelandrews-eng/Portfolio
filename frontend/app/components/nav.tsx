"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SunIcon, CalendarIcon, ChatIcon, BookIcon, CogIcon, InboxIcon, PlusIcon } from "./icons";

const ITEMS = [
  { href: "/today", label: "Today", Icon: SunIcon },
  { href: "/week", label: "Week", Icon: CalendarIcon },
  { href: "/chat", label: "Chat", Icon: ChatIcon },
  { href: "/knowledge", label: "Knowledge", Icon: BookIcon },
  { href: "/settings", label: "Settings", Icon: CogIcon },
];

export function Nav({
  pendingCount,
  onOpenApprovals,
  onOpenCapture,
}: {
  pendingCount: number;
  onOpenApprovals: () => void;
  onOpenCapture: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-stone-200/70 bg-white/70 px-4 py-6 backdrop-blur md:flex">
        <Link href="/today" className="mb-8 px-2 text-lg font-semibold tracking-tight text-accent">
          LifeOS
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {ITEMS.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-accent/10 font-medium text-accent"
                    : "text-stone-500 hover:bg-stone-100 hover:text-ink"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-1 border-t border-stone-200/70 pt-4">
          <button
            onClick={onOpenApprovals}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-500 transition-colors hover:bg-stone-100 hover:text-ink"
          >
            <InboxIcon className="h-[18px] w-[18px]" />
            Approvals
            {pendingCount > 0 && (
              <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={onOpenCapture}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-500 transition-colors hover:bg-stone-100 hover:text-ink"
            title="Quick capture (⌘K)"
          >
            <PlusIcon className="h-[18px] w-[18px]" />
            Capture
            <kbd className="ml-auto rounded border border-stone-200 bg-stone-50 px-1.5 text-[10px] text-stone-400">
              ⌘K
            </kbd>
          </button>
        </div>
      </aside>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-stretch justify-around border-t border-stone-200/70 bg-white/90 backdrop-blur md:hidden">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
                active ? "font-medium text-accent" : "text-stone-400"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
        <button
          onClick={onOpenApprovals}
          className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-stone-400"
        >
          <InboxIcon className="h-5 w-5" />
          Inbox
          {pendingCount > 0 && (
            <span className="absolute right-[22%] top-1 h-2 w-2 rounded-full bg-amber-500" />
          )}
        </button>
      </nav>
    </>
  );
}
