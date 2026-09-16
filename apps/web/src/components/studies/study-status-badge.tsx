import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Study } from "@totalsegmentator-batch-pipeline/shared";

type Variant = "default" | "secondary" | "destructive" | "outline";

const VARIANT: Record<Study["status"], Variant> = {
  pending: "outline",
  running: "secondary",
  done: "default",
  failed: "destructive",
};

const LABEL: Record<Study["status"], string> = {
  pending: "Pending",
  running: "Segmenting…",
  done: "Done",
  failed: "Failed",
};

export function StudyStatusBadge({ status }: { status: Study["status"] }) {
  if (status === "running") {
    // No server-side percentage exists for a run (coarse status only), so this
    // is deliberately an indeterminate spinner, not a progress bar. role="status"
    // + aria-live announce it the same way the failure path's role="alert" does.
    return (
      <Badge variant={VARIANT[status]} role="status" aria-live="polite">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        {LABEL[status]}
      </Badge>
    );
  }
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
