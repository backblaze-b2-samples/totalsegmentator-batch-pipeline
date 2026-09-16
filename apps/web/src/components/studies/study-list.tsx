"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Layers, Loader2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useInvalidateStudies, useSegmentStudyById, useStudies } from "@/lib/queries";
import { StudyStatusBadge } from "./study-status-badge";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Turning N ingested volumes into N segmented studies is otherwise fully
 * manual (single-source New Study dialog, per-study Segment). This calls the
 * existing per-study `POST /studies/{id}/segment` mutation once per pending
 * study — no new backend endpoint — sequentially, since segmentation is
 * CPU/GPU-bound and this is a single local demo host, not a job queue.
 */
function SegmentAllPendingButton({ pendingIds }: { pendingIds: string[] }) {
  const segmentById = useSegmentStudyById();
  const invalidateStudies = useInvalidateStudies();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  if (pendingIds.length === 0) return null;

  const running = progress !== null;

  const runAll = async () => {
    // Snapshot at click, not the live `pendingIds` prop: each segment call
    // used to invalidate the studies list on its own, which (with this
    // list's polling and re-render) could recompute a shorter `pendingIds`
    // mid-loop and leave a later id never submitted. This fixed array is
    // exactly what gets sent, once each, regardless of any re-render.
    const ids = [...pendingIds];
    setProgress({ done: 0, total: ids.length });
    const failedIds: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      try {
        // skipInvalidate: reconcile once after the whole batch below instead
        // of once per item — the per-item refetch was what let the working
        // set shrink out from under this loop.
        await segmentById.mutateAsync({ studyId: ids[i], skipInvalidate: true });
      } catch {
        failedIds.push(ids[i]);
      }
      setProgress({ done: i + 1, total: ids.length });
    }
    setProgress(null);
    invalidateStudies();
    if (failedIds.length > 0) {
      toast.error(
        `Failed to start: ${failedIds.join(", ")} — still pending, retry from this list`,
      );
    } else {
      toast.success(`Started segmentation for ${ids.length} pending studies`);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={runAll} disabled={running}>
      {running ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Layers className="h-3.5 w-3.5" />
      )}
      {running
        ? `Segmenting ${progress.done}/${progress.total}…`
        : `Segment all pending (${pendingIds.length})`}
    </Button>
  );
}

export function StudyList() {
  const { data: studies, isLoading, error, refetch } = useStudies();

  if (error) {
    return (
      <Card>
        <CardContent className="p-0">
          <ErrorState error={error} onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!studies || studies.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={Layers}
            title="No studies yet"
            description="Ingest a NIfTI volume on the Upload page, then create a study to segment it."
          />
        </CardContent>
      </Card>
    );
  }

  const pendingIds = studies
    .filter((study) => study.status === "pending")
    .map((study) => study.study_id);

  return (
    <Card>
      <CardContent className="p-0">
        {pendingIds.length > 0 && (
          <div className="flex items-center justify-end border-b border-border px-5 py-3">
            <SegmentAllPendingButton pendingIds={pendingIds} />
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Study</TableHead>
              <TableHead>Modality</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Structures</TableHead>
              <TableHead className="text-right">Source</TableHead>
              <TableHead className="text-right">Derived</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {studies.map((study) => (
              <TableRow key={study.study_id}>
                <TableCell className="font-medium">
                  <Link href={`/studies/${study.study_id}`} className="hover:underline">
                    {study.study_id}
                  </Link>
                </TableCell>
                <TableCell>{study.modality}</TableCell>
                <TableCell className="font-mono text-xs">{study.task}</TableCell>
                <TableCell>
                  <StudyStatusBadge status={study.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {study.structure_count ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{study.source_bytes_human}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {study.derived_bytes_human ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatDate(study.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
