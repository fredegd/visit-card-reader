"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function DeleteCardButton({
  cardId,
  className,
  label = "Delete card",
}: {
  cardId: string;
  className?: string;
  label?: string;
}) {
  const [status, setStatus] = useState<"idle" | "deleting" | "error">("idle");
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Delete this card and all associated images?")) {
      return;
    }

    setStatus("deleting");
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to delete.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleDelete}
        className={cn(
          "rounded-full border border-rose-200 px-5 py-2 text-sm font-semibold text-rose-600",
          className,
        )}
        disabled={status === "deleting"}
      >
        {status === "deleting" ? "Deleting..." : label}
      </button>
      {status === "error" ? (
        <span className="text-xs text-rose-600">Delete failed</span>
      ) : null}
    </div>
  );
}
