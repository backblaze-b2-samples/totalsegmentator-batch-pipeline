"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useDeleteStudy,
  useSegmentStudy,
  useStudyDetail,
  useStudyMaskDownload,
  useStudySourceDownload,
} from "@/lib/queries";
import { StudyStatusBadge } from "./study-status-badge";
import { EditStudyDialog } from "./study-form";

// mm:ss — no server-side percentage exists for a run, so an elapsed clock is
// the honest thing to show advancing, not a fabricated progress fraction.
function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function download(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function StudyDetail({ studyId }: { studyId: string }) {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useStudyDetail(studyId);
  const segment = useSegmentStudy(studyId);
  const removeStudy = useDeleteStudy();
  const maskDownload = useStudyMaskDownload();
  const sourceDownload = useStudySourceDownload();

  // Drive the busy UI from the mutation itself (optimistic), not just the
  // polled study status — `running` only flips true after the create/segment
  // round trip refetches, which left the button reading "Segment" for
  // several seconds after it was already disabled. Computed above the early
  // returns (with data?. guards) because the elapsed-time effect below must
  // stay an unconditional hook call.
  const busy = data?.study.status === "running" || segment.isPending;

  // No server-side run-start timestamp exists, so "when the run started" is
  // tracked client-side: the first moment this page observes `busy`. Ticks
  // once a second only while busy, and resets when the run ends.
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!busy) {
      // No setState here: the elapsed label is only rendered while `running`
      // below, so a stale value sitting unused in state is harmless — the
      // `tick()` call right after the next start immediately overwrites it
      // before it's ever shown.
      startedAtRef.current = null;
      return;
    }
    if (startedAtRef.current === null) startedAtRef.current = Date.now();
    const tick = () => setElapsedMs(Date.now() - (startedAtRef.current as number));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [busy]);

  if (error) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }
  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" />;
  }

  const { study, stats, mask_url } = data;
  const running = study.status === "running";
  // The status badge used to read `study.status` directly, so it kept saying
  // "Pending" for the same 3-5s gap the button used to show "Segment" for —
  // drive it from the same `busy` signal instead.
  const displayStatus = busy && study.status === "pending" ? "running" : study.status;

  const runSegmentation = async () => {
    try {
      await segment.mutateAsync(undefined);
      toast.success("Segmentation started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start segmentation");
    }
  };

  const doDelete = async () => {
    try {
      await removeStudy.mutateAsync(studyId);
      toast.success("Study deleted");
      router.push("/studies");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete study");
    }
  };

  const downloadSource = async () => {
    const res = await sourceDownload.mutateAsync(studyId);
    download(res.url);
  };
  const downloadMask = async () => {
    const res = await maskDownload.mutateAsync(studyId);
    download(res.url);
  };

  const facts: [string, string][] = [
    ["Modality", study.modality],
    ["Task", study.task],
    ["Resolution", study.fast ? "Fast (3 mm)" : "Full (1.5 mm)"],
    ["Structures", study.structure_count !== null ? String(study.structure_count) : "—"],
    ["Source size", study.source_bytes_human],
    ["Derived size", study.derived_bytes_human ?? "—"],
    ["Patient label", study.patient_label ?? "—"],
    ["Created", new Date(study.created_at).toLocaleString()],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{study.study_id}</h1>
            <StudyStatusBadge status={displayStatus} />
          </div>
          {study.description && (
            <p className="text-sm text-muted-foreground">{study.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={runSegmentation} disabled={busy}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {busy ? "Segmenting…" : study.status === "done" ? "Re-segment" : "Segment"}
          </Button>
          <EditStudyDialog study={study} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this study?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the record and every object under{" "}
                  <code>studies/{study.study_id}/</code> — source volume, mask and
                  stats. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={doDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {study.status === "failed" && study.error && (
        <Alert variant="destructive">
          <AlertTitle>Segmentation failed</AlertTitle>
          <AlertDescription>{study.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Study</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="space-y-0.5">
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Artifacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadSource}
              disabled={sourceDownload.isPending}
            >
              <Download className="h-3.5 w-3.5" />
              Source volume
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={downloadMask}
              disabled={!mask_url || maskDownload.isPending}
            >
              <Download className="h-3.5 w-3.5" />
              Segmentation mask
            </Button>
            <p className="text-xs text-muted-foreground">
              Masks and stats are written back to B2 under this study&apos;s prefix.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">Per-structure volumetrics</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stats && stats.structures.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Structure</TableHead>
                  <TableHead className="text-right">Volume (mL)</TableHead>
                  <TableHead className="text-right">Voxels</TableHead>
                  <TableHead className="text-right">HU mean</TableHead>
                  <TableHead className="text-right">HU std</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.structures.map((structure) => (
                  <TableRow key={structure.label_id}>
                    <TableCell className="font-medium">{structure.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {structure.volume_ml.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {structure.voxel_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {structure.hu_mean !== null ? structure.hu_mean.toFixed(1) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {structure.hu_std !== null ? structure.hu_std.toFixed(1) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={Play}
              title={running ? "Segmenting…" : "No stats yet"}
              description={
                running
                  ? "Volumetrics appear here when the run finishes."
                  : "Run segmentation to compute per-structure volumetrics."
              }
              action={
                running ? (
                  <div className="flex flex-col items-center gap-2">
                    {/* No server-side percentage exists, so this is deliberately
                        indeterminate (same `.progress-indeterminate` sweep already
                        used for the analogous no-percentage wait in upload-progress.tsx). */}
                    <div
                      role="status"
                      aria-live="polite"
                      aria-label="Segmentation running"
                      className="progress-indeterminate h-1 w-40 rounded-full"
                    />
                    {/* An advancing elapsed clock, not a fabricated percentage —
                        a 30-90s run with only a static sweep can look frozen.
                        Plain text (no aria-live): announcing a per-second tick
                        would spam screen readers. */}
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      Segmenting… {formatElapsed(elapsedMs)}
                    </span>
                  </div>
                ) : undefined
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
