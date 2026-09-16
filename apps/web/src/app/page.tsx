import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentationStatsCards } from "@/components/dashboard/segmentation-stats-cards";
import { AmplificationChart } from "@/components/dashboard/amplification-chart";
import { RecentStudiesTable } from "@/components/dashboard/recent-studies-table";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Segmentation throughput and the source-to-derived write-amplification
            story on Backblaze B2.
          </p>
        </div>
        <Button asChild size="sm" className="h-8">
          <Link href="/studies">
            <Plus className="h-3.5 w-3.5" />
            New study
          </Link>
        </Button>
      </div>
      <SegmentationStatsCards />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="animate-fade-in-up stagger-3">
          <AmplificationChart />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <RecentStudiesTable />
        </div>
      </div>
    </div>
  );
}
