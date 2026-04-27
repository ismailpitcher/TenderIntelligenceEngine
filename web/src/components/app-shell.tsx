"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.14),_transparent_28%),linear-gradient(180deg,_#eff5ef_0%,_#f8faf8_48%,_#eef2ef_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 px-4 py-4 lg:flex-row lg:px-6">
        <aside className="w-full rounded-[28px] border border-white/80 bg-[#20322b] p-5 text-white shadow-[0_25px_80px_rgba(20,38,33,0.22)] lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-[300px]">
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Pitcher BDR Radar</div>
            <Link href="/" className="block text-3xl font-semibold leading-none tracking-tight">
              {APP_NAME}
            </Link>
            <p className="max-w-xs text-sm leading-6 text-emerald-50/80">
              Local-first signal intelligence for spotting pre-RFP motion before the shortlist is locked.
            </p>
          </div>

          <nav className="mt-8 space-y-2">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition",
                    active
                      ? "bg-white text-slate-900 shadow-[0_10px_40px_rgba(255,255,255,0.12)]"
                      : "text-emerald-50/85 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <span>{item.label}</span>
                  <span className={cn("h-2.5 w-2.5 rounded-full", active ? "bg-emerald-500" : "bg-emerald-200/40")} />
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-[24px] border border-white/12 bg-white/7 p-4 text-sm text-emerald-50/85">
            <div className="text-xs uppercase tracking-[0.18em] text-emerald-100/60">MVP Mode</div>
            <p className="mt-2 leading-6">
              SQLite-backed demo with mock providers, explainable scoring, local exports, and upload-safe workflows.
            </p>
          </div>
        </aside>

        <main className="flex-1 rounded-[32px] border border-white/80 bg-white/88 p-5 shadow-[0_24px_80px_rgba(31,41,55,0.08)] backdrop-blur xl:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
