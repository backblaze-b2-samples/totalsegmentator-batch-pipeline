"use client";

import Link from "next/link";
import { Layers } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useStudies } from "@/lib/queries";
import { StudyStatusBadge } from "@/components/studies/study-status-badge";

export function RecentStudiesTable() {
  const { data: studies, isLoading, error, refetch } = useStudies();

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Recent studies</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !studies || studies.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No studies yet"
            description="Create a study to start segmenting."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Study</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Structures</TableHead>
                <TableHead className="text-right">Derived</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studies.slice(0, 8).map((study) => (
                <TableRow key={study.study_id}>
                  <TableCell className="font-medium">
                    <Link href={`/studies/${study.study_id}`} className="hover:underline">
                      {study.study_id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StudyStatusBadge status={study.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {study.structure_count ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {study.derived_bytes_human ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
