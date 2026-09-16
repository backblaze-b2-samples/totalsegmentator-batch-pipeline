"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useSegmentationStats } from "@/lib/queries";

const chartConfig = {
  mb: { label: "Megabytes", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function AmplificationChart() {
  const { data: stats, isLoading, error, refetch } = useSegmentationStats();

  const data = useMemo(
    () => [
      { name: "Source", mb: stats ? +(stats.source_bytes_total / 1e6).toFixed(1) : 0 },
      { name: "Derived", mb: stats ? +(stats.derived_bytes_total / 1e6).toFixed(1) : 0 },
    ],
    [stats],
  );

  const hasData = !!stats && stats.source_bytes_total > 0;

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Source vs derived bytes</CardTitle>
        <CardDescription className="text-xs">
          Each source volume yields a comparable-size mask plus stats — this is the
          write amplification, in MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !hasData ? (
          <EmptyState
            icon={TrendingUp}
            title="No processed studies yet"
            description="Segment a study to see source and derived bytes compared here."
          />
        ) : (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} tickMargin={6} fontSize={11} width={40} />
              <ChartTooltip cursor={{ fill: "var(--accent-subtle)" }} content={<ChartTooltipContent />} />
              <Bar dataKey="mb" fill="var(--color-mb)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
