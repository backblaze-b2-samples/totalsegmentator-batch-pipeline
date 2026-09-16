"use client";

import { useRouter } from "next/navigation";
import { Download, Play, Trash2 } from "lucide-react";
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

  if (error) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }
  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" />;
  }

  const { study, stats, mask_url } = data;
  const running = study.status === "running";

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
            <StudyStatusBadge status={study.status} />
          </div>
          {study.description && (
            <p className="text-sm text-muted-foreground">{study.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={runSegmentation} disabled={running || segment.isPending}>
            <Play className="h-3.5 w-3.5" />
            {running ? "Segmenting…" : study.status === "done" ? "Re-segment" : "Segment"}
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
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
