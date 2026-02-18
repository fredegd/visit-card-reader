import { cn } from "@/lib/utils";
import type { CardStatus } from "@/lib/types";

const statusStyles: Record<CardStatus, string> = {
  uploaded: "bg-amber-100 text-amber-900 border-amber-200",
  processing: "bg-blue-100 text-blue-900 border-blue-200",
  ready: "bg-emerald-100 text-emerald-900 border-emerald-200",
  error: "bg-rose-100 text-rose-900 border-rose-200",
};

export default function CardStatusBadge({ status }: { status: CardStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize",
        statusStyles[status],
      )}
    >
      {status}
    </span>
  );
}
