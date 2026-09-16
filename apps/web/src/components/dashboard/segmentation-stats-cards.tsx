"use client";

import { Activity, HardDrive, Layers, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useSegmentationStats } from "@/lib/queries";

export function SegmentationStatsCards() {
  const { data: stats, isLoading, error, refetch } = useSegmentationStats();

  if (error) {
    return (
      <Card>
        <CardContent className="p-0">
          <ErrorState error={error} onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  const cards = [
    {
      title: "Write amplification",
      value: stats ? `${stats.amplification_ratio.toFixed(2)}×` : "—",
      hint: "derived ÷ source (done studies)",
      icon: TrendingUp,
    },
    {
      title: "Studies processed",
      value: stats ? `${stats.studies_done}` : "0",
      hint: stats ? `of ${stats.studies_total} total` : "of 0 total",
      icon: Layers,
    },
    {
      title: "Structures segmented",
      value: stats?.structures_segmented ?? 0,
      hint: "across all done studies",
      icon: Activity,
    },
    {
      title: "Derived on B2",
      value: stats?.derived_bytes_total_human ?? "0 B",
      hint: stats ? `from ${stats.source_bytes_total_human} source` : "from 0 B source",
      icon: HardDrive,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <Card key={card.title} className={`card-hover animate-fade-in-up stagger-${i + 1}`}>
          <CardHeader className="flex flex-row items-center justify-between pt-4 pb-2 px-4 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className="stat-icon-wrap">
              <card.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pb-5 px-4">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="stat-value">{card.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
