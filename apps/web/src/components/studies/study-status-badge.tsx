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
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
