"use client";

import Link from "next/link";
import { Layers } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useStudies } from "@/lib/queries";
import { StudyStatusBadge } from "./study-status-badge";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  return (
    <Card>
      <CardContent className="p-0">
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
