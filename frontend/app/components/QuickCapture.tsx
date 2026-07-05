"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button, friendlyError } from "./ui";
import { SparkIcon } from "./icons";

export function QuickCapture({
  open,
  onClose,
  onCaptured,
}: {
  open: boolean;
  onClose: () => void;
  onCaptured: (count: number) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setTimeout(() => ref.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  async function submit() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.capture(t);
      setText("");
      onCaptured(res.proposals.length);
      onClose();
    } catch (e) {
      setError(friendlyError(String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center p-4 pt-[18vh]" role="dialog" aria-label="Quick capture">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center gap-2 text-accent">
          <SparkIcon className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Capture a thought</h2>
        </div>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            if (e.key === "Escape") onClose();
          }}
          rows={3}
          placeholder="Sarah wants to try the new Thai place…"
          className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <p className="mt-1 text-xs text-stone-400">
          Turned into a staged task, note, or observation — nothing saved until you approve it.
        </p>
        {error && <p className="mt-2 text-xs text-amber-700">{error}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !text.trim()}>
            {busy ? "Capturing…" : "Capture"}
          </Button>
        </div>
      </div>
    </div>
  );
}
