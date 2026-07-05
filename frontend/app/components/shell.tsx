"use client";

// Client shell: sidebar/tab nav, global approvals drawer (polled), quick capture (⌘K),
// and a missing-token hint. Lives under the server layout so next/font stays server-side.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, getToken, Proposal } from "@/lib/api";
import { Nav } from "./nav";
import { ApprovalsDrawer } from "./ApprovalsDrawer";
import { QuickCapture } from "./QuickCapture";

const POLL_MS = 20_000;

export function Shell({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Proposal[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(true);

  const refresh = useCallback(() => {
    if (!getToken()) return;
    api.proposals("pending").then(setPending).catch(() => {});
  }, []);

  useEffect(() => {
    setHasToken(!!getToken());
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // ⌘K / Ctrl-K opens quick capture anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCaptureOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 4000);
  }

  return (
    <>
      <Nav
        pendingCount={pending.length}
        onOpenApprovals={() => {
          refresh();
          setDrawerOpen(true);
        }}
        onOpenCapture={() => setCaptureOpen(true)}
      />

      <div className="md:pl-56">
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 md:px-10 md:pb-12">
          {!hasToken && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No API token set —{" "}
              <Link href="/settings" className="font-medium underline underline-offset-2">
                add it in Settings
              </Link>{" "}
              to connect to the backend.
            </div>
          )}
          {children}
        </div>
      </div>

      <ApprovalsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        proposals={pending}
        onDecided={(id, approved) => {
          setPending((cur) => cur.filter((p) => p.id !== id));
          showFlash(approved ? "Approved." : "Rejected.");
        }}
      />

      <QuickCapture
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onCaptured={(count) => {
          refresh();
          showFlash(`Captured — ${count} item${count === 1 ? "" : "s"} staged for approval.`);
        }}
      />

      {flash && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg md:bottom-8">
          {flash}
        </div>
      )}
    </>
  );
}
