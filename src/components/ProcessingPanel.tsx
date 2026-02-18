"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DeleteCardButton from "@/components/DeleteCardButton";

export default function ProcessingPanel({
  status,
  cardId,
}: {
  status: string;
  cardId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "processing" && status !== "uploaded") return;
    const interval = setInterval(() => {
      router.refresh();
    }, 3000);
    return () => clearInterval(interval);
  }, [router, status]);

  return (
    <div className="rounded-3xl border border-ink-200/70 bg-white/80 p-6 shadow-soft">
      <h2 className="text-xl font-semibold">Processing</h2>
      <p className="mt-2 text-sm text-ink-500">
        OCR is running. This view will refresh automatically.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-full border border-ink-200/70 px-4 py-2 text-xs font-semibold text-ink-700"
        >
          Refresh now
        </button>
        <DeleteCardButton cardId={cardId} label="Delete upload" />
      </div>
    </div>
  );
}
