import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadForm } from "@/components/upload/upload-form";

export default function UploadPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="page-title">Bulk Volume Ingest</h1>
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground text-pretty">
            Drag in raw CT/MRI volumes (NIfTI <code>.nii.gz</code>), up to 600 MB
            each. They upload straight to Backblaze B2, then appear as sources when
            you create a study.
          </p>
        </div>
        {/* Persistent, unlike the per-row "Go to Studies" link in the upload
            queue below — that one disappears on reload/revisit, leaving no
            in-context way back to Studies. */}
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/studies">
            Go to Studies
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <UploadForm />
      </div>
    </div>
  );
}
